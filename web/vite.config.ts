import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { themeScript } from './theme-script.ts';

export default defineConfig({
  plugins: [themeScript(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@api': fileURLToPath(new URL('./src/generated/api', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.E2E_API_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
      '/health': process.env.E2E_API_URL ?? 'http://127.0.0.1:8000',
    },
  },
});
