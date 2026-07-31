const CACHE_NAME = 'zomvox-pwa-2026-07-31-04';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './hud-theme.css',
  './config.js',
  './sound.js',
  './audio/audio-config.js',
  './audio/dsp.js',
  './audio/weapons.js',
  './audio/foley.js',
  './audio/voice.js',
  './audio/mixer-runtime.js',
  './audio/ambience.js',
  './audio/index.js',
  './script.js',
  './manifest.webmanifest',
  './assets/favicon.ico',
  './assets/favicon-16.png',
  './assets/favicon-32.png',
  './assets/favicon-48.png',
  './assets/favicon-192.png',
  './assets/favicon-256.png',
  './assets/favicon-512.png',
  './assets/apple-touch-icon.png',
  './assets/favicon.png',
  './assets/bullet-icon.svg',
  './assets/radio-operator.svg',
  './assets/zomvox-splash.png',
  './assets/zomvox-gun-spritesheet.png',
  './assets/ambientAshlands.mp3',
  './assets/ambientDunes.mp3',
  './assets/ambientForest.mp3',
  './assets/ambientMenu.mp3',
  './assets/ambientRocky.mp3',
  './assets/ambientSwamp.mp3',
  './assets/empty.mp3',
  './assets/explosion.mp3',
  './assets/head.mp3',
  './assets/hit.mp3',
  './assets/hurt.mp3',
  './assets/land.mp3',
  './assets/moan.mp3',
  './assets/objectiveClear.mp3',
  './assets/pickup.mp3',
  './assets/pickupAmmo.mp3',
  './assets/pickupC4.mp3',
  './assets/pickupHealth.mp3',
  './assets/perkEquip.mp3',
  './assets/reloadDone.mp3',
  './assets/reloadStart.mp3',
  './assets/shoot.mp3',
  './assets/toxin.mp3',
  './assets/zombiemoan.wav'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
