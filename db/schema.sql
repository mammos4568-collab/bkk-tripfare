-- ตารางฐานข้อมูล (ระบบแอดมิน) — คำอธิบายแต่ละคอลัมน์ดู docs/schema.md
-- รันอัตโนมัติตอน `docker compose up` ครั้งแรก
-- แก้ไฟล์นี้แล้ว: `docker compose down -v && docker compose up -d` (ข้อมูลในเครื่องจะหาย)

-- บัญชีผู้ดูแล (สร้างด้วย npm run create-admin เท่านั้น ไม่มีหน้าสมัคร)
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,                       -- bcryptjs เท่านั้น ห้ามเก็บรหัสผ่านตรง ๆ
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- แจ้งราคาไม่ตรงจากผู้ใช้ (ไม่ต้องล็อกอิน) — ทำถ้ามีเวลา
CREATE TABLE reports (
  id            SERIAL PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('fare_wrong', 'stop_moved', 'line_cancelled')),
  line_id       TEXT NOT NULL,
  stop_id       TEXT,
  proposed_fare NUMERIC(6, 2) CHECK (proposed_fare IS NULL OR (proposed_fare >= 0 AND proposed_fare <= 200)),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash       TEXT NOT NULL,                       -- SHA-256(salt + IP) ไม่เก็บ IP ตรง ๆ
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  CHECK (type <> 'fare_wrong' OR proposed_fare IS NOT NULL),
  CHECK (type <> 'stop_moved' OR stop_id IS NOT NULL)
);
CREATE INDEX reports_pending_idx ON reports (line_id, type, status);

-- log สิ่งที่ระบบบล็อกหรือน่าสงสัย (หน้าแอดมินแสดงตารางนี้)
CREATE TABLE security_events (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,                          -- login_failed, rate_limited, honeypot, ...
  ip_hash    TEXT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  detail     JSONB NOT NULL DEFAULT '{}'::jsonb,     -- ห้ามใส่รหัสผ่านหรือข้อมูลส่วนตัว
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX security_events_created_idx ON security_events (created_at DESC);

-- ตาราง session ของ connect-pg-simple สร้างเองอัตโนมัติ (createTableIfMissing: true)
