import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/admin',
  base: './',
  build: {
    outDir: '../../dist/admin',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'), // Share aliases if needed
    },
  },
  server: {
    port: 5174,
  },
});
