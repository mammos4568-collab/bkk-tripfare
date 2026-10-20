import { createApp } from './app.js';
import { config } from './config.js';
import { createPlanner } from './core/planner.js';
import { loadData } from './data/loadData.js';
import { validateData } from './data/validateData.js';

// โหลดและตรวจข้อมูลก่อน — ข้อมูลผิดจะไม่ยอมเปิด server (ดีกว่าคำนวณราคาผิดให้ผู้ใช้)
const data = await loadData(config.dataDir);
const { errors, warnings } = validateData(data);
if (errors.length) {
  console.error(`ข้อมูลใน ${config.dataDir} ผิดพลาด ${errors.length} รายการ:`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('แก้ข้อมูลแล้วรันใหม่ (ดูรายละเอียดด้วย npm run validate-data)');
  process.exit(1);
}
if (warnings.length) {
  console.warn(`⚠️  ข้อมูลมีคำเตือน ${warnings.length} รายการ — รัน npm run validate-data เพื่อดู`);
}

const planner = createPlanner(data);
const app = createApp({ planner, config });

app.listen(config.port, () => {
  console.log(`API พร้อมใช้งาน: http://localhost:${config.port}/api/health`);
});
