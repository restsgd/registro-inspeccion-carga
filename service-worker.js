// Service Worker — Registro Servicios Inspección de Carga
// NOTA: solo cachea el shell del wrapper (esta página estática de GitHub Pages).
// La app real (formularios, datos, fotos) vive en Google Apps Script y SIEMPRE
// requiere Internet — esto no habilita ningún modo offline funcional,
// solo permite que el ícono quede instalado en el equipo/celular.

const CACHE_NAME = 'ric-carga-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Solo se sirve desde cache el shell estático. Todo lo demás (la app de
// Apps Script dentro del iframe) pasa directo a la red, sin interceptar,
// porque esa parte no puede funcionar sin conexión.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
