/**
 * แปลงฟีด Namtang GTFS ของ สนข. (CC BY 4.0) เป็นข้อมูลของเว็บ (รูปแบบตาม docs/schema.md)
 * เลือกว่าจะดึงสายไหน ตั้งชื่อ สี กลุ่มค่าโดยสาร ฯลฯ ได้ที่ data/sources/namtang.json
 *
 * ขั้นตอน:
 *  1. อ่านสาย ป้าย เที่ยววิ่ง (เฉพาะสายที่ตั้งค่าไว้)
 *  2. หาลำดับสถานี/ท่า เวลาระหว่างจุด และความถี่ของแต่ละสาย
 *  3. ตัดเส้นทางจริง (shapes) ให้พอดีช่วงที่วิ่ง แล้วลดจำนวนจุด
 *  4. สร้างตารางค่าโดยสารจาก fare_rules / fare_attributes
 *  5. สร้างทางเดินต่อรถระหว่างจุดที่อยู่ใกล้กัน (ไม่ให้เดินข้ามแม่น้ำ)
 */
import { cumulative, distanceMeters, projectOnto, segmentsCross, simplify } from './geo.js';

const DEFAULT_WINDOW = ['07:00', '20:00'];

function seconds(text) {
  if (!text) return null;
  const [h, m, s = 0] = text.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}
const clockMinutes = (text) => seconds(`${text}:00`) / 60;
const round1 = (n) => Math.round(n * 10) / 10;
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function mapBy(feed, name, key) {
  const out = new Map();
  for await (const row of feed.rows(name)) out.set(row[key], row);
  return out;
}

/** ชื่อในฟีดเขียนแบบ "ไทย;English" และมีคำนำหน้าระบบ เช่น "BTS สยาม;BTS Siam" */
export function cleanName(name) {
  return name
    .replace(/\[[^\])]*[\])]/g, ' ')
    .replace(/\(สายสี[^)]*\)/g, ' ')
    .replace(/^\s*(BTS|MRT|ARL|SRT)\s+/i, '')
    .replace(/^\s*สถานี(กลาง)?/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitName(raw = '') {
  const [th = '', en = ''] = raw.split(';');
  return { th: cleanName(th), en: cleanName(en) };
}

function normalizeColor(color) {
  if (!color) return null;
  const hex = color.replace(/^#/, '').trim();
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

/** สายในไฟล์ตั้งค่า → รายการสายที่จะสร้าง (แบบ expand แตกเป็นหลายสายตามเงื่อนไข) */
function expandLineConfigs(lineConfigs, routes) {
  const specs = [];
  for (const cfg of lineConfigs) {
    if (cfg.expand) {
      const matches = [...routes.values()].filter((r) =>
        Object.entries(cfg.expand).every(([field, value]) => r[field] === value),
      );
      for (const route of matches) {
        const { th, en } = splitName(route.route_long_name);
        specs.push({
          cfg: {
            ...cfg,
            expand: undefined,
            id: `${cfg.id_prefix}-${route.route_id}`,
            route_id: route.route_id,
            name_th: `${cfg.name_prefix_th ?? ''}${th.replace(/\s+[-–]\s+/g, '–')}`,
            name_en: en,
          },
          routeIds: [route.route_id],
        });
      }
      continue;
    }
    specs.push({ cfg, routeIds: cfg.route_id ? [cfg.route_id] : [] });
  }
  return specs;
}

/** กลุ่มเที่ยวที่จอดลำดับเดียวกัน */
function patternsOf(tripIds, trips, stopTimes) {
  const byKey = new Map();
  for (const tripId of tripIds) {
    const times = stopTimes.get(tripId);
    if (!times || times.length < 2) continue;
    const direction = trips.get(tripId).direction_id || '0';
    const stops = times.map((t) => t.stop);
    const key = `${direction}|${stops.join(',')}`;
    if (!byKey.has(key)) byKey.set(key, { direction, stops, trips: [] });
    byKey.get(key).trips.push(tripId);
  }
  return [...byKey.values()];
}

function segmentSeconds(times) {
  const out = [];
  for (let i = 0; i + 1 < times.length; i += 1) out.push(times[i + 1].arr - times[i].arr);
  return out;
}

/**
 * ความถี่เฉลี่ย (นาที) ช่วงกลางวันของวันธรรมดา
 * นับจำนวนรถที่ออกจากแต่ละสถานีในช่วงเวลา แล้วใช้ค่ากลาง (รองรับสายที่มีหลายรูปแบบการเดินรถซ้อนกัน)
 */
function computeHeadway({ gtfsStops, tripIds, trips, stopTimes, frequencies, calendar, window }) {
  const weekday = tripIds.filter((id) => calendar.get(trips.get(id).service_id)?.monday === '1');
  const use = weekday.length > 0 ? weekday : tripIds;
  const start = clockMinutes(window[0]) * 60;
  const end = clockMinutes(window[1]) * 60;
  const perStop = [];
  for (const stop of gtfsStops) {
    let departures = 0;
    const directions = new Set();
    for (const tripId of use) {
      const times = stopTimes.get(tripId);
      const index = times?.findIndex((t) => t.stop === stop) ?? -1;
      if (index === -1) continue;
      directions.add(trips.get(tripId).direction_id || '0');
      const offset = times[index].dep - times[0].dep;
      const freq = frequencies.get(tripId);
      if (freq?.length) {
        for (const f of freq) {
          if (!(f.headway > 0)) continue;
          for (let t = f.start; t < f.end; t += f.headway) {
            const at = t + offset;
            if (at >= start && at < end) departures += 1;
          }
        }
      } else if (times[index].dep >= start && times[index].dep < end) {
        departures += 1;
      }
    }
    const perDirection = departures / Math.max(1, directions.size);
    if (perDirection > 0) perStop.push(perDirection);
  }
  if (perStop.length === 0) return null;
  const headway = (end - start) / 60 / median(perStop);
  return Math.min(240, Math.max(2, Math.round(headway)));
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const DAY_TYPES = {
  weekday: (c) => !c || WEEKDAYS.some((d) => c[d] === '1'),
  weekend: (c) => !c || c.saturday === '1' || c.sunday === '1',
};
/** รถห่างกันเกินนี้ถือว่าช่วงนั้นหยุดวิ่ง (เช่น เรือด่วนที่วิ่งเฉพาะเช้าและเย็น) */
const SERVICE_GAP_SECONDS = 90 * 60;
/** วิ่งช่วงเดียวคลุมตั้งแต่ก่อนเวลานี้ถึงหลังเวลานี้ = วิ่งทั้งวัน ไม่ต้องบอกเวลา */
const ALL_DAY = { from: 6.5 * 3600, to: 20 * 3600 };

const clock = (secondsOfDay) => {
  const minutes = Math.round(secondsOfDay / 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/** เวลาออกของเที่ยวนั้นที่จุดลำดับ index (ขยายตาม frequencies.txt ถ้ามี) */
function departuresAt(tripId, index, stopTimes, frequencies) {
  const times = stopTimes.get(tripId);
  const offset = times[index].dep - times[0].dep;
  const freq = frequencies.get(tripId);
  if (!freq?.length) return [times[index].dep];
  const out = [];
  for (const f of freq) {
    if (!(f.headway > 0)) continue;
    for (let t = f.start; t < f.end; t += f.headway) out.push(t + offset);
  }
  return out;
}

/**
 * ช่วงเวลาที่มีรถ แยกตามวัน (ธรรมดา / เสาร์–อาทิตย์) และทิศ (ตามลำดับ stops = forward, ย้อนกลับ = backward)
 * เวลาเป็นเวลาที่ออกจากจุดแรกของทิศนั้น — ตัววางแผนจะบวกเวลาเดินทางถึงจุดที่ขึ้นเอง
 * คืน null ถ้าทุกทิศวิ่งทั้งวัน (ไม่ต้องบอกผู้ใช้) หรือฟีดไม่มีเวลา
 */
function computeService({ sequence, segmentMinutes, tripIds, trips, stopTimes, frequencies, calendar }) {
  const positions = new Map();
  sequence.forEach((id, i) => positions.set(id, [...(positions.get(id) ?? []), i]));
  const cum = [0];
  for (const m of segmentMinutes) cum.push(cum.at(-1) + m * 60);
  const total = cum.at(-1);

  const departures = { weekday: { forward: [], backward: [] }, weekend: { forward: [], backward: [] } };
  for (const tripId of tripIds) {
    const times = stopTimes.get(tripId);
    if (!times) continue;
    const matched = [];
    times.forEach((t, k) => {
      if (positions.has(t.stop) && matched.at(-1)?.stop !== t.stop) matched.push({ k, stop: t.stop });
    });
    if (matched.length < 2) continue;
    // ทิศ: ดูจากสองจุดแรกที่ตรงกับสาย (สายที่ผ่านจุดเดิมสองครั้ง เลือกตำแหน่งที่ใกล้กันที่สุด)
    let best = null;
    for (const pa of positions.get(matched[0].stop)) {
      for (const pb of positions.get(matched[1].stop)) {
        if (!best || Math.abs(pb - pa) < Math.abs(best.pb - best.pa)) best = { pa, pb };
      }
    }
    const direction = best.pb > best.pa ? 'forward' : 'backward';
    const fromOrigin = direction === 'forward' ? cum[best.pa] : total - cum[best.pa];
    const service = calendar.get(trips.get(tripId).service_id);
    for (const [day, runs] of Object.entries(DAY_TYPES)) {
      if (!runs(service)) continue;
      for (const t of departuresAt(tripId, matched[0].k, stopTimes, frequencies)) departures[day][direction].push(t - fromOrigin);
    }
  }

  let limited = false;
  let any = false;
  const out = {};
  for (const [day, byDirection] of Object.entries(departures)) {
    out[day] = {};
    for (const [direction, list] of Object.entries(byDirection)) {
      const sorted = [...list].sort((a, b) => a - b);
      const periods = [];
      for (const t of sorted) {
        const last = periods.at(-1);
        if (last && t - last[1] <= SERVICE_GAP_SECONDS) last[1] = t;
        else periods.push([t, t]);
      }
      if (periods.length > 0) any = true;
      const allDay = periods.length === 1 && periods[0][0] <= ALL_DAY.from && periods[0][1] >= ALL_DAY.to;
      if (!allDay) limited = true;
      out[day][direction] = periods.map(([a, b]) => [clock(Math.max(0, a)), clock(b)]);
    }
  }
  return any && limited ? out : null;
}

/**
 * วางสถานีลงบนเส้นทางจริงตามลำดับ แล้วตัดเส้นให้พอดีช่วงที่วิ่ง
 * @returns {{ points: number[][], stopIndex: number[], segmentKm: number[], maxGap: number }}
 */
function fitShape(rawPoints, stopCoords) {
  const attempt = (points) => {
    const projections = [];
    let segment = 0;
    let t = 0;
    for (const coord of stopCoords) {
      const p = projectOnto(points, coord, segment, t);
      projections.push(p);
      segment = p.segment;
      t = p.t;
    }
    return { points, projections, totalGap: projections.reduce((sum, p) => sum + p.gap, 0) };
  };
  let best = null;
  if (rawPoints.length >= 2) {
    const forward = attempt(rawPoints);
    const backward = attempt([...rawPoints].reverse());
    best = backward.totalGap < forward.totalGap ? backward : forward;
  }
  // ไม่มีเส้นทางในฟีด หรือเส้นห่างจากสถานีเกินไป → ลากเส้นตรงระหว่างสถานี
  if (!best || best.projections.some((p) => p.gap > 600)) {
    const points = stopCoords.map((c) => [...c]);
    const dist = cumulative(points);
    const segmentKm = [];
    for (let i = 0; i + 1 < points.length; i += 1) segmentKm.push((dist[i + 1] - dist[i]) / 1000);
    return { points, stopIndex: points.map((_, i) => i), segmentKm, maxGap: best ? Math.max(...best.projections.map((p) => p.gap)) : null, straight: true };
  }

  // แทรกจุดของสถานีลงในเส้น แล้วตัดหัวท้ายที่เกินช่วงวิ่ง
  const { points, projections } = best;
  const merged = [];
  const stopIndex = [];
  let k = 0;
  for (let i = 0; i < points.length; i += 1) {
    merged.push(points[i]);
    while (k < projections.length && projections[k].segment === i) {
      const p = projections[k];
      stopIndex.push(merged.length);
      merged.push(p.point);
      k += 1;
    }
  }
  const first = stopIndex[0];
  const last = stopIndex[stopIndex.length - 1];
  const clipped = merged.slice(first, last + 1);
  const shifted = stopIndex.map((i) => i - first);
  const dist = cumulative(clipped);
  const segmentKm = [];
  for (let i = 0; i + 1 < shifted.length; i += 1) segmentKm.push((dist[shifted[i + 1]] - dist[shifted[i]]) / 1000);

  const keep = new Array(clipped.length).fill(false);
  for (const i of shifted) keep[i] = true;
  const kept = simplify(clipped, 6, keep);
  const remap = new Map(kept.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  return {
    points: kept.map((i) => [round6(clipped[i][0]), round6(clipped[i][1])]),
    stopIndex: shifted.map((i) => remap.get(i)),
    segmentKm,
    maxGap: Math.max(...projections.map((p) => p.gap)),
    straight: false,
  };
}

export async function importNamtang({ feed, config, log = () => {} }) {
  const warnings = [];
  const warn = (message) => {
    warnings.push(message);
    log(`  ⚠ ${message}`);
  };

  // ---------- 1) ตารางพื้นฐาน ----------
  const feedInfo = feed.has('feed_info.txt') ? (await mapBy(feed, 'feed_info.txt', 'feed_version')).values().next().value ?? {} : {};
  const version = feedInfo.feed_version ?? 'unknown';
  const checkedAt = /^\d{8}$/.test(version)
    ? `${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);
  log(`ฟีดเวอร์ชัน ${version}`);

  const routes = await mapBy(feed, 'routes.txt', 'route_id');
  const agencies = await mapBy(feed, 'agency.txt', 'agency_id');
  const gtfsStops = await mapBy(feed, 'stops.txt', 'stop_id');
  const calendar = feed.has('calendar.txt') ? await mapBy(feed, 'calendar.txt', 'service_id') : new Map();
  const trips = await mapBy(feed, 'trips.txt', 'trip_id');

  const specs = expandLineConfigs(config.lines, routes);
  for (const spec of specs) {
    for (const routeId of spec.routeIds) {
      if (!routes.has(routeId)) throw new Error(`ไม่พบ route_id ${routeId} (สาย ${spec.cfg.id}) ในฟีด`);
    }
  }

  // ---------- 2) เวลาเดินรถของเที่ยวที่เกี่ยวข้อง ----------
  const neededRoutes = new Set(specs.flatMap((s) => s.routeIds));
  const throughAgencies = new Set(specs.filter((s) => s.cfg.trains_through).map((s) => s.cfg.agency_id));
  const keepTrips = new Set();
  for (const trip of trips.values()) {
    const route = routes.get(trip.route_id);
    if (neededRoutes.has(trip.route_id) || (route && throughAgencies.has(route.agency_id) && route.route_type === '2')) {
      keepTrips.add(trip.trip_id);
    }
  }
  log(`อ่านเวลาเดินรถของ ${keepTrips.size} เที่ยว`);
  const stopTimes = new Map();
  for await (const row of feed.rows('stop_times.txt')) {
    if (!keepTrips.has(row.trip_id)) continue;
    if (!stopTimes.has(row.trip_id)) stopTimes.set(row.trip_id, []);
    stopTimes.get(row.trip_id).push({
      stop: row.stop_id,
      seq: Number(row.stop_sequence),
      arr: seconds(row.arrival_time || row.departure_time),
      dep: seconds(row.departure_time || row.arrival_time),
    });
  }
  for (const times of stopTimes.values()) times.sort((a, b) => a.seq - b.seq);

  const frequencies = new Map();
  if (feed.has('frequencies.txt')) {
    for await (const row of feed.rows('frequencies.txt')) {
      if (!keepTrips.has(row.trip_id)) continue;
      if (!frequencies.has(row.trip_id)) frequencies.set(row.trip_id, []);
      frequencies.get(row.trip_id).push({
        start: seconds(row.start_time),
        end: seconds(row.end_time),
        headway: Number(row.headway_secs),
      });
    }
  }

  // ---------- 3) ลำดับสถานี เวลา ความถี่ ----------
  const skip = (config.skip_stop_name_patterns ?? []).map((p) => new RegExp(p));
  const isClosed = (gtfsId) => skip.some((re) => re.test(gtfsStops.get(gtfsId)?.stop_name ?? ''));
  const window = config.headway_window ?? DEFAULT_WINDOW;
  const built = [];

  for (const spec of specs) {
    const { cfg } = spec;
    let sequence;
    let segSeconds = null;
    let shapeIds = [];
    let tripIds;

    if (cfg.trains_through) {
      tripIds = [...stopTimes.keys()].filter((id) => {
        const route = routes.get(trips.get(id).route_id);
        return route.agency_id === cfg.agency_id && stopTimes.get(id).some((t) => t.stop === cfg.trains_through);
      });
      spec.routeIds = [...new Set(tripIds.map((id) => trips.get(id).route_id))];
      sequence = [...cfg.stops];
      const covering = [...tripIds].sort(
        (a, b) =>
          stopTimes.get(b).filter((t) => sequence.includes(t.stop)).length -
          stopTimes.get(a).filter((t) => sequence.includes(t.stop)).length,
      )[0];
      shapeIds = covering ? [trips.get(covering).shape_id] : [];
    } else {
      tripIds = [...trips.values()].filter((t) => spec.routeIds.includes(t.route_id) && stopTimes.has(t.trip_id)).map((t) => t.trip_id);
      const patterns = patternsOf(tripIds, trips, stopTimes);
      const wanted = cfg.pattern?.contains_stop;
      const candidates = patterns.filter((p) => !wanted || p.stops.includes(wanted));
      if (candidates.length === 0) {
        warn(`สาย ${cfg.id}: ไม่พบเที่ยววิ่งในฟีด ข้ามสายนี้`);
        continue;
      }
      const score = (p) => p.stops.length * 1000 + (p.direction === '0' ? 100 : 0) + p.trips.length;
      const main = candidates.sort((a, b) => score(b) - score(a))[0];
      const weekdayTrip = (p) =>
        p.trips.find((id) => calendar.get(trips.get(id).service_id)?.monday === '1') ?? p.trips[0];
      const mainTrip = weekdayTrip(main);
      sequence = [...main.stops];
      segSeconds = segmentSeconds(stopTimes.get(mainTrip));
      shapeIds = [trips.get(mainTrip).shape_id];

      if (cfg.join_patterns) {
        // สายที่วนกลับมา (เช่น สายสีน้ำเงิน) ฟีดแยกเป็นสองรูปแบบที่เริ่มจากสถานีเดียวกัน → ต่อเป็นสายเดียว
        const branch = patterns
          .filter((p) => p !== main && p.direction === main.direction && p.stops[0] === main.stops[0])
          .filter((p) => p.stops.some((s) => !main.stops.includes(s)))
          .sort((a, b) => b.stops.length - a.stops.length)[0];
        if (branch) {
          const branchTrip = weekdayTrip(branch);
          sequence = [...branch.stops].reverse().concat(main.stops.slice(1));
          segSeconds = segmentSeconds(stopTimes.get(branchTrip)).reverse().concat(segSeconds);
          shapeIds = [`reverse:${trips.get(branchTrip).shape_id}`, trips.get(mainTrip).shape_id];
        } else {
          warn(`สาย ${cfg.id}: ตั้งค่า join_patterns แต่ไม่พบรูปแบบที่จะต่อ`);
        }
      }
    }

    // ข้ามท่า/สถานีที่ฟีดระบุว่าปิด และรวมเวลาของช่วงนั้นเข้ากับช่วงถัดไป
    const kept = [];
    const keptSeconds = [];
    let carry = 0;
    sequence.forEach((gtfsId, i) => {
      const missing = !gtfsStops.has(gtfsId);
      if (missing) warn(`สาย ${cfg.id}: ไม่พบจุด ${gtfsId} ในฟีด`);
      if (missing || isClosed(gtfsId)) {
        if (!missing) warn(`สาย ${cfg.id}: ข้าม "${splitName(gtfsStops.get(gtfsId).stop_name).th}" (ฟีดระบุว่าปิด)`);
        if (segSeconds && i < segSeconds.length) carry += segSeconds[i];
        return;
      }
      if (kept.length > 0 && segSeconds) keptSeconds.push(carry);
      carry = segSeconds && i < segSeconds.length ? segSeconds[i] : 0;
      kept.push(gtfsId);
    });
    if (kept.length < 2) {
      warn(`สาย ${cfg.id}: เหลือจุดจอดไม่ถึง 2 จุด ข้ามสายนี้`);
      continue;
    }

    built.push({ spec, cfg, sequence: kept, segSeconds: segSeconds ? keptSeconds : null, shapeIds, tripIds });
  }

  // ---------- 4) เส้นทางจริง (shapes) ----------
  const wantedShapes = new Set(built.flatMap((b) => b.shapeIds.map((id) => id.replace(/^reverse:/, ''))).filter(Boolean));
  const shapePoints = new Map();
  if (feed.has('shapes.txt') && wantedShapes.size > 0) {
    log(`อ่านเส้นทาง ${wantedShapes.size} เส้น จาก shapes.txt`);
    for await (const row of feed.rows('shapes.txt')) {
      if (!wantedShapes.has(row.shape_id)) continue;
      if (!shapePoints.has(row.shape_id)) shapePoints.set(row.shape_id, []);
      shapePoints.get(row.shape_id).push([Number(row.shape_pt_sequence), Number(row.shape_pt_lat), Number(row.shape_pt_lon)]);
    }
    for (const list of shapePoints.values()) list.sort((a, b) => a[0] - b[0]);
  }

  const estimate = config.estimate ?? {};
  const ourId = new Map(); // gtfs stop_id → id ของเรา
  const stopMode = new Map();
  const lines = [];

  for (const b of built) {
    const { cfg, spec } = b;
    for (const gtfsId of b.sequence) {
      if (!ourId.has(gtfsId)) {
        ourId.set(gtfsId, `${cfg.stop_prefix}-${gtfsId}`);
        stopMode.set(gtfsId, cfg.mode);
      }
    }
    const coords = b.sequence.map((id) => [Number(gtfsStops.get(id).stop_lat), Number(gtfsStops.get(id).stop_lon)]);
    const raw = b.shapeIds.flatMap((id) => {
      const reverse = id.startsWith('reverse:');
      const points = (shapePoints.get(id.replace(/^reverse:/, '')) ?? []).map((p) => [p[1], p[2]]);
      return reverse ? points.reverse() : points;
    });
    const shape = fitShape(raw, coords);
    if (shape.straight) warn(`สาย ${cfg.id}: ไม่มีเส้นทางที่ใช้ได้ในฟีด วาดเป็นเส้นตรงระหว่างสถานี`);

    // เวลา: ใช้ของฟีดถ้าสมเหตุสมผล ไม่งั้นประมาณจากระยะทาง
    const [low, high] = estimate.plausible_kmh?.[cfg.mode] ?? [8, 80];
    const speed = cfg.speed_kmh ?? estimate.default_kmh?.[cfg.mode] ?? 25;
    const totalKm = shape.segmentKm.reduce((s, x) => s + x, 0);
    let segmentMinutes;
    let estimated = true;
    let reason;
    if (b.segSeconds && cfg.time !== 'estimate') {
      const totalHours = b.segSeconds.reduce((s, x) => s + x, 0) / 3600;
      const feedSpeed = totalHours > 0 ? totalKm / totalHours : Infinity;
      const placeholder = b.segSeconds.some((s) => !(s >= 20));
      if (!placeholder && feedSpeed >= low && feedSpeed <= high) {
        segmentMinutes = b.segSeconds.map((s) => round1(s / 60));
        estimated = false;
      } else {
        reason = placeholder ? 'เวลาในฟีดบางช่วงเป็นค่าว่าง' : `ความเร็วเฉลี่ยจากฟีด ${feedSpeed.toFixed(0)} กม./ชม. ผิดปกติ`;
      }
    } else {
      reason = cfg.time === 'estimate' ? 'ตั้งค่าให้ประมาณ' : 'ฟีดไม่มีเวลา';
    }
    if (estimated) {
      segmentMinutes = shape.segmentKm.map((km) => Math.max(0.5, round1((km / speed) * 60)));
    }

    const headway =
      computeHeadway({
        gtfsStops: b.sequence,
        tripIds: b.tripIds,
        trips,
        stopTimes,
        frequencies,
        calendar,
        window,
      }) ?? cfg.headway_minutes ?? 30;

    const service = computeService({
      sequence: b.sequence,
      segmentMinutes,
      tripIds: b.tripIds,
      trips,
      stopTimes,
      frequencies,
      calendar,
    });

    const firstRoute = routes.get(spec.routeIds[0]);
    const agency = agencies.get(firstRoute?.agency_id ?? cfg.agency_id);
    const totalMinutes = segmentMinutes.reduce((s, x) => s + x, 0);
    lines.push({
      id: cfg.id,
      name_th: cfg.name_th,
      ...(cfg.name_en ? { name_en: cfg.name_en } : {}),
      group: cfg.group_th ?? cfg.name_th,
      mode: cfg.mode,
      operator: splitName(agency?.agency_name ?? cfg.agency_id ?? '').th || (firstRoute?.agency_id ?? ''),
      color: normalizeColor(cfg.color) ?? normalizeColor(firstRoute?.route_color),
      stops: b.sequence.map((id) => ourId.get(id)),
      bidirectional: true,
      minutes_between_stops: round1(totalMinutes / segmentMinutes.length),
      segment_minutes: segmentMinutes,
      time_estimated: estimated,
      headway_minutes: headway,
      ...(service ? { service_hours: service } : {}),
      fare_rule: cfg.fare_group ?? `own-${cfg.id.toLowerCase()}`,
      source: `Namtang GTFS route ${spec.routeIds.join(', ')}`,
      _gtfs: b.sequence,
      _routes: spec.routeIds,
      _shape: shape,
      _report: { km: round1(totalKm), minutes: round1(totalMinutes), estimated, reason },
    });
    log(
      `  ${cfg.id.padEnd(14)} ${String(b.sequence.length).padStart(3)} จุด ${round1(totalKm).toString().padStart(5)} กม. ` +
        `${Math.round(totalMinutes).toString().padStart(4)} นาที รถทุก ${headway} นาที${estimated ? ` (เวลาประมาณ: ${reason})` : ''}`,
    );
  }

  // ---------- 5) ป้าย/สถานี/ท่าเรือ ----------
  const nameOverrides = config.stop_names ?? {};
  const stops = [...ourId.entries()].map(([gtfsId, id]) => {
    const row = gtfsStops.get(gtfsId);
    const { th, en } = splitName(row.stop_name);
    return {
      id,
      name_th: nameOverrides[gtfsId] ?? th,
      ...(en ? { name_en: en } : {}),
      mode: stopMode.get(gtfsId),
      lat: round6(Number(row.stop_lat)),
      lon: round6(Number(row.stop_lon)),
    };
  });

  // ---------- 6) ค่าโดยสาร ----------
  const groupConfigs = config.fare_groups ?? {};
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.fare_rule)) {
      groups.set(line.fare_rule, { id: line.fare_rule, cfg: groupConfigs[line.fare_rule] ?? {}, lines: [], gtfs: new Set(), routes: new Set() });
    }
    const group = groups.get(line.fare_rule);
    group.lines.push(line);
    line._gtfs.forEach((id) => group.gtfs.add(id));
    line._routes.forEach((id) => group.routes.add(id));
  }
  const zoneOf = (gtfsId) => gtfsStops.get(gtfsId)?.zone_id || gtfsId;
  const zonesOfInterest = new Set([...ourId.keys()].map(zoneOf));
  const routeRules = new Set([...groups.values()].filter((g) => g.cfg.source !== 'blank_agency').flatMap((g) => [...g.routes]));
  const blankWanted = [...groups.values()].some((g) => g.cfg.source === 'blank_agency');

  log('อ่านกฎค่าโดยสาร');
  const rules = [];
  for await (const row of feed.rows('fare_rules.txt')) {
    if (routeRules.has(row.route_id)) rules.push(row);
    else if (blankWanted && row.route_id === '' && zonesOfInterest.has(row.origin_id) && zonesOfInterest.has(row.destination_id)) rules.push(row);
  }
  const fareIds = new Set(rules.map((r) => r.fare_id));
  const attributes = new Map();
  for await (const row of feed.rows('fare_attributes.txt')) {
    if (fareIds.has(row.fare_id)) attributes.set(row.fare_id, { price: Number(row.price), agency: row.agency_id, currency: row.currency_type });
  }

  const sourceText = `Namtang GTFS ของ สนข. (CC BY 4.0) เวอร์ชัน ${version}`;
  const fareRules = [];
  for (const group of groups.values()) {
    const zoneStops = new Map();
    for (const gtfsId of group.gtfs) {
      const zone = zoneOf(gtfsId);
      if (!zoneStops.has(zone)) zoneStops.set(zone, []);
      zoneStops.get(zone).push(gtfsId);
    }
    const relevant = rules.filter((r) => {
      const attr = attributes.get(r.fare_id);
      if (!attr || attr.currency !== 'THB') return false;
      return group.cfg.source === 'blank_agency'
        ? r.route_id === '' && attr.agency === group.cfg.agency_id
        : group.routes.has(r.route_id);
    });
    const flat = [];
    const table = new Map();
    for (const rule of relevant) {
      const price = attributes.get(rule.fare_id).price;
      if (!rule.origin_id && !rule.destination_id) {
        flat.push(price);
        continue;
      }
      for (const a of zoneStops.get(rule.origin_id) ?? []) {
        for (const b of zoneStops.get(rule.destination_id) ?? []) {
          if (a === b) continue;
          const key = `${ourId.get(a)}|${ourId.get(b)}`;
          table.set(key, Math.min(table.get(key) ?? Infinity, price));
        }
      }
    }
    const routesText = [...group.routes].join(', ');
    const base = {
      id: group.id,
      source: `${sourceText} · route ${routesText}`,
      checked_at: checkedAt,
      ...(group.cfg.merge_transfers ? { merge_transfers: true } : {}),
      ...(group.cfg.note ? { note: group.cfg.note } : {}),
    };
    if (table.size === 0 && flat.length === 0) {
      throw new Error(`ไม่พบค่าโดยสารของกลุ่ม "${group.id}" (สาย ${group.lines.map((l) => l.id).join(', ')}) ในฟีด`);
    }
    const n = group.gtfs.size;
    const prices = [...table.values()];
    if (table.size === 0) {
      fareRules.push({ ...base, type: 'flat', amount: Math.min(...flat) });
    } else if (table.size === n * (n - 1) && prices.every((p) => p === prices[0])) {
      fareRules.push({ ...base, type: 'flat', amount: prices[0] });
    } else {
      if (table.size < n * (n - 1)) warn(`ค่าโดยสาร ${group.id}: ตารางมี ${table.size} จาก ${n * (n - 1)} คู่ ที่เหลือใช้ราคาสูงสุดแทน`);
      const max = Math.max(...prices, ...flat);
      const sorted = Object.fromEntries([...table.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
      fareRules.push({ ...base, type: 'table', table: sorted, fallback: { base: max, per_stop: 0, max } });
    }
  }
  fareRules.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ---------- 7) ทางเดินต่อรถ ----------
  const walk = config.walk ?? {};
  const limits = walk.max_meters ?? {};
  const pace = walk.meters_per_minute ?? 70;
  const barriers = lines.filter((l) => l._routes.some((r) => (walk.barrier_routes ?? []).includes(r))).map((l) => l._shape.points);
  const crossesBarrier = (a, b) =>
    barriers.some((points) => {
      for (let i = 0; i + 1 < points.length; i += 1) if (segmentsCross(a, b, points[i], points[i + 1])) return true;
      return false;
    });
  const coordOf = new Map(stops.map((s) => [s.id, [s.lat, s.lon]]));
  const modeOf = new Map(stops.map((s) => [s.id, s.mode]));

  // เรือข้ามฟากแต่ละลำเชื่อมสองฝั่งแม่น้ำ → ใช้แนวของมันบอกว่าจุดไหนอยู่ฝั่งเดียวกัน
  // (คู่ที่อยู่คนละฝั่งของเรือข้ามฟากที่ใกล้ที่สุด จะไม่สร้างทางเดินให้ เพราะต้องข้ามแม่น้ำ)
  const ferryPrefix = walk.ferry_line_prefix ?? 'FERRY-';
  const ferries = lines
    .filter((l) => l.id.startsWith(ferryPrefix) && l.stops.length === 2)
    .map((l) => {
      const a = coordOf.get(l.stops[0]);
      const b = coordOf.get(l.stops[1]);
      return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], a, b };
    });
  const sideRadius = walk.ferry_side_radius_meters ?? 1500;
  const side = (ferry, p) => {
    const k = Math.cos((ferry.mid[0] * Math.PI) / 180);
    const ax = (ferry.b[1] - ferry.a[1]) * k;
    const ay = ferry.b[0] - ferry.a[0];
    return Math.sign((p[1] - ferry.mid[1]) * k * ax + (p[0] - ferry.mid[0]) * ay);
  };
  const oppositeBanks = (a, b) => {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let nearest = null;
    let best = Infinity;
    for (const ferry of ferries) {
      const d = distanceMeters(mid, ferry.mid);
      if (d < best) {
        best = d;
        nearest = ferry;
      }
    }
    if (!nearest || best > sideRadius) return false;
    const sa = side(nearest, a);
    const sb = side(nearest, b);
    return sa !== 0 && sb !== 0 && sa !== sb;
  };
  const blockedPairs = new Set((config.block_transfers ?? []).map(([x, y]) => [ourId.get(x) ?? x, ourId.get(y) ?? y].sort().join('|')));
  const transfers = [];
  let blocked = 0;
  for (let i = 0; i < stops.length; i += 1) {
    for (let j = i + 1; j < stops.length; j += 1) {
      const a = stops[i];
      const b = stops[j];
      const pair = [modeOf.get(a.id), modeOf.get(b.id)].sort().join('-');
      const limit = limits[pair] ?? limits.default ?? 400;
      const d = distanceMeters(coordOf.get(a.id), coordOf.get(b.id));
      if (d > limit) continue;
      if (
        blockedPairs.has([a.id, b.id].sort().join('|')) ||
        oppositeBanks(coordOf.get(a.id), coordOf.get(b.id)) ||
        crossesBarrier(coordOf.get(a.id), coordOf.get(b.id))
      ) {
        blocked += 1;
        continue;
      }
      const extra = pair === 'boat-boat' ? (walk.extra_minutes_boat ?? 1) : (walk.extra_minutes ?? 2);
      transfers.push({ from: a.id, to: b.id, walk_minutes: Math.ceil(d / pace) + extra });
    }
  }
  for (const t of config.extra_transfers ?? []) {
    const from = ourId.get(t.from) ?? t.from;
    const to = ourId.get(t.to) ?? t.to;
    if (!coordOf.has(from) || !coordOf.has(to)) {
      warn(`ทางเดินที่ตั้งเอง ${t.from} ↔ ${t.to}: ไม่พบจุดนี้ในข้อมูลที่ดึงมา`);
      continue;
    }
    transfers.push({ from, to, walk_minutes: t.walk_minutes });
  }
  log(`ทางเดินต่อรถ ${transfers.length} คู่ (ไม่สร้างทางเดินข้ามแม่น้ำ ${blocked} คู่)`);

  // ---------- 8) ตรวจว่าทุกสายต่อถึงกัน ----------
  const parent = new Map(stops.map((s) => [s.id, s.id]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const join = (a, b) => parent.set(find(a), find(b));
  for (const line of lines) line.stops.forEach((s) => join(s, line.stops[0]));
  for (const t of transfers) join(t.from, t.to);
  const components = new Map();
  for (const line of lines) {
    const root = find(line.stops[0]);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(line.id);
  }
  let dropped = [];
  if (components.size > 1) {
    const parts = [...components.values()].sort((a, b) => b.length - a.length);
    if (config.drop_isolated_lines) {
      // สายที่ไม่ต่อกับเครือข่ายหลัก (เช่น เรือข้ามฟากไกล ๆ) ใช้วางแผนเดินทางไม่ได้ → ตัดทิ้ง
      dropped = parts.slice(1).flat();
      log(`ตัด ${dropped.length} สายที่ไม่ต่อกับเครือข่ายหลัก: ${dropped.join(', ')}`);
    } else {
      warn(`ข้อมูลแยกเป็น ${parts.length} เครือข่ายที่ไม่ต่อกัน: ${parts.slice(1).map((p) => p.join(', ')).join(' / ')}`);
    }
  }
  if (dropped.length > 0) {
    const gone = new Set(dropped);
    for (let i = lines.length - 1; i >= 0; i -= 1) if (gone.has(lines[i].id)) lines.splice(i, 1);
    const used = new Set(lines.flatMap((l) => l.stops));
    for (let i = stops.length - 1; i >= 0; i -= 1) if (!used.has(stops[i].id)) stops.splice(i, 1);
    for (let i = transfers.length - 1; i >= 0; i -= 1) {
      if (!used.has(transfers[i].from) || !used.has(transfers[i].to)) transfers.splice(i, 1);
    }
    const usedRules = new Set(lines.map((l) => l.fare_rule));
    for (let i = fareRules.length - 1; i >= 0; i -= 1) if (!usedRules.has(fareRules[i].id)) fareRules.splice(i, 1);
  }

  // ---------- 9) ผลลัพธ์ ----------
  const shapes = {};
  for (const line of lines) shapes[line.id] = { points: line._shape.points, stop_index: line._shape.stopIndex };
  const report = lines.map((l) => ({ id: l.id, name_th: l.name_th, stops: l.stops.length, headway: l.headway_minutes, ...l._report }));
  const outLines = lines.map(({ _gtfs, _routes, _shape, _report, ...rest }) => rest);

  return {
    feed: { version, checked_at: checkedAt, publisher: feedInfo.feed_publisher_name ?? '' },
    stops,
    lines: outLines,
    transfers,
    fares: { rules: fareRules, policies: [] },
    shapes,
    report,
    warnings,
    dropped,
    components: components.size - (dropped.length > 0 ? components.size - 1 : 0),
  };
}
