import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';

// Emits offline-sw.js (registered ONLY when the user enables Offline mode in the UI) that pre-caches every built file, WASM codecs included.
const offlineSW = () => ({
  name: 'meow-offline-sw',
  apply: 'build',
  generateBundle(_, bundle) {
    const files = ['./', 'index.html', ...Object.keys(bundle).filter(f => !f.endsWith('.map') && !/_mt/.test(f)), ...readdirSync('public')];
    this.emitFile({
      type: 'asset', fileName: 'offline-sw.js',
      source: `const V = 'meow-image-compressor-${Date.now().toString(36)}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit
    || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)
    || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(V).then(c => c.put(e.request, copy)); }
      return res;
    })));
});
`
    });
    // Legacy/cleanup worker: if an older build ever registered ./sw.js, it removes itself and its caches.
    this.emitFile({
      type: 'asset', fileName: 'sw.js',
      source: `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (/^(squeeze|meow-image-compressor)-/.test(k)) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
`
    });
  }
});

export default defineConfig({
  base: './',
  plugins: [offlineSW()],
  build: { target: 'esnext' },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@jsquash/avif', '@jsquash/jpeg', '@jsquash/oxipng', '@jsquash/webp', '@jsquash/jxl', 'libimagequant-wasm'] }
});
