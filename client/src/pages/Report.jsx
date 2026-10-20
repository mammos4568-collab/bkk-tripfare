/**
 * แจ้งราคาไม่ตรง (เพื่อน — ทำถ้ามีเวลา, แอดมินเป็นคนตรวจ)
 * API: submitReport() ใน src/api.js — server ยังตอบ 501 จนกว่าจะทำ server/src/routes/reports.js
 * เปิดใช้ในเว็บจริงด้วย src/features.js (report: true)
 *
 * ไม่มีช่องพิมพ์อิสระ (ตั้งใจ) → ไม่ต้องกรองคำหยาบ ไม่มีที่ให้ใส่ลิงก์สแปม
 * ช่อง "website" คือ honeypot: ซ่อนจากคน แต่บอตจะกรอก → server ทิ้งรีพอร์ตนั้น
 */
import { useEffect, useState } from 'react';
import { getLines, getStops, submitReport } from '../api.js';
import StopSelect from '../components/StopSelect.jsx';

const TYPES = [
  { value: 'fare_wrong', label: 'ราคาไม่ตรง' },
  { value: 'stop_moved', label: 'ป้ายหรือจุดจอดย้าย' },
  { value: 'line_cancelled', label: 'สายนี้ไม่วิ่งแล้ว' },
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
    if (!form.line_id) return setError('เลือกสายก่อน');
    if (form.type === 'fare_wrong' && form.proposed_fare === '') return setError('ใส่ราคาที่ถูกต้อง');
    if (form.type === 'stop_moved' && !form.stop_id) return setError('เลือกจุดที่ย้าย');
    try {
      await submitReport({
        type: form.type,
        line_id: form.line_id,
        stop_id: form.stop_id || null,
        proposed_fare: form.type === 'fare_wrong' ? Number(form.proposed_fare) : null,
        website: form.website,
      });
      setMessage('ส่งแล้ว ทีมจะตรวจก่อนแก้ข้อมูล');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="report narrow" onSubmit={handleSubmit} aria-labelledby="report-title">
      <h3 id="report-title">เจอราคาไม่ตรง แจ้งเราได้</h3>

      <label htmlFor="report-type">เรื่องที่แจ้ง</label>
      <select id="report-type" className="field" value={form.type} onChange={(e) => set('type')(e.target.value)}>
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <label htmlFor="report-line">สาย</label>
      <select id="report-line" className="field" value={form.line_id} onChange={(e) => set('line_id')(e.target.value)}>
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
            className="field"
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

      <button type="submit" className="go secondary">
        ส่งให้ทีมตรวจ
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
