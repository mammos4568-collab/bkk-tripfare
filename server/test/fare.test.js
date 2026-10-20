import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPolicies, rideFare } from '../src/core/fare.js';

const ride = (numStops, fromStop = 'A', toStop = 'B') => ({ fromStop, toStop, numStops });

test('flat: ราคาเดียวตลอดสาย', () => {
  assert.equal(rideFare({ type: 'flat', amount: 8 }, ride(1)), 8);
  assert.equal(rideFare({ type: 'flat', amount: 8 }, ride(10)), 8);
});

test('by_stops: base + per_stop × จำนวนจุด และไม่เกิน max', () => {
  const rule = { type: 'by_stops', base: 16, per_stop: 3, max: 45 };
  assert.equal(rideFare(rule, ride(1)), 19);
  assert.equal(rideFare(rule, ride(4)), 28);
  assert.equal(rideFare(rule, ride(20)), 45);
});

test('table: หาได้ทั้งสองทิศทาง ไม่เจอใช้ fallback', () => {
  const rule = {
    id: 't',
    type: 'table',
    table: { 'A|B': 25 },
    fallback: { base: 10, per_stop: 1, max: 40 },
  };
  assert.equal(rideFare(rule, ride(3, 'A', 'B')), 25);
  assert.equal(rideFare(rule, ride(3, 'B', 'A')), 25);
  assert.equal(rideFare(rule, ride(3, 'A', 'C')), 13);
});

test('table: ไม่มีในตารางและไม่มี fallback → error', () => {
  assert.throws(() => rideFare({ id: 't', type: 'table', table: {} }, ride(1)));
});

test('policies: เพดานราคาใช้เฉพาะตอน active และเฉพาะประเภทรถที่กำหนด', () => {
  const cap = { modes: ['rail'], max_fare_per_ride: 20, active: true };
  assert.equal(applyPolicies(42, 'rail', [cap]), 20);
  assert.equal(applyPolicies(15, 'rail', [cap]), 15);
  assert.equal(applyPolicies(42, 'bus', [cap]), 42);
  assert.equal(applyPolicies(42, 'rail', [{ ...cap, active: false }]), 42);
});
