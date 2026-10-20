# สัญญา API (API Contract)

> ไฟล์นี้คือข้อตกลงกลางของทีม client กับ server ต้องตรงกับที่เขียนไว้ตรงนี้
> **ถ้าจะเปลี่ยน ต้องบอกอีกคนก่อน แล้วแก้ไฟล์นี้ใน PR เดียวกับโค้ด**
> ใช้ AI ช่วยเขียนโค้ด → แนบไฟล์นี้ให้ AI ทุกครั้ง

- Base URL: `/api` (ตอน dev หน้าเว็บเรียกผ่าน proxy ของ Vite ไปที่ `http://localhost:3001`)
- รับ/ส่งเป็น JSON (`Content-Type: application/json`) ขนาด body ไม่เกิน 10 KB
- เวลาเป็น**นาที** (จำนวนเต็ม) ราคาเป็น**บาท**
- id ของจุด (สถานี / ป้าย / ท่าเรือ) และสายรถ เป็น string ตาม `data/` เช่น `"SMP-A1"`

## สถานะ

| Endpoint | เจ้าของ | สถานะ |
|---|---|---|
| `GET /api/health` | คนหลัก | ✅ ใช้ได้ |
| `GET /api/network` | คนหลัก | ✅ ใช้ได้ — แผนที่และช่องเลือกจุดใช้อันนี้ |
| `GET /api/stops`, `GET /api/lines` | คนหลัก | ✅ ใช้ได้ |
| `POST /api/trips/options` | คนหลัก | ✅ ใช้ได้ — หน้าแรกใช้อันนี้ |
| `POST /api/trips/plan` | คนหลัก | ✅ ใช้ได้ |
| `POST /api/meetup` | คนหลัก | 🚧 ถ้ามีเวลา (ตอบ 501) |
| `POST /api/auth/login`, `/logout`, `GET /api/me` | เพื่อน | 🚧 ต้องมี (ตอบ 501) |
| `GET /api/admin/security-events` | เพื่อน | 🚧 ต้องมี (ตอบ 501) |
| `POST /api/reports`, `/api/admin/reports*` | เพื่อน | 🚧 ถ้ามีเวลา (ตอบ 501) |

## รูปแบบ error (ทุก endpoint)

```json
{ "error": { "code": "NO_ROUTE", "message": "ไม่พบเส้นทางจาก ... ไป ...", "details": [] } }
```

| HTTP | code | เมื่อไหร่ |
|---|---|---|
| 400 | `INVALID_INPUT` | ข้อมูลที่ส่งมาไม่ถูกต้อง (`details` = รายการช่องที่ผิด `{ path, message }`) |
| 401 | `UNAUTHORIZED` | ยังไม่ได้ล็อกอิน / อีเมลหรือรหัสผ่านไม่ถูกต้อง |
| 403 | `FORBIDDEN` | ไม่มีสิทธิ์ |
| 404 | `NOT_FOUND`, `STOP_NOT_FOUND` | ไม่พบสิ่งที่ขอ |
| 422 | `NO_ROUTE` | หาเส้นทางไม่ได้ |
| 429 | `RATE_LIMITED` | เรียกถี่เกินไป |
| 501 | `NOT_IMPLEMENTED` | ส่วนนั้นยังไม่ได้ทำ |
| 500 | `INTERNAL` | ผิดพลาดภายใน (ห้ามส่งรายละเอียดภายในหรือ stack trace กลับไป) |

---

## หน้าเว็บผู้ใช้ (คนหลัก)

### `GET /api/health`

```json
{ "status": "ok", "stops": 13, "lines": 4, "data_checked_at": "2026-10-20", "sample_data": true }
```

`data_checked_at` = วันที่ตรวจข้อมูลราคาที่เก่าที่สุดในระบบ, `sample_data` = ยังมีข้อมูลสมมติปนอยู่หรือไม่

### `GET /api/network`

ทุกจุด (พร้อมพิกัด) ทุกสาย (พร้อมสี) และแนวเส้นทางจริงในครั้งเดียว ไม่จำกัดจำนวน — ใช้วาดแผนที่และทำช่องเลือกจุด (cache 5 นาที, ราว 100 KB)

```json
{
  "stops": [
    { "id": "BTS-12", "name_th": "สยาม", "name_en": "Siam", "mode": "rail", "lat": 13.745618, "lon": 100.534199 }
  ],
  "lines": [
    { "id": "BTS-SUK", "name_th": "BTS สายสุขุมวิท", "group": "BTS สายสุขุมวิท", "mode": "rail",
      "operator": "บริษัท ระบบขนส่งมวลชนกรุงเทพ จำกัด", "color": "#65B724", "stops": ["BTS-13843", "..."] }
  ],
  "shapes": {
    "BTS-SUK": { "points": [[13.932336, 100.646563], "..."], "stop_index": [0, 4, 9, "..."] }
  }
}
```

- `mode`: `rail` (รถไฟฟ้า) | `train` (รถไฟ) | `bus` (รถเมล์) | `boat` (เรือ)
- `color`: สีประจำสาย (`null` = หน้าเว็บใช้สีตามประเภท)
- `group`: ชื่อกลุ่มในช่องเลือกจุด
- `shapes[สาย].stop_index[i]` = ลำดับใน `points` ของจุดที่ i ของสาย (ไว้ตัดเส้นเฉพาะช่วงที่นั่ง) ไม่มี `shapes` ของสายไหน ให้ลากเส้นตรงระหว่างสถานี

### `GET /api/stops?q=&mode=`

ค้นหาจุดด้วยคำ (ไว้ทำช่องค้นหาแบบพิมพ์) — คืนสูงสุด 50 รายการ

- `q` (ไม่บังคับ): คำค้นในชื่อไทย ชื่ออังกฤษ หรือ id
- `mode` (ไม่บังคับ): `rail` | `train` | `bus` | `boat`

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
      "operator": "SAMPLE_RAIL", "color": "#C8102E", "stops": ["SMP-A1", "SMP-A2", "SMP-C0", "SMP-A3", "SMP-A4"] }
  ]
}
```

### `POST /api/trips/options`

ทางเลือกทั้งทริปสำหรับหน้าเทียบ: ถูกที่สุด / เร็วที่สุด / ต่อรถน้อยที่สุด (ตัดเส้นทางที่ซ้ำกันออก) — **หน้าแรกใช้อันนี้**

Request:

```json
{ "waypoints": ["SMP-A1", "SMP-P2", "SMP-A4"] }
```

- `waypoints`: id ของจุด 2–6 จุด เรียงตามลำดับที่จะไป (จุดติดกันห้ามซ้ำกัน)

Response `200` (ผลจริงจากข้อมูลตัวอย่าง):

```jsonc
{
  "options": [
    {
      "labels": ["cheapest", "fewest_transfers"],
      "segments": [ /* รูปแบบเดียวกับ /api/trips/plan */ ],
      "total": { "minutes": 71, "fare": 65, "transfers": 3 }
    },
    {
      "labels": ["fastest"],
      "segments": [ /* ... */ ],
      "total": { "minutes": 68, "fare": 82, "transfers": 4 }
    }
  ],
  "best": { "fastest": 1, "cheapest": 0, "fewest_transfers": 0 },
  "warnings": ["ราคาคำนวณจากข้อมูลตัวอย่าง ไม่ใช่ราคาจริง"],
  "data_checked_at": "2026-10-20"
}
```

- `options` เรียงจากถูกไปแพง (ราคาเท่ากันเรียงตามเวลา) มี 1–3 รายการ
- `best` = ตำแหน่งใน `options` ของทางที่ดีที่สุดในแต่ละเกณฑ์ ตัดสินจาก**ค่าจริง** (ราคาจริง เวลา จำนวนต่อรถ)
- `labels` = เกณฑ์ที่ทางนี้ชนะ (ใช้ตั้งชื่อ เช่น "ประหยัดที่สุด และต่อรถน้อยที่สุด")
- Errors: `400 INVALID_INPUT`, `404 STOP_NOT_FOUND`, `422 NO_ROUTE`

### `POST /api/trips/plan`

เส้นทางเดียวตามเกณฑ์ที่เลือก

Request:

```json
{ "waypoints": ["SMP-A1", "SMP-P2", "SMP-A4"], "optimize": "fastest" }
```

- `optimize`: `"fastest"` (ค่าเริ่มต้น) | `"cheapest"` | `"fewest_transfers"`

Response `200` (ผลจริงจากข้อมูลตัวอย่าง — ช่วงที่ 2 ตัดออกให้สั้น ฉบับเต็มดู `client/src/mocks/plan.json`):

```json
{
  "optimize": "fastest",
  "segments": [
    {
      "from": "SMP-A1",
      "to": "SMP-P2",
      "minutes": 34,
      "fare": 41,
      "transfers": 2,
      "legs": [
        {
          "type": "ride",
          "line_id": "SMP-RED", "line_name": "[ตัวอย่าง] สายสีแดงสมมติ", "line_color": "#C8102E", "mode": "rail",
          "from_stop": "SMP-A1", "from_name": "[ตัวอย่าง] ต้นสายแดง",
          "to_stop": "SMP-C0", "to_name": "[ตัวอย่าง] ชุมทางกลาง",
          "num_stops": 2, "wait_minutes": 3, "ride_minutes": 5, "minutes": 8,
          "fare": 25, "fare_included_in_previous": false
        },
        {
          "type": "ride",
          "line_id": "SMP-SKY", "line_name": "[ตัวอย่าง] สายสีฟ้าสมมติ", "line_color": "#2AA4D6", "mode": "rail",
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
          "line_id": "SMP-BOAT", "line_name": "[ตัวอย่าง] เรือด่วนสมมติ", "line_color": "#E07A12", "mode": "boat",
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
- `transfers` ของช่วง = จำนวนครั้งที่เปลี่ยนรถในช่วงนั้น (ไม่นับการลงที่จุดแวะ), ของทั้งทริป = ผลรวมทุกช่วง
- `fare_included_in_previous: true` = เปลี่ยนสายในระบบเดียวกันโดยไม่ต้องจ่ายใหม่ (ราคารวมอยู่ใน leg ก่อนหน้า) → `fare` ของ leg นั้นเป็น 0
- `line_color` = สีประจำสายจาก `data/lines.json` (`null` ถ้าไม่ได้ใส่ — หน้าเว็บใช้สีตามประเภทแทน)
- `ranges` (ride) = ช่วงลำดับจุดในสาย (`stops` ของสายนั้น) ที่นั่งผ่าน เช่น `[[3, 8]]` ปกติมีช่วงเดียว
  ถ้านั่งผ่านจุดที่สายวนกลับมา (สายสีน้ำเงินที่ท่าพระ) จะมีสองช่วง — ใช้ตัดเส้นบนแผนที่
- `time_estimated: true` (ride) = เวลาของสายนี้ประมาณจากระยะทาง (ฟีดยังไม่มีเวลาจริง)
- `service_hours` (ride, มีเฉพาะสายที่ไม่ได้วิ่งทั้งวัน) = ช่วงเวลาที่มีรถ/เรือ**ที่จุดขึ้น ในทิศที่นั่ง**
  `{ "weekday": [["06:20","09:15"], ...], "weekend": [] }` (รายการว่าง = วันนั้นไม่มี)
- `warnings` ให้หน้าเว็บแสดงเสมอถ้ามี
- Errors: `400 INVALID_INPUT`, `404 STOP_NOT_FOUND`, `422 NO_ROUTE`

### `POST /api/meetup` 🚧 ถ้ามีเวลา

หาจุดนัดที่ค่าเดินทางรวมของทุกคนถูกที่สุด (หรือที่คนจ่ายแพงสุดจ่ายน้อยที่สุด)

Request:

```json
{ "origins": ["SMP-A1", "SMP-U3", "SMP-B1"], "strategy": "min_total", "optimize": "cheapest" }
```

- `origins`: จุดเริ่มต้นของแต่ละคน 2–6 จุด
- `strategy`: `"min_total"` (ค่ารถรวมถูกสุด, ค่าเริ่มต้น) | `"min_max"` (ไม่ให้ใครจ่ายหนักอยู่คนเดียว)
- `optimize`: `"cheapest"` (ค่าเริ่มต้น) | `"fastest"`

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

- `per_person` ใช้ `origin_index` แทน id ของจุดเริ่มต้น — ห้ามส่งจุดเริ่มต้นของคนอื่นกลับไป (บอกได้ว่าคนนั้นอยู่ที่ไหน)
- `alternatives` สูงสุด 3 รายการ

---

## เข้าสู่ระบบและแอดมิน (เพื่อน)

- มีแต่**บัญชีผู้ดูแล** ไม่เปิดให้คนทั่วไปสมัคร สร้างบัญชีด้วย `npm run create-admin` ใน `server/`
- ล็อกอินแบบ session cookie (`httpOnly`, `sameSite=lax`, `secure` ตอน production) — หน้าเว็บส่ง cookie ทุกครั้ง (`credentials: "include"` มีใน `client/src/api.js` แล้ว)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/login` | `{ "email", "password" }` | `200 { "user": { "id", "email", "role" } }` + ตั้ง cookie / `401 UNAUTHORIZED` |
| POST | `/api/auth/logout` | – | `204` |
| GET | `/api/me` | – | `200 { "user": { "id", "email", "role" } }` / `401` |
| GET | `/api/admin/security-events` | – | `200 { "events": [ { "id", "kind", "ip_hash", "detail", "created_at" } ] }` 100 รายการล่าสุด |

- ล็อกอินผิด: ข้อความเดียวกันทุกกรณี "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ไม่บอกว่าอีเมลมีอยู่หรือไม่ และบันทึก `security_events` kind `login_failed`
- `/api/admin/*` ต้องล็อกอินและเป็น `admin` (ใช้ `requireAdmin` ใน `server/src/middleware/requireAuth.js`)
- `ip_hash` แสดงแค่ 8 ตัวแรกในหน้าแอดมินก็พอ

### แจ้งราคาไม่ตรง 🚧 ถ้ามีเวลา

**`POST /api/reports`** (ไม่ต้องล็อกอิน)

```json
{ "type": "fare_wrong", "line_id": "SMP-BUS1", "stop_id": null, "proposed_fare": 10, "website": "" }
```

- `type`: `"fare_wrong"` (ต้องมี `proposed_fare` 0–200) | `"stop_moved"` (ต้องมี `stop_id`) | `"line_cancelled"`
- **ไม่มีช่องข้อความอิสระ** (ตั้งใจ — ไม่ต้องกรองคำหยาบ ไม่มีที่ให้ใส่ลิงก์สแปม)
- `website` = ช่อง honeypot ที่ซ่อนในฟอร์ม คนจริงจะเว้นว่าง ถ้ามีค่า server ตอบ `201` เหมือนปกติแต่**ไม่บันทึก** และเก็บลง `security_events` kind `honeypot`
- Response `201`: `{ "report": { "id": 1, "status": "pending" } }`

**แอดมิน**

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/api/admin/reports?status=pending` | รายการที่รอตรวจ จัดกลุ่มตาม (สาย, ประเภท, ราคาที่เสนอ) พร้อมจำนวนคนแจ้งที่ต่างกันจริง (`COUNT(DISTINCT ip_hash)`) |
| POST | `/api/admin/reports/:id/approve` | อนุมัติ → คนหลักแก้ `data/fares.json` ผ่าน PR โดยใส่เลขรีพอร์ตใน `source` |
| POST | `/api/admin/reports/:id/reject` | ปฏิเสธ |

ราคาที่ใช้คำนวณ**ไม่เปลี่ยนตามรีพอร์ตโดยตรง** ต้องผ่านแอดมินเสมอ

---

## Rate limit (ต่อ IP)

| ขอบเขต | จำกัด |
|---|---|
| ทั้ง API | 300 ครั้ง / 15 นาที (มีแล้ว) |
| `/api/auth/*` | 10 ครั้ง / 15 นาที (เพื่อนทำ) |
| `POST /api/reports` | 5 ครั้ง / วัน (เพื่อนทำ) |

เกินแล้วตอบ `429 RATE_LIMITED` และบันทึกลง `security_events` kind `rate_limited`
