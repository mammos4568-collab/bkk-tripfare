/**
 * ตรวจข้อมูลขนส่งใน data/ ก่อนใช้งาน
 * - errors   = ข้อมูลผิด ระบบใช้ไม่ได้ (server จะไม่ยอมเริ่ม)
 * - warnings = น่าสงสัย ควรเช็ก (เช่น ข้อมูลตัวอย่าง พิกัดแปลก ราคาสูงผิดปกติ)
 *
 * ด่านนี้ช่วยจับข้อมูลที่พิมพ์ผิดหรือ AI แต่งมา ก่อนจะไปถึงผู้ใช้
 */

const MODES = ['rail', 'train', 'bus', 'boat'];
const RULE_TYPES = ['flat', 'by_stops', 'table'];
const ID_PATTERN = /^[A-Za-z0-9_-]+$/; // ห้ามมี : หรือ | เพราะโค้ดใช้เป็นตัวคั่น
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REASONABLE_FARE = 200;

// กรอบพิกัดกรุงเทพฯ และปริมณฑลแบบหลวม ๆ ไว้จับ lat/lon สลับกันหรือพิมพ์ผิด
const AREA = { latMin: 13.4, latMax: 14.3, lonMin: 100.0, lonMax: 101.0 };

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isValidDate = (v) =>
  typeof v === 'string' && DATE_PATTERN.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function validateData({ stops, lines, transfers, fares, shapes }) {
  const errors = [];
  const warnings = [];
  let sampleCount = 0;

  if (!Array.isArray(stops)) errors.push('stops.json ต้องเป็น array');
  if (!Array.isArray(lines)) errors.push('lines.json ต้องเป็น array');
  if (!Array.isArray(transfers)) errors.push('transfers.json ต้องเป็น array');
  if (!fares || !Array.isArray(fares.rules)) errors.push('fares.json ต้องเป็น object ที่มี "rules" เป็น array');
  if (fares?.policies !== undefined && !Array.isArray(fares.policies)) errors.push('fares.json: "policies" ต้องเป็น array');
  if (errors.length) return { errors, warnings };

  const policies = fares.policies ?? [];

  // ---------- stops.json ----------
  const stopIds = new Set();
  stops.forEach((stop, i) => {
    const at = `stops.json[${i}] (${stop?.id ?? 'ไม่มี id'})`;
    if (!isText(stop?.id) || !ID_PATTERN.test(stop.id)) {
      errors.push(`${at}: id ต้องเป็นตัวอังกฤษ ตัวเลข - หรือ _ เท่านั้น`);
      return;
    }
    if (stopIds.has(stop.id)) errors.push(`${at}: id ซ้ำ`);
    stopIds.add(stop.id);
    if (stop.id.startsWith('SMP-')) sampleCount += 1;

    if (!isText(stop.name_th)) errors.push(`${at}: ไม่มี name_th`);
    if (!MODES.includes(stop.mode)) errors.push(`${at}: mode ต้องเป็น ${MODES.join(' / ')}`);
    if (!isNumber(stop.lat) || !isNumber(stop.lon) || Math.abs(stop.lat) > 90 || Math.abs(stop.lon) > 180) {
      errors.push(`${at}: lat/lon ไม่ถูกต้อง`);
    } else if (stop.lat < AREA.latMin || stop.lat > AREA.latMax || stop.lon < AREA.lonMin || stop.lon > AREA.lonMax) {
      warnings.push(`${at}: พิกัดอยู่นอกกรุงเทพฯ และปริมณฑล — lat/lon สลับกันหรือเปล่า?`);
    }
  });

  // ---------- fares.json ----------
  const ruleIds = new Set();
  const checkSourceAndDate = (item, at) => {
    if (!isText(item.source)) errors.push(`${at}: ต้องมี source (แหล่งที่มาของข้อมูล)`);
    else if (item.source.startsWith('SAMPLE')) sampleCount += 1;
    if (!isValidDate(item.checked_at)) errors.push(`${at}: checked_at ต้องเป็นวันที่ YYYY-MM-DD`);
    else if (Date.parse(`${item.checked_at}T00:00:00Z`) > Date.now() + 24 * 60 * 60 * 1000) {
      warnings.push(`${at}: checked_at เป็นวันในอนาคต`);
    }
  };
  const checkAmount = (value, field, at) => {
    if (!isNumber(value) || value < 0) {
      errors.push(`${at}: ${field} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
    } else if (value > MAX_REASONABLE_FARE) {
      errors.push(`${at}: ${field} = ${value} บาท สูงผิดปกติ (เกิน ${MAX_REASONABLE_FARE})`);
    }
  };
  const checkByStops = (obj, at) => {
    checkAmount(obj.base, 'base', at);
    checkAmount(obj.per_stop, 'per_stop', at);
    if (obj.max !== undefined) {
      checkAmount(obj.max, 'max', at);
      if (isNumber(obj.max) && isNumber(obj.base) && obj.max < obj.base) errors.push(`${at}: max ต้องไม่น้อยกว่า base`);
    }
  };

  fares.rules.forEach((rule, i) => {
    const at = `fares.json rules[${i}] (${rule?.id ?? 'ไม่มี id'})`;
    if (!isText(rule?.id) || !ID_PATTERN.test(rule.id)) {
      errors.push(`${at}: id ต้องเป็นตัวอังกฤษ ตัวเลข - หรือ _ เท่านั้น`);
      return;
    }
    if (ruleIds.has(rule.id)) errors.push(`${at}: id ซ้ำ`);
    ruleIds.add(rule.id);
    if (!RULE_TYPES.includes(rule.type)) {
      errors.push(`${at}: type ต้องเป็น ${RULE_TYPES.join(' / ')}`);
      return;
    }
    if (rule.type === 'flat') checkAmount(rule.amount, 'amount', at);
    if (rule.type === 'by_stops') checkByStops(rule, at);
    if (rule.type === 'table') {
      if (!rule.table || typeof rule.table !== 'object') {
        errors.push(`${at}: type "table" ต้องมี table`);
      } else {
        for (const [key, value] of Object.entries(rule.table)) {
          const [a, b, extra] = key.split('|');
          if (!a || !b || extra !== undefined) errors.push(`${at}: key "${key}" ต้องเป็นรูปแบบ "ต้นทาง|ปลายทาง"`);
          else if (!stopIds.has(a) || !stopIds.has(b)) warnings.push(`${at}: key "${key}" มีจุดที่ไม่อยู่ใน stops.json`);
          checkAmount(value, `table["${key}"]`, at);
        }
      }
      if (rule.fallback !== undefined) checkByStops(rule.fallback, `${at} fallback`);
    }
    if (rule.merge_transfers !== undefined && typeof rule.merge_transfers !== 'boolean') {
      errors.push(`${at}: merge_transfers ต้องเป็น true / false`);
    }
    checkSourceAndDate(rule, at);
  });

  policies.forEach((policy, i) => {
    const at = `fares.json policies[${i}] (${policy?.id ?? 'ไม่มี id'})`;
    if (!isText(policy?.id)) errors.push(`${at}: ไม่มี id`);
    if (!Array.isArray(policy?.modes) || policy.modes.length === 0 || !policy.modes.every((m) => MODES.includes(m))) {
      errors.push(`${at}: modes ต้องเป็น array ของ ${MODES.join(' / ')}`);
    }
    checkAmount(policy?.max_fare_per_ride, 'max_fare_per_ride', at);
    if (typeof policy?.active !== 'boolean') errors.push(`${at}: active ต้องเป็น true / false`);
    checkSourceAndDate(policy ?? {}, at);
  });

  // ---------- lines.json ----------
  const lineIds = new Set();
  const usedStops = new Set();
  const usedRules = new Set();
  lines.forEach((line, i) => {
    const at = `lines.json[${i}] (${line?.id ?? 'ไม่มี id'})`;
    if (!isText(line?.id) || !ID_PATTERN.test(line.id)) {
      errors.push(`${at}: id ต้องเป็นตัวอังกฤษ ตัวเลข - หรือ _ เท่านั้น`);
      return;
    }
    if (lineIds.has(line.id)) errors.push(`${at}: id ซ้ำ`);
    lineIds.add(line.id);

    if (!isText(line.name_th)) errors.push(`${at}: ไม่มี name_th`);
    if (!MODES.includes(line.mode)) errors.push(`${at}: mode ต้องเป็น ${MODES.join(' / ')}`);
    if (!isText(line.operator)) errors.push(`${at}: ไม่มี operator`);
    if (line.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(line.color)) {
      errors.push(`${at}: color ต้องเป็นรหัสสีแบบ #RRGGBB`);
    }
    if (line.bidirectional !== undefined && typeof line.bidirectional !== 'boolean') {
      errors.push(`${at}: bidirectional ต้องเป็น true / false`);
    }

    if (!Array.isArray(line.stops) || line.stops.length < 2) {
      errors.push(`${at}: stops ต้องมีอย่างน้อย 2 จุด`);
    } else {
      line.stops.forEach((stopId, j) => {
        if (!stopIds.has(stopId)) errors.push(`${at}: stops[${j}] "${stopId}" ไม่มีใน stops.json`);
        if (j > 0 && line.stops[j - 1] === stopId) errors.push(`${at}: stops[${j}] "${stopId}" ซ้ำกับจุดก่อนหน้า`);
        usedStops.add(stopId);
      });
    }

    if (!isNumber(line.minutes_between_stops) || line.minutes_between_stops <= 0) {
      errors.push(`${at}: minutes_between_stops ต้องเป็นตัวเลขมากกว่า 0`);
    } else if (line.minutes_between_stops > 30) {
      warnings.push(`${at}: minutes_between_stops = ${line.minutes_between_stops} นาที นานผิดปกติ`);
    }
    if (line.segment_minutes !== undefined) {
      if (!Array.isArray(line.segment_minutes) || line.segment_minutes.length !== (line.stops?.length ?? 0) - 1) {
        errors.push(`${at}: segment_minutes ต้องมีจำนวน = จำนวนจุดจอด − 1`);
      } else if (!line.segment_minutes.every((m) => isNumber(m) && m > 0)) {
        errors.push(`${at}: segment_minutes ทุกค่าต้องเป็นตัวเลขมากกว่า 0`);
      } else if (line.segment_minutes.some((m) => m > 60)) {
        warnings.push(`${at}: segment_minutes บางช่วงนานเกิน 60 นาที`);
      }
    }
    if (line.group !== undefined && !isText(line.group)) errors.push(`${at}: group ต้องเป็นข้อความ`);
    if (!isNumber(line.headway_minutes) || line.headway_minutes <= 0) {
      errors.push(`${at}: headway_minutes ต้องเป็นตัวเลขมากกว่า 0`);
    } else if (line.headway_minutes > 120 && !line.service_hours) {
      // สายที่วิ่งเฉพาะบางช่วง (มี service_hours) ค่าเฉลี่ยทั้งวันนานได้เป็นปกติ
      warnings.push(`${at}: headway_minutes = ${line.headway_minutes} นาที นานผิดปกติ`);
    }
    if (line.service_hours !== undefined) {
      const clock = /^\d{2}:\d{2}$/;
      const ok = ['weekday', 'weekend'].every((day) =>
        ['forward', 'backward'].every((dir) => {
          const periods = line.service_hours?.[day]?.[dir];
          return Array.isArray(periods) && periods.every((p) => Array.isArray(p) && p.length === 2 && p.every((t) => clock.test(t)) && p[0] <= p[1]);
        }),
      );
      if (!ok) errors.push(`${at}: service_hours ต้องเป็น { weekday|weekend: { forward|backward: [["HH:MM","HH:MM"], ...] } }`);
    }

    if (!ruleIds.has(line.fare_rule)) errors.push(`${at}: fare_rule "${line.fare_rule}" ไม่มีใน fares.json`);
    usedRules.add(line.fare_rule);
  });

  // ---------- transfers.json ----------
  transfers.forEach((t, i) => {
    const at = `transfers.json[${i}] (${t?.from} ↔ ${t?.to})`;
    if (!stopIds.has(t?.from)) errors.push(`${at}: from "${t?.from}" ไม่มีใน stops.json`);
    if (!stopIds.has(t?.to)) errors.push(`${at}: to "${t?.to}" ไม่มีใน stops.json`);
    if (t?.from === t?.to) errors.push(`${at}: from กับ to ต้องไม่ใช่จุดเดียวกัน`);
    if (!isNumber(t?.walk_minutes) || t.walk_minutes <= 0) {
      errors.push(`${at}: walk_minutes ต้องเป็นตัวเลขมากกว่า 0`);
    } else if (t.walk_minutes > 15) {
      warnings.push(`${at}: เดิน ${t.walk_minutes} นาที ไกลเกินไปสำหรับการต่อรถหรือเปล่า?`);
    }
  });

  // ---------- shapes.json (ไม่บังคับ) ----------
  if (shapes !== undefined) {
    if (!shapes || typeof shapes !== 'object' || Array.isArray(shapes)) {
      errors.push('shapes.json ต้องเป็น object { รหัสสาย: { points, stop_index } }');
    } else {
      const linesById = new Map(lines.map((l) => [l.id, l]));
      for (const [id, shape] of Object.entries(shapes)) {
        const at = `shapes.json (${id})`;
        const line = linesById.get(id);
        if (!line) {
          warnings.push(`${at}: ไม่มีสายนี้ใน lines.json`);
          continue;
        }
        const points = shape?.points;
        if (!Array.isArray(points) || points.length < 2 || !points.every((p) => Array.isArray(p) && isNumber(p[0]) && isNumber(p[1]))) {
          errors.push(`${at}: points ต้องเป็นรายการ [lat, lon] อย่างน้อย 2 จุด`);
          continue;
        }
        const index = shape.stop_index;
        if (!Array.isArray(index) || index.length !== line.stops.length) {
          errors.push(`${at}: stop_index ต้องมีจำนวนเท่ากับจุดจอดของสาย`);
        } else if (!index.every((v, k) => Number.isInteger(v) && v >= 0 && v < points.length && (k === 0 || v >= index[k - 1]))) {
          errors.push(`${at}: stop_index ต้องเป็นเลขลำดับจุดที่เรียงจากน้อยไปมาก`);
        }
      }
    }
  }

  // ---------- ภาพรวม ----------
  for (const id of stopIds) {
    if (!usedStops.has(id)) warnings.push(`stops.json (${id}): ไม่มีสายไหนผ่านจุดนี้`);
  }
  for (const id of ruleIds) {
    if (!usedRules.has(id)) warnings.push(`fares.json (${id}): ไม่มีสายไหนใช้กฎราคานี้`);
  }
  if (sampleCount > 0) {
    warnings.push(`ยังมีข้อมูลตัวอย่าง (SMP- / SAMPLE) ${sampleCount} รายการ — ต้องลบออกก่อนใช้งานจริง`);
  }

  return { errors, warnings };
}
