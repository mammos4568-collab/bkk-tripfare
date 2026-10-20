/**
 * อ่าน CSV แบบ stream ทีละแถว (รองรับ BOM, CRLF, ช่องที่ครอบด้วย "..." และ "" ข้างใน)
 * ใช้กับไฟล์ GTFS ซึ่งบางไฟล์ใหญ่หลายร้อย MB จึงห้ามอ่านทั้งไฟล์เข้าหน่วยความจำ
 */
import readline from 'node:readline';

export function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return { fields, open: quoted };
}

/**
 * @param {import('node:stream').Readable} stream
 * @returns {AsyncGenerator<Record<string, string>>}
 */
export async function* readCsv(stream) {
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  let pending = '';
  for await (let line of lines) {
    if (header === null) line = line.replace(/^﻿/, '');
    const text = pending ? `${pending}\n${line}` : line;
    const { fields, open } = parseCsvLine(text);
    if (open) {
      pending = text; // ช่องที่ขึ้นบรรทัดใหม่ข้างในเครื่องหมายคำพูด
      continue;
    }
    pending = '';
    if (header === null) {
      header = fields.map((f) => f.trim());
      continue;
    }
    if (fields.length === 1 && fields[0] === '') continue;
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = (fields[i] ?? '').trim();
    yield row;
  }
}
