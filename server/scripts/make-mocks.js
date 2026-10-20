/**
 * สร้างข้อมูลจำลองของหน้าเว็บ (client/src/mocks/*.json) จากข้อมูลจริงใน data/
 * รันใหม่ทุกครั้งที่นำเข้าข้อมูลใหม่: npm run make-mocks
 * (โหมด VITE_USE_MOCK=true จะได้หน้าตาเหมือนของจริง)
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlanner } from '../src/core/planner.js';
import { loadData } from '../src/data/loadData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../client/src/mocks');
const planner = createPlanner(await loadData(path.join(here, '../../data')));

// ทริปเดียวกับเส้นทางตัวอย่างแรกใน client/src/presets.js
const TRIP = ['SRT-242', 'BTS-12', 'PIER-13951'];
const MEETUP = ['SRT-242', 'BTS-37', 'MRT-13626'];

function meetup(origins) {
  const candidates = planner
    .searchStops({ limit: 1000 })
    .filter((s) => s.lines.length >= 2)
    .slice(0, 40);
  const scored = [];
  for (const stop of candidates) {
    try {
      const per = origins.map((o, i) =>
        o === stop.id ? { origin_index: i, fare: 0, minutes: 0 } : (({ fare, minutes }) => ({ origin_index: i, fare, minutes }))(planner.planSegment(o, stop.id, 'cheapest')),
      );
      scored.push({
        stop_id: stop.id,
        name: stop.name_th,
        total_fare: per.reduce((t, p) => t + p.fare, 0),
        max_fare: Math.max(...per.map((p) => p.fare)),
        total_minutes: per.reduce((t, p) => t + p.minutes, 0),
        per,
      });
    } catch {
      // ไปไม่ถึง → ข้าม
    }
  }
  scored.sort((a, b) => a.total_fare - b.total_fare || a.total_minutes - b.total_minutes);
  const [best, ...rest] = scored;
  const strip = ({ per, ...s }) => s;
  return { strategy: 'min_total', best: strip(best), per_person: best.per, alternatives: rest.slice(0, 3).map(strip) };
}

const files = {
  'network.json': planner.network(),
  'options.json': planner.planOptions(TRIP),
  'plan.json': planner.planTrip(TRIP, 'fastest'),
  'stops.json': { stops: planner.searchStops({ limit: 1000 }) },
  'lines.json': { lines: planner.listLines() },
  'meetup.json': meetup(MEETUP),
};
for (const [name, body] of Object.entries(files)) {
  await writeFile(path.join(out, name), `${JSON.stringify(body, null, name === 'network.json' || name === 'stops.json' ? 0 : 2)}\n`);
}
console.log(`เขียน ${Object.keys(files).length} ไฟล์ลง ${out}`);
