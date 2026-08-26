import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        impostazioni: resolve(__dirname, 'impostazioni.html')
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
});
