import { AppError } from '../errors.js';
import { dijkstra } from './dijkstra.js';
import { priceLegs } from './fare.js';
import { buildGraph, stopNode } from './graph.js';

export const MAX_WAYPOINTS = 6;
export const OPTIMIZE_MODES = ['fastest', 'cheapest', 'fewest_transfers'];

/**
 * น้ำหนักของ edge ตอนค้นหา (Dijkstra) — หนึ่งแบบต่อหนึ่งเกณฑ์
 * แต่ละแบบให้ "เส้นทางผู้ท้าชิง" มาหนึ่งเส้น แล้วค่อยคิดราคาจริงเพื่อเลือก (ดู CRITERIA)
 */
const SEARCH_COSTS = {
  fastest: (edge) => edge.minutes,
  // ราคาโดยประมาณ (ค่าแรกเข้า + ต่อจุด) ถ้าเท่ากันเลือกทางที่เร็วกว่า
  cheapest: (edge) => edge.approxFare + edge.minutes * 0.001,
  // ขึ้นรถแต่ละครั้งแพงมาก → ได้เส้นทางที่ขึ้นรถน้อยที่สุด แล้วค่อยดูเวลา
  fewest_transfers: (edge) => (edge.kind === 'board' ? 1000 : 0) + edge.minutes,
};

/** เกณฑ์เลือกเส้นทางจากค่าจริง (เวลา ราคาจริง จำนวนต่อรถ) — ใช้ได้ทั้งกับ 1 ช่วง และทั้งทริป */
const CRITERIA = {
  fastest: (a, b) => a.minutes - b.minutes || a.fare - b.fare,
  cheapest: (a, b) => a.fare - b.fare || a.minutes - b.minutes,
  fewest_transfers: (a, b) => a.transfers - b.transfers || a.minutes - b.minutes,
};

/** วิ่งช่วงเดียวคลุมตั้งแต่ก่อนเวลานี้ถึงหลังเวลานี้ = วิ่งทั้งวัน ไม่ต้องบอกเวลาให้บริการ */
const ALL_DAY = { from: '06:30', to: '20:00' };
const DAY_TYPES = ['weekday', 'weekend'];

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (items, key) => items.reduce((total, item) => total + (item[key] ?? 0), 0);
const pickBest = (items, compare) => items.reduce((best, item) => (compare(item, best) < 0 ? item : best));

const toMinutes = (clock) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};
const toClock = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const isAllDay = (periods) => periods.length === 1 && periods[0][0] <= ALL_DAY.from && periods[0][1] >= ALL_DAY.to;

/** ลายเซ็นของเส้นทาง ใช้ตัดเส้นทางที่ซ้ำกัน */
const segmentSignature = (segment) =>
  segment.legs
    .map((l) => (l.type === 'ride' ? `${l.line_id}:${l.from_stop}>${l.to_stop}` : `walk:${l.from_stop}>${l.to_stop}`))
    .join(',');

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

  // ตำแหน่งของแต่ละจุดในสาย — สายที่ผ่านจุดเดิมสองครั้ง (สายสีน้ำเงินที่ท่าพระ) มีได้หลายตำแหน่ง
  const positionsByLine = new Map();
  // เวลาสะสมจากจุดแรกของสายถึงแต่ละตำแหน่ง (ใช้เลื่อนเวลาให้บริการไปเป็นเวลาที่จุดขึ้นรถ)
  const elapsedByLine = new Map();
  for (const line of data.lines) {
    const positions = new Map();
    line.stops.forEach((id, i) => positions.set(id, [...(positions.get(id) ?? []), i]));
    positionsByLine.set(line.id, positions);
    const elapsed = [0];
    for (let i = 0; i + 1 < line.stops.length; i += 1) {
      elapsed.push(elapsed[i] + (line.segment_minutes?.[i] ?? line.minutes_between_stops));
    }
    elapsedByLine.set(line.id, elapsed);
  }

  /** ตำแหน่งของการนั่ง 1 จุด (from → to ที่อยู่ติดกันในสาย) เลือกคู่ที่ต่อจากตำแหน่งก่อนหน้าก่อน */
  function stepPositions(lineId, from, to, last) {
    const positions = positionsByLine.get(lineId);
    let best = null;
    for (const i of positions.get(from) ?? []) {
      for (const j of positions.get(to) ?? []) {
        if (Math.abs(i - j) !== 1) continue;
        const score = last == null || i === last ? 0 : 1;
        if (!best || score < best.score) best = { i, j, score };
      }
    }
    return best;
  }

  /**
   * เวลาให้บริการของสายนั้นในทิศที่นั่ง ณ จุดที่ขึ้น — คืน null ถ้าวิ่งทั้งวัน
   * (data เก็บเวลาที่ออกจากจุดแรกของทิศนั้น → บวกเวลาเดินทางถึงจุดขึ้น แล้วปัดเป็นช่วง 5 นาที)
   */
  function legServiceHours(line, from, to) {
    if (!line.service_hours) return null;
    const direction = to > from ? 'forward' : 'backward';
    const elapsed = elapsedByLine.get(line.id);
    const offset = direction === 'forward' ? elapsed[from] : elapsed.at(-1) - elapsed[from];
    const raw = Object.fromEntries(DAY_TYPES.map((day) => [day, line.service_hours[day]?.[direction] ?? []]));
    if (DAY_TYPES.every((day) => isAllDay(raw[day]))) return null;
    return Object.fromEntries(
      DAY_TYPES.map((day) => [
        day,
        raw[day].map(([start, end]) => [
          toClock(Math.floor((toMinutes(start) + offset) / 5) * 5),
          toClock(Math.ceil((toMinutes(end) + offset) / 5) * 5),
        ]),
      ]),
    );
  }

  /** แปลง edge จาก Dijkstra เป็นขั้นตอนที่คนอ่านเข้าใจ (ride / walk) */
  function toLegs(edges) {
    const legs = [];
    let ride = null;
    for (const edge of edges) {
      if (edge.kind === 'board') {
        ride = {
          lineId: edge.lineId,
          fromStop: edge.fromStop,
          toStop: edge.fromStop,
          numStops: 0,
          wait: edge.minutes,
          ride: 0,
          ranges: [],
        };
      } else if (edge.kind === 'ride') {
        ride.numStops += 1;
        ride.ride += edge.minutes;
        ride.toStop = edge.toStop;
        // ช่วงตำแหน่งในสายที่นั่งผ่าน (ปกติมีช่วงเดียว ถ้านั่งผ่านจุดที่สายวนกลับมาจะแยกเป็นสองช่วง)
        const last = ride.ranges.at(-1);
        const step = stepPositions(edge.lineId, edge.fromStop, edge.toStop, last?.[1]);
        if (last && step.i === last[1]) last[1] = step.j;
        else ride.ranges.push([step.i, step.j]);
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
      line_color: line.color ?? null,
      mode: line.mode,
      from_stop: ride.fromStop,
      from_name: stopName(ride.fromStop),
      to_stop: ride.toStop,
      to_name: stopName(ride.toStop),
      num_stops: ride.numStops,
      ranges: ride.ranges,
      wait_minutes: waitMinutes,
      ride_minutes: rideMinutes,
      minutes: waitMinutes + rideMinutes,
      ...(line.time_estimated ? { time_estimated: true } : {}),
      ...withServiceHours(line, ride.ranges[0]),
    };
  }

  function withServiceHours(line, [from, to]) {
    const hours = legServiceHours(line, from, to);
    return hours ? { service_hours: hours } : {};
  }

  function checkOptimize(optimize) {
    if (!OPTIMIZE_MODES.includes(optimize)) {
      throw new AppError(400, 'INVALID_INPUT', `optimize ต้องเป็น ${OPTIMIZE_MODES.join(' / ')}`);
    }
  }

  function checkWaypoints(waypoints) {
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
    for (const id of waypoints) {
      if (!stopsById.has(id)) throw new AppError(404, 'STOP_NOT_FOUND', `ไม่พบจุด "${id}"`);
    }
  }

  /**
   * หาเส้นทางผู้ท้าชิงของ 1 ช่วง (จุด → จุด): ค้นหาด้วยทุกเกณฑ์ แล้วคิดราคาจริงทุกเส้น
   * @returns {object[]} เส้นทางที่ไม่ซ้ำกัน 1–3 เส้น
   */
  function segmentCandidates(from, to) {
    for (const id of [from, to]) {
      if (!stopsById.has(id)) throw new AppError(404, 'STOP_NOT_FOUND', `ไม่พบจุด "${id}"`);
    }
    const unique = new Map();
    for (const mode of OPTIMIZE_MODES) {
      const result = dijkstra(graph, stopNode(from), stopNode(to), SEARCH_COSTS[mode]);
      if (!result) {
        throw new AppError(422, 'NO_ROUTE', `ไม่พบเส้นทางจาก ${stopName(from)} ไป ${stopName(to)}`);
      }
      const legs = priceLegs(toLegs(result.edges), { linesById, rulesById, policies });
      const rides = legs.filter((l) => l.type === 'ride').length;
      const segment = {
        from,
        to,
        minutes: sum(legs, 'minutes'),
        fare: round2(sum(legs, 'fare')),
        transfers: Math.max(0, rides - 1),
        legs,
      };
      const signature = segmentSignature(segment);
      if (!unique.has(signature)) unique.set(signature, segment);
    }
    return [...unique.values()];
  }

  /** หาเส้นทาง 1 ช่วงตามเกณฑ์ที่เลือก */
  function planSegment(from, to, optimize = 'fastest') {
    checkOptimize(optimize);
    return pickBest(segmentCandidates(from, to), CRITERIA[optimize]);
  }

  function buildTrip(segments) {
    return {
      segments,
      total: {
        minutes: sum(segments, 'minutes'),
        fare: round2(sum(segments, 'fare')),
        transfers: sum(segments, 'transfers'),
      },
    };
  }

  function tripMeta() {
    const warnings = [];
    if (sampleData) warnings.push('ราคาคำนวณจากข้อมูลตัวอย่าง ไม่ใช่ราคาจริง');
    return { warnings, data_checked_at: dataCheckedAt };
  }

  /** หาเส้นทางผ่านหลายจุดตามลำดับ = เลือกเส้นทางที่ดีที่สุดของแต่ละช่วงแล้วต่อกัน */
  function planTrip(waypoints, optimize = 'fastest') {
    checkWaypoints(waypoints);
    checkOptimize(optimize);
    const segments = [];
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      segments.push(planSegment(waypoints[i], waypoints[i + 1], optimize));
    }
    return { optimize, ...buildTrip(segments), ...tripMeta() };
  }

  /**
   * ทางเลือกทั้งทริปสำหรับหน้าเปรียบเทียบ (ถูกที่สุด / เร็วที่สุด / ต่อรถน้อยที่สุด)
   * แต่ละช่วงคิดแยกกันได้ → ทริปที่ดีที่สุดตามเกณฑ์ = เลือกช่วงที่ดีที่สุดตามเกณฑ์นั้นทุกช่วง
   */
  function planOptions(waypoints) {
    checkWaypoints(waypoints);
    const candidates = [];
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      candidates.push(segmentCandidates(waypoints[i], waypoints[i + 1]));
    }

    const unique = new Map();
    for (const mode of OPTIMIZE_MODES) {
      const trip = buildTrip(candidates.map((list) => pickBest(list, CRITERIA[mode])));
      const signature = trip.segments.map(segmentSignature).join('|');
      if (!unique.has(signature)) unique.set(signature, trip);
    }

    const options = [...unique.values()].sort((a, b) => CRITERIA.cheapest(a.total, b.total));
    const best = {};
    for (const mode of OPTIMIZE_MODES) {
      best[mode] = options.indexOf(pickBest(options, (a, b) => CRITERIA[mode](a.total, b.total)));
    }
    return {
      options: options.map((option, i) => ({
        labels: OPTIMIZE_MODES.filter((mode) => best[mode] === i),
        ...option,
      })),
      best,
      ...tripMeta(),
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
    return data.lines.map(({ id, name_th, group, mode, operator, color, stops }) => ({
      id,
      name_th,
      group: group ?? name_th,
      mode,
      operator,
      color: color ?? null,
      stops,
    }));
  }

  /**
   * ทุกจุด ทุกสาย และแนวเส้นทางจริง (ถ้ามี shapes.json) ในครั้งเดียว — ใช้วาดแผนที่และทำช่องเลือกจุด
   * shapes[สาย] = { points: [[lat, lon], ...], stop_index: ลำดับใน points ของแต่ละจุดจอด }
   */
  function network() {
    return {
      stops: data.stops.map(({ id, name_th, name_en, mode, lat, lon }) => ({ id, name_th, name_en, mode, lat, lon })),
      lines: listLines(),
      shapes: data.shapes ?? {},
    };
  }

  function info() {
    return {
      stops: data.stops.length,
      lines: data.lines.length,
      data_checked_at: dataCheckedAt,
      sample_data: sampleData,
    };
  }

  return { planSegment, planTrip, planOptions, searchStops, listLines, network, info, stopsById, linesById };
}
