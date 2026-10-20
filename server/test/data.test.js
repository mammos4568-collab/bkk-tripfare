/**
 * ตรวจว่าข้อมูลจริงใน data/ ใช้งานได้ (ไม่มี error และหาเส้นทางได้)
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPlanner } from '../src/core/planner.js';
import { loadData } from '../src/data/loadData.js';
import { validateData } from '../src/data/validateData.js';
import { makeFixture } from './fixtures.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');

test('ข้อมูลใน data/ ผ่านการตรวจ (ไม่มี error)', async () => {
  const { errors } = validateData(await loadData(dataDir));
  assert.deepEqual(errors, []);
});

test('ทุกจุดที่มีสายผ่าน หาเส้นทางไปจุดแรกได้ทั้งแบบเร็วสุดและถูกสุด', async () => {
  const data = await loadData(dataDir);
  const planner = createPlanner(data);
  const served = [...new Set(data.lines.flatMap((l) => l.stops))];
  const [first, ...others] = served;
  for (const id of others) {
    for (const optimize of ['fastest', 'cheapest']) {
      const trip = planner.planTrip([id, first], optimize);
      assert.ok(trip.total.minutes > 0, `${id} → ${first} (${optimize})`);
    }
  }
});

test('validateData จับข้อมูลผิดได้', () => {
  const data = makeFixture();
  data.lines[0].stops.push('NOT_A_STOP');
  data.fares.rules[1].amount = 999;
  delete data.fares.rules[0].source;
  const { errors } = validateData(data);
  assert.ok(errors.some((e) => e.includes('NOT_A_STOP')));
  assert.ok(errors.some((e) => e.includes('สูงผิดปกติ')));
  assert.ok(errors.some((e) => e.includes('source')));
});
