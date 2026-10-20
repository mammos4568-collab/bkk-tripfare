/**
 * เรียก API ตาม docs/API.md — หน้าเว็บทุกหน้าเรียกผ่านไฟล์นี้เท่านั้น
 *
 * VITE_USE_MOCK=true ใน client/.env → ใช้ข้อมูลใน src/mocks/ แทน
 * (ทำหน้าเว็บได้โดยไม่ต้องรัน server หรือรอส่วนอื่นเสร็จ)
 */
import mockLines from './mocks/lines.json';
import mockMeetup from './mocks/meetup.json';
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
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include', // ส่ง cookie session (ส่วน C)
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `เชื่อมต่อ server ไม่ได้ (${res.status})`,
      err?.details ?? [],
    );
  }
  return data;
}

const mock = async (data) => {
  await new Promise((resolve) => setTimeout(resolve, 300)); // จำลองความหน่วงของเครือข่าย
  return structuredClone(data);
};

// ---------- ส่วน A ----------
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

/** @param {string[]} waypoints @param {'fastest'|'cheapest'} optimize */
export function planTrip(waypoints, optimize = 'fastest') {
  if (USE_MOCK) return mock(mockPlan);
  return request('/trips/plan', { method: 'POST', body: { waypoints, optimize } });
}

// ---------- ส่วน D ----------
/** @param {string[]} origins @param {'min_total'|'min_max'} strategy */
export function findMeetup(origins, strategy = 'min_total') {
  if (USE_MOCK) return mock({ ...mockMeetup, strategy });
  return request('/meetup', { method: 'POST', body: { origins, strategy } });
}

export function submitReport(report) {
  if (USE_MOCK) return mock({ report: { id: 1, status: 'pending' } });
  return request('/reports', { method: 'POST', body: report });
}

// ---------- ส่วน C ----------
// TODO (ส่วน C): register, login, logout, getMe, exportMe, deleteMe, getPlaces, addPlace, deletePlace
// ตาม docs/API.md หัวข้อ "ส่วน C"
