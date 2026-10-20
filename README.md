# BKK TripFare (ชื่อชั่วคราว)

เว็บวางแผนเดินทาง**หลายจุด**ในกรุงเทพฯ และคำนวณ**ราคารวมทั้งทริป** ทั้งรถไฟฟ้า รถเมล์ และเรือ ในที่เดียว

> ⚠️ ข้อมูลใน `data/` ตอนนี้เป็น**ข้อมูลสมมติ** (id ขึ้นต้นด้วย `SMP-`) ใส่ไว้ให้ระบบรันได้ก่อน
> ต้องแทนที่ด้วยข้อมูลจริงที่มีแหล่งอ้างอิง ดู [data/README.md](data/README.md)

## ขอบเขตรอบนี้ (7 วัน)

| ระดับ | ฟีเจอร์ |
|---|---|
| **ต้องมี (MVP)** | เลือก 2–6 จุด → เส้นทาง + เวลารวม + ราคารวม, เลือกแบบเร็วสุด/ถูกสุด, หน้าเว็บแสดงขั้นตอนการเดินทาง |
| ส่วนเสริม | บัญชีผู้ใช้ + สถานที่บันทึก, นัดเจอกลุ่ม, แจ้งข้อมูลผิด + กันสแปม |
| ไม่ทำรอบนี้ | AI, ระบบจ่ายเงิน, งบรายเดือน, ข้อมูลเรียลไทม์ |

## แบ่งงาน

| ส่วน | งาน | ไฟล์หลัก | ความสำคัญ |
|---|---|---|---|
| **A** | แกนหาเส้นทาง (Dijkstra), คำนวณราคา, ระบบหลายจุด, ข้อมูลรถไฟฟ้า | `server/src/core/`, `server/src/routes/trips.js`, `data/` | ต้องมี |
| **B** | หน้าเว็บ, ฟอร์มหลายจุด, แสดงผลเส้นทาง, แผนที่ | `client/src/pages/PlanTrip.jsx`, `client/src/` | ต้องมี |
| **C** | สมัคร/ล็อกอิน, สถานที่บันทึก, ฟีเจอร์ PDPA | `server/src/routes/auth.js`, `places.js`, `client/src/pages/Account.jsx` | ส่วนเสริม |
| **D** | นัดเจอกลุ่ม, แจ้งข้อมูลผิด, กันสแปม, หน้าแอดมิน | `server/src/routes/meetup.js`, `reports.js`, `admin.js`, `client/src/pages/Meetup.jsx`, `Report.jsx` | ส่วนเสริม |

ส่วนที่ยังไม่ได้ทำจะตอบ `501 NOT_IMPLEMENTED` เว็บยังรันได้ตามปกติ แค่ฟีเจอร์นั้นยังไม่มี

## เริ่มใช้งาน

ต้องมี **Node.js 20 ขึ้นไป** (คนทำส่วน C และ D ต้องมี Docker สำหรับฐานข้อมูลด้วย)

```bash
# 1) server → http://localhost:3001/api/health
cd server
cp .env.example .env
npm install
npm run dev

# 2) client → http://localhost:5173 (เปิดอีกหน้าต่าง terminal)
cd client
cp .env.example .env
npm install
npm run dev

# 3) ฐานข้อมูล (เฉพาะคนทำส่วน C/D)
docker compose up -d
```

**ครั้งแรกสุด (หัวหน้าทีมทำคนเดียว):** หลัง `npm install` ทั้ง `server/` และ `client/` ให้ commit ไฟล์ `package-lock.json` ทั้งสองไฟล์ ทุกคนจะได้ library เวอร์ชันเดียวกัน จากนั้นเปลี่ยน `npm install` ใน `.github/workflows/ci.yml` เป็น `npm ci`

**ทำหน้าเว็บโดยไม่ต้องรัน server:** ตั้ง `VITE_USE_MOCK=true` ใน `client/.env` ระบบจะใช้ข้อมูลใน `client/src/mocks/` แทน

**ทดสอบ:**

```bash
cd server
npm test               # unit tests ของแกนหาเส้นทาง
npm run validate-data  # ตรวจข้อมูลใน data/ (ต้องผ่านก่อนส่ง PR ที่แก้ data)
```

## แผน 7 วัน

| วัน | งาน |
|---|---|
| 1 | ทุกคนอ่าน `docs/` และรันโปรเจกต์บนเครื่องตัวเองได้ แบ่งกันเก็บข้อมูลจริง (A: รถไฟฟ้า, B: เรือ, C+D: รถเมล์สายหลัก) |
| 2–4 | ทำส่วนของตัวเอง ส่ง PR อย่างน้อยวันละครั้ง |
| 5 | รวมงานและแก้ให้ต่อกันติด — ไม่เพิ่มฟีเจอร์ใหม่ |
| 6 | ทดสอบ แก้บั๊ก deploy |
| 7 | เผื่อเวลา + ทำสไลด์และซ้อมเดโม — **ห้ามเขียนฟีเจอร์ใหม่** |

**จุดเช็ก:** ทุกเย็นแจ้งความคืบหน้าในกลุ่ม ถ้าส่วนไหนไม่มี commit เลย 2 วันติด ให้คุยทันทีว่าจะช่วยกัน ลดขอบเขต หรือตัดฟีเจอร์นั้น

## เอกสาร

- [docs/API.md](docs/API.md) — สัญญา API (**ทุกคนต้องยึดตามนี้** และแนบให้ AI ทุกครั้ง)
- [docs/schema.md](docs/schema.md) — รูปแบบข้อมูลขนส่งและตารางฐานข้อมูล
- [docs/TEAM-RULES.md](docs/TEAM-RULES.md) — กติกาทีม การใช้ AI และ checklist ก่อน merge
- [data/README.md](data/README.md) — วิธีเพิ่มข้อมูลจริง

## โครงสร้างโปรเจกต์

```
.
├── client/            React (Vite) — B, C, D
│   └── src/mocks/     ข้อมูลจำลองสำหรับทำหน้าเว็บโดยไม่ต้องรัน server
├── server/            Express API — A, C, D
│   ├── src/core/      แกนหาเส้นทางและคำนวณราคา — A
│   ├── src/routes/    API แยกไฟล์ตามส่วน
│   ├── scripts/       สคริปต์ตรวจข้อมูล
│   └── test/          unit tests
├── data/              ข้อมูลขนส่ง (JSON) — ทุกคนช่วยกรอก
├── db/schema.sql      ตาราง PostgreSQL — C, D
└── docs/              เอกสารทีม
```

## Deploy (วันที่ 6)

ตั้ง `NODE_ENV=production` แล้ว server จะเสิร์ฟหน้าเว็บจาก `client/dist` เอง ทั้งเว็บจึงอยู่ในบริการเดียว (เช่น Render หรือ Railway)

- Build command: `cd client && npm ci && npm run build && cd ../server && npm ci`
- Start command: `cd server && npm start`
- ตั้ง environment variables ตาม `server/.env.example` (ห้ามใช้ค่าตัวอย่างใน production)
