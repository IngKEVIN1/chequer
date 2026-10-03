/* =============================================================================
 * service-worker.js — Permite usar la app SIN INTERNET una vez cargada.
 * Guarda una copia local de todos los archivos (incluido el OCR).
 *
 * ===== IMPORTANTE AL ACTUALIZAR LA APP =====
 * Cada vez que modifique cualquier archivo (config.js, logo, código), suba el
 * número de CACHE_VERSION. Así las tablets descargan la versión nueva y la app
 * mostrará el aviso "Hay una versión nueva" con el botón Actualizar.
 * ===== FIN =====
 *
 * Nota: los service workers solo funcionan con http://localhost o https://.
 * No funcionan al abrir index.html como archivo (file://).
 * ========================================================================== */
'use strict';

// ===== CONFIGURACIÓN EDITABLE =====
var CACHE_VERSION = 'v1.0.0';
// ===== FIN CONFIGURACIÓN =====

var CACHE_NOMBRE = 'reubicacion-' + CACHE_VERSION;

// Archivos indispensables (la instalación falla si alguno no existe)
var ARCHIVOS_APP = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './css/bootstrap.min.css',
  './css/styles.css',
  './js/utils.js',
  './js/storage.js',
  './js/ui.js',
  './js/productos.js',
  './js/perfiles-etiquetas.js',
  './js/interprete.js',
  './js/barcode.js',
  './js/ocr.js',
  './js/formulario.js',
  './js/scanner.js',
  './js/export-excel.js',
  './js/export-pdf.js',
  './js/email.js',
  './js/app.js',
  './libs/bootstrap/bootstrap.bundle.min.js',
  './libs/exceljs/exceljs.min.js',
  './libs/jspdf/jspdf.umd.min.js',
  './libs/jspdf/jspdf.plugin.autotable.min.js',
  './libs/zxing/zxing.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

// Archivos opcionales o grandes: se intentan guardar, pero no bloquean la instalación
var ARCHIVOS_OPCIONALES = [
  './assets/logo.png',
  './assets/icons/icon-maskable-512.png',
  './libs/tesseract/tesseract.min.js',
  './libs/tesseract/worker.min.js',
  './libs/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  './libs/tesseract/core/tesseract-core-lstm.wasm.js',
  './libs/tesseract/lang/eng.traineddata.gz'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NOMBRE).then(function (cache) {
      return cache.addAll(ARCHIVOS_APP).then(function () {
        return Promise.all(ARCHIVOS_OPCIONALES.map(function (url) {
          return cache.add(url).catch(function (e) { console.warn('[SW] No se pudo guardar', url, e); });
        }));
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(nombres.filter(function (n) {
        return n.indexOf('reubicacion-') === 0 && n !== CACHE_NOMBRE;
      }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// La app pide activar la versión nueva cuando el usuario presiona "Actualizar"
self.addEventListener('message', function (event) {
  if (event.data && event.data.tipo === 'ACTIVAR') self.skipWaiting();
});

// Estrategia: primero la copia local (rápido y sin Internet); si no existe, la red.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (guardado) {
      if (guardado) return guardado;
      return fetch(req).then(function (resp) {
        if (resp && resp.ok && resp.type === 'basic') {
          var copia = resp.clone();
          caches.open(CACHE_NOMBRE).then(function (cache) { cache.put(req, copia); });
        }
        return resp;
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Sin conexión y el archivo no está guardado: ' + url.pathname, { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
    })
  );
});
