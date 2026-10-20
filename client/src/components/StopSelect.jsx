import { MODE_LABEL } from '../labels.js';

/** ช่องเลือกจุด (สถานี / ป้ายรถเมล์ / ท่าเรือ) ใช้ร่วมกันทุกหน้า */
export default function StopSelect({ id, stops, value, onChange, placeholder }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {stops.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name_th} ({MODE_LABEL[s.mode] ?? s.mode})
        </option>
      ))}
    </select>
  );
}
