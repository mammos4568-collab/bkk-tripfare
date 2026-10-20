import { AppError } from '../errors.js';

/**
 * ใช้คุมสิทธิ์ใน route ที่ต้องล็อกอิน
 * ทำงานได้ทันทีเมื่อตั้ง session แล้ว (ดู routes/auth.js) และตอนล็อกอินสำเร็จเก็บ
 *   req.session.userId = user.id
 *   req.session.role   = user.role
 *
 *   router.post('/', requireLogin, handler)
 *   router.get('/', requireAdmin, handler)
 */
export function requireLogin(req, res, next) {
  if (!req.session?.userId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อน'));
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อน'));
  }
  if (req.session.role !== 'admin') {
    return next(new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึง'));
  }
  next();
}
