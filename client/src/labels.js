/**
 * ข้อความและรูปแบบตัวเลขที่ใช้ทั้งเว็บ — แก้คำที่นี่ที่เดียว ทุกหน้าจะตรงกัน
 */

/** ประเภทรถ เรียงตามที่แสดงในช่องเลือกจุด */
export const MODE_ORDER = ['rail', 'train', 'bus', 'boat'];
export const MODE_LABEL = { rail: 'รถไฟฟ้า', train: 'รถไฟ', bus: 'รถเมล์', boat: 'เรือ' };
/** หน่วยนับจุดจอดของแต่ละประเภท */
export const STOP_UNIT = { rail: 'สถานี', train: 'สถานี', bus: 'ป้าย', boat: 'ท่า' };

const ROUTE_NAME = {
  cheapest: 'ประหยัดที่สุด',
  fastest: 'เร็วที่สุด',
  fewest_transfers: 'ต่อรถน้อยที่สุด',
};
const LABEL_ORDER = ['cheapest', 'fastest', 'fewest_transfers'];

/** 25 → "25", 12.5 → "12.5" */
export const num = (n) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

/** "2026-10-20" → "20 ต.ค. 2569" */
export const thaiDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

export const transfersText = (n) => (n === 0 ? 'ไม่ต้องต่อรถ' : `ต่อรถ ${n} ครั้ง`);

/** ตั้งชื่อเส้นทางจากสิ่งที่มันดีที่สุด เช่น ["cheapest","fewest_transfers"] → "ประหยัดที่สุด และต่อรถน้อยที่สุด" */
export function routeName(labels, optionCount) {
  if (optionCount === 1) return 'เส้นทางที่แนะนำ';
  if (labels.length === 0) return 'อีกเส้นทางหนึ่ง';
  if (labels.length === LABEL_ORDER.length) return 'ดีที่สุดทุกด้าน';
  return LABEL_ORDER.filter((l) => labels.includes(l))
    .map((l) => ROUTE_NAME[l])
    .join(' และ');
}

/**
 * บอกส่วนต่างของอีกเส้นทางเทียบกับเส้นทางที่กำลังดู เพื่อให้ตัดสินใจง่าย
 * เช่น "ถึงเร็วขึ้น 3 นาที แต่จ่ายเพิ่ม 17 บาท และต่อรถเพิ่ม 1 ครั้ง"
 */
export function compareText(current, other) {
  const fare = Math.round((other.fare - current.fare) * 100) / 100;
  const minutes = other.minutes - current.minutes;
  const transfers = other.transfers - current.transfers;
  const gains = [];
  const costs = [];

  if (minutes < 0) gains.push(`ถึงเร็วขึ้น ${-minutes} นาที`);
  if (minutes > 0) costs.push(`ถึงช้าลง ${minutes} นาที`);
  if (fare < 0) gains.push(`ประหยัด ${num(-fare)} บาท`);
  if (fare > 0) costs.push(`จ่ายเพิ่ม ${num(fare)} บาท`);
  if (transfers < 0) gains.push(`ต่อรถน้อยลง ${-transfers} ครั้ง`);
  if (transfers > 0) costs.push(`ต่อรถเพิ่ม ${transfers} ครั้ง`);

  if (gains.length === 0 && costs.length === 0) return 'ราคาและเวลาเท่ากัน แต่ใช้คนละสาย';
  if (costs.length === 0) return gains.join(' และ');
  if (gains.length === 0) return costs.join(' และ');
  return `${gains.join(' และ')} แต่${costs.join(' และ')}`;
}

const VEHICLE = { rail: 'รถไฟฟ้า', train: 'รถไฟ', bus: 'รถเมล์', boat: 'เรือ' };
const span = (periods) => periods.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(' และ ');
const sameHours = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * เวลาที่มีรถ/เรือเที่ยวนั้นที่จุดขึ้น (leg.service_hours จาก API) เขียนเป็นประโยคเดียว
 * เช่น "เรือเที่ยวนี้มีเฉพาะวันธรรมดา ช่วง 06:00–07:45"
 */
export function serviceText(hours, mode) {
  const vehicle = VEHICLE[mode] ?? 'รถ';
  const weekday = hours.weekday ?? [];
  const weekend = hours.weekend ?? [];
  const sparse = (periods) => periods.length > 3;
  const describe = (periods) =>
    sparse(periods) ? `เป็นรอบ ๆ ไม่ถี่ ระหว่าง ${periods[0][0]}–${periods.at(-1)[1]}` : `ช่วง ${span(periods)}`;
  let text;
  if (weekday.length === 0 && weekend.length === 0) text = `${vehicle}เที่ยวนี้ไม่มีให้บริการตามข้อมูลล่าสุด`;
  else if (weekend.length === 0) text = `${vehicle}เที่ยวนี้มีเฉพาะวันธรรมดา ${describe(weekday)}`;
  else if (weekday.length === 0) text = `${vehicle}เที่ยวนี้มีเฉพาะเสาร์–อาทิตย์ ${describe(weekend)}`;
  else if (sameHours(weekday, weekend)) text = `${vehicle}เที่ยวนี้มี${describe(weekday)}`;
  else text = `${vehicle}เที่ยวนี้ วันธรรมดามี${describe(weekday)} ส่วนเสาร์–อาทิตย์มี${describe(weekend)}`;
  return sparse(weekday) || sparse(weekend) ? `${text} เช็กเวลากับผู้ให้บริการก่อนออกเดินทาง` : text;
}

