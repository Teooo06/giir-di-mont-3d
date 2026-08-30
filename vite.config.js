import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        impostazioni: resolve(__dirname, 'impostazioni.html'),
        edit: resolve(__dirname, 'edit.html'),
        controller: resolve(__dirname, 'controller.html')
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
});
