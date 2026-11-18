import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    // During local dev, proxy /api/* to Pages Functions running via wrangler
    // You run two terminals: `npm run dev` + `npm run pages:dev`
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
});
