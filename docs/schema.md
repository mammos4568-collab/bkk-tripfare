# รูปแบบข้อมูล

มีข้อมูล 2 ส่วน:

1. **ข้อมูลขนส่ง** (สถานี สายรถ ราคา) → ไฟล์ JSON ใน `data/` อ่านอย่างเดียวตอน server เริ่ม แก้ผ่าน PR เท่านั้น ประวัติการแก้ทั้งหมดจึงอยู่ใน git (ย้อนกลับได้เสมอ)
2. **ข้อมูลผู้ใช้** (บัญชี สถานที่บันทึก รีพอร์ต) → PostgreSQL ตาม `db/schema.sql`

---

## 1. ข้อมูลขนส่ง (`data/`)

### `stops.json` — สถานี / ป้ายรถเมล์ / ท่าเรือ

```json
[{ "id": "SMP-A1", "name_th": "[ตัวอย่าง] ต้นสายแดง", "name_en": "[Sample] Red Terminus", "mode": "rail", "lat": 13.8, "lon": 100.55 }]
```

| ช่อง | ชนิด | บังคับ | หมายเหตุ |
|---|---|---|---|
| `id` | string | ✓ | ห้ามซ้ำ รูปแบบ `<ระบบ>-<รหัส>` เช่น `BTS-xxx`, `MRT-xxx`, `BUS-<สาย>-<ลำดับ>` |
| `name_th` | string | ✓ | |
| `name_en` | string | | |
| `mode` | `"rail"` \| `"bus"` \| `"boat"` | ✓ | ประเภทหลักของจุดนี้ |
| `lat`, `lon` | number | ✓ | พิกัด WGS84 (ใช้วาดแผนที่) |

> ตัวอย่างทั้งหมดในไฟล์นี้เป็นข้อมูลสมมติ ใช้อธิบายรูปแบบเท่านั้น

### `lines.json` — สายรถ / สายเรือ

```json
[{
  "id": "SMP-RED", "name_th": "[ตัวอย่าง] สายสีแดงสมมติ", "mode": "rail", "operator": "SAMPLE_RAIL",
  "stops": ["SMP-A1", "SMP-A2", "SMP-C0"], "bidirectional": true,
  "minutes_between_stops": 2.5, "headway_minutes": 6, "fare_rule": "smp_rail"
}]
```

| ช่อง | ชนิด | บังคับ | หมายเหตุ |
|---|---|---|---|
| `id` | string | ✓ | |
| `name_th` | string | ✓ | |
| `mode` | `"rail"` \| `"bus"` \| `"boat"` | ✓ | |
| `operator` | string | ✓ | ผู้ให้บริการ |
| `stops` | string[] | ✓ | เรียงตามลำดับที่รถวิ่ง อย่างน้อย 2 จุด ทุก id ต้องมีใน `stops.json` |
| `bidirectional` | boolean | | ค่าเริ่มต้น `true` (วิ่งทั้งไปและกลับ) |
| `minutes_between_stops` | number | ✓ | เวลาเฉลี่ยระหว่างจุด |
| `headway_minutes` | number | ✓ | รถมาทุกกี่นาทีโดยเฉลี่ย ระบบคิดเวลารอ = ครึ่งหนึ่งของค่านี้ |
| `fare_rule` | string | ✓ | id ของกฎราคาใน `fares.json` |

**จุดต่อรถ:** ถ้าสองสายจอดที่สถานีเดียวกันและต่อได้โดยไม่ต้องออกจากระบบ ให้ใช้ **id เดียวกัน** ในทั้งสองสาย ถ้าต้องเดินไปอีกจุด ให้แยก id แล้วใส่ใน `transfers.json`

### `transfers.json` — ทางเดินเชื่อมระหว่างจุด

```json
[{ "from": "SMP-B2", "to": "SMP-P1", "walk_minutes": 5 }]
```

ใช้ได้ทั้งสองทิศทาง ใส่เฉพาะจุดที่เดินถึงกันจริงในเวลาไม่นาน (แนะนำไม่เกิน 10 นาที)

### `fares.json` — กฎราคา

```json
{
  "rules": [
    { "id": "smp_bus", "type": "flat", "amount": 8, "source": "SAMPLE: ข้อมูลสมมติ", "checked_at": "2026-10-20" }
  ],
  "policies": []
}
```

**ชนิดกฎราคา (`type`)**

| type | ช่อง | วิธีคิด |
|---|---|---|
| `flat` | `amount` | ราคาเดียวตลอดสาย |
| `by_stops` | `base`, `per_stop`, `max` | `min(max, base + per_stop × จำนวนจุดที่นั่ง)` |
| `table` | `table`, `fallback` (ไม่บังคับ) | หาใน `table` ด้วย key `"ต้นทาง\|ปลายทาง"` (ทิศไหนก็ได้) ถ้าไม่เจอใช้ `fallback` (`base`, `per_stop`, `max`) |

**ช่องที่ทุกกฎต้องมี / มีได้**

| ช่อง | บังคับ | หมายเหตุ |
|---|---|---|
| `source` | ✓ | URL แหล่งทางการ หรือ "สำรวจเอง วันที่ ... (รูปใน evidence/)" — ข้อมูลสมมติขึ้นต้นด้วย `SAMPLE` |
| `checked_at` | ✓ | วันที่ตรวจล่าสุด `YYYY-MM-DD` |
| `merge_transfers` | | `true` = ต่อสายที่ใช้กฎเดียวกันที่สถานีเดียวกัน คิดเป็นเที่ยวเดียว (ไม่จ่ายค่าแรกเข้าซ้ำ) |
| `note` | | หมายเหตุ เช่น ราคานี้สำหรับรถแอร์ |

**`policies` — นโยบายเพดานราคา** (เช่น นโยบายค่าโดยสารสูงสุดของรัฐ ซึ่งเปิด/ปิด/เปลี่ยนตามประกาศ)

```json
{ "id": "rail_cap", "description": "เพดานราคารถไฟฟ้าต่อเที่ยว", "modes": ["rail"],
  "max_fare_per_ride": 20, "active": false, "source": "https://...", "checked_at": "2026-10-20" }
```

นโยบายเปลี่ยนบ่อย → แก้แค่ `active` / `max_fare_per_ride` ไม่ต้องแก้โค้ด

### ข้อจำกัดที่รู้อยู่แล้ว (บอกตรง ๆ ตอนพรีเซนต์ได้)

- ไม่มีตารางเวลาจริง ใช้ค่าเฉลี่ย `headway_minutes` แทน
- โหมด `cheapest` ใช้ราคาโดยประมาณระหว่างค้นหา (ค่าแรกเข้า + ต่อจุด, ยังไม่คิดเพดาน `max` / ตาราง / นโยบาย) แล้วค่อยคิดราคาจริงหลังได้เส้นทาง จึงอาจไม่ใช่เส้นทางที่ถูกที่สุดจริงในบางกรณี

---

## 2. ฐานข้อมูล PostgreSQL (`db/schema.sql`)

รันอัตโนมัติตอน `docker compose up` ครั้งแรก (ถ้าแก้ schema ให้ `docker compose down -v` แล้วขึ้นใหม่ — **ข้อมูลในเครื่องจะหาย**)

### `users` — ส่วน C

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | serial PK | |
| `email` | text unique | เก็บเป็นตัวพิมพ์เล็ก |
| `password_hash` | text | bcryptjs (cost 12) — **ห้ามเก็บรหัสผ่านตรง ๆ** |
| `role` | text | `user` \| `admin` |
| `trust_score` | int | คะแนนความน่าเชื่อถือของผู้แจ้ง (ส่วน D ใช้) |
| `created_at` | timestamptz | |

### `saved_places` — ส่วน C

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | serial PK | |
| `user_id` | FK → users (ลบตามเมื่อลบบัญชี) | |
| `label` | varchar(30) | เช่น "หอ", "มหาลัย" — ห้ามซ้ำในผู้ใช้คนเดียวกัน |
| `stop_id` | text | id ของจุดใกล้ที่นั้น **ไม่เก็บที่อยู่หรือพิกัดจริง** |

### `reports` — ส่วน D

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | serial PK | |
| `user_id` | FK → users (เป็น NULL เมื่อลบบัญชี) | |
| `type` | text | `fare_wrong` \| `stop_moved` \| `line_cancelled` |
| `line_id`, `stop_id` | text | |
| `proposed_fare` | numeric | 0–200 |
| `status` | text | `pending` \| `approved` \| `rejected` |
| `ip_hash` | text | SHA-256 ของ IP + salt — **ไม่เก็บ IP ตรง ๆ** ใช้นับว่าผู้แจ้งมาจากคนละที่จริงไหม |
| `reviewed_by`, `reviewed_at` | | แอดมินที่ตรวจ |

### `security_events` — ส่วน C, D (log สำหรับทำ dashboard แบบ SOC)

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `kind` | text | `rate_limited`, `login_failed`, `honeypot`, `report_rejected`, ... |
| `ip_hash` | text | |
| `user_id` | FK (NULL ได้) | |
| `detail` | jsonb | รายละเอียดเพิ่ม — **ห้ามใส่รหัสผ่านหรือข้อมูลส่วนตัว** |
| `created_at` | timestamptz | ลบอัตโนมัติหลัง 90 วัน (ทำเป็น job หรือสั่งลบตอน server เริ่ม) |

### `session`

ตารางเก็บ session ของ `connect-pg-simple` สร้างเองอัตโนมัติด้วย `createTableIfMissing: true`
