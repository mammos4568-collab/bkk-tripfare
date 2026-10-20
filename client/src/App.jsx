import { useState } from 'react';
import { USE_MOCK } from './api.js';
import Account from './pages/Account.jsx';
import Meetup from './pages/Meetup.jsx';
import PlanTrip from './pages/PlanTrip.jsx';
import Report from './pages/Report.jsx';

// สลับหน้าด้วย state ไปก่อน — ส่วน B จะเปลี่ยนเป็น react-router ภายหลังก็ได้ (บอกทีมก่อนเพิ่ม library)
const TABS = [
  { id: 'plan', label: 'วางแผนเดินทาง', Page: PlanTrip }, // B
  { id: 'meetup', label: 'นัดเจอกลุ่ม', Page: Meetup }, // D
  { id: 'report', label: 'แจ้งข้อมูลผิด', Page: Report }, // D
  { id: 'account', label: 'บัญชี', Page: Account }, // C
];

export default function App() {
  const [tab, setTab] = useState('plan');
  const { Page } = TABS.find((t) => t.id === tab);

  return (
    <div className="app">
      <header className="app-header">
        <h1>BKK TripFare</h1>
        <p className="tagline">เดินทางหลายจุด รู้ราคารวมก่อนออกจากบ้าน</p>
        {USE_MOCK && <span className="badge">โหมดข้อมูลจำลอง</span>}
      </header>

      <nav className="tabs" aria-label="เมนูหลัก">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? 'tab active' : 'tab'}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        <Page />
      </main>

      <footer className="app-footer">ราคาที่แสดงเป็นราคาอ้างอิง อาจไม่ตรงกับราคาจริง</footer>
    </div>
  );
}
