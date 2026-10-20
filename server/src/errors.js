/**
 * error ที่ตั้งใจส่งให้ผู้ใช้เห็น (รูปแบบตาม docs/API.md)
 * error อื่นที่ไม่ใช่ AppError จะถูกตอบเป็น 500 INTERNAL โดยไม่เปิดเผยรายละเอียด
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code เช่น "NO_ROUTE"
   * @param {string} message ข้อความภาษาไทยที่ผู้ใช้อ่านได้
   * @param {Array<{path: string, message: string}>} [details]
   */
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** ใช้ในส่วนที่ยังไม่ได้ทำ → ตอบ 501 */
export function notImplemented(part, feature) {
  return new AppError(501, 'NOT_IMPLEMENTED', `${feature} ยังไม่ได้ทำ (ส่วน ${part})`);
}
