import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// apps/admin (§14.5) — the content & user management surface. A desktop tool,
// so no PWA plugin; it shares every package with apps/web but no UI.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
