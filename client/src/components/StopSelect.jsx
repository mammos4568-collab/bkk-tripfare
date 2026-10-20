import { MODE_LABEL, MODE_ORDER } from '../labels.js';

/** ช่องเลือกจุด (สถานี / ป้ายรถเมล์ / ท่าเรือ) แยกกลุ่มตามประเภท ใช้ร่วมกันทุกหน้า */
export default function StopSelect({ id, stops, value, onChange, placeholder }) {
  const groups = MODE_ORDER.map((mode) => ({ mode, items: stops.filter((s) => s.mode === mode) })).filter(
    (g) => g.items.length > 0,
  );
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.mode} label={MODE_LABEL[g.mode]}>
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
