import AdminApp from './admin/AdminApp.jsx';
import { USE_MOCK } from './api.js';
import Mark from './components/Mark.jsx';
import { isOn } from './features.js';
import Meetup from './pages/Meetup.jsx';
import PlanTrip from './pages/PlanTrip.jsx';
import DataInfo from './sections/DataInfo.jsx';
import HowFares from './sections/HowFares.jsx';

export default function App() {
  // /admin = ระบบแอดมิน (เพื่อน) แยกจากหน้าเว็บของผู้ใช้
  if (window.location.pathname.startsWith('/admin')) return <AdminApp />;

  const showMeetup = isOn('meetup');

  return (
    <>
      {USE_MOCK && <p className="mock-strip">โหมดข้อมูลจำลอง: ตัวเลขทั้งหมดมาจาก client/src/mocks</p>}

      <header className="site-header wrap">
        <a className="wordmark" href="/">
          <Mark />
          BKK TripFare
        </a>
        <nav aria-label="เมนูหลัก">
          <a href="#plan">วางแผนเดินทาง</a>
          {showMeetup && <a href="#meetup">นัดเพื่อน</a>}
          <a href="#how">วิธีคิดราคา</a>
          <a href="#data">ข้อมูลที่ใช้</a>
        </nav>
      </header>

      <main>
        <PlanTrip />
        {showMeetup && <Meetup />}
        <HowFares />
        <DataInfo />
      </main>

      <footer className="site-footer wrap">
        <p>
          BKK TripFare โปรเจกต์นักศึกษา ราคาที่แสดงเป็นราคาอ้างอิง ก่อนเดินทางควรเช็กกับผู้ให้บริการอีกครั้ง
          ข้อมูลการเดินทางจาก สนข. (CC BY 4.0) แผนที่จาก OpenStreetMap
        </p>
        <a href="/admin">สำหรับผู้ดูแลระบบ</a>
      </footer>
    </>
  );
}
