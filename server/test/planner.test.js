import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlanner } from '../src/core/planner.js';
import { makeFixture, makeTradeoffFixture } from './fixtures.js';

const planner = createPlanner(makeFixture());
const rides = (segment) => segment.legs.filter((l) => l.type === 'ride');

test('เร็วสุด X1 → X4: นั่ง L1 ตรง ๆ 3 จุด', () => {
  const trip = planner.planTrip(['X1', 'X4'], 'fastest');
  const [seg] = trip.segments;
  assert.equal(seg.legs.length, 1);
  assert.equal(seg.legs[0].line_id, 'L1');
  assert.equal(seg.legs[0].num_stops, 3);
  assert.equal(seg.minutes, 2 + 3 * 2); // รอ 2 + นั่ง 6
  assert.equal(seg.fare, 10 + 2 * 3);
});

test('ถูกสุด X1 → X4: ยอมนั่งรถเมล์ที่ช้ากว่าแต่ถูกกว่า', () => {
  const trip = planner.planTrip(['X1', 'X4'], 'cheapest');
  const [seg] = trip.segments;
  assert.deepEqual(seg.legs.map((l) => l.type), ['walk', 'ride', 'walk']);
  assert.equal(seg.legs[1].line_id, 'BUS');
  assert.equal(seg.fare, 5);
  assert.equal(seg.minutes, 1 + 5 + 20 + 1);
});

test('ต่อสายในระบบเดียวกัน (L1 → L2 ที่ X3) คิดเป็นเที่ยวเดียว', () => {
  const [seg] = planner.planTrip(['X1', 'Y3'], 'fastest').segments;
  const [first, second] = rides(seg);
  assert.equal(first.line_id, 'L1');
  assert.equal(second.line_id, 'L2');
  assert.equal(first.fare, 10 + 2 * (2 + 1)); // นับจุดรวม 3 จุด
  assert.equal(second.fare, 0);
  assert.equal(second.fare_included_in_previous, true);
  assert.equal(seg.minutes, 2 + 4 + 3 + 3);
});

test('หลายจุด: ราคาและเวลารวม = ผลรวมของทุกช่วง', () => {
  const trip = planner.planTrip(['X1', 'X4', 'Y1'], 'fastest');
  assert.equal(trip.segments.length, 2);
  assert.equal(trip.total.minutes, trip.segments[0].minutes + trip.segments[1].minutes);
  assert.equal(trip.total.fare, trip.segments[0].fare + trip.segments[1].fare);
  assert.equal(trip.total.minutes, 8 + 10);
  assert.equal(trip.total.fare, 16 + 14);
  assert.equal(trip.total.transfers, 1); // เปลี่ยน L1 → L2 ในช่วงที่ 2 (ไม่นับการลงที่จุดแวะ)
});

test('ช่วงที่เดินอย่างเดียว ราคา 0 และไม่นับเป็นการเปลี่ยนรถ', () => {
  const trip = planner.planTrip(['X1', 'B1'], 'fastest');
  assert.deepEqual(trip.segments[0].legs.map((l) => l.type), ['walk']);
  assert.equal(trip.total.fare, 0);
  assert.equal(trip.total.transfers, 0);
});

test('นโยบายเพดานราคาที่เปิดอยู่ถูกนำมาใช้', () => {
  const data = makeFixture();
  data.fares.policies = [
    { id: 'cap', modes: ['rail'], max_fare_per_ride: 12, active: true, source: 'test', checked_at: '2026-01-01' },
  ];
  const trip = createPlanner(data).planTrip(['X1', 'X4'], 'fastest');
  assert.equal(trip.total.fare, 12);
});

test('error: จุดไม่มีอยู่จริง → 404 STOP_NOT_FOUND', () => {
  assert.throws(() => planner.planTrip(['X1', 'NOPE']), { status: 404, code: 'STOP_NOT_FOUND' });
});

test('error: ไปไม่ถึง → 422 NO_ROUTE', () => {
  assert.throws(() => planner.planTrip(['X1', 'Z']), { status: 422, code: 'NO_ROUTE' });
});

test('error: จุดติดกันซ้ำ / จำนวนจุดผิด / optimize ผิด → 400', () => {
  assert.throws(() => planner.planTrip(['X1', 'X1']), { status: 400 });
  assert.throws(() => planner.planTrip(['X1']), { status: 400 });
  assert.throws(() => planner.planTrip(['X1', 'X2', 'X3', 'X4', 'Y1', 'Y3', 'B1']), { status: 400 });
  assert.throws(() => planner.planTrip(['X1', 'X4'], 'slowest'), { status: 400 });
});

test('ถูกสุดใช้ราคาจริง ไม่ใช่ราคาโดยประมาณตอนค้นหา (ต่อสายไม่จ่ายซ้ำ)', () => {
  const tradeoff = createPlanner(makeTradeoffFixture());
  const trip = tradeoff.planTrip(['S', 'U'], 'cheapest');
  assert.deepEqual(rides(trip.segments[0]).map((l) => l.line_id), ['R1', 'R2']);
  assert.equal(trip.total.fare, 12);
});

test('ต่อรถน้อยสุด: ยอมช้ากว่าเพื่อไม่ต้องเปลี่ยนรถ', () => {
  const tradeoff = createPlanner(makeTradeoffFixture());
  const trip = tradeoff.planTrip(['S', 'U'], 'fewest_transfers');
  assert.deepEqual(rides(trip.segments[0]).map((l) => l.line_id), ['BUS2']);
  assert.equal(trip.total.transfers, 0);
  assert.equal(trip.total.minutes, 25);
});

test('planOptions: ตัดเส้นทางซ้ำ เรียงตามราคา และติดป้ายตามค่าจริง', () => {
  const tradeoff = createPlanner(makeTradeoffFixture());
  const result = tradeoff.planOptions(['S', 'U']);
  assert.equal(result.options.length, 2);
  const [rail, bus] = result.options;
  assert.deepEqual(rail.total, { minutes: 6, fare: 12, transfers: 1 });
  assert.deepEqual(bus.total, { minutes: 25, fare: 15, transfers: 0 });
  assert.deepEqual(result.best, { fastest: 0, cheapest: 0, fewest_transfers: 1 });
  assert.deepEqual(rail.labels, ['fastest', 'cheapest']);
  assert.deepEqual(bus.labels, ['fewest_transfers']);
  assert.ok(Array.isArray(result.warnings));
});

test('planOptions หลายจุด: ทางเลือกถูกสุดถูกกว่าหรือเท่ากับทุกทางเลือก', () => {
  const result = planner.planOptions(['X1', 'X4', 'Y1']);
  const cheapest = result.options[result.best.cheapest];
  const fastest = result.options[result.best.fastest];
  for (const option of result.options) {
    assert.ok(cheapest.total.fare <= option.total.fare);
    assert.ok(fastest.total.minutes <= option.total.minutes);
    assert.equal(option.total.fare, option.segments.reduce((n, s) => n + s.fare, 0));
  }
  assert.equal(cheapest.total.fare, 5 + 14); // ช่วงแรกนั่งรถเมล์ ช่วงสองรถไฟฟ้า
});

test('ค้นหาจุดด้วยชื่อหรือ id และกรองตามประเภท', () => {
  assert.deepEqual(planner.searchStops({ q: 'x3' }).map((s) => s.id), ['X3']);
  assert.deepEqual(planner.searchStops({ q: 'X3' })[0].lines.sort(), ['L1', 'L2']);
  assert.deepEqual(planner.searchStops({ mode: 'bus' }).map((s) => s.id), ['B1', 'B2', 'Z']);
});
