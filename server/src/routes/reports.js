/**
 * แจ้งราคาไม่ตรงจากผู้ใช้ (เพื่อน — ทำถ้ามีเวลา, แอดมินเป็นคนตรวจ)
 * สัญญา: docs/API.md หัวข้อ "แจ้งราคาไม่ตรง"
 * ไม่ต้องล็อกอิน → ต้องกันสแปมด้วย rate limit + honeypot
 *
 * TODO (เพื่อน):
 *  - POST / : rate limit 5 ครั้ง / วัน / IP
 *  - zod: type, line_id (ต้องมีจริง: planner.linesById.has()), stop_id, proposed_fare (0–200), website
 *    ใช้ .superRefine() บังคับ: fare_wrong ต้องมี proposed_fare, stop_moved ต้องมี stop_id
 *  - honeypot: website ไม่ว่าง → ตอบ 201 เหมือนปกติแต่ "ไม่บันทึก" + บันทึก security_events kind 'honeypot'
 *  - บันทึก ip_hash = hashIp(req.ip, config.ipHashSalt) ไม่เก็บ IP ตรง ๆ
 *  - ห้ามเปลี่ยนราคาที่ใช้คำนวณจากรีพอร์ตโดยตรง → แอดมินตรวจก่อนเสมอ
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function reportsRouter() {
  const router = Router();
  router.post('/', () => {
    throw notImplemented('แอดมิน', 'แจ้งราคาไม่ตรง');
  });
  return router;
}
