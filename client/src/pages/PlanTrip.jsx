/**
 * ส่วนแรกของเว็บ: วางแผนเดินทางหลายจุด (คนหลัก)
 * API: getNetwork(), getTripOptions() ใน src/api.js
 * แนวทางการออกแบบ: docs/DESIGN.md
 *
 * TODO:
 *  - ช่องค้นหาจุดแบบพิมพ์แล้วขึ้นรายการ (ตอนข้อมูลจริงมีหลายร้อยจุด select จะยาวมาก)
 *  - ปุ่มสลับต้นทาง/ปลายทาง
 */
import { useEffect, useRef, useState } from 'react';
import { getNetwork, getTripOptions } from '../api.js';
import { RouteAlternatives, RouteSummary } from '../components/RouteChoices.jsx';
import RouteMap from '../components/RouteMap.jsx';
import RouteSteps from '../components/RouteSteps.jsx';
import StopSelect from '../components/StopSelect.jsx';
import { thaiDate } from '../labels.js';
import { PRESETS } from '../presets.js';

const MAX_POINTS = 6;

export default function PlanTrip() {
  const [network, setNetwork] = useState(null);
  const [waypoints, setWaypoints] = useState(['', '']);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    getNetwork()
      .then(setNetwork)
      .catch((err) => setError(err.message));
  }, []);

  // จอแคบ: ผลอยู่ใต้ฟอร์ม → เลื่อนลงไปให้เห็น และย้าย focus ไปที่ผลลัพธ์
  useEffect(() => {
    if (!result || !resultsRef.current) return;
    if (window.matchMedia('(max-width: 959px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultsRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    resultsRef.current.focus({ preventScroll: true });
  }, [result]);

  const stops = network?.stops ?? [];

  const setPoint = (index, value) => setWaypoints((w) => w.map((v, i) => (i === index ? value : v)));
  // จุดแวะใหม่แทรกก่อนปลายทางเสมอ
  const addStop = () => setWaypoints((w) => [...w.slice(0, -1), '', w.at(-1)]);
  const removeStop = (index) => setWaypoints((w) => w.filter((_, i) => i !== index));

  /** กดจุดบนแผนที่: role = start | via | end */
  function pickStop(id, role) {
    setWaypoints((w) => {
      if (role === 'start') return [id, ...w.slice(1)];
      if (role === 'end') return [...w.slice(0, -1), id];
      const emptyVia = w.findIndex((v, i) => i > 0 && i < w.length - 1 && !v);
      if (emptyVia !== -1) return w.map((v, i) => (i === emptyVia ? id : v));
      if (w.length >= MAX_POINTS) return w;
      return [...w.slice(0, -1), id, w.at(-1)];
    });
  }

  const placeholder = (i) => (i === 0 ? 'ต้นทาง' : i === waypoints.length - 1 ? 'ปลายทาง' : `จุดแวะที่ ${i}`);

  // เส้นทางตัวอย่างที่มีจุดครบในข้อมูล → เขียนเป็นประโยค "จาก A แวะ B ไป C"
  const nameOf = new Map(stops.map((s) => [s.id, s.name_th]));
  const presets = PRESETS.filter((ids) => ids.every((id) => nameOf.has(id))).map((ids) => ({
    ids,
    label: ids
      .map((id, i) => `${i === 0 ? 'จาก' : i === ids.length - 1 ? 'ไป' : 'แวะ'} ${nameOf.get(id)}`)
      .join(' '),
  }));

  function handleSubmit(event) {
    event.preventDefault();
    if (waypoints.some((w) => !w)) {
      setError('เลือกให้ครบทุกจุดก่อน');
      return;
    }
    runTrip(waypoints);
  }

  function tryPreset(ids) {
    setWaypoints(ids);
    runTrip(ids);
  }

  async function runTrip(points) {
    setError('');
    setLoading(true);
    try {
      const data = await getTripOptions(points);
      setSelected(data.best.cheapest); // จุดขายของเว็บคือราคา → เปิดมาที่ทางที่ถูกที่สุดก่อน
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hero wrap" id="plan" aria-label="วางแผนเดินทาง">
      <div className="hero-plan">
        <h1>
          รู้ค่ารถทั้งวัน
          <br />
          ก่อนออกจากบ้าน
        </h1>
        <p className="lede">
          เลือกทุกที่ที่จะไปวันนี้ตามลำดับ เว็บจะรวมค่ารถไฟฟ้า รถไฟ รถเมล์ และเรือให้เป็นยอดเดียว
          แล้วบอกว่าทางไหนถูกกว่า ทางไหนเร็วกว่า
        </p>

        <form onSubmit={handleSubmit} aria-label="จุดที่จะไป">
          <ol className="stops">
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
                {i > 0 && i < waypoints.length - 1 && (
                  <button type="button" className="text-btn quiet" onClick={() => removeStop(i)}>
                    เอาออก
                  </button>
                )}
              </li>
            ))}
          </ol>

          {waypoints.length < MAX_POINTS && (
            <button type="button" className="text-btn add-stop" onClick={addStop}>
              เพิ่มจุดแวะ
            </button>
          )}

          <button type="submit" className="go" disabled={loading}>
            {loading ? 'กำลังคำนวณ…' : 'คำนวณค่าเดินทาง'}
          </button>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>

      <div className="hero-result" ref={resultsRef} tabIndex={-1} aria-live="polite">
        {result ? (
          <RouteSummary result={result} selected={selected} />
        ) : (
          <div className="empty">
            <p>
              ผลจะขึ้นตรงนี้ ทั้งค่ารถรวมทั้งวัน เวลาที่ใช้ และทางที่ถูกกว่าหรือเร็วกว่าให้เทียบ
              กดจุดบนแผนที่เพื่อเลือกต้นทาง จุดแวะ หรือปลายทางก็ได้
            </p>
            {presets.length > 0 && (
              <>
                <p className="presets-title">ลองเส้นทางตัวอย่าง</p>
                <ul className="presets">
                  {presets.map((p) => (
                    <li key={p.ids.join('>')}>
                      <button type="button" className="text-btn" onClick={() => tryPreset(p.ids)} disabled={loading}>
                        {p.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {network && <RouteMap network={network} option={result ? result.options[selected] : null} onPick={pickStop} />}

        {result && (
          <>
            <RouteAlternatives result={result} selected={selected} onSelect={setSelected} />

            {result.warnings.map((w) => (
              <p key={w} className="note">
                {w}
              </p>
            ))}

            <h3 className="steps-title">ขั้นตอนการเดินทาง</h3>
            <RouteSteps option={result.options[selected]} />

            <p className="fineprint">
              เวลาเป็นค่าประมาณ รวมเวลารอรถเฉลี่ยแล้ว
              {result.data_checked_at && ` ราคาตรวจล่าสุดเมื่อ ${thaiDate(result.data_checked_at)}`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
