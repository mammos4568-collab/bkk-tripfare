/**
 * คำนวณค่าโดยสารตามกฎใน data/fares.json (รูปแบบดู docs/schema.md)
 */

/**
 * ราคาโดยประมาณสำหรับใช้ระหว่างค้นหาเส้นทางแบบ "ถูกสุด"
 * = ค่าแรกเข้า (ตอนขึ้นรถ) + ราคาต่อจุด (ตอนนั่งผ่านแต่ละจุด)
 * ยังไม่คิดเพดาน max / ตารางราคา / นโยบาย — ราคาจริงคิดทีหลังด้วย priceLegs()
 */
export function approximateFare(rule) {
  switch (rule.type) {
    case 'flat':
      return { boarding: rule.amount, perStop: 0 };
    case 'by_stops':
      return { boarding: rule.base, perStop: rule.per_stop };
    case 'table':
      return rule.fallback
        ? { boarding: rule.fallback.base, perStop: rule.fallback.per_stop }
        : { boarding: 0, perStop: 0 };
    default:
      throw new Error(`ไม่รู้จักกฎราคาชนิด "${rule.type}" (${rule.id})`);
  }
}

function byStops({ base, per_stop, max }, numStops) {
  const fare = base + per_stop * numStops;
  return max != null ? Math.min(max, fare) : fare;
}

/**
 * ราคาของการนั่ง 1 เที่ยว ตามกฎราคา
 * @param {object} rule กฎจาก fares.json
 * @param {{ fromStop: string, toStop: string, numStops: number }} ride
 */
export function rideFare(rule, { fromStop, toStop, numStops }) {
  switch (rule.type) {
    case 'flat':
      return rule.amount;
    case 'by_stops':
      return byStops(rule, numStops);
    case 'table': {
      const table = rule.table ?? {};
      const price = table[`${fromStop}|${toStop}`] ?? table[`${toStop}|${fromStop}`];
      if (price != null) return price;
      if (rule.fallback) return byStops(rule.fallback, numStops);
      throw new Error(`ไม่มีราคา ${fromStop} → ${toStop} ในตาราง ${rule.id}`);
    }
    default:
      throw new Error(`ไม่รู้จักกฎราคาชนิด "${rule.type}" (${rule.id})`);
  }
}

/** ใช้นโยบายเพดานราคาที่เปิดอยู่ (active) กับประเภทรถนั้น */
export function applyPolicies(fare, mode, policies = []) {
  let result = fare;
  for (const policy of policies) {
    if (policy.active && policy.modes.includes(mode) && policy.max_fare_per_ride != null) {
      result = Math.min(result, policy.max_fare_per_ride);
    }
  }
  return result;
}

/**
 * ใส่ราคาให้ทุก leg ในหนึ่งช่วงการเดินทาง
 * ride ที่ต่อกันในระบบเดียวกัน (กฎราคาเดียวกัน + merge_transfers + ลงแล้วขึ้นที่จุดเดิม)
 * คิดเป็นเที่ยวเดียว → leg หลังได้ fare 0 และ fare_included_in_previous = true
 *
 * @returns {object[]} legs ชุดใหม่ (ไม่แก้ของเดิม)
 */
export function priceLegs(legs, { linesById, rulesById, policies = [] }) {
  const out = legs.map((leg) => ({ ...leg }));
  let i = 0;
  while (i < out.length) {
    const leg = out[i];
    if (leg.type !== 'ride') {
      i += 1;
      continue;
    }
    const line = linesById.get(leg.line_id);
    const rule = rulesById.get(line.fare_rule);

    // รวม ride ถัด ๆ ไปที่ต่อในระบบเดียวกันได้
    let j = i;
    let numStops = leg.num_stops;
    while (
      rule.merge_transfers &&
      j + 1 < out.length &&
      out[j + 1].type === 'ride' &&
      linesById.get(out[j + 1].line_id).fare_rule === rule.id &&
      out[j + 1].from_stop === out[j].to_stop
    ) {
      j += 1;
      numStops += out[j].num_stops;
    }

    const raw = rideFare(rule, { fromStop: leg.from_stop, toStop: out[j].to_stop, numStops });
    leg.fare = applyPolicies(raw, line.mode, policies);
    leg.fare_included_in_previous = false;
    for (let k = i + 1; k <= j; k += 1) {
      out[k].fare = 0;
      out[k].fare_included_in_previous = true;
    }
    i = j + 1;
  }
  return out;
}
