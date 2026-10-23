/* Hülle von Spiel-Freunde.
   Nur die Seite und statische Dateien. API, Anmeldung, Uploads, der
   Avatar-Editor und Antworten mit Set-Cookie bleiben außen vor. HTML
   und Skripte werden zuerst aus dem Netz geholt, damit ein Update nicht
   hinter einer alten Fassung hängen bleibt. */
importScripts('/assets/pwa-policy.js');

var VERSION = 'sf-pwa-v12';
var SHELL = VERSION + '-shell';
var PAGES = VERSION + '-pages';
var FILES = VERSION + '-files';

var PRECACHE = [
  '/',
  '/manifest.json',
  '/assets/style.css',
  '/assets/pwa.css',
  '/assets/pwa.js',
  '/assets/pwa-policy.js',
  '/assets/pwa/icon-192.png',
  '/assets/pwa/icon-512.png',
  '/assets/pwa/icon-maskable-192.png',
  '/assets/pwa/icon-maskable-512.png',
  '/assets/pwa/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(SHELL).then(function (cache) {
    return cache.addAll(PRECACHE);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    var stale = keys.filter(function (key) {
      return key.indexOf(VERSION) !== 0;
    });
    return Promise.all(stale.map(function (key) {
      return caches.delete(key);
    })).then(function () {
      return self.clients.claim();
    }).then(function () {
      if (!stale.length) return null;
      return self.clients.matchAll({ type: 'window' });
    }).then(function (clients) {
      if (!clients) return null;
      // Die Navigation nicht abwarten. Sonst wartet activate auf die neue
      // Seite, und die Seite wartet auf activate.
      clients.forEach(function (client) {
        if (!client.url || typeof client.navigate !== 'function') return;
        client.navigate(client.url).catch(function () {});
      });
    });
  }));
});

function store(cacheName, request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return response;
  if (response.headers.get('set-cookie')) return response;
  var cacheControl = response.headers.get('cache-control') || '';
  if (/no-store|private/i.test(cacheControl)) return response;
  var copy = response.clone();
  caches.open(cacheName).then(function (cache) {
    return cache.put(request, copy);
  });
  return response;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var decision = self.SpielpartnerPwa.classify(request.url, {
    origin: self.location.origin,
    method: request.method,
    mode: request.mode,
    destination: request.destination,
    accept: request.headers.get('accept') || '',
    authorization: request.headers.get('authorization') || '',
    contentType: request.headers.get('content-type') || ''
  });
  if (decision === 'bypass') return;

  if (decision === 'network-first') {
    var freshRequest = request;
    if (/\.(?:js|mjs)$/i.test(new URL(request.url).pathname)) {
      try { freshRequest = new Request(request, { cache: 'no-cache' }); }
      catch (err) { freshRequest = request; }
    }
    event.respondWith(fetch(freshRequest).then(function (response) {
      return store(PAGES, request, response);
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match('/');
      });
    }));
    return;
  }

  event.respondWith(caches.match(request).then(function (cached) {
    var fresh = fetch(request).then(function (response) {
      return store(FILES, request, response);
    }).catch(function () {
      return cached;
    });
    return cached || fresh;
  }));
});
