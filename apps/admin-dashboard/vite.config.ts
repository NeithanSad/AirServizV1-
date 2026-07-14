import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 5175,
    proxy: {
      // Everything under /api goes through the Kong gateway (:8000), not
      // straight to each microservice — same routing, JWT and rate-limit
      // that production traffic gets. Kong strips the /api prefix itself.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
