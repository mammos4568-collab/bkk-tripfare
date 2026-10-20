import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppError } from './errors.js';
import { adminRouter } from './routes/admin.js';
import { authRouter, meRouter } from './routes/auth.js';
import { meetupRouter } from './routes/meetup.js';
import { reportsRouter } from './routes/reports.js';
import { linesRouter, networkRouter, stopsRouter } from './routes/stops.js';
import { tripsRouter } from './routes/trips.js';

/**
 * โดเมนรูปแผนที่ (tile) ที่หน้าเว็บโหลดได้ — ถ้าเปลี่ยนผู้ให้บริการแผนที่ (VITE_TILE_URL ใน client)
 * ต้องเพิ่มโดเมนที่นี่ด้วย ไม่งั้น CSP จะบล็อกรูปแผนที่ตอน production
 */
export const TILE_HOSTS = ['https://tile.openstreetmap.org', 'https://*.basemaps.cartocdn.com'];

export function createApp({ planner, config }) {
  const app = express();

  // อยู่หลัง proxy ของ Render / Railway → ให้ req.ip เป็น IP จริงของผู้ใช้ (rate limit จะได้ไม่นับรวมกัน)
  app.set('trust proxy', 1);

  // header ความปลอดภัยพื้นฐาน (CSP อนุญาตรูปแผนที่จาก TILE_HOSTS เพิ่มจากค่าเริ่มต้น)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'img-src': ["'self'", 'data:', ...TILE_HOSTS] },
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // เพื่อน: บันทึก security_events kind 'rate_limited' ตรงนี้
      handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'เรียกใช้งานถี่เกินไป กรุณารอสักครู่')),
    }),
  );

  // เพื่อน: ตั้ง session (express-session + connect-pg-simple) ตรงนี้ ก่อน route ด้านล่าง

  // ---------- API ----------
  // คนหลัก: หน้าเว็บผู้ใช้
  app.get('/api/health', (req, res) => res.json({ status: 'ok', ...planner.info() }));
  app.use('/api/network', networkRouter(planner));
  app.use('/api/stops', stopsRouter(planner));
  app.use('/api/lines', linesRouter(planner));
  app.use('/api/trips', tripsRouter(planner));
  app.use('/api/meetup', meetupRouter(planner)); // ถ้ามีเวลา
  // เพื่อน: เข้าสู่ระบบและแอดมิน
  app.use('/api/auth', authRouter());
  app.use('/api/me', meRouter());
  app.use('/api/reports', reportsRouter()); // ถ้ามีเวลา
  app.use('/api/admin', adminRouter());

  app.use('/api', (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'ไม่พบ endpoint นี้')));

  // ---------- หน้าเว็บ (production) ----------
  // ตอน deploy server เสิร์ฟไฟล์ที่ build แล้วจาก client/dist เอง ทั้งเว็บจึงอยู่ในบริการเดียว
  if (config.env === 'production' && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

// eslint-disable-next-line no-unused-vars -- Express รู้ว่าเป็น error handler จากจำนวน parameter = 4
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'JSON ไม่ถูกต้อง', details: [] } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'INVALID_INPUT', message: 'ข้อมูลใหญ่เกินไป', details: [] } });
  }
  // error ที่ไม่ได้ตั้งใจ → log ไว้ดูเอง แต่ไม่ส่งรายละเอียดให้ผู้ใช้
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'เกิดข้อผิดพลาดภายใน', details: [] } });
}
