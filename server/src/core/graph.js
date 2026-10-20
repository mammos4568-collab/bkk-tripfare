import { approximateFare } from './fare.js';

/**
 * สร้างกราฟสำหรับหาเส้นทาง
 *
 * node มี 2 แบบ:
 *   S:<stop>         = ยืนอยู่ที่สถานี/ป้าย/ท่าเรือ (ยังไม่ได้อยู่บนรถ)
 *   L:<line>:<stop>  = อยู่บนรถสาย <line> ขณะจอดที่ <stop>
 *
 * edge มี 4 แบบ (kind):
 *   board  S → L   ขึ้นรถ   เวลา = รอรถเฉลี่ย (headway / 2), ราคาโดยประมาณ = ค่าแรกเข้า
 *   ride   L → L   นั่งไป 1 จุด   เวลา = minutes_between_stops, ราคาโดยประมาณ = ราคาต่อจุด
 *   alight L → S   ลงรถ    เวลา 0
 *   walk   S → S   เดินต่อรถ (transfers.json) ได้ทั้งสองทิศ
 *
 * การแยก "อยู่ที่สถานี" กับ "อยู่บนรถ" ทำให้เปลี่ยนสายแล้วเสียเวลารอรถจริง
 * และย้อนรอยออกมาเป็นขั้นตอน ขึ้น-นั่ง-ลง-เดิน ได้ง่าย
 */
export const stopNode = (stopId) => `S:${stopId}`;
export const lineNode = (lineId, stopId) => `L:${lineId}:${stopId}`;

export function buildGraph({ lines, transfers }, rulesById) {
  const adjacency = new Map();
  const addEdge = (edge) => {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge);
  };

  for (const line of lines) {
    const approx = approximateFare(rulesById.get(line.fare_rule));
    const waitMinutes = line.headway_minutes / 2;

    for (const stopId of line.stops) {
      addEdge({
        from: stopNode(stopId),
        to: lineNode(line.id, stopId),
        kind: 'board',
        lineId: line.id,
        fromStop: stopId,
        toStop: stopId,
        minutes: waitMinutes,
        approxFare: approx.boarding,
      });
      addEdge({
        from: lineNode(line.id, stopId),
        to: stopNode(stopId),
        kind: 'alight',
        lineId: line.id,
        fromStop: stopId,
        toStop: stopId,
        minutes: 0,
        approxFare: 0,
      });
    }

    const directions = [line.stops];
    if (line.bidirectional !== false) directions.push([...line.stops].reverse());
    for (const sequence of directions) {
      for (let i = 0; i + 1 < sequence.length; i += 1) {
        addEdge({
          from: lineNode(line.id, sequence[i]),
          to: lineNode(line.id, sequence[i + 1]),
          kind: 'ride',
          lineId: line.id,
          fromStop: sequence[i],
          toStop: sequence[i + 1],
          minutes: line.minutes_between_stops,
          approxFare: approx.perStop,
        });
      }
    }
  }

  for (const transfer of transfers) {
    for (const [a, b] of [
      [transfer.from, transfer.to],
      [transfer.to, transfer.from],
    ]) {
      addEdge({
        from: stopNode(a),
        to: stopNode(b),
        kind: 'walk',
        fromStop: a,
        toStop: b,
        minutes: transfer.walk_minutes,
        approxFare: 0,
      });
    }
  }

  return adjacency;
}
