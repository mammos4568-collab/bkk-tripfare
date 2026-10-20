# สัญญา API (API Contract)

> ไฟล์นี้คือข้อตกลงกลางของทีม client กับ server ต้องตรงกับที่เขียนไว้ตรงนี้
> **ถ้าจะเปลี่ยน ต้องคุยในกลุ่มก่อน แล้วแก้ไฟล์นี้ใน PR เดียวกับโค้ด**
> ใช้ AI ช่วยเขียนโค้ด → แนบไฟล์นี้ให้ AI ทุกครั้ง

- Base URL: `/api` (ตอน dev client เรียกผ่าน proxy ของ Vite ไปที่ `http://localhost:3001`)
- รับ/ส่งเป็น JSON (`Content-Type: application/json`) ขนาด body ไม่เกิน 10 KB
- เวลาเป็น**นาที** (จำนวนเต็ม) ราคาเป็น**บาท**
- id ของสถานี/ป้าย/ท่าเรือ และสายรถ เป็น string ตาม `data/` เช่น `"BTS-N8"`

## สถานะ

| Endpoint | เจ้าของ | สถานะ |
|---|---|---|
| `GET /api/health` | A | ✅ ใช้ได้ |
| `GET /api/stops`, `GET /api/lines` | A | ✅ ใช้ได้ |
| `POST /api/trips/plan` | A | ✅ ใช้ได้ (ข้อมูลยังเป็นข้อมูลสมมติ) |
| `POST /api/meetup` | D | 🚧 ตอบ 501 / client ใช้ mock |
| `/api/auth/*`, `/api/me*`, `/api/places*` | C | 🚧 ตอบ 501 |
| `/api/reports*`, `/api/admin/*` | D | 🚧 ตอบ 501 |

## รูปแบบ error (ทุก endpoint)

```json
{ "error": { "code": "NO_ROUTE", "message": "ไม่พบเส้นทางระหว่างสองจุดนี้", "details": [] } }
```

| HTTP | code | เมื่อไหร่ |
|---|---|---|
| 400 | `INVALID_INPUT` | ข้อมูลที่ส่งมาไม่ถูกต้อง (`details` = รายการช่องที่ผิด) |
| 401 | `UNAUTHORIZED` | ยังไม่ได้ล็อกอิน |
| 403 | `FORBIDDEN` | ไม่มีสิทธิ์ (เช่น ไม่ใช่แอดมิน) |
| 404 | `NOT_FOUND`, `STOP_NOT_FOUND` | ไม่พบสิ่งที่ขอ |
| 409 | `CONFLICT` | ซ้ำ เช่น อีเมลนี้สมัครแล้ว |
| 422 | `NO_ROUTE` | หาเส้นทางไม่ได้ |
| 429 | `RATE_LIMITED` | เรียกถี่เกินไป |
| 501 | `NOT_IMPLEMENTED` | ส่วนนั้นยังไม่ได้ทำ |
| 500 | `INTERNAL` | ผิดพลาดภายใน (ห้ามส่งรายละเอียดภายในหรือ stack trace กลับไป) |

---

## ส่วน A — หาเส้นทางและราคา

### `GET /api/health`

```json
{ "status": "ok", "stops": 13, "lines": 4, "data_checked_at": "2026-10-20", "sample_data": true }
```

`data_checked_at` = วันที่ตรวจข้อมูลราคาที่เก่าที่สุดในระบบ, `sample_data` = ยังมีข้อมูลสมมติปนอยู่หรือไม่

### `GET /api/stops?q=&mode=`

ค้นหาสถานี/ป้าย/ท่าเรือ (ใช้ทำช่องเลือกจุดในฟอร์ม) — ไม่ใส่ `q` = คืนทั้งหมด (สูงสุด 50 รายการ)

- `q` (ไม่บังคับ): คำค้นในชื่อไทย ชื่ออังกฤษ หรือ id
- `mode` (ไม่บังคับ): `rail` | `bus` | `boat`

```json
{
  "stops": [
    { "id": "SMP-A1", "name_th": "[ตัวอย่าง] ต้นสายแดง", "name_en": "[Sample] Red Terminus",
      "mode": "rail", "lat": 13.8, "lon": 100.55, "lines": ["SMP-RED"] }
  ]
}
```

### `GET /api/lines`

```json
{
  "lines": [
    { "id": "SMP-RED", "name_th": "[ตัวอย่าง] สายสีแดงสมมติ", "mode": "rail",
      "operator": "SAMPLE_RAIL", "stops": ["SMP-A1", "SMP-A2"] }
  ]
}
```

### `POST /api/trips/plan`

หาเส้นทางผ่านจุดตามลำดับ (2–6 จุด) พร้อมเวลาและราคารวม

Request:

```json
{ "waypoints": ["SMP-A1", "SMP-P2", "SMP-A4"], "optimize": "fastest" }
```

- `waypoints`: id ของจุด 2–6 จุด เรียงตามลำดับที่จะไป (จุดติดกันห้ามซ้ำกัน)
- `optimize`: `"fastest"` (ค่าเริ่มต้น) หรือ `"cheapest"`

Response `200` (ผลจริงจากข้อมูลตัวอย่าง — ช่วงที่ 2 ตัดออกให้สั้น ดูฉบับเต็มใน `client/src/mocks/plan.json`):

```json
{
  "optimize": "fastest",
  "segments": [
    {
      "from": "SMP-A1",
      "to": "SMP-P2",
      "minutes": 34,
      "fare": 41,
      "legs": [
        {
          "type": "ride",
          "line_id": "SMP-RED", "line_name": "[ตัวอย่าง] สายสีแดงสมมติ", "mode": "rail",
          "from_stop": "SMP-A1", "from_name": "[ตัวอย่าง] ต้นสายแดง",
          "to_stop": "SMP-C0", "to_name": "[ตัวอย่าง] ชุมทางกลาง",
          "num_stops": 2, "wait_minutes": 3, "ride_minutes": 5, "minutes": 8,
          "fare": 25, "fare_included_in_previous": false
        },
        {
          "type": "ride",
          "line_id": "SMP-SKY", "line_name": "[ตัวอย่าง] สายสีฟ้าสมมติ", "mode": "rail",
          "from_stop": "SMP-C0", "from_name": "[ตัวอย่าง] ชุมทางกลาง",
          "to_stop": "SMP-B2", "to_name": "[ตัวอย่าง] ริมน้ำ",
          "num_stops": 1, "wait_minutes": 4, "ride_minutes": 3, "minutes": 7,
          "fare": 0, "fare_included_in_previous": true
        },
        {
          "type": "walk",
          "from_stop": "SMP-B2", "from_name": "[ตัวอย่าง] ริมน้ำ",
          "to_stop": "SMP-P1", "to_name": "[ตัวอย่าง] ท่าเรือริมน้ำ",
          "minutes": 5
        },
        {
          "type": "ride",
          "line_id": "SMP-BOAT", "line_name": "[ตัวอย่าง] เรือด่วนสมมติ", "mode": "boat",
          "from_stop": "SMP-P1", "from_name": "[ตัวอย่าง] ท่าเรือริมน้ำ",
          "to_stop": "SMP-P2", "to_name": "[ตัวอย่าง] ท่าเรือวัด",
          "num_stops": 1, "wait_minutes": 8, "ride_minutes": 6, "minutes": 14,
          "fare": 16, "fare_included_in_previous": false
        }
      ]
    }
  ],
  "total": { "minutes": 68, "fare": 82, "transfers": 4 },
  "warnings": ["ราคาคำนวณจากข้อมูลตัวอย่าง ไม่ใช่ราคาจริง"],
  "data_checked_at": "2026-10-20"
}
```

หมายเหตุ:
- `segments` มีจำนวน = จำนวน waypoints − 1 (หนึ่งช่วงต่อการเดินทางระหว่างจุดติดกัน)
- `fare_included_in_previous: true` = ต่อสายในระบบเดียวกันโดยไม่ต้องจ่ายใหม่ (ราคาถูกรวมไว้ในช่วงก่อนหน้า) → `fare` ของ leg นั้นเป็น 0
- `transfers` = จำนวนครั้งที่เปลี่ยนรถทั้งทริป (ไม่นับการลงที่จุดแวะ)
- `warnings` ให้หน้าเว็บแสดงเสมอถ้ามี
- Errors: `400 INVALID_INPUT`, `404 STOP_NOT_FOUND`, `422 NO_ROUTE`

---

## ส่วน D — นัดเจอกลุ่ม

### `POST /api/meetup` 🚧

หาจุดนัดที่ค่าเดินทางรวมของทุกคนถูกที่สุด (หรือที่คนจ่ายแพงสุดจ่ายน้อยที่สุด)

Request:

```json
{ "origins": ["SMP-A1", "SMP-U3", "SMP-B1"], "strategy": "min_total", "optimize": "cheapest" }
```

- `origins`: จุดเริ่มต้นของแต่ละคน 2–6 จุด
- `strategy`: `"min_total"` (ค่าเดินทางรวมถูกสุด, ค่าเริ่มต้น) หรือ `"min_max"` (ให้คนที่จ่ายแพงสุดจ่ายน้อยที่สุด = ยุติธรรมกว่า)
- `optimize`: `"cheapest"` (ค่าเริ่มต้น) หรือ `"fastest"`

Response `200`:

```json
{
  "strategy": "min_total",
  "best": { "stop_id": "SMP-A1", "name": "[ตัวอย่าง] ต้นสายแดง",
            "total_fare": 33, "max_fare": 25, "total_minutes": 34 },
  "per_person": [
    { "origin_index": 0, "fare": 0, "minutes": 0 },
    { "origin_index": 1, "fare": 8, "minutes": 19 },
    { "origin_index": 2, "fare": 25, "minutes": 15 }
  ],
  "alternatives": [
    { "stop_id": "SMP-U1", "name": "[ตัวอย่าง] ป้ายรถเมล์หน้าต้นสายแดง",
      "total_fare": 33, "max_fare": 25, "total_minutes": 37 }
  ]
}
```

- `per_person` ใช้ `origin_index` แทน id ของจุดเริ่มต้น — **ถ้าต่อยอดเป็นกลุ่มหลายบัญชี ห้ามส่งจุดเริ่มต้นของคนอื่นกลับไป** (PDPA: บอกได้ว่าคนนั้นอยู่ที่ไหน)
- `alternatives` สูงสุด 3 รายการ

---

## ส่วน C — บัญชีผู้ใช้และสถานที่บันทึก 🚧

ล็อกอินแบบ session cookie (`httpOnly`, `sameSite=lax`, `secure` ตอน production) — client ต้องส่ง cookie ทุกครั้ง (`credentials: "include"`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ "email", "password" }` (รหัสผ่าน 8–72 ตัว) | `201 { "user": { "id", "email" } }` / `409 CONFLICT` |
| POST | `/api/auth/login` | `{ "email", "password" }` | `200 { "user": { "id", "email" } }` + ตั้ง cookie / `401` |
| POST | `/api/auth/logout` | – | `204` |
| GET | `/api/me` | – | `200 { "user": { "id", "email", "role", "created_at" } }` / `401` |
| GET | `/api/me/export` | – | `200` ข้อมูลทั้งหมดของผู้ใช้เป็น JSON (สิทธิ์ตาม PDPA) |
| DELETE | `/api/me` | `{ "password" }` | `204` ลบบัญชีและสถานที่บันทึก, รีพอร์ตเดิมเปลี่ยนเป็นไม่ระบุตัวตน |
| GET | `/api/places` | – | `200 { "places": [ { "id", "label", "stop_id" } ] }` |
| POST | `/api/places` | `{ "label", "stop_id" }` (label 1–30 ตัว) | `201 { "place": { "id", "label", "stop_id" } }` |
| DELETE | `/api/places/:id` | – | `204` (ลบได้เฉพาะของตัวเอง) |

- ข้อความ error ตอนล็อกอินผิดต้องเหมือนกันทุกกรณี ("อีเมลหรือรหัสผ่านไม่ถูกต้อง") ไม่บอกว่าอีเมลมีอยู่หรือไม่
- **สถานที่บันทึกเก็บเป็น `stop_id` ของสถานี/ป้ายใกล้บ้าน ไม่เก็บที่อยู่หรือพิกัดจริง** (data minimization)

---

## ส่วน D — แจ้งข้อมูลผิดและแอดมิน 🚧

### `POST /api/reports` (ต้องล็อกอิน)

```json
{ "type": "fare_wrong", "line_id": "SMP-BUS1", "stop_id": null, "proposed_fare": 10, "website": "" }
```

- `type`: `"fare_wrong"` (ต้องมี `proposed_fare` 0–200) | `"stop_moved"` (ต้องมี `stop_id`) | `"line_cancelled"`
- **ไม่มีช่องข้อความอิสระ** (ตั้งใจ — ไม่ต้องกรองคำหยาบ ไม่มีที่ให้ใส่ลิงก์สแปม)
- `website` = ช่อง honeypot ที่ซ่อนในฟอร์ม คนจริงจะเว้นว่าง ถ้ามีค่า server ตอบ `201` เหมือนปกติแต่**ไม่บันทึก** และเก็บลง `security_events`
- Response `201`: `{ "report": { "id": 1, "status": "pending" } }`

### `GET /api/reports/summary?line_id=`

```json
{ "line_id": "SMP-BUS1", "pending": [ { "type": "fare_wrong", "proposed_fare": 10, "reporters": 2 } ] }
```

หน้าเว็บใช้แสดง "มีผู้แจ้งว่าราคาอาจเปลี่ยน" — **ราคาที่ใช้คำนวณยังเป็นราคาเดิม**จนกว่าแอดมินอนุมัติ

### แอดมิน (ต้องเป็น role `admin`)

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/api/admin/reports?status=pending` | ดูรีพอร์ตที่รอตรวจ จัดกลุ่มตาม (สาย, ประเภท, ราคาที่เสนอ) พร้อมจำนวนผู้แจ้งที่ต่างกันจริง |
| POST | `/api/admin/reports/:id/approve` | อนุมัติ → แอดมินแก้ `data/fares.json` ผ่าน PR โดยใส่ `source` เป็นเลขรีพอร์ต |
| POST | `/api/admin/reports/:id/reject` | ปฏิเสธ (ลด `trust_score` ของผู้แจ้ง) |
| GET | `/api/admin/security-events` | log สิ่งที่ระบบบล็อก (สำหรับทำ dashboard) |

**เกณฑ์ที่ควรใช้ก่อนเสนอให้อนุมัติ:** มีผู้แจ้งตรงกัน ≥ 3 คน ที่ต่างกันทั้งบัญชีและ IP, บัญชีอายุ ≥ 1 วัน และราคาที่เสนออยู่ในช่วงสมเหตุสมผลของประเภทรถ

---

## Rate limit (ต่อ IP)

| ขอบเขต | จำกัด |
|---|---|
| ทั้ง API | 300 ครั้ง / 15 นาที |
| `/api/auth/*` | 10 ครั้ง / 15 นาที |
| `POST /api/reports` | 5 ครั้ง / วัน / ผู้ใช้ |

เกินแล้วตอบ `429 RATE_LIMITED` และบันทึกลง `security_events`
