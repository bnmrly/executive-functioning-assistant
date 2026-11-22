import { defineConfig } from 'vite';
import { previewCalendar } from './preview-calendar.js';

// The wall tablet runs Android WebView 106 — keep JS output within Chromium 106.
// CSS targets chrome61 on purpose: the tablet's WebView rejects 4/8-digit hex colours (#0000,
// #ffffffbf) even though Chrome 106 should support them, and a newer target lets the minifier
// rewrite transparent/rgba() into that form. Verified on-device with CSS.supports().
export default defineConfig({
  plugins: [{
    name: 'reload-public-files',
    configureServer(server) {
      server.middlewares.use(previewCalendar);
    },
    handleHotUpdate({ file, server }) {
      // The checklist lives in public/, outside Vite's module graph.
      if (file.startsWith(server.config.publicDir + '/')) {
        server.ws.send({ type: 'full-reload', path: '*' });
        return [];
      }
    },
  }],
  build: {
    target: 'chrome106',
    cssTarget: 'chrome61',
  },
  server: { host: true },
});
