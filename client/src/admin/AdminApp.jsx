/**
 * ระบบแอดมิน (เพื่อน) — เปิดที่ /admin
 * API: login(), logout(), getMe(), getSecurityEvents() ฯลฯ ใน src/api.js
 * สัญญา: docs/API.md หัวข้อ "เข้าสู่ระบบและแอดมิน"
 *
 * TODO (เพื่อน):
 *  1. หน้าเข้าสู่ระบบ: ฟอร์มอีเมล + รหัสผ่าน → login() → สำเร็จแล้วไปหน้าแดชบอร์ด
 *     ผิด → ข้อความเดียวกันทุกกรณี "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
 *  2. เปิดหน้ามา → getMe() ถ้าล็อกอินอยู่แล้วไปแดชบอร์ดเลย (401 = ยังไม่ล็อกอิน)
 *  3. แดชบอร์ด: ตาราง log ความปลอดภัย (getSecurityEvents) + ปุ่มออกจากระบบ
 *  4. (ถ้ามีเวลา) รายการแจ้งราคาไม่ตรง + ปุ่มอนุมัติ / ปฏิเสธ
 *  ใช้สไตล์และคำตามแนวทางใน docs/DESIGN.md
 */
import { useState } from 'react';
import { login } from '../api.js';

export default function AdminApp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password);
      // TODO (เพื่อน): ไปหน้าแดชบอร์ด
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin wrap">
      <header className="site-header">
        <a className="wordmark" href="/">
          BKK TripFare
        </a>
        <span className="muted">ผู้ดูแลระบบ</span>
      </header>

      <form className="admin-login narrow" onSubmit={handleSubmit}>
        <h1>เข้าสู่ระบบผู้ดูแล</h1>
        <label htmlFor="admin-email">อีเมล</label>
        <input
          id="admin-email"
          className="field"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="admin-password">รหัสผ่าน</label>
        <input
          id="admin-password"
          className="field"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="go">
          เข้าสู่ระบบ
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
