/**
 * สีของสายรถ: ใช้สีประจำสายจาก data/lines.json ("color") ถ้าไม่มีใช้สีตามประเภท
 */
export const MODE_COLOR = { rail: '#2e7d4f', train: '#8a4b2d', bus: '#2f5d9e', boat: '#c46a0a' };
const INK = '#1c2433';

export const lineColor = (line) => line.color ?? MODE_COLOR[line.mode] ?? INK;
export const legColor = (leg) => leg.line_color ?? MODE_COLOR[leg.mode] ?? INK;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** สีตัวหนังสือบนพื้นสีนั้น: เลือกขาวหรือน้ำเงินเข้ม แล้วแต่อันไหนอ่านชัดกว่า */
export function textOn(bg) {
  const l = luminance(bg);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastInk = (l + 0.05) / (luminance(INK) + 0.05);
  return contrastWhite >= contrastInk ? '#ffffff' : INK;
}
