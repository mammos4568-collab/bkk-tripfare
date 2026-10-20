-- ตารางฐานข้อมูล (ส่วน C, D) — คำอธิบายแต่ละคอลัมน์ดู docs/schema.md
-- รันอัตโนมัติตอน `docker compose up` ครั้งแรก
-- แก้ไฟล์นี้แล้ว: `docker compose down -v && docker compose up -d` (ข้อมูลในเครื่องจะหาย)

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,                       -- bcryptjs เท่านั้น ห้ามเก็บรหัสผ่านตรง ๆ
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  trust_score   INTEGER NOT NULL DEFAULT 0,          -- ความน่าเชื่อถือของผู้แจ้งข้อมูล
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saved_places (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      VARCHAR(30) NOT NULL,                   -- "บ้าน", "หอ", "มหาลัย"
  stop_id    TEXT NOT NULL,                          -- จุดใกล้ ๆ ไม่เก็บที่อยู่/พิกัดจริง
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

CREATE TABLE reports (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- ลบบัญชีแล้วรีพอร์ตเป็นไม่ระบุตัวตน
  type          TEXT NOT NULL CHECK (type IN ('fare_wrong', 'stop_moved', 'line_cancelled')),
  line_id       TEXT NOT NULL,
  stop_id       TEXT,
  proposed_fare NUMERIC(6, 2) CHECK (proposed_fare IS NULL OR (proposed_fare >= 0 AND proposed_fare <= 200)),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash       TEXT,                                -- SHA-256(salt + IP) ไม่เก็บ IP ตรง ๆ
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  CHECK (type <> 'fare_wrong' OR proposed_fare IS NOT NULL),
  CHECK (type <> 'stop_moved' OR stop_id IS NOT NULL)
);
CREATE INDEX reports_pending_idx ON reports (line_id, type, status);

CREATE TABLE security_events (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,                          -- rate_limited, login_failed, honeypot, report_rejected, ...
  ip_hash    TEXT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  detail     JSONB NOT NULL DEFAULT '{}'::jsonb,     -- ห้ามใส่รหัสผ่านหรือข้อมูลส่วนตัว
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX security_events_created_idx ON security_events (created_at DESC);

-- ตาราง session ของ connect-pg-simple สร้างเองอัตโนมัติ (createTableIfMissing: true)
