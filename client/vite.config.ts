import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'admin-route',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/admin') request.url = '/admin.html';
        next();
      });
    },
  }],
  build: {
    rollupOptions: { input: { game: 'index.html', admin: 'admin.html' } },
  },
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8080', ws: true },
      '/api': 'http://localhost:8080',
      '/map.json': 'http://localhost:8080',
    },
  },
});
