/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Node 22+ ships an experimental global localStorage that shadows jsdom's (undefined without a file).
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
});
