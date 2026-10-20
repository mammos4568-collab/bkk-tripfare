/**
 * ทดสอบ API ผ่าน HTTP จริง (Express + validation + รูปแบบ error ตาม docs/API.md)
 * ต้อง npm install ก่อน
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createPlanner } from '../src/core/planner.js';
import { makeFixture } from './fixtures.js';

const app = createApp({
  planner: createPlanner(makeFixture()),
  config: { env: 'test', clientDist: '' },
});

let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

const get = (path) => fetch(`${base}${path}`);
const post = (path, body, rawBody) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody ?? JSON.stringify(body),
  });

async function expectError(res, status, code) {
  assert.equal(res.status, status);
  const body = await res.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  assert.ok(Array.isArray(body.error.details));
  return body.error;
}

test('GET /api/health', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.stops, 9);
  assert.equal(body.sample_data, false);
});

test('ส่ง header ความปลอดภัยพื้นฐาน (helmet) และ CSP อนุญาตรูปแผนที่', async () => {
  const res = await get('/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /img-src [^;]*https:\/\/tile\.openstreetmap\.org/);
  assert.match(csp, /script-src 'self'/);
});

test('GET /api/network คืนทุกจุดพร้อมพิกัด และทุกสายพร้อมสี', async () => {
  const res = await get('/api/network');
  assert.equal(res.status, 200);
  const { stops, lines } = await res.json();
  assert.equal(stops.length, 9);
  assert.ok(stops.every((s) => typeof s.lat === 'number' && typeof s.lon === 'number'));
  assert.deepEqual(lines.map((l) => l.id), ['L1', 'L2', 'BUS']);
  assert.ok(lines.every((l) => 'color' in l && Array.isArray(l.stops)));
});

test('GET /api/stops ค้นหาและกรองได้', async () => {
  const res = await get('/api/stops?q=x3');
  assert.equal(res.status, 200);
  const { stops } = await res.json();
  assert.deepEqual(stops.map((s) => s.id), ['X3']);

  await expectError(await get('/api/stops?mode=plane'), 400, 'INVALID_INPUT');
});

test('GET /api/lines', async () => {
  const { lines } = await (await get('/api/lines')).json();
  assert.deepEqual(lines.map((l) => l.id), ['L1', 'L2', 'BUS']);
});

test('POST /api/trips/options คืนทางเลือกพร้อมป้ายถูกสุด/เร็วสุด/ต่อรถน้อยสุด', async () => {
  const res = await post('/api/trips/options', { waypoints: ['X1', 'X4'] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.options.length, 2);
  assert.deepEqual(Object.keys(body.best).sort(), ['cheapest', 'fastest', 'fewest_transfers']);
  assert.equal(body.options[body.best.cheapest].total.fare, 5);
  assert.equal(body.options[body.best.fastest].total.minutes, 8);
});

test('POST /api/trips/plan รับ optimize ทั้ง 3 แบบ', async () => {
  for (const optimize of ['fastest', 'cheapest', 'fewest_transfers']) {
    const res = await post('/api/trips/plan', { waypoints: ['X1', 'X4'], optimize });
    assert.equal(res.status, 200, optimize);
    assert.equal((await res.json()).optimize, optimize);
  }
});

test('input ผิด → 400 INVALID_INPUT พร้อมบอกช่องที่ผิด', async () => {
  const error = await expectError(await post('/api/trips/plan', { waypoints: ['X1'] }), 400, 'INVALID_INPUT');
  assert.ok(error.details.some((d) => d.path === 'waypoints'));
  await expectError(await post('/api/trips/plan', { waypoints: ['X1', 'X4'], optimize: 'slowest' }), 400, 'INVALID_INPUT');
  await expectError(await post('/api/trips/options', {}), 400, 'INVALID_INPUT');
  await expectError(await post('/api/trips/options', null, '{"waypoints": ['), 400, 'INVALID_INPUT');
});

test('ไม่พบจุด → 404, ไปไม่ถึง → 422', async () => {
  await expectError(await post('/api/trips/options', { waypoints: ['X1', 'NOPE'] }), 404, 'STOP_NOT_FOUND');
  await expectError(await post('/api/trips/options', { waypoints: ['X1', 'Z'] }), 422, 'NO_ROUTE');
});

test('ส่วนที่ยังไม่ทำ → 501, endpoint ที่ไม่มี → 404', async () => {
  await expectError(await post('/api/meetup', { origins: ['X1', 'X4'] }), 501, 'NOT_IMPLEMENTED');
  await expectError(await get('/api/nope'), 404, 'NOT_FOUND');
});
