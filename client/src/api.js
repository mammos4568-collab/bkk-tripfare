/**
 * เรียก API ตาม docs/API.md — ทุกหน้าเรียกผ่านไฟล์นี้เท่านั้น
 *
 * VITE_USE_MOCK=true ใน client/.env → ใช้ข้อมูลใน src/mocks/ แทน
 * (ทำหน้าเว็บได้โดยไม่ต้องรัน server หรือรอส่วนอื่นเสร็จ)
 */
import mockLines from './mocks/lines.json';
import mockMeetup from './mocks/meetup.json';
import mockOptions from './mocks/options.json';
import mockPlan from './mocks/plan.json';
import mockStops from './mocks/stops.json';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // ส่ง cookie session (ระบบแอดมิน)
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'เชื่อมต่อ server ไม่ได้ ตรวจว่ารัน server อยู่หรือเปล่า');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `server ตอบกลับผิดปกติ (${res.status})`,
      err?.details ?? [],
    );
  }
  return data;
}

const mock = async (data) => {
  await new Promise((resolve) => setTimeout(resolve, 300)); // จำลองความหน่วงของเครือข่าย
  return structuredClone(data);
};

// ---------- ข้อมูลทั่วไป ----------
export function getHealth() {
  if (USE_MOCK) return mock({ status: 'ok', stops: mockStops.stops.length, lines: mockLines.lines.length, data_checked_at: mockOptions.data_checked_at, sample_data: true });
  return request('/health');
}

export function getStops(q = '') {
  if (USE_MOCK) {
    const needle = q.trim().toLowerCase();
    return mock({
      stops: mockStops.stops.filter(
        (s) => !needle || s.name_th.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle),
      ),
    });
  }
  return request(`/stops${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}

export function getLines() {
  if (USE_MOCK) return mock(mockLines);
  return request('/lines');
}

// ---------- วางแผนเดินทาง ----------
/** ทางเลือกทั้งหมดของทริป (ถูกสุด / เร็วสุด / ต่อรถน้อยสุด) — หน้าแรกใช้อันนี้ */
export function getTripOptions(waypoints) {
  if (USE_MOCK) return mock(mockOptions);
  return request('/trips/options', { method: 'POST', body: { waypoints } });
}

/** @param {'fastest'|'cheapest'|'fewest_transfers'} optimize */
export function planTrip(waypoints, optimize = 'fastest') {
  if (USE_MOCK) return mock(mockPlan);
  return request('/trips/plan', { method: 'POST', body: { waypoints, optimize } });
}

/** @param {'min_total'|'min_max'} strategy */
export function findMeetup(origins, strategy = 'min_total') {
  if (USE_MOCK) return mock({ ...mockMeetup, strategy });
  return request('/meetup', { method: 'POST', body: { origins, strategy } });
}

export function submitReport(report) {
  if (USE_MOCK) return mock({ report: { id: 1, status: 'pending' } });
  return request('/reports', { method: 'POST', body: report });
}

// ---------- เข้าสู่ระบบและแอดมิน (เพื่อน) ----------
export const login = (email, password) => request('/auth/login', { method: 'POST', body: { email, password } });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const getMe = () => request('/me');
export const getSecurityEvents = () => request('/admin/security-events');
export const getPendingReports = () => request('/admin/reports?status=pending');
export const approveReport = (id) => request(`/admin/reports/${id}/approve`, { method: 'POST' });
export const rejectReport = (id) => request(`/admin/reports/${id}/reject`, { method: 'POST' });
