import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** ค่าตั้งทั้งหมดอ่านจาก server/.env (ดูตัวอย่างใน .env.example) */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  env: process.env.NODE_ENV ?? 'development',
  dataDir: process.env.DATA_DIR ?? path.resolve(here, '../../data'),
  clientDist: path.resolve(here, '../../client/dist'),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  ipHashSalt: process.env.IP_HASH_SALT,
};

export const isProduction = config.env === 'production';
