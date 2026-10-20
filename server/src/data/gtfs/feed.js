/**
 * เปิดฟีด GTFS ได้ทั้งแบบไฟล์ .zip และแบบโฟลเดอร์ที่แตกไฟล์แล้ว
 */
import fs from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { readCsv } from './csv.js';
import { openZipEntry, readZipDirectory } from './zip.js';

export async function openFeed(input) {
  const info = await stat(input);
  if (info.isDirectory()) {
    return {
      has: (name) => fs.existsSync(path.join(input, name)),
      rows: (name) => readCsv(fs.createReadStream(path.join(input, name))),
    };
  }
  const entries = await readZipDirectory(input);
  return {
    has: (name) => entries.has(name),
    async *rows(name) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`ไม่มีไฟล์ ${name} ในฟีด`);
      yield* readCsv(await openZipEntry(input, entry));
    },
  };
}
