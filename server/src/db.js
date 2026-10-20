import pg from 'pg';
import { config } from './config.js';

/**
 * การเชื่อมต่อ PostgreSQL (ส่วน C, D ใช้)
 * เปิด DB ในเครื่อง: `docker compose up -d` ที่โฟลเดอร์บนสุด
 *
 * ใช้ parameter เสมอ ห้ามต่อ string เอง (กัน SQL injection):
 *   await query('SELECT id FROM users WHERE email = $1', [email]);
 */
let pool;

export function getPool() {
  if (!config.databaseUrl) {
    throw new Error('ยังไม่ได้ตั้ง DATABASE_URL ใน server/.env');
  }
  pool ??= new pg.Pool({ connectionString: config.databaseUrl });
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}
