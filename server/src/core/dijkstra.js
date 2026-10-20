import { MinHeap } from './minHeap.js';

/**
 * Dijkstra — หาเส้นทางที่ cost รวมต่ำสุดจาก source ไป target
 *
 * @param {Map<string, Array<{from: string, to: string}>>} adjacency
 *        node → รายการ edge ที่ออกจาก node นั้น
 * @param {string} source
 * @param {string} target
 * @param {(edge: object) => number} costFn น้ำหนักของ edge (ต้องไม่ติดลบ)
 *        เปลี่ยน costFn = เปลี่ยนเกณฑ์ เช่น เร็วสุด หรือ ถูกสุด
 * @returns {{ cost: number, edges: object[] } | null} null = ไปไม่ถึง
 */
export function dijkstra(adjacency, source, target, costFn) {
  const dist = new Map([[source, 0]]);
  const prevEdge = new Map(); // node → edge ที่ใช้เดินมาถึง (ไว้ย้อนรอยเส้นทาง)
  const heap = new MinHeap();
  heap.push(source, 0);

  while (heap.size > 0) {
    const { value: node, priority: d } = heap.pop();
    if (d > (dist.get(node) ?? Infinity)) continue; // ค่าเก่าที่ค้างอยู่ใน heap → ข้าม
    if (node === target) break; // ถึงปลายทางแล้ว ระยะนี้คือค่าต่ำสุดแน่นอน

    for (const edge of adjacency.get(node) ?? []) {
      const weight = costFn(edge);
      if (weight < 0) throw new Error('Dijkstra ใช้กับน้ำหนักติดลบไม่ได้');
      const nextDist = d + weight;
      if (nextDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nextDist);
        prevEdge.set(edge.to, edge);
        heap.push(edge.to, nextDist);
      }
    }
  }

  if (!dist.has(target)) return null;

  // ย้อนรอยจากปลายทางกลับไปต้นทาง
  const edges = [];
  for (let node = target; node !== source; ) {
    const edge = prevEdge.get(node);
    edges.push(edge);
    node = edge.from;
  }
  edges.reverse();
  return { cost: dist.get(target), edges };
}
