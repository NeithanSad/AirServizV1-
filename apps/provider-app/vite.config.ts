import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 5174,
    proxy: {
      '/api/orders':        { target: 'http://localhost:3002', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/api/notifications': { target: 'http://localhost:3003', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/api/auth':          { target: 'http://localhost:3001', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/api/services':      { target: 'http://localhost:3004', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/api/profiles':      { target: 'http://localhost:3005', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
    },
  },
});
