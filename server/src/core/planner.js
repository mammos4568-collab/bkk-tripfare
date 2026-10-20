import { AppError } from '../errors.js';
import { dijkstra } from './dijkstra.js';
import { priceLegs } from './fare.js';
import { buildGraph, stopNode } from './graph.js';

export const MAX_WAYPOINTS = 6;

/** เกณฑ์การหาเส้นทาง = น้ำหนักของแต่ละ edge */
const COST_FUNCTIONS = {
  fastest: (edge) => edge.minutes,
  // ใช้ราคาโดยประมาณเป็นหลัก ถ้าราคาเท่ากันให้เลือกทางที่เร็วกว่า
  cheapest: (edge) => edge.approxFare + edge.minutes * 0.001,
};

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (items, key) => items.reduce((total, item) => total + (item[key] ?? 0), 0);

/**
 * สร้างตัววางแผนการเดินทางจากข้อมูลใน data/
 * กราฟสร้างครั้งเดียวตอน server เริ่ม แล้วใช้ซ้ำทุก request
 */
export function createPlanner(data) {
  const stopsById = new Map(data.stops.map((s) => [s.id, s]));
  const linesById = new Map(data.lines.map((l) => [l.id, l]));
  const rulesById = new Map(data.fares.rules.map((r) => [r.id, r]));
  const policies = data.fares.policies ?? [];
  const graph = buildGraph(data, rulesById);

  // สายที่ผ่านแต่ละจุด (ใช้ตอนค้นหาจุด)
  const linesByStop = new Map();
  for (const line of data.lines) {
    for (const stopId of line.stops) {
      if (!linesByStop.has(stopId)) linesByStop.set(stopId, new Set());
      linesByStop.get(stopId).add(line.id);
    }
  }

  const checkedDates = [...data.fares.rules, ...policies].map((r) => r.checked_at).filter(Boolean).sort();
  const dataCheckedAt = checkedDates[0] ?? null; // วันที่ตรวจที่เก่าที่สุด
  const sampleData =
    data.stops.some((s) => s.id.startsWith('SMP-')) ||
    data.fares.rules.some((r) => String(r.source).startsWith('SAMPLE'));

  const stopName = (id) => stopsById.get(id)?.name_th ?? id;

  /** แปลง edge จาก Dijkstra เป็นขั้นตอนที่คนอ่านเข้าใจ (ride / walk) */
  function toLegs(edges) {
    const legs = [];
    let ride = null;
    for (const edge of edges) {
      if (edge.kind === 'board') {
        ride = { lineId: edge.lineId, fromStop: edge.fromStop, toStop: edge.fromStop, numStops: 0, wait: edge.minutes, ride: 0 };
      } else if (edge.kind === 'ride') {
        ride.numStops += 1;
        ride.ride += edge.minutes;
        ride.toStop = edge.toStop;
      } else if (edge.kind === 'alight') {
        if (ride.numStops > 0) legs.push(rideLeg(ride));
        ride = null;
      } else if (edge.kind === 'walk') {
        legs.push({
          type: 'walk',
          from_stop: edge.fromStop,
          from_name: stopName(edge.fromStop),
          to_stop: edge.toStop,
          to_name: stopName(edge.toStop),
          minutes: Math.round(edge.minutes),
        });
      }
    }
    return legs;
  }

  function rideLeg(ride) {
    const line = linesById.get(ride.lineId);
    const waitMinutes = Math.round(ride.wait);
    const rideMinutes = Math.round(ride.ride);
    return {
      type: 'ride',
      line_id: line.id,
      line_name: line.name_th,
      mode: line.mode,
      from_stop: ride.fromStop,
      from_name: stopName(ride.fromStop),
      to_stop: ride.toStop,
      to_name: stopName(ride.toStop),
      num_stops: ride.numStops,
      wait_minutes: waitMinutes,
      ride_minutes: rideMinutes,
      minutes: waitMinutes + rideMinutes,
    };
  }

  /** หาเส้นทาง 1 ช่วง (จุด → จุด) */
  function planSegment(from, to, optimize = 'fastest') {
    const costFn = COST_FUNCTIONS[optimize];
    if (!costFn) {
      throw new AppError(400, 'INVALID_INPUT', `optimize ต้องเป็น ${Object.keys(COST_FUNCTIONS).join(' หรือ ')}`);
    }
    for (const id of [from, to]) {
      if (!stopsById.has(id)) throw new AppError(404, 'STOP_NOT_FOUND', `ไม่พบจุด "${id}"`);
    }

    const result = dijkstra(graph, stopNode(from), stopNode(to), costFn);
    if (!result) {
      throw new AppError(422, 'NO_ROUTE', `ไม่พบเส้นทางจาก ${stopName(from)} ไป ${stopName(to)}`);
    }

    const legs = priceLegs(toLegs(result.edges), { linesById, rulesById, policies });
    return {
      from,
      to,
      minutes: sum(legs, 'minutes'),
      fare: round2(sum(legs, 'fare')),
      legs,
    };
  }

  /** หาเส้นทางผ่านหลายจุดตามลำดับ = ต่อเส้นทางทีละช่วง */
  function planTrip(waypoints, optimize = 'fastest') {
    if (!Array.isArray(waypoints) || waypoints.length < 2 || waypoints.length > MAX_WAYPOINTS) {
      throw new AppError(400, 'INVALID_INPUT', `ต้องมีจุด 2–${MAX_WAYPOINTS} จุด`);
    }
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      if (waypoints[i] === waypoints[i + 1]) {
        throw new AppError(400, 'INVALID_INPUT', 'จุดที่อยู่ติดกันต้องไม่ซ้ำกัน', [
          { path: `waypoints.${i + 1}`, message: 'ซ้ำกับจุดก่อนหน้า' },
        ]);
      }
    }

    const segments = [];
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      segments.push(planSegment(waypoints[i], waypoints[i + 1], optimize));
    }

    const rideCount = segments.reduce((n, seg) => n + seg.legs.filter((l) => l.type === 'ride').length, 0);
    const segmentsWithRide = segments.filter((seg) => seg.legs.some((l) => l.type === 'ride')).length;

    const warnings = [];
    if (sampleData) warnings.push('ราคาคำนวณจากข้อมูลตัวอย่าง ไม่ใช่ราคาจริง');

    return {
      optimize,
      segments,
      total: {
        minutes: sum(segments, 'minutes'),
        fare: round2(sum(segments, 'fare')),
        transfers: Math.max(0, rideCount - segmentsWithRide),
      },
      warnings,
      data_checked_at: dataCheckedAt,
    };
  }

  function searchStops({ q, mode, limit = 50 } = {}) {
    const needle = q?.trim().toLowerCase();
    const results = [];
    for (const stop of data.stops) {
      if (mode && stop.mode !== mode) continue;
      if (
        needle &&
        !stop.name_th.toLowerCase().includes(needle) &&
        !(stop.name_en ?? '').toLowerCase().includes(needle) &&
        !stop.id.toLowerCase().includes(needle)
      ) {
        continue;
      }
      results.push({ ...stop, lines: [...(linesByStop.get(stop.id) ?? [])] });
      if (results.length >= limit) break;
    }
    return results;
  }

  function listLines() {
    return data.lines.map(({ id, name_th, mode, operator, stops }) => ({ id, name_th, mode, operator, stops }));
  }

  function info() {
    return {
      stops: data.stops.length,
      lines: data.lines.length,
      data_checked_at: dataCheckedAt,
      sample_data: sampleData,
    };
  }

  return { planSegment, planTrip, searchStops, listLines, info, stopsById, linesById };
}
