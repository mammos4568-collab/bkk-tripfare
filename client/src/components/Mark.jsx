/**
 * สัญลักษณ์ของเว็บ: หมุดแผนที่ที่จุดต่อของเส้นสายรถ
 * ย่อมาจากโลโก้เต็มของทีม (docs/brand/logo-full.jpg) ให้ยังอ่านออกตอนเล็ก ๆ
 * ไฟล์เดียวกันแบบแยกอยู่ที่ client/public/favicon.svg — แก้ที่หนึ่งต้องแก้อีกที่ด้วย
 */
export default function Mark({ size = 28 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="mark-blue" d="M16 24 L11 27.5 H5.8" />
      <path className="mark-green" d="M16 24 L21 27.5 H26.2" />
      <circle className="mark-blue mark-stop" cx="3.6" cy="27.5" r="2.2" />
      <circle className="mark-green mark-stop" cx="28.4" cy="27.5" r="2.2" />
      <path
        fill="#e1251b"
        d="M16 2.5C10.9 2.5 7 6.4 7 11.4C7 17.3 16 24.5 16 24.5S25 17.3 25 11.4C25 6.4 21.1 2.5 16 2.5Z"
      />
      <circle cx="16" cy="11.3" r="3.8" fill="#fff" />
    </svg>
  );
}
