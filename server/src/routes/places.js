/**
 * ส่วน C — สถานที่บันทึก ("บ้าน", "หอ", "มหาลัย")
 * สัญญา: docs/API.md หัวข้อ "ส่วน C"
 * ตาราง: saved_places ใน db/schema.sql
 *
 * TODO (ส่วน C):
 *  - ทุก route ใช้ requireLogin
 *  - POST: zod (label 1–30 ตัว, stop_id) → เช็กว่า stop_id มีจริงด้วย planner.stopsById.has()
 *    → label ซ้ำ (error code 23505) ตอบ 409 CONFLICT
 *  - DELETE /:id → ต้องมี "AND user_id = $2" เสมอ (ห้ามลบของคนอื่น) → ไม่เจอตอบ 404
 *  - เก็บแค่ stop_id ของจุดใกล้ ๆ ห้ามเก็บที่อยู่หรือพิกัดจริง (data minimization)
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function placesRouter() {
  const router = Router();
  router.get('/', () => {
    throw notImplemented('C', 'สถานที่บันทึก');
  });
  router.post('/', () => {
    throw notImplemented('C', 'บันทึกสถานที่');
  });
  router.delete('/:id', () => {
    throw notImplemented('C', 'ลบสถานที่บันทึก');
  });
  return router;
}
