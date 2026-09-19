/* SixthSense service worker: keeps the app shell and pilot data available offline */
const CACHE = 'sixthsense-web-v39';
const SHELL = ['./', 'index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'css/style-aurora.css', 'css/style-studio.css', 'css/style-classic.css', 'js/icons.js', 'js/data.js', 'js/sensors.js', 'js/map.js', 'js/i18n.js', 'js/ui.js', 'js/app.js',
  'js/engine/native.js', 'js/engine/hub.js', 'js/engine/sound.js', 'js/engine/light.js', 'js/engine/mockdata.js', 'js/engine/preference.js',
  'js/engine/context.js', 'js/engine/normals.js', 'js/engine/scoring.js', 'js/engine/metro.js', 'js/engine/reroute.js', 'js/engine/journeys.js', 'js/engine/instant.js', 'js/engine/store.js', 'js/engine/ask.js', 'js/engine/agent.js',
  'data/basemap.igdtuw.json', 'data/helppoints.igdtuw.json', 'data/osm-lit.igdtuw.json', 'data/nightlight.igdtuw.json',
  'data/deadzones.mock.json', 'data/trips.mock.json', 'data/dmrc.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Map tiles saved by "Save this area" are served from the cache when offline
self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (u.includes('tile.openstreetmap.org')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.open('ss-tiles-v1').then(c => c.match(u.replace(/\/\/[abc]\./, '//a.'))))
    );
    return;
  }
}, { once: false });

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.pathname.endsWith('ping.json')) return;                 // connectivity check must hit the network
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request)));
  }
});
