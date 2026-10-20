import { MODE_LABEL, MODE_ORDER } from '../labels.js';

/**
 * ช่องเลือกจุด (สถานี / ป้ายรถเมล์ / ท่าเรือ) ใช้ร่วมกันทุกหน้า
 * - มี lines: แยกกลุ่มตามสาย (group ใน lines.json) เรียงตามลำดับจุดบนสาย คนรู้จักลำดับสถานีอยู่แล้ว
 *   จุดที่อยู่หลายสาย (จุดต่อรถ) แสดงครั้งเดียวในสายแรกที่ผ่าน
 * - ไม่มี lines: แยกกลุ่มตามประเภทรถ
 */
export default function StopSelect({ id, stops, lines, value, onChange, placeholder }) {
  const groups = lines?.length ? groupByLine(stops, lines) : groupByMode(stops);
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name_th}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function groupByMode(stops) {
  return MODE_ORDER.map((mode) => ({ label: MODE_LABEL[mode], items: stops.filter((s) => s.mode === mode) })).filter(
    (g) => g.items.length > 0,
  );
}

function groupByLine(stops, lines) {
  const byId = new Map(stops.map((s) => [s.id, s]));
  const placed = new Set();
  const groups = new Map();
  const ordered = [...lines].sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode));
  for (const line of ordered) {
    const label = line.group ?? line.name_th;
    if (!groups.has(label)) groups.set(label, { label, items: [] });
    for (const stopId of line.stops) {
      if (placed.has(stopId) || !byId.has(stopId)) continue;
      placed.add(stopId);
      groups.get(label).items.push(byId.get(stopId));
    }
  }
  return [...groups.values()].filter((g) => g.items.length > 0);
}
