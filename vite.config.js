import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // In development the API runs on :3001; the proxy keeps requests same-origin so cookies work.
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  plugins: [react()],
});
