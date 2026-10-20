import { useEffect, useState } from 'react';
import { getHealth } from '../api.js';
import { isOn } from '../features.js';
import { thaiDate } from '../labels.js';
import Report from '../pages/Report.jsx';

/** แหล่งข้อมูลและวันที่ตรวจล่าสุด (ดึงจาก GET /api/health) */
export default function DataInfo() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <section className="section wrap" id="data" aria-labelledby="data-title">
      <h2 id="data-title">ข้อมูลมาจากไหน</h2>
      <div className="section-body">
        <p>
          ราคาและเส้นทางรวบรวมจากเว็บไซต์ทางการของผู้ให้บริการแต่ละระบบ ทุกราคามีที่มาและวันที่ตรวจกำกับไว้
          ก่อนขึ้นเว็บต้องผ่านการตรวจความถูกต้องทุกครั้ง
        </p>
        {info && (
          <p>
            ตอนนี้มีข้อมูล {info.stops} จุด {info.lines} สาย
            {info.data_checked_at && ` ตรวจราคาล่าสุดเมื่อ ${thaiDate(info.data_checked_at)}`}
          </p>
        )}
        {info?.sample_data && <p className="note">ตอนนี้ยังเป็นข้อมูลตัวอย่างระหว่างพัฒนา ตัวเลขยังไม่ใช่ราคาจริง</p>}
        {isOn('report') && <Report />}
      </div>
    </section>
  );
}
