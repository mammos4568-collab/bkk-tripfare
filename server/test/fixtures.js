/**
 * ข้อมูลทดสอบขนาดเล็ก (แยกจาก data/ — แก้ข้อมูลจริงแล้ว test จะไม่พัง)
 *
 *   L1 (rail): X1 — X2 — X3 — X4      ทุก 2 นาที, รถมาทุก 4 นาที (รอ 2)
 *   L2 (rail): Y1 — X3 — Y3           ทุก 3 นาที, รถมาทุก 6 นาที (รอ 3)
 *   BUS:       B1 ——————— B2          20 นาที, รถมาทุก 10 นาที (รอ 5)
 *   เดิน: X1 ↔ B1 (1 นาที), B2 ↔ X4 (1 นาที)
 *   Z = จุดที่ไม่มีอะไรผ่าน (ไว้ทดสอบ NO_ROUTE)
 *
 *   ราคา rail: 10 + 2 × จำนวนจุด สูงสุด 30, ต่อสาย L1 ↔ L2 ไม่จ่ายใหม่
 *   ราคา bus: 5 บาทตลอดสาย
 */
export function makeFixture() {
  const stop = (id, mode) => ({ id, name_th: `จุด ${id}`, mode, lat: 13.75, lon: 100.5 });
  return {
    stops: [
      stop('X1', 'rail'), stop('X2', 'rail'), stop('X3', 'rail'), stop('X4', 'rail'),
      stop('Y1', 'rail'), stop('Y3', 'rail'),
      stop('B1', 'bus'), stop('B2', 'bus'),
      stop('Z', 'bus'),
    ],
    lines: [
      { id: 'L1', name_th: 'สาย 1', mode: 'rail', operator: 'T', stops: ['X1', 'X2', 'X3', 'X4'],
        minutes_between_stops: 2, headway_minutes: 4, fare_rule: 'rail' },
      { id: 'L2', name_th: 'สาย 2', mode: 'rail', operator: 'T', stops: ['Y1', 'X3', 'Y3'],
        minutes_between_stops: 3, headway_minutes: 6, fare_rule: 'rail' },
      { id: 'BUS', name_th: 'รถเมล์', mode: 'bus', operator: 'T', stops: ['B1', 'B2'],
        minutes_between_stops: 20, headway_minutes: 10, fare_rule: 'bus' },
    ],
    transfers: [
      { from: 'X1', to: 'B1', walk_minutes: 1 },
      { from: 'B2', to: 'X4', walk_minutes: 1 },
    ],
    fares: {
      rules: [
        { id: 'rail', type: 'by_stops', base: 10, per_stop: 2, max: 30, merge_transfers: true,
          source: 'test', checked_at: '2026-01-01' },
        { id: 'bus', type: 'flat', amount: 5, source: 'test', checked_at: '2026-01-01' },
      ],
      policies: [],
    },
  };
}
