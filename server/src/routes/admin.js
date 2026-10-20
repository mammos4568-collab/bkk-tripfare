/**
 * ส่วน D — หน้าแอดมิน: ตรวจรีพอร์ต + log ความปลอดภัย
 * สัญญา: docs/API.md หัวข้อ "แอดมิน"
 *
 * TODO (ส่วน D):
 *  - ทุก route ใช้ requireAdmin (src/middleware/requireAuth.js)
 *  - GET /reports?status=pending → จัดกลุ่มตาม (line_id, type, proposed_fare)
 *    นับผู้แจ้งที่ต่างกันจริง: COUNT(DISTINCT user_id) และ COUNT(DISTINCT ip_hash)
 *    เสนอให้อนุมัติเมื่อ ≥ 3 คน, บัญชีอายุ ≥ 1 วัน, ราคาอยู่ในช่วงสมเหตุสมผล
 *  - POST /reports/:id/approve → status 'approved', reviewed_by, reviewed_at, trust_score ผู้แจ้ง +1
 *  - POST /reports/:id/reject  → status 'rejected', trust_score ผู้แจ้ง -1, บันทึก security_events
 *  - GET /security-events → 100 รายการล่าสุด (ไว้ทำ dashboard แบบ SOC)
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function adminRouter() {
  const router = Router();
  router.get('/reports', () => {
    throw notImplemented('D', 'ตรวจรีพอร์ต');
  });
  router.post('/reports/:id/approve', () => {
    throw notImplemented('D', 'อนุมัติรีพอร์ต');
  });
  router.post('/reports/:id/reject', () => {
    throw notImplemented('D', 'ปฏิเสธรีพอร์ต');
  });
  router.get('/security-events', () => {
    throw notImplemented('D', 'log ความปลอดภัย');
  });
  return router;
}
