/**
 * แผนที่เส้นทาง (Leaflet + รูปแผนที่ OpenStreetMap)
 * - เส้นของแต่ละสายวาดตามแนวจริงจาก shapes ใน GET /api/network (ไม่มีก็ลากตรงระหว่างสถานี)
 * - ยังไม่ได้ค้นหา: แสดงทุกสายตามสีจริง กดจุดบนแผนที่เพื่อเลือกเป็นต้นทาง / จุดแวะ / ปลายทาง
 * - มีผลแล้ว: เน้นเส้นทางที่เลือก สายอื่นจางลง (ภาษาเดียวกับเส้นใน RouteSteps)
 *
 * เปลี่ยนผู้ให้บริการรูปแผนที่ได้ด้วย VITE_TILE_URL / VITE_TILE_ATTRIBUTION ใน client/.env
 * (ต้องเพิ่มโดเมนใน TILE_HOSTS ของ server/src/app.js ด้วย) ห้ามซ่อนเครดิตแผนที่
 */
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useEffect, useRef } from 'react';
import { legColor, lineColor } from '../colors.js';

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  import.meta.env.VITE_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const BANGKOK = [13.7563, 100.5018];

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function RouteMap({ network, option, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView(BANGKOK, 12);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // วาดใหม่เมื่อข้อมูลหรือเส้นทางที่เลือกเปลี่ยน
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !network) return;
    layer.clearLayers();

    const ink = cssVar('--ink');
    const platform = cssVar('--platform');
    const muted = cssVar('--muted');
    const stopsById = new Map(network.stops.map((s) => [s.id, s]));
    const linesById = new Map(network.lines.map((l) => [l.id, l]));
    const pos = (id) => {
      const s = stopsById.get(id);
      return s ? [s.lat, s.lon] : null;
    };
    const focused = Boolean(option);
    const shapes = network.shapes ?? {};
    const linePath = (line) => shapes[line.id]?.points ?? line.stops.map(pos).filter(Boolean);

    // 1) ทุกสาย
    for (const line of network.lines) {
      L.polyline(linePath(line), {
        color: lineColor(line),
        weight: focused ? 3 : 4,
        opacity: focused ? 0.22 : 0.85,
        interactive: false,
      }).addTo(layer);
    }

    // 2) ทุกจุด กดแล้วเลือกเป็นต้นทาง / จุดแวะ / ปลายทางได้ (ซูมออกแล้วจุดเล็กลง ไม่ให้บังเส้น)
    const dots = [];
    const dotRadius = () => (focused ? 3 : map.getZoom() <= 11 ? 2.5 : map.getZoom() <= 12 ? 3.5 : 4.5);
    for (const stop of network.stops) {
      const dot = L.circleMarker([stop.lat, stop.lon], {
        radius: dotRadius(),
        color: ink,
        weight: 1.5,
        opacity: focused ? 0.4 : 1,
        fillColor: platform,
        fillOpacity: 1,
      })
        .bindTooltip(stop.name_th, { direction: 'top', offset: [0, -6] })
        .bindPopup(
          () =>
            pickMenu(stop, (role) => {
              map.closePopup();
              onPickRef.current?.(stop.id, role);
            }),
          { closeButton: false, offset: [0, -2] },
        )
        .addTo(layer);
      dots.push(dot);
    }
    const resize = () => dots.forEach((d) => d.setRadius(dotRadius()));
    map.on('zoomend', resize);

    if (!focused) {
      const all = network.stops.map((s) => [s.lat, s.lon]);
      if (all.length > 0) map.fitBounds(all, { padding: [28, 28], animate: false });
      resize();
      return () => map.off('zoomend', resize);
    }

    // 3) เส้นทางที่เลือก: นั่งรถ = เส้นหนาสีของสาย, เดิน = จุดไข่ปลา
    const bounds = [];
    for (const segment of option.segments) {
      for (const leg of segment.legs) {
        const latlngs =
          leg.type === 'ride'
            ? rideCoords(linesById.get(leg.line_id), shapes[leg.line_id], leg, pos)
            : [pos(leg.from_stop), pos(leg.to_stop)].filter(Boolean);
        L.polyline(
          latlngs,
          leg.type === 'ride'
            ? { color: legColor(leg), weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }
            : { color: muted, weight: 3, dashArray: '1 8', lineCap: 'round', interactive: false },
        ).addTo(layer);
        bounds.push(...latlngs);
      }
    }

    // 4) หมุดบนเส้นทาง: จุดต่อรถเล็ก จุดที่เลือกใหญ่ ปลายทางทึบ
    for (const point of routePoints(option)) {
      const latlng = pos(point.id);
      if (!latlng) continue;
      const big = point.kind !== 'transfer';
      const marker = L.circleMarker(latlng, {
        radius: big ? 8 : 5,
        color: ink,
        weight: big ? 3.5 : 2.5,
        fillColor: point.kind === 'end' ? ink : platform,
        fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
      if (big) {
        marker.bindTooltip(stopsById.get(point.id).name_th, {
          permanent: true,
          direction: 'right',
          offset: [10, 0],
          className: 'map-label',
        });
      }
    }

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [36, 36], animate: !reduceMotion() });
    return () => map.off('zoomend', resize);
  }, [network, option]);

  return <div ref={containerRef} className="route-map" role="region" aria-label="แผนที่เส้นทาง" />;
}

/**
 * แนวเส้นของช่วงที่นั่ง: ตัดจากเส้นทางจริงของสายตาม leg.ranges (ลำดับจุดในสายที่นั่งผ่าน)
 * ไม่มี shapes ก็ใช้พิกัดสถานีเรียงกัน
 */
function rideCoords(line, shape, leg, pos) {
  const direct = [pos(leg.from_stop), pos(leg.to_stop)].filter(Boolean);
  if (!line) return direct;
  const ranges = leg.ranges ?? [[line.stops.indexOf(leg.from_stop), line.stops.indexOf(leg.to_stop)]];
  if (ranges.some(([a, b]) => a < 0 || b < 0)) return direct;
  const out = [];
  for (const [a, b] of ranges) {
    const piece = shape
      ? shape.points.slice(Math.min(shape.stop_index[a], shape.stop_index[b]), Math.max(shape.stop_index[a], shape.stop_index[b]) + 1)
      : line.stops.slice(Math.min(a, b), Math.max(a, b) + 1).map(pos).filter(Boolean);
    out.push(...(a <= b ? piece : piece.reverse()));
  }
  return out.length >= 2 ? out : direct;
}

/** จุดบนเส้นทาง: start / via (จุดแวะ) / end / transfer (ที่ต่อรถ) */
function routePoints(option) {
  const points = [];
  option.segments.forEach((segment, s) => {
    const lastSegment = s === option.segments.length - 1;
    segment.legs.forEach((leg, l) => {
      if (s === 0 && l === 0) points.push({ id: leg.from_stop, kind: 'start' });
      const lastLeg = l === segment.legs.length - 1;
      points.push({ id: leg.to_stop, kind: !lastLeg ? 'transfer' : lastSegment ? 'end' : 'via' });
    });
  });
  // วาดจุดต่อรถก่อน จุดที่เลือกทีหลัง (จะได้อยู่ด้านบน)
  return points.sort((a, b) => (a.kind === 'transfer' ? 0 : 1) - (b.kind === 'transfer' ? 0 : 1));
}

/** เมนูในป๊อปอัปของจุด — สร้างด้วย textContent (ชื่อจุดไม่ถูกตีความเป็น HTML) */
function pickMenu(stop, pick) {
  const box = document.createElement('div');
  box.className = 'map-pick';
  const name = document.createElement('p');
  name.className = 'map-pick-name';
  name.textContent = stop.name_th;
  box.append(name);
  for (const [role, label] of [
    ['start', 'เริ่มจากที่นี่'],
    ['via', 'แวะที่นี่'],
    ['end', 'ไปที่นี่'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-btn';
    button.textContent = label;
    button.addEventListener('click', () => pick(role));
    box.append(button);
  }
  return box;
}
