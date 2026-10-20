import { USE_MOCK } from './api.js';

/**
 * ฟีเจอร์ที่ server ยังไม่มี → ปิดไว้ในเว็บจริง แต่ยังเห็นในโหมดข้อมูลจำลอง (ไว้ทำหน้าตาก่อน)
 * ทำ backend ส่วนไหนเสร็จ → เปลี่ยนเป็น true
 */
const READY = {
  meetup: false, // นัดเจอกลุ่ม — คนหลัก (ถ้ามีเวลา)
  report: false, // แจ้งราคาไม่ตรง — เพื่อน (ถ้ามีเวลา)
};

export const isOn = (feature) => READY[feature] || USE_MOCK;
