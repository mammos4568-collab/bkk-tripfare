import { compareText, num, routeName, transfersText } from '../labels.js';
import TimeBar from './TimeBar.jsx';

/**
 * สรุปเส้นทางที่กำลังดู และทางเลือกอื่นที่บอกเป็น "ส่วนต่าง" (จ่ายเพิ่ม/ประหยัด, เร็วขึ้น/ช้าลง)
 * ข้อมูลจาก POST /api/trips/options (docs/API.md)
 */
export function RouteSummary({ result, selected }) {
  const current = result.options[selected];
  return (
    <>
      <p className="choice-name">{routeName(current.labels, result.options.length)}</p>
      <p className="total">
        {num(current.total.fare)}
        <small>บาท</small>
      </p>
      <p className="total-note">
        ใช้เวลาราว {current.total.minutes} นาที {transfersText(current.total.transfers)}
      </p>
      <TimeBar option={current} />
    </>
  );
}

export function RouteAlternatives({ result, selected, onSelect }) {
  const { options } = result;
  if (options.length < 2) return null;
  const current = options[selected];
  return (
    <div className="others">
      <h3>ถ้าเลือกทางอื่น</h3>
      {options.map((option, i) =>
        i === selected ? null : (
          <button key={i} type="button" className="other" onClick={() => onSelect(i)}>
            <span className="other-head">
              <span className="other-name">{routeName(option.labels, options.length)}</span>
              <span className="other-go">ดูทางนี้</span>
            </span>
            <span className="other-diff">{compareText(current.total, option.total)}</span>
            <TimeBar option={option} thin />
          </button>
        ),
      )}
    </div>
  );
}
