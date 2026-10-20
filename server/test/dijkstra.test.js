import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dijkstra } from '../src/core/dijkstra.js';
import { MinHeap } from '../src/core/minHeap.js';

test('MinHeap ดึงค่าที่น้อยที่สุดออกก่อนเสมอ', () => {
  const heap = new MinHeap();
  for (const n of [5, 1, 4, 2, 3, 0]) heap.push(`v${n}`, n);
  const order = [];
  while (heap.size > 0) order.push(heap.pop().priority);
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5]);
  assert.equal(heap.pop(), undefined);
});

function graphOf(edges) {
  const adj = new Map();
  for (const [from, to, w] of edges) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ from, to, w });
  }
  return adj;
}
const byWeight = (e) => e.w;

test('Dijkstra เลือกทางที่รวมแล้วน้อยกว่า แม้จะมีหลายช่วง', () => {
  //  A —10→ D   และ   A —1→ B —1→ C —1→ D
  const g = graphOf([['A', 'D', 10], ['A', 'B', 1], ['B', 'C', 1], ['C', 'D', 1]]);
  const result = dijkstra(g, 'A', 'D', byWeight);
  assert.equal(result.cost, 3);
  assert.deepEqual(result.edges.map((e) => e.to), ['B', 'C', 'D']);
});

test('Dijkstra คืน null เมื่อไปไม่ถึง', () => {
  const g = graphOf([['A', 'B', 1]]);
  assert.equal(dijkstra(g, 'A', 'Z', byWeight), null);
});

test('Dijkstra จากจุดเดิมไปจุดเดิม cost = 0', () => {
  const g = graphOf([['A', 'B', 1]]);
  assert.deepEqual(dijkstra(g, 'A', 'A', byWeight), { cost: 0, edges: [] });
});

test('Dijkstra ไม่ยอมรับน้ำหนักติดลบ', () => {
  const g = graphOf([['A', 'B', -1]]);
  assert.throws(() => dijkstra(g, 'A', 'B', byWeight));
});
