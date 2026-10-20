export const MODE_LABEL = { rail: 'รถไฟฟ้า', bus: 'รถเมล์', boat: 'เรือ' };
export const MODE_ICON = { rail: '🚆', bus: '🚌', boat: '⛴️' };

/** แสดงราคาเป็นบาท เช่น 25 → "25 ฿" */
export const baht = (n) => `${Number(n).toLocaleString('th-TH')} ฿`;
