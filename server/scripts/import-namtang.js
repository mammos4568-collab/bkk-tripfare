/**
 * ดึงข้อมูลจริงจากฟีด Namtang GTFS ของ สนข. มาเป็นไฟล์ใน data/
 *
 *   1) ดาวน์โหลด https://namtang-api.otp.go.th/download/namtang-gtfs.zip (ประมาณ 40 MB)
 *   2) npm run import-data -- path/to/namtang-gtfs.zip
 *      (หรือชี้ไปที่โฟลเดอร์ที่แตกไฟล์แล้วก็ได้)
 *
 * ตัวเลือก
 *   --config <ไฟล์>   ค่าตั้ง (ค่าเริ่มต้น data/sources/namtang.json)
 *   --out <โฟลเดอร์>  ที่เก็บผลลัพธ์ (ค่าเริ่มต้น data/)
 *   --dry-run        ตรวจอย่างเดียว ไม่เขียนไฟล์
 *
 * ไม่ต้องใช้ library ภายนอก
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importNamtang } from '../src/data/gtfs/importNamtang.js';
import { openFeed } from '../src/data/gtfs/feed.js';
import { validateData } from '../src/data/validateData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const input = args.find((a, i) => !a.startsWith('--') && !['--config', '--out'].includes(args[i - 1]));
const configPath = path.resolve(option('--config', path.join(here, '../../data/sources/namtang.json')));
const outDir = path.resolve(option('--out', path.join(here, '../../data')));
const dryRun = args.includes('--dry-run');

if (!input) {
  console.error('วิธีใช้: npm run import-data -- path/to/namtang-gtfs.zip');
  console.error('ดาวน์โหลดฟีดได้ที่ https://namtang-api.otp.go.th/opendata');
  process.exit(1);
}

const config = JSON.parse(await readFile(configPath, 'utf8'));
const started = Date.now();
const result = await importNamtang({ feed: await openFeed(path.resolve(input)), config, log: (m) => console.log(m) });

const { errors, warnings } = validateData({ ...result, shapes: result.shapes });
if (errors.length) {
  console.error(`\n❌ ข้อมูลที่ได้ไม่ผ่านการตรวจ ${errors.length} รายการ:`);
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
  process.exit(1);
}

const pretty = (value) => `${JSON.stringify(value, null, 2)}\n`;
// เส้นทางเก็บแบบบรรทัดละสาย ไฟล์จะได้ไม่ยาวเกินไป
const shapesText = `{\n${Object.entries(result.shapes)
  .map(([id, shape]) => `  ${JSON.stringify(id)}: ${JSON.stringify(shape)}`)
  .join(',\n')}\n}\n`;

const estimated = result.report.filter((r) => r.estimated);
const sources = `# ที่มาของข้อมูล

ไฟล์ในโฟลเดอร์นี้ (ยกเว้นไฟล์ README และ sources/) สร้างด้วย \`npm run import-data\` จาก

- **Namtang GTFS** ของ${config.feed.publisher}
- เวอร์ชัน **${result.feed.version}** (ใช้เป็นวันที่ตรวจราคา ${result.feed.checked_at})
- สัญญาอนุญาต **${config.feed.license}** (${config.feed.license_url}) — ต้องให้เครดิต สนข. ทุกที่ที่แสดงข้อมูลนี้
- ดาวน์โหลด: ${config.feed.download_url}

## สิ่งที่เราดัดแปลงจากฟีด

- เลือกเฉพาะ ${result.lines.length} สายตาม \`sources/namtang.json\` และตัดชื่อให้สั้นลง (เช่น "BTS สยาม" → "สยาม") แก้คำผิด ${Object.keys(config.stop_names ?? {}).length} ชื่อ
- ข้ามสถานี/ท่าที่ฟีดระบุว่าปิดปรับปรุง
- ความถี่ = ค่าเฉลี่ยวันธรรมดา ${(config.headway_window ?? ['07:00', '20:00']).join('–')} จาก frequencies.txt / จำนวนเที่ยว
- ค่าโดยสารจาก fare_rules.txt + fare_attributes.txt (คู่ที่ไม่มีในตารางใช้ราคาสูงสุดของสายนั้น)
- ทางเดินต่อรถสร้างจากระยะห่างระหว่างจุด (ไม่สร้างทางเดินข้ามแม่น้ำเจ้าพระยา)
- เวลาเดินทางใช้ของฟีด ยกเว้น ${estimated.length} สายที่เวลาในฟีดผิดปกติ ซึ่งประมาณจากระยะทางตามเส้นทางจริงแทน:
${estimated.map((r) => `  - ${r.name_th} — ${r.reason}`).join('\n')}

นำเข้าเมื่อ ${new Date().toISOString().slice(0, 10)}
`;

console.log(`\nสาย ${result.lines.length} · จุดจอด ${result.stops.length} · ทางเดินต่อรถ ${result.transfers.length} · กฎราคา ${result.fares.rules.length}`);
if (warnings.length) console.log(`คำเตือนจากการตรวจข้อมูล ${warnings.length} รายการ (ดูด้วย npm run validate-data)`);
if (result.components > 1) console.log('⚠️  มีบางสายที่ไม่ต่อกับเครือข่ายหลัก ดูคำเตือนด้านบน');

if (dryRun) {
  console.log('\n--dry-run: ไม่ได้เขียนไฟล์');
} else {
  await Promise.all([
    writeFile(path.join(outDir, 'stops.json'), pretty(result.stops)),
    writeFile(path.join(outDir, 'lines.json'), pretty(result.lines)),
    writeFile(path.join(outDir, 'transfers.json'), pretty(result.transfers)),
    writeFile(path.join(outDir, 'fares.json'), pretty(result.fares)),
    writeFile(path.join(outDir, 'shapes.json'), shapesText),
    writeFile(path.join(outDir, 'SOURCES.md'), sources),
  ]);
  console.log(`\n✅ เขียนไฟล์ลง ${outDir} แล้ว (${((Date.now() - started) / 1000).toFixed(0)} วินาที)`);
}
