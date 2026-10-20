/**
 * ส่วน D — นัดเจอกลุ่ม
 * สัญญา: docs/API.md หัวข้อ POST /api/meetup
 *
 * TODO (ส่วน D) — ไม่ต้องเขียน Dijkstra ใหม่ ใช้ planner.planSegment() ได้เลย:
 *  1. validate body ด้วย zod: origins 2–6 จุด, strategy = min_total | min_max, optimize = cheapest | fastest
 *  2. เลือกจุดนัดที่เป็นไปได้ (candidates) เช่น จุดที่มีสายผ่าน ≥ 2 สาย (planner.searchStops() คืน lines มาด้วย)
 *     จำกัดไม่เกิน ~50 จุด เพราะต้องคำนวณ = จำนวนคน × จำนวน candidate ครั้ง
 *  3. ทุก candidate: เรียก planner.planSegment(origin, candidate, optimize) ของทุกคน
 *     - origin === candidate → fare 0, minutes 0 (ไม่ต้องเรียก)
 *     - ถ้าใครไปไม่ถึง (AppError code NO_ROUTE) → ตัด candidate นั้นทิ้ง
 *  4. คำนวณ total_fare, max_fare, total_minutes แล้วเรียงตาม strategy (เสมอกันให้ดู total_minutes)
 *  5. ตอบ best + per_person + alternatives (3 อันดับถัดไป)
 *     per_person ใช้ origin_index — ห้ามส่ง id ของจุดเริ่มต้นกลับไป (ความเป็นส่วนตัว)
 */
import { Router } from 'express';
import { notImplemented } from '../errors.js';

// planner ส่งเข้ามาให้แล้ว (ส่วน D ใช้ planner.planSegment / planner.searchStops)
export function meetupRouter(planner) {
  const router = Router();
  router.post('/', () => {
    throw notImplemented('D', 'นัดเจอกลุ่ม');
  });
  return router;
}
