/**
 * วางแผนการเดินทางหลายจุด + ราคารวม (คนหลัก)
 * สัญญา: docs/API.md หัวข้อ POST /api/trips/options และ POST /api/trips/plan
 * ตรรกะหลักอยู่ใน src/core/planner.js
 */
import { Router } from 'express';
import { z } from 'zod';
import { MAX_WAYPOINTS, OPTIMIZE_MODES } from '../core/planner.js';
import { parse } from '../validate.js';

const waypoints = z.array(z.string().trim().min(1).max(40)).min(2).max(MAX_WAYPOINTS);

const optionsBody = z.object({ waypoints });
const planBody = z.object({
  waypoints,
  optimize: z.enum(OPTIMIZE_MODES).default('fastest'),
});

export function tripsRouter(planner) {
  const router = Router();

  // ทางเลือกทั้งหมด (ถูกสุด / เร็วสุด / ต่อรถน้อยสุด) — หน้าเว็บใช้อันนี้
  router.post('/options', (req, res) => {
    const body = parse(optionsBody, req.body);
    res.json(planner.planOptions(body.waypoints));
  });

  // เส้นทางเดียวตามเกณฑ์ที่เลือก
  router.post('/plan', (req, res) => {
    const body = parse(planBody, req.body);
    res.json(planner.planTrip(body.waypoints, body.optimize));
  });

  return router;
}
