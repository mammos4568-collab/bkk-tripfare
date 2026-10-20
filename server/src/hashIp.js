import { createHash } from 'node:crypto';

/**
 * แปลง IP เป็นค่า hash ก่อนเก็บลงฐานข้อมูล (PDPA: ไม่เก็บ IP ตรง ๆ)
 * ยังใช้นับได้ว่ารีพอร์ตมาจากคนละที่จริงไหม แต่ย้อนกลับเป็น IP ไม่ได้ถ้าไม่รู้ salt
 *
 * @param {string} ip เช่น req.ip
 * @param {string} salt ค่า IP_HASH_SALT ใน .env (ห้าม commit ค่าจริง)
 */
export function hashIp(ip, salt) {
  if (!salt) throw new Error('ยังไม่ได้ตั้ง IP_HASH_SALT ใน server/.env');
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
