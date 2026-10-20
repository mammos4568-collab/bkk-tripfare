/**
 * ระบบแอดมิน (เพื่อน)
 * สัญญา: docs/API.md หัวข้อ "เข้าสู่ระบบและแอดมิน"
 *
 * TODO (เพื่อน):
 *  - ทุก route ใช้ requireAdmin (src/middleware/requireAuth.js)
 *  - (ต้องมี) GET /security-events → 100 รายการล่าสุดจากตาราง security_events (ใหม่สุดก่อน)
 *  - (ถ้ามีเวลา) GET /reports?status=pending → จัดกลุ่มตาม (line_id, type, proposed_fare)
 *    นับคนแจ้งที่ต่างกันจริงด้วย COUNT(DISTINCT ip_hash)
 *  - (ถ้ามีเวลา) POST /reports/:id/approve | reject → เปลี่ยน status, reviewed_by, reviewed_at
 *    อนุมัติแล้ว: คนหลักแก้ data/fares.json ผ่าน PR โดยใส่เลขรีพอร์ตใน source
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function adminRouter() {
  const router = Router();
  router.get('/security-events', () => {
    throw notImplemented('แอดมิน', 'log ความปลอดภัย');
  });
  router.get('/reports', () => {
    throw notImplemented('แอดมิน', 'ตรวจรายการแจ้งราคา');
  });
  router.post('/reports/:id/approve', () => {
    throw notImplemented('แอดมิน', 'อนุมัติรายการแจ้งราคา');
  });
  router.post('/reports/:id/reject', () => {
    throw notImplemented('แอดมิน', 'ปฏิเสธรายการแจ้งราคา');
  });
  return router;
}
