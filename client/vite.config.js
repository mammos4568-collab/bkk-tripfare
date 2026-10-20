import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // ตอน dev: เรียก /api/... แล้ว Vite ส่งต่อไปที่ server (ไม่ต้องตั้ง CORS)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
