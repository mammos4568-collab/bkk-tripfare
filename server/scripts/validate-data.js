/**
 * ตรวจข้อมูลใน data/ — รันก่อนส่ง PR ที่แก้ข้อมูลทุกครั้ง
 *
 *   npm run validate-data          errors → ไม่ผ่าน, warnings → แค่เตือน
 *   npm run validate-data:strict   warnings ก็ไม่ผ่าน (ใช้ก่อนเปิดให้คนใช้จริง)
 *
 * ไม่ต้องใช้ library ภายนอก รันได้ทันทีแม้ยังไม่ได้ npm install
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data/loadData.js';
import { validateData } from '../src/data/validateData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? path.resolve(here, '../../data');
const strict = process.argv.includes('--strict');

let data;
try {
  data = await loadData(dataDir);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

const { errors, warnings } = validateData(data);

console.log(`ตรวจข้อมูลใน ${dataDir}`);
console.log(`สถานี/ป้าย/ท่าเรือ ${data.stops.length} จุด · สาย ${data.lines.length} สาย · ทางเดินเชื่อม ${data.transfers.length} · กฎราคา ${data.fares.rules.length}\n`);

if (errors.length) {
  console.log(`❌ ข้อผิดพลาด ${errors.length} รายการ`);
  for (const e of errors) console.log(`  - ${e}`);
  console.log();
}
if (warnings.length) {
  console.log(`⚠️  คำเตือน ${warnings.length} รายการ`);
  for (const w of warnings) console.log(`  - ${w}`);
  console.log();
}

const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(failed ? '❌ ไม่ผ่าน' : '✅ ผ่าน');
process.exit(failed ? 1 : 0);
