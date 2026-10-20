/**
 * ส่วน D — แจ้งข้อมูลผิด (ราคาเปลี่ยน, ป้ายย้าย, สายยกเลิก)
 * สัญญา: docs/API.md หัวข้อ "ส่วน D — แจ้งข้อมูลผิดและแอดมิน"
 * ตาราง: reports, security_events ใน db/schema.sql
 *
 * TODO (ส่วน D):
 *  - POST / ใช้ requireLogin + rate limit 5 ครั้ง/วัน/ผู้ใช้ (keyGenerator ใช้ req.session.userId)
 *  - zod: type, line_id (ต้องมีจริง: planner.linesById.has()), stop_id, proposed_fare (0–200), website
 *    ใช้ .superRefine() บังคับ: fare_wrong ต้องมี proposed_fare, stop_moved ต้องมี stop_id
 *  - honeypot: ถ้า website ไม่ว่าง → ตอบ 201 เหมือนปกติแต่ "ไม่บันทึก" + บันทึก security_events kind 'honeypot'
 *  - บันทึก ip_hash = hashIp(req.ip, config.ipHashSalt) ไม่เก็บ IP ตรง ๆ
 *  - GET /summary?line_id= → นับผู้แจ้งที่ต่างกันจริง (COUNT DISTINCT user_id) ต่อ (type, proposed_fare)
 *    ที่ status = 'pending'
 *  - ห้ามเปลี่ยนราคาที่ใช้คำนวณจากรีพอร์ตโดยตรง → แอดมินอนุมัติแล้วแก้ data/fares.json ผ่าน PR
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function reportsRouter() {
  const router = Router();
  router.post('/', () => {
    throw notImplemented('D', 'แจ้งข้อมูลผิด');
  });
  router.get('/summary', () => {
    throw notImplemented('D', 'สรุปรีพอร์ต');
  });
  return router;
}
