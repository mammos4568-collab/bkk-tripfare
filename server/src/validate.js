import { AppError } from './errors.js';

/**
 * ตรวจ input ด้วย zod schema
 * ผ่าน → คืนค่าที่ตรวจแล้ว (ใช้ค่านี้ต่อ ไม่ใช้ req.body ตรง ๆ)
 * ไม่ผ่าน → 400 INVALID_INPUT พร้อมรายการช่องที่ผิด
 */
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(400, 'INVALID_INPUT', 'ข้อมูลที่ส่งมาไม่ถูกต้อง', details);
  }
  return result.data;
}
