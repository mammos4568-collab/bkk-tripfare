/**
 * นัดเจอกลุ่ม (คนหลัก — ทำถ้ามีเวลา)
 * API: findMeetup() ใน src/api.js — server ยังตอบ 501 จนกว่าจะทำ server/src/routes/meetup.js
 * เปิดใช้ในเว็บจริงด้วย src/features.js (meetup: true)
 *
 * ห้ามแสดงจุดเริ่มต้นของคนอื่น ถ้าต่อยอดเป็นกลุ่มหลายคนจริง (ใช้ origin_index)
 */
import { useEffect, useState } from 'react';
import { findMeetup, getStops } from '../api.js';
import StopSelect from '../components/StopSelect.jsx';
import { num } from '../labels.js';

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
    if (origins.some((o) => !o)) {
      setError('เลือกจุดเริ่มต้นของทุกคนก่อน');
      return;
    }
    setLoading(true);
    try {
      setResult(await findMeetup(origins, strategy));
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section wrap" id="meetup" aria-labelledby="meetup-title">
      <h2 id="meetup-title">นัดเพื่อนที่ไหนดี</h2>
      <div className="section-body">
        <p>ใส่จุดที่แต่ละคนจะออกเดินทาง แล้วเราจะหาที่นัดที่ค่ารถของทุกคนรวมกันแล้วคุ้มที่สุด</p>

        <form onSubmit={handleSubmit} className="narrow">
          <ol className="stops people">
            {origins.map((value, i) => (
              <li key={i}>
                <label className="sr-only" htmlFor={`origin-${i}`}>
                  คนที่ {i + 1} ออกจาก
                </label>
                <StopSelect
                  id={`origin-${i}`}
                  stops={stops}
                  value={value}
                  onChange={(v) => setOrigins((o) => o.map((x, j) => (j === i ? v : x)))}
                  placeholder={`คนที่ ${i + 1} ออกจาก`}
                />
                {origins.length > 2 && (
                  <button
                    type="button"
                    className="text-btn quiet"
                    onClick={() => setOrigins((o) => o.filter((_, j) => j !== i))}
                  >
                    เอาออก
                  </button>
                )}
              </li>
            ))}
          </ol>
          {origins.length < MAX_PEOPLE && (
            <button type="button" className="text-btn add-stop" onClick={() => setOrigins((o) => [...o, ''])}>
              เพิ่มคน
            </button>
          )}

          <fieldset className="radios">
            <legend>เลือกที่นัดแบบ</legend>
            <label>
              <input
                type="radio"
                name="strategy"
                checked={strategy === 'min_total'}
                onChange={() => setStrategy('min_total')}
              />
              ค่ารถรวมทุกคนถูกที่สุด
            </label>
            <label>
              <input type="radio" name="strategy" checked={strategy === 'min_max'} onChange={() => setStrategy('min_max')} />
              ไม่ให้ใครต้องจ่ายหนักอยู่คนเดียว
            </label>
          </fieldset>

          <button type="submit" className="go" disabled={loading}>
            {loading ? 'กำลังหา…' : 'หาที่นัด'}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>

        {result && (
          <div className="meetup-result" aria-live="polite">
            <p className="choice-name">นัดที่ {result.best.name}</p>
            <p className="total">
              {num(result.best.total_fare)}
              <small>บาท รวมทุกคน</small>
            </p>
            <ul className="people-fares">
              {result.per_person.map((p) => (
                <li key={p.origin_index}>
                  <span>คนที่ {p.origin_index + 1}</span>
                  <span>
                    <b>{num(p.fare)}</b> บาท {p.minutes} นาที
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
