/**
 * อ่านไฟล์ .zip โดยไม่ต้องใช้ library (ใช้ zlib ที่มากับ Node)
 * อ่านทีละไฟล์แบบ stream จึงเปิดไฟล์ใหญ่ ๆ อย่าง shapes.txt (150+ MB) ได้โดยไม่กินหน่วยความจำ
 * รองรับเฉพาะ zip ธรรมดา (stored / deflate) ไม่รองรับ ZIP64 และไฟล์ที่เข้ารหัส
 */
import { open } from 'node:fs/promises';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** @returns {Promise<Map<string, {method: number, compressedSize: number, size: number, localOffset: number}>>} */
export async function readZipDirectory(path) {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const tailSize = Math.min(size, 65557);
    const tail = Buffer.alloc(tailSize);
    await handle.read(tail, 0, tailSize, size - tailSize);

    let eocd = -1;
    for (let i = tailSize - 22; i >= 0; i -= 1) {
      if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) throw new Error(`${path} ไม่ใช่ไฟล์ zip`);

    const count = tail.readUInt16LE(eocd + 10);
    const dirSize = tail.readUInt32LE(eocd + 12);
    const dirOffset = tail.readUInt32LE(eocd + 16);
    if (dirOffset === 0xffffffff || count === 0xffff) throw new Error('ไม่รองรับไฟล์ ZIP64');

    const dir = Buffer.alloc(dirSize);
    await handle.read(dir, 0, dirSize, dirOffset);

    const entries = new Map();
    let p = 0;
    for (let i = 0; i < count; i += 1) {
      if (dir.readUInt32LE(p) !== CENTRAL_SIGNATURE) throw new Error('โครงสร้าง zip เสียหาย');
      const flags = dir.readUInt16LE(p + 8);
      const method = dir.readUInt16LE(p + 10);
      const compressedSize = dir.readUInt32LE(p + 20);
      const uncompressed = dir.readUInt32LE(p + 24);
      const nameLength = dir.readUInt16LE(p + 28);
      const extraLength = dir.readUInt16LE(p + 30);
      const commentLength = dir.readUInt16LE(p + 32);
      const localOffset = dir.readUInt32LE(p + 42);
      const name = dir.toString('utf8', p + 46, p + 46 + nameLength);
      if (flags & 1) throw new Error(`ไฟล์ ${name} ถูกเข้ารหัส`);
      if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('ไม่รองรับไฟล์ ZIP64');
      // เก็บแค่ชื่อไฟล์ (บาง zip มีโฟลเดอร์ซ้อน เช่น gtfs/stops.txt)
      const base = name.split('/').pop();
      if (base && !name.endsWith('/')) {
        entries.set(base, { method, compressedSize, size: uncompressed, localOffset });
      }
      p += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await handle.close();
  }
}

/** เปิดไฟล์หนึ่งไฟล์ใน zip เป็น stream ที่คลายการบีบอัดแล้ว */
export async function openZipEntry(path, entry) {
  const handle = await open(path, 'r');
  let dataStart;
  try {
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, entry.localOffset);
    if (header.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new Error('โครงสร้าง zip เสียหาย');
    dataStart = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  } finally {
    await handle.close();
  }
  if (entry.compressedSize === 0) return Readable.from([]);
  const raw = fs.createReadStream(path, { start: dataStart, end: dataStart + entry.compressedSize - 1 });
  if (entry.method === 0) return raw;
  if (entry.method === 8) return raw.pipe(zlib.createInflateRaw());
  throw new Error(`ไม่รองรับการบีบอัดแบบ ${entry.method}`);
}
