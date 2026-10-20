/**
 * ส่วน B — หน้าวางแผนเดินทางหลายจุด
 * API: getStops(), planTrip() ใน src/api.js
 *
 * TODO (ส่วน B):
 *  - ปรับหน้าตาให้สวยและใช้ง่ายบนมือถือ
 *  - ช่องค้นหาจุดแบบพิมพ์แล้วขึ้นรายการ (ตอนข้อมูลจริงมีหลายร้อยจุด select ธรรมดาจะใช้ยาก)
 *  - ปุ่มสลับลำดับจุด / ลากเรียงจุดแวะ
 *  - (ถ้ามีเวลา) แผนที่ด้วย Leaflet + OpenStreetMap — บอกทีมก่อนเพิ่ม library และใส่เครดิต OSM
 */
import { useEffect, useState } from 'react';
import { getStops, planTrip } from '../api.js';
import StopSelect from '../components/StopSelect.jsx';
import TripResult from '../components/TripResult.jsx';

const MAX_POINTS = 6;

export default function PlanTrip() {
  const [stops, setStops] = useState([]);
  const [waypoints, setWaypoints] = useState(['', '']);
  const [optimize, setOptimize] = useState('fastest');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStops()
      .then((data) => setStops(data.stops))
      .catch((err) => setError(err.message));
  }, []);

  const setPoint = (index, value) => setWaypoints((w) => w.map((v, i) => (i === index ? value : v)));
  // เพิ่มจุดแวะก่อนปลายทางเสมอ
  const addStop = () => setWaypoints((w) => [...w.slice(0, -1), '', w.at(-1)]);
  const removeStop = (index) => setWaypoints((w) => w.filter((_, i) => i !== index));

  const placeholder = (i) => (i === 0 ? 'เลือกต้นทาง' : i === waypoints.length - 1 ? 'เลือกปลายทาง' : 'เลือกจุดแวะ');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (waypoints.some((w) => !w)) {
      setError('กรุณาเลือกให้ครบทุกจุด');
      return;
    }
    setLoading(true);
    try {
      setResult(await planTrip(waypoints, optimize));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={handleSubmit}>
        <h2>วันนี้จะไปไหนบ้าง</h2>

        <ol className="waypoints">
          {waypoints.map((value, i) => (
            <li key={i}>
              <label className="sr-only" htmlFor={`point-${i}`}>
                {placeholder(i)}
              </label>
              <StopSelect
                id={`point-${i}`}
                stops={stops}
                value={value}
                onChange={(v) => setPoint(i, v)}
                placeholder={placeholder(i)}
              />
              {waypoints.length > 2 && (
                <button type="button" className="icon-btn" onClick={() => removeStop(i)} aria-label="ลบจุดนี้">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>

        {waypoints.length < MAX_POINTS && (
          <button type="button" className="link-btn" onClick={addStop}>
            + เพิ่มจุดแวะ
          </button>
        )}

        <fieldset className="choice">
          <legend>เลือกเส้นทางแบบ</legend>
          <label>
            <input
              type="radio"
              name="optimize"
              value="fastest"
              checked={optimize === 'fastest'}
              onChange={() => setOptimize('fastest')}
            />{' '}
            เร็วที่สุด
          </label>
          <label>
            <input
              type="radio"
              name="optimize"
              value="cheapest"
              checked={optimize === 'cheapest'}
              onChange={() => setOptimize('cheapest')}
            />{' '}
            ถูกที่สุด
          </label>
        </fieldset>

        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'กำลังคำนวณ…' : 'หาเส้นทาง'}
        </button>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && <TripResult trip={result} />}
    </>
  );
}
