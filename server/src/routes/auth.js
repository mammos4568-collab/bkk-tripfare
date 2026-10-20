/**
 * เข้าสู่ระบบผู้ดูแล (เพื่อน)
 * สัญญา: docs/API.md หัวข้อ "เข้าสู่ระบบและแอดมิน"
 * ตาราง: users ใน db/schema.sql — มีแต่บัญชีแอดมิน ไม่เปิดให้คนทั่วไปสมัคร
 *
 * TODO (เพื่อน):
 *  1. ตั้ง session ใน src/app.js (ตรงที่เขียนว่า "ตั้ง session")
 *     - express-session + connect-pg-simple (createTableIfMissing: true)
 *     - cookie: httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge 8 ชั่วโมง
 *     - secret: config.sessionSecret (production ต้องมีค่า ไม่งั้นไม่ยอมเปิด server)
 *  2. สร้างบัญชีแอดมินด้วย scripts/create-admin.js (ไม่มีหน้าสมัคร)
 *  3. POST /login: zod (email, password) → หา user → bcryptjs.compare
 *     - ผิด: ตอบ 401 ข้อความเดียวกันทุกกรณี "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (ไม่บอกว่าอีเมลมีอยู่ไหม)
 *       และบันทึก security_events kind 'login_failed' (ip_hash จาก src/hashIp.js ห้ามเก็บรหัสผ่าน)
 *     - ถูก: req.session.regenerate() แล้วเก็บ userId, role (กัน session fixation)
 *  4. POST /logout: req.session.destroy() → 204
 *  5. GET /api/me: ต้องล็อกอิน (requireLogin) → { user: { id, email, role } }
 *  6. rate limit /api/auth: 10 ครั้ง / 15 นาที / IP (express-rate-limit)
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function authRouter() {
  const router = Router();
  router.post('/login', () => {
    throw notImplemented('แอดมิน', 'เข้าสู่ระบบ');
  });
  router.post('/logout', () => {
    throw notImplemented('แอดมิน', 'ออกจากระบบ');
  });
  return router;
}

export function meRouter() {
  const router = Router();
  router.get('/', () => {
    throw notImplemented('แอดมิน', 'ข้อมูลผู้ที่ล็อกอิน');
  });
  return router;
}
