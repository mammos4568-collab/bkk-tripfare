import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** อ่านข้อมูลขนส่งทั้งหมดจากโฟลเดอร์ data/ */
export async function loadData(dataDir) {
  const read = async (name) => {
    const file = path.join(dataDir, name);
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      throw new Error(`อ่านไฟล์ ${file} ไม่ได้: ${err.message}`);
    }
  };
  const [stops, lines, transfers, fares] = await Promise.all([
    read('stops.json'),
    read('lines.json'),
    read('transfers.json'),
    read('fares.json'),
  ]);
  return { stops, lines, transfers, fares };
}
