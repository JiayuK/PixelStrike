import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8080', ws: true },
      '/api': 'http://localhost:8080',
      '/map.json': 'http://localhost:8080',
    },
  },
});
