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
          สถานี ท่าเรือ แนวเส้นทาง ความถี่ และค่าโดยสาร มาจากข้อมูลเปิด{' '}
          <a href="https://namtang-api.otp.go.th/opendata">Namtang GTFS</a> ของสำนักงานนโยบายและแผนการขนส่งและจราจร
          (สนข.) กระทรวงคมนาคม ใช้ตามสัญญาอนุญาต{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.th">CC BY 4.0</a> เราดัดแปลงโดยเลือกเฉพาะสายในกรุงเทพฯ
          และปริมณฑล ตัดชื่อให้สั้นลง และประมาณเวลาเดินทางจากระยะทางในสายที่ฟีดยังไม่มีเวลาจริง
        </p>
        <p>
          ก่อนขึ้นเว็บ ข้อมูลทุกชุดต้องผ่านการตรวจความถูกต้อง ทุกราคามีที่มาและวันที่ตรวจกำกับไว้ รูปแผนที่จาก
          OpenStreetMap
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
