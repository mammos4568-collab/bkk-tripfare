/**
 * ส่วน A — วางแผนการเดินทางหลายจุด + ราคารวม
 * สัญญา: docs/API.md หัวข้อ POST /api/trips/plan
 * ตรรกะหลักอยู่ใน src/core/planner.js
 */
import { Router } from 'express';
import { z } from 'zod';
import { MAX_WAYPOINTS } from '../core/planner.js';
import { parse } from '../validate.js';

const planBody = z.object({
  waypoints: z.array(z.string().trim().min(1).max(40)).min(2).max(MAX_WAYPOINTS),
  optimize: z.enum(['fastest', 'cheapest']).default('fastest'),
});

export function tripsRouter(planner) {
  const router = Router();
  router.post('/plan', (req, res) => {
    const { waypoints, optimize } = parse(planBody, req.body);
    res.json(planner.planTrip(waypoints, optimize));
  });
  return router;
}
