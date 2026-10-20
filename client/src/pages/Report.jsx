/**
 * ส่วน D — หน้าแจ้งข้อมูลผิด
 * API: submitReport() ใน src/api.js (server ยังตอบ 501 จนกว่าส่วน D จะทำ routes/reports.js)
 *
 * ออกแบบให้ไม่มีช่องพิมพ์อิสระ (ตั้งใจ) → ไม่ต้องกรองคำหยาบ ไม่มีที่ให้ใส่ลิงก์สแปม
 * ช่อง "website" คือ honeypot: ซ่อนจากคน แต่บอตจะกรอก → server ทิ้งรีพอร์ตนั้น
 *
 * TODO (ส่วน D): ต้องล็อกอินก่อนแจ้ง (รอส่วน C), แสดงข้อความเมื่อโดน rate limit (429)
 */
import { useEffect, useState } from 'react';
import { getLines, getStops, submitReport } from '../api.js';
import StopSelect from '../components/StopSelect.jsx';

const TYPES = [
  { value: 'fare_wrong', label: 'ราคาไม่ตรง' },
  { value: 'stop_moved', label: 'ป้าย/จุดจอดย้าย' },
  { value: 'line_cancelled', label: 'สายนี้ยกเลิกแล้ว' },
];

export default function Report() {
  const [lines, setLines] = useState([]);
  const [stops, setStops] = useState([]);
  const [form, setForm] = useState({ type: 'fare_wrong', line_id: '', stop_id: '', proposed_fare: '', website: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getLines(), getStops()])
      .then(([l, s]) => {
        setLines(l.lines);
        setStops(s.stops);
      })
      .catch((err) => setError(err.message));
  }, []);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.line_id) return setError('กรุณาเลือกสาย');
    if (form.type === 'fare_wrong' && form.proposed_fare === '') return setError('กรุณาใส่ราคาที่ถูกต้อง');
    if (form.type === 'stop_moved' && !form.stop_id) return setError('กรุณาเลือกจุดที่ย้าย');
    try {
      await submitReport({
        type: form.type,
        line_id: form.line_id,
        stop_id: form.stop_id || null,
        proposed_fare: form.type === 'fare_wrong' ? Number(form.proposed_fare) : null,
        website: form.website,
      });
      setMessage('ขอบคุณครับ ทีมจะตรวจสอบก่อนแก้ข้อมูล');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>แจ้งข้อมูลไม่ถูกต้อง</h2>

      <label htmlFor="report-type">เรื่องที่แจ้ง</label>
      <select id="report-type" value={form.type} onChange={(e) => set('type')(e.target.value)}>
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <label htmlFor="report-line">สาย</label>
      <select id="report-line" value={form.line_id} onChange={(e) => set('line_id')(e.target.value)}>
        <option value="">เลือกสาย</option>
        {lines.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name_th}
          </option>
        ))}
      </select>

      {form.type === 'fare_wrong' && (
        <>
          <label htmlFor="report-fare">ราคาที่ถูกต้อง (บาท)</label>
          <input
            id="report-fare"
            type="number"
            inputMode="decimal"
            min="0"
            max="200"
            step="0.5"
            value={form.proposed_fare}
            onChange={(e) => set('proposed_fare')(e.target.value)}
          />
        </>
      )}

      {form.type === 'stop_moved' && (
        <>
          <label htmlFor="report-stop">จุดที่ย้าย</label>
          <StopSelect id="report-stop" stops={stops} value={form.stop_id} onChange={set('stop_id')} placeholder="เลือกจุด" />
        </>
      )}

      {/* honeypot — ซ่อนจากคนและโปรแกรมอ่านหน้าจอ */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="report-website">Website</label>
        <input
          id="report-website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set('website')(e.target.value)}
        />
      </div>

      <button type="submit" className="primary">
        ส่งข้อมูล
      </button>
      {message && <p className="success">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
