/**
 * เรขาคณิตบนพื้นโลกแบบง่าย สำหรับระยะทางระดับเมือง (คลาดเคลื่อนไม่ถึง 0.5%)
 * จุดทุกจุดเป็น [lat, lon]
 */
const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceMeters(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** แปลงเป็นพิกัดเมตรบนระนาบรอบจุดอ้างอิง (ใช้คำนวณระยะจากจุดถึงเส้น) */
function toXY(p, ref) {
  const k = Math.cos(toRad(ref[0]));
  return [toRad(p[1] - ref[1]) * EARTH_RADIUS_M * k, toRad(p[0] - ref[0]) * EARTH_RADIUS_M];
}

export function polylineLength(points) {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i += 1) total += distanceMeters(points[i], points[i + 1]);
  return total;
}

/** ระยะสะสมตามเส้นของแต่ละจุด */
export function cumulative(points) {
  const out = [0];
  for (let i = 1; i < points.length; i += 1) out.push(out[i - 1] + distanceMeters(points[i - 1], points[i]));
  return out;
}

/**
 * หาตำแหน่งบนเส้นที่ใกล้จุดที่สุด โดยห้ามถอยหลังกว่า fromIndex
 * (ใช้ไล่ทีละสถานีตามลำดับ จึงรองรับสายที่วนกลับมาผ่านที่เดิม เช่น สายสีน้ำเงิน)
 * @returns {{ segment: number, t: number, point: number[], gap: number }}
 */
export function projectOnto(points, target, fromSegment = 0, fromT = 0) {
  let best = null;
  for (let i = fromSegment; i + 1 < points.length; i += 1) {
    const a = toXY(points[i], target);
    const b = toXY(points[i + 1], target);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(a[0] * dx + a[1] * dy) / len2;
    t = Math.max(i === fromSegment ? fromT : 0, Math.min(1, t));
    const x = a[0] + t * dx;
    const y = a[1] + t * dy;
    const gap = Math.hypot(x, y);
    if (!best || gap < best.gap - 0.01) {
      best = {
        segment: i,
        t,
        gap,
        point: [points[i][0] + t * (points[i + 1][0] - points[i][0]), points[i][1] + t * (points[i + 1][1] - points[i][1])],
      };
    }
  }
  return best;
}

/** Douglas–Peucker ช่วงเดียว: คืน index ของจุดที่ต้องเก็บ */
function douglasPeucker(points, start, end, toleranceMeters, out) {
  out.add(start);
  out.add(end);
  const stack = [[start, end]];
  while (stack.length > 0) {
    const [s, e] = stack.pop();
    let maxGap = -1;
    let index = -1;
    for (let i = s + 1; i < e; i += 1) {
      const a = toXY(points[s], points[i]);
      const b = toXY(points[e], points[i]);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2));
      const gap = Math.hypot(a[0] + t * dx, a[1] + t * dy);
      if (gap > maxGap) {
        maxGap = gap;
        index = i;
      }
    }
    if (index !== -1 && maxGap > toleranceMeters) {
      out.add(index);
      stack.push([s, index], [index, e]);
    }
  }
}

/**
 * ลดจำนวนจุดของเส้น (Douglas–Peucker) โดยไม่ลบจุดที่ keep[i] เป็น true
 * @returns {number[]} index ของจุดที่เหลือ เรียงจากน้อยไปมาก
 */
export function simplify(points, toleranceMeters, keep = []) {
  if (points.length <= 2) return points.map((_, i) => i);
  const anchors = [0];
  keep.forEach((k, i) => {
    if (k && i > 0 && i < points.length - 1) anchors.push(i);
  });
  anchors.push(points.length - 1);
  const out = new Set();
  for (let k = 0; k + 1 < anchors.length; k += 1) douglasPeucker(points, anchors[k], anchors[k + 1], toleranceMeters, out);
  return [...out].sort((a, b) => a - b);
}

/** ส่วนของเส้นตรงสองเส้นตัดกันแบบไม่นับปลาย (เผื่อระยะ marginMeters ที่ปลายทั้งสองด้าน) */
export function segmentsCross(p1, p2, q1, q2, marginMeters = 25) {
  const ref = p1;
  const a = toXY(p1, ref);
  const b = toXY(p2, ref);
  const c = toXY(q1, ref);
  const d = toXY(q2, ref);
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(denom) < 1e-9) return false;
  const qp = [c[0] - a[0], c[1] - a[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / denom;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / denom;
  const lenP = Math.hypot(r[0], r[1]);
  const marginT = lenP === 0 ? 1 : marginMeters / lenP;
  return t > marginT && t < 1 - marginT && u >= 0 && u <= 1;
}
