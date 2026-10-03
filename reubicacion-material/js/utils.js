/* =============================================================================
 * utils.js — Funciones de apoyo usadas por toda la aplicación.
 * No contiene configuración editable (ver config.js).
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var cacheScripts = {};
  var cacheLogo = null;

  var U = {};

  /** Escapa texto para insertarlo en HTML de forma segura. */
  U.escapeHtml = function (texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /** Identificador único (no usa crypto.randomUUID porque falla fuera de HTTPS). */
  U.generarId = function () {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /** Fecha local de hoy en formato YYYY-MM-DD (no UTC, evita desfase de un día). */
  U.hoyISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /** YYYY-MM-DD -> DD/MM/YYYY */
  U.fechaDMY = function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || '');
  };

  U.horaCorta = function (isoCompleto) {
    var d = new Date(isoCompleto);
    if (isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  };

  U.quitarAcentos = function (s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  /** Mayúsculas, sin acentos, espacios simples. Para comparar textos. */
  U.normalizarTexto = function (s) {
    return U.quitarAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim();
  };

  U.debounce = function (fn, ms) {
    var t = null;
    var envuelta = function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(ctx, args); }, ms);
    };
    envuelta.ejecutarYa = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    return envuelta;
  };

  U.dormir = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /** '#E4002B' -> [228, 0, 43] */
  U.hexARgb = function (hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return [228, 0, 43];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /** Formato de número para mostrar: 6343 -> "6,343"; 395.5 -> "395.5" */
  U.formatearNumero = function (n) {
    var v = Number(n);
    if (!isFinite(v)) return '';
    return v.toLocaleString('es-MX', { maximumFractionDigits: 3 });
  };

  U.formatearBytes = function (b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  /** Nombre de archivo profesional: Reubicacion_71308_2026-10-02.pdf */
  U.nombreArchivo = function (prefijo, referencia, fechaISO, extension) {
    var ref = U.quitarAcentos(referencia || 'SIN-REF').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'SIN-REF';
    var fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaISO || '') ? fechaISO : U.hoyISO();
    return prefijo + '_' + ref + '_' + fecha + '.' + extension;
  };

  /** Distancia de edición (para comparar OCR contra código de barras). */
  U.levenshtein = function (a, b) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  };

  // ---------------------------------------------------------------------------
  // Entorno / dispositivo
  // ---------------------------------------------------------------------------
  U.modoArchivo = function () { return root.location && root.location.protocol === 'file:'; };

  U.esIOS = function () {
    var ua = (root.navigator && navigator.userAgent) || '';
    // iPadOS se presenta como "Macintosh" pero con pantalla táctil
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  };

  U.esAndroid = function () { return /Android/i.test((root.navigator && navigator.userAgent) || ''); };

  U.esTactil = function () {
    if (U.esIOS() || U.esAndroid()) return true;
    return !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
  };

  // ---------------------------------------------------------------------------
  // Archivos
  // ---------------------------------------------------------------------------
  /** Descarga un Blob con nombre de archivo. */
  U.descargarBlob = function (blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 60000);
  };

  /** Blob -> base64 (sin el prefijo data:) */
  U.blobABase64 = function (blob) {
    return new Promise(function (resolve, reject) {
      var lector = new FileReader();
      lector.onload = function () { resolve(String(lector.result).split(',')[1] || ''); };
      lector.onerror = function () { reject(new Error('No se pudo leer el archivo generado.')); };
      lector.readAsDataURL(blob);
    });
  };

  /** Texto UTF-8 -> base64 */
  U.textoABase64 = function (texto) {
    var bytes = new TextEncoder().encode(texto);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  };

  /** Convierte una ruta relativa en URL absoluta (necesario para el worker del OCR). */
  U.urlAbsoluta = function (ruta) { return new URL(ruta, root.location.href).href; };

  // ---------------------------------------------------------------------------
  // Carga diferida de librerías (solo se cargan cuando se necesitan)
  // ---------------------------------------------------------------------------
  U.cargarScript = function (src) {
    if (cacheScripts[src]) return cacheScripts[src];
    cacheScripts[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        delete cacheScripts[src];
        reject(new Error('No se encontró el archivo "' + src + '". Verifique que la carpeta libs/ se copió completa.'));
      };
      document.head.appendChild(s);
    });
    return cacheScripts[src];
  };

  /** Carga una librería definida en APP_CONFIG.LIBRERIAS (en orden). */
  U.cargarLibreria = function (nombre) {
    var def = root.APP_CONFIG.LIBRERIAS[nombre];
    if (!def) return Promise.reject(new Error('Librería no configurada: ' + nombre));
    if (root[def.global]) return Promise.resolve(root[def.global]);
    return def.archivos.reduce(function (p, archivo) {
      return p.then(function () { return U.cargarScript(archivo); });
    }, Promise.resolve()).then(function () {
      if (!root[def.global]) throw new Error('La librería "' + nombre + '" no se inicializó correctamente.');
      return root[def.global];
    });
  };

  // ---------------------------------------------------------------------------
  // Imágenes
  // ---------------------------------------------------------------------------
  /** Carga un File/Blob de imagen y devuelve un canvas (respeta orientación EXIF). */
  U.archivoACanvas = function (archivo, tamanoMax) {
    return new Promise(function (resolve, reject) {
      if (!archivo) { reject(new Error('No se recibió ninguna imagen.')); return; }
      if (archivo.type && !/^image\//.test(archivo.type)) {
        reject(new Error('El archivo seleccionado no es una imagen.'));
        return;
      }
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.onload = function () {
        try {
          var c = U.imagenACanvas(img, tamanoMax);
          URL.revokeObjectURL(url);
          resolve(c);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo abrir la imagen. Si es formato HEIC, configure la cámara en "Más compatible" (JPG).'));
      };
      img.src = url;
    });
  };

  /** Dibuja una imagen/video/canvas en un canvas nuevo con tamaño máximo. */
  U.imagenACanvas = function (fuente, tamanoMax) {
    var w = fuente.naturalWidth || fuente.videoWidth || fuente.width;
    var h = fuente.naturalHeight || fuente.videoHeight || fuente.height;
    if (!w || !h) throw new Error('La imagen está vacía o dañada.');
    var escala = tamanoMax ? Math.min(1, tamanoMax / Math.max(w, h)) : 1;
    var c = document.createElement('canvas');
    c.width = Math.round(w * escala);
    c.height = Math.round(h * escala);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(fuente, 0, 0, c.width, c.height);
    return c;
  };

  /** Copia reducida de un canvas. */
  U.reducirCanvas = function (canvas, tamanoMax) {
    if (Math.max(canvas.width, canvas.height) <= tamanoMax) return canvas;
    return U.imagenACanvas(canvas, tamanoMax);
  };

  /** Gira un canvas 90, 180 o 270 grados (sentido horario). */
  U.rotarCanvas = function (canvas, grados) {
    grados = ((grados % 360) + 360) % 360;
    if (grados === 0) return canvas;
    var c = document.createElement('canvas');
    var lateral = grados === 90 || grados === 270;
    c.width = lateral ? canvas.height : canvas.width;
    c.height = lateral ? canvas.width : canvas.height;
    var ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(grados * Math.PI / 180);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return c;
  };

  /**
   * Devuelve el logo como PNG en base64 para PDF/Excel:
   *  1) logo cargado en Configuración (guardado en este dispositivo)
   *  2) archivo assets/logo.png
   * Si se abre la app como archivo (file://) el navegador puede bloquear la
   * lectura del archivo del logo; en ese caso se usa la opción 1 o el texto.
   */
  U.obtenerLogo = function () {
    if (cacheLogo) return Promise.resolve(cacheLogo);
    var guardado = R.Storage ? R.Storage.obtenerLogo() : null;
    var fuente = guardado || root.APP_CONFIG.LOGO.RUTA;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = U.imagenACanvas(img, 600);
          var dataURL = c.toDataURL('image/png'); // puede fallar con file:// (lienzo "contaminado")
          cacheLogo = { dataURL: dataURL, ancho: c.width, alto: c.height };
          resolve(cacheLogo);
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = fuente;
    });
  };

  U.limpiarCacheLogo = function () { cacheLogo = null; };

  R.Utils = U;
})(typeof window !== 'undefined' ? window : globalThis);
