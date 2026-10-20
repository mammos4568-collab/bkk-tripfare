/**
 * ส่วน D — หน้านัดเจอกลุ่ม
 * API: findMeetup() ใน src/api.js (server ยังตอบ 501 จนกว่าส่วน D จะทำ routes/meetup.js)
 * ใช้ VITE_USE_MOCK=true เพื่อดูหน้าตาด้วยข้อมูลจำลองได้เลย
 *
 * TODO (ส่วน D):
 *  - ปรับหน้าตา, แสดง alternatives, ปุ่ม "วางแผนเดินทางไปจุดนี้"
 *  - ห้ามแสดงจุดเริ่มต้นของคนอื่นถ้าต่อยอดเป็นกลุ่มหลายบัญชี (ใช้ origin_index)
 */
import { useEffect, useState } from 'react';
import { findMeetup, getStops } from '../api.js';
import StopSelect from '../components/StopSelect.jsx';
import { baht } from '../labels.js';

const MAX_PEOPLE = 6;

export default function Meetup() {
  const [stops, setStops] = useState([]);
  const [origins, setOrigins] = useState(['', '']);
  const [strategy, setStrategy] = useState('min_total');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStops()
      .then((data) => setStops(data.stops))
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (origins.some((o) => !o)) {
      setError('กรุณาเลือกจุดเริ่มต้นของทุกคน');
      return;
    }
    setLoading(true);
    try {
      setResult(await findMeetup(origins, strategy));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={handleSubmit}>
        <h2>หาจุดนัดที่ค่าเดินทางคุ้มที่สุด</h2>
        <ol className="waypoints">
          {origins.map((value, i) => (
            <li key={i}>
              <label className="sr-only" htmlFor={`origin-${i}`}>
                จุดเริ่มต้นของคนที่ {i + 1}
              </label>
              <StopSelect
                id={`origin-${i}`}
                stops={stops}
                value={value}
                onChange={(v) => setOrigins((o) => o.map((x, j) => (j === i ? v : x)))}
                placeholder={`คนที่ ${i + 1} ออกจาก…`}
              />
              {origins.length > 2 && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setOrigins((o) => o.filter((_, j) => j !== i))}
                  aria-label={`ลบคนที่ ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
        {origins.length < MAX_PEOPLE && (
          <button type="button" className="link-btn" onClick={() => setOrigins((o) => [...o, ''])}>
            + เพิ่มคน
          </button>
        )}

        <fieldset className="choice">
          <legend>เลือกจุดนัดแบบ</legend>
          <label>
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'min_total'}
              onChange={() => setStrategy('min_total')}
            />{' '}
            ค่าเดินทางรวมถูกสุด
          </label>
          <label>
            <input type="radio" name="strategy" checked={strategy === 'min_max'} onChange={() => setStrategy('min_max')} />{' '}
            ยุติธรรมสุด (คนที่จ่ายแพงสุดจ่ายน้อยที่สุด)
          </label>
        </fieldset>

        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'กำลังคำนวณ…' : 'หาจุดนัด'}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="card result" aria-label="ผลจุดนัด">
          <h3>นัดที่ {result.best.name}</h3>
          <p className="muted">
            รวมทุกคน {baht(result.best.total_fare)} · คนที่จ่ายมากสุด {baht(result.best.max_fare)}
          </p>
          <ul className="plain-list">
            {result.per_person.map((p) => (
              <li key={p.origin_index}>
                คนที่ {p.origin_index + 1}: {baht(p.fare)} · {p.minutes} นาที
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
