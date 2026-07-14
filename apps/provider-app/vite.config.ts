import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 5174,
    proxy: {
      // Everything under /api goes through the Kong gateway (:8000), not
      // straight to each microservice — same routing, JWT and rate-limit
      // that production traffic gets. Kong itself strips the /api prefix
      // per infra/kong/kong.local.yaml, so no path rewrite here.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.req?.url?.startsWith('/api/notifications')) {
              proxyRes.headers['cache-control'] = 'no-cache';
            }
          });
        },
      },
    },
  },
});
