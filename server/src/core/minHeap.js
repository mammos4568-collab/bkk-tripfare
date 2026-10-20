/**
 * Min-heap (binary heap) — คิวลำดับความสำคัญสำหรับ Dijkstra
 * ดึงตัวที่ priority น้อยที่สุดออกมาก่อนเสมอ
 * push / pop ใช้เวลา O(log n)
 */
export class MinHeap {
  #items = [];

  get size() {
    return this.#items.length;
  }

  push(value, priority) {
    const items = this.#items;
    items.push({ value, priority });
    // sift up: ดันตัวใหม่ขึ้นไปจนกว่าพ่อจะน้อยกว่าหรือเท่ากับ
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  /** @returns {{ value: any, priority: number } | undefined} */
  pop() {
    const items = this.#items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      // เอาตัวสุดท้ายขึ้นมาแทนราก แล้ว sift down
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
        if (right < items.length && items[right].priority < items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}
