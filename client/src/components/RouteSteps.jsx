import { legColor, textOn } from '../colors.js';
import { num, STOP_UNIT } from '../labels.js';

/**
 * ขั้นตอนการเดินทางวาดเป็นเส้นสายรถแนวตั้ง
 * - จุดที่ผู้ใช้เลือก = หมุดใหญ่ (จุดแวะบอกยอดที่ใช้ไปแล้ว)
 * - ช่วงนั่งรถ = แถบสีของสาย + ตั๋วราคา, ช่วงเดิน = เส้นประ
 */
export default function RouteSteps({ option }) {
  const items = buildItems(option);
  return (
    <ol className="route-line">
      {items.map((item, i) => {
        if (item.kind === 'stop') {
          return (
            <li key={i} className={['stop', item.place].filter(Boolean).join(' ')}>
              <span className="stop-name">{item.name}</span>
              {item.spent != null && (
                <span className="spent">
                  ใช้ไปแล้ว <b>{num(item.spent)}</b> บาท
                </span>
              )}
            </li>
          );
        }
        const { leg } = item;
        if (leg.type === 'walk') {
          return (
            <li key={i} className="leg walk">
              <span className="leg-title">เดิน {leg.minutes} นาที</span>
            </li>
          );
        }
        const color = legColor(leg);
        return (
          <li key={i} className="leg ride" style={{ '--line': color }}>
            <span className="leg-main">
              <span className="leg-title">{leg.line_name}</span>
              <span className="leg-detail">
                {leg.num_stops} {STOP_UNIT[leg.mode]} นั่ง {leg.ride_minutes} นาที รอรถราว {leg.wait_minutes} นาที
              </span>
            </span>
            {leg.fare_included_in_previous ? (
              <span className="stub-none">รวมในตั๋วก่อนหน้า</span>
            ) : (
              <span
                className="stub"
                style={{ '--stub-bg': color, '--stub-fg': textOn(color) }}
                aria-label={`ค่าโดยสาร ${num(leg.fare)} บาท`}
              >
                {num(leg.fare)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** แปลงทุกช่วงเป็นรายการเดียว: จุด → ช่วงเดินทาง → จุด → ... */
function buildItems(option) {
  const items = [];
  let spent = 0;
  option.segments.forEach((segment, s) => {
    const isLastSegment = s === option.segments.length - 1;
    segment.legs.forEach((leg, l) => {
      if (s === 0 && l === 0) items.push({ kind: 'stop', name: leg.from_name, place: 'waypoint start' });
      items.push({ kind: 'leg', leg });
      if (l < segment.legs.length - 1) {
        items.push({ kind: 'stop', name: leg.to_name });
        return;
      }
      spent += segment.fare;
      items.push({
        kind: 'stop',
        name: leg.to_name,
        place: isLastSegment ? 'waypoint end' : 'waypoint',
        spent: isLastSegment ? null : spent,
      });
    });
  });
  return items;
}
