import { baht, MODE_ICON } from '../labels.js';

/** แสดงผลลัพธ์จาก POST /api/trips/plan (รูปแบบดู docs/API.md) */
export default function TripResult({ trip }) {
  return (
    <section className="card result" aria-label="ผลการค้นหาเส้นทาง">
      <div className="summary">
        <div>
          <span className="big">{baht(trip.total.fare)}</span>
          <span className="muted">ราคารวม</span>
        </div>
        <div>
          <span className="big">{trip.total.minutes} นาที</span>
          <span className="muted">เวลารวม</span>
        </div>
        <div>
          <span className="big">{trip.total.transfers}</span>
          <span className="muted">ครั้งที่ต่อรถ</span>
        </div>
      </div>

      {trip.warnings.map((w) => (
        <p key={w} className="warning">
          ⚠️ {w}
        </p>
      ))}

      {trip.segments.map((seg, i) => (
        <div key={`${seg.from}-${seg.to}-${i}`} className="segment">
          <h3>
            ช่วงที่ {i + 1}: {seg.legs[0]?.from_name} → {seg.legs.at(-1)?.to_name}
          </h3>
          <p className="muted small">
            {seg.minutes} นาที · {baht(seg.fare)}
          </p>
          <ol className="legs">
            {seg.legs.map((leg, j) => (
              <li key={j} className={`leg ${leg.type}`}>
                {leg.type === 'walk' ? <WalkLeg leg={leg} /> : <RideLeg leg={leg} />}
              </li>
            ))}
          </ol>
        </div>
      ))}

      {trip.data_checked_at && <p className="muted small">ข้อมูลราคาตรวจล่าสุด {trip.data_checked_at}</p>}
    </section>
  );
}

function RideLeg({ leg }) {
  return (
    <>
      <div className="leg-title">
        <span aria-hidden="true">{MODE_ICON[leg.mode]}</span> {leg.line_name}
      </div>
      <div>
        ขึ้นที่ <strong>{leg.from_name}</strong> → ลงที่ <strong>{leg.to_name}</strong> ({leg.num_stops} จุด)
      </div>
      <div className="muted small">
        รอรถ ~{leg.wait_minutes} นาที + นั่ง {leg.ride_minutes} นาที ·{' '}
        {leg.fare_included_in_previous ? 'ต่อสายไม่ต้องจ่ายเพิ่ม' : baht(leg.fare)}
      </div>
    </>
  );
}

function WalkLeg({ leg }) {
  return (
    <>
      <div className="leg-title">
        <span aria-hidden="true">🚶</span> เดิน {leg.minutes} นาที
      </div>
      <div>
        จาก {leg.from_name} ไป {leg.to_name}
      </div>
    </>
  );
}
