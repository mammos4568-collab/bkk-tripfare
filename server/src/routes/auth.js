/**
 * ส่วน C — สมัคร / ล็อกอิน / ข้อมูลของฉัน (PDPA)
 * สัญญา: docs/API.md หัวข้อ "ส่วน C"
 * ตาราง: users ใน db/schema.sql
 *
 * TODO (ส่วน C):
 *  1. ตั้ง session ใน src/app.js (ตรงที่เขียนว่า "ส่วน C")
 *     - express-session + connect-pg-simple (createTableIfMissing: true)
 *     - cookie: httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge 7 วัน
 *     - secret: config.sessionSecret (ถ้าไม่มีค่าใน production ให้ server ไม่ยอมเริ่ม)
 *  2. register: zod (email, password 8–72 ตัว) → email.toLowerCase() → bcryptjs.hash(password, 12)
 *     → INSERT ... RETURNING id, email (อีเมลซ้ำ = error code 23505 → 409 CONFLICT)
 *  3. login: หา user → bcryptjs.compare → ถ้าผิด ตอบ 401 ข้อความเดียวกันทุกกรณี
 *     ("อีเมลหรือรหัสผ่านไม่ถูกต้อง") → req.session.regenerate() → เก็บ userId, role
 *     ล็อกอินพลาด → บันทึก security_events kind 'login_failed' (ใช้ hashIp จาก src/hashIp.js)
 *  4. logout: req.session.destroy() → 204
 *  5. GET /api/me, GET /api/me/export (ข้อมูลทั้งหมดของผู้ใช้ + สถานที่บันทึก + รีพอร์ตของตัวเอง)
 *  6. DELETE /api/me: ต้องยืนยันรหัสผ่าน → DELETE FROM users (saved_places ลบตาม, reports เป็น NULL เอง)
 *  7. ใส่ rate limit ให้ /api/auth (10 ครั้ง / 15 นาที) ด้วย express-rate-limit
 *
 * ใช้ requireLogin จาก src/middleware/requireAuth.js กับ route ที่ต้องล็อกอิน
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

export function authRouter() {
  const router = Router();
  router.post('/register', () => {
    throw notImplemented('C', 'สมัครสมาชิก');
  });
  router.post('/login', () => {
    throw notImplemented('C', 'เข้าสู่ระบบ');
  });
  router.post('/logout', () => {
    throw notImplemented('C', 'ออกจากระบบ');
  });
  return router;
}

export function meRouter() {
  const router = Router();
  router.get('/', () => {
    throw notImplemented('C', 'ข้อมูลของฉัน');
  });
  router.get('/export', () => {
    throw notImplemented('C', 'ดาวน์โหลดข้อมูลของฉัน');
  });
  router.delete('/', () => {
    throw notImplemented('C', 'ลบบัญชี');
  });
  return router;
}
