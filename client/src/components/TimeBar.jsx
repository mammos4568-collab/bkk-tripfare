import { legColor } from '../colors.js';

/**
 * แถบเวลาของทั้งทริป: ยาวตามจำนวนนาทีของแต่ละช่วง ใช้สีของสายที่นั่ง ช่วงเดินเป็นเส้นประ
 * ข้อความรอบ ๆ บอกตัวเลขอยู่แล้ว แถบนี้จึงซ่อนจากโปรแกรมอ่านหน้าจอ
 */
export default function TimeBar({ option, thin = false }) {
  const legs = option.segments.flatMap((s) => s.legs).filter((l) => l.minutes > 0);
  return (
    <div className={thin ? 'timebar thin' : 'timebar'} aria-hidden="true">
      {legs.map((leg, i) =>
        leg.type === 'walk' ? (
          <span key={i} className="walk" style={{ flexGrow: leg.minutes }} />
        ) : (
          <span key={i} style={{ flexGrow: leg.minutes, background: legColor(leg) }} />
        ),
      )}
    </div>
  );
}
