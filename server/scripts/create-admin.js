/**
 * สร้างบัญชีแอดมิน (เว็บไม่มีหน้าสมัคร ตั้งใจให้สร้างจากคำสั่งนี้เท่านั้น)
 *
 *   npm run create-admin -- admin@example.com
 *
 * TODO (เพื่อน):
 *  1. รับอีเมลจาก process.argv[2] และให้พิมพ์รหัสผ่านใน terminal (node:readline) — ห้ามรับรหัสผ่านทาง argv
 *     เพราะจะค้างอยู่ใน history ของ shell
 *  2. ตรวจรหัสผ่านอย่างน้อย 12 ตัว
 *  3. bcryptjs.hash(password, 12)
 *  4. INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')  ← ใช้ parameter เสมอ
 *  5. อีเมลซ้ำ (error code 23505) → แจ้งว่ามีบัญชีนี้แล้ว
 */
console.error('ยังไม่ได้ทำ: ดู TODO ใน server/scripts/create-admin.js');
process.exit(1);
