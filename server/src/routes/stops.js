/**
 * ค้นหาจุด และรายชื่อสาย (คนหลัก)
 * สัญญา: docs/API.md หัวข้อ GET /api/stops, GET /api/lines
 */
import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../validate.js';

const stopsQuery = z.object({
  q: z.string().trim().max(50).optional(),
  mode: z.enum(['rail', 'train', 'bus', 'boat']).optional(),
});

export function stopsRouter(planner) {
  const router = Router();
  router.get('/', (req, res) => {
    const { q, mode } = parse(stopsQuery, req.query);
    res.json({ stops: planner.searchStops({ q, mode, limit: 50 }) });
  });
  return router;
}

/** GET /api/network — ทุกจุดและทุกสาย (แผนที่ + ช่องเลือกจุด) */
export function networkRouter(planner) {
  const router = Router();
  const body = planner.network(); // ข้อมูลไม่เปลี่ยนระหว่างที่ server รัน → สร้างครั้งเดียว
  router.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(body);
  });
  return router;
}

export function linesRouter(planner) {
  const router = Router();
  router.get('/', (req, res) => {
    res.json({ lines: planner.listLines() });
  });
  return router;
}
