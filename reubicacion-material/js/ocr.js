/* =============================================================================
 * ocr.js — Reconocimiento de texto con Tesseract.js, 100 % LOCAL.
 * Los archivos del motor y del idioma están en libs/tesseract/ (no usa CDN).
 *
 * ===== DÓNDE MODIFICAR EL OCR =====
 *   - Idioma, modo de página y tamaño de imagen: config.js > CAPTURA
 *   - Preprocesamiento de la imagen: función prepararImagen() (abajo)
 *   - Interpretación del texto: js/interprete.js y js/perfiles-etiquetas.js
 * ===== FIN =====
 *
 * Limitación real: el OCR usa un "Web Worker" y WebAssembly. Los navegadores
 * NO permiten eso cuando la página se abre como archivo (file://). En ese caso
 * use INICIAR-SERVIDOR.bat (PC) o la versión publicada (tablets).
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  var worker = null;
  var inicializando = null;
  var progresoActual = null;

  function cfg() { return root.APP_CONFIG.CAPTURA; }

  var O = {};

  /** Indica si el OCR puede funcionar en este entorno. */
  O.disponible = function () {
    if (!cfg().USAR_OCR) return { ok: false, motivo: 'El OCR está desactivado en config.js (CAPTURA.USAR_OCR).' };
    if (U.modoArchivo()) {
      return { ok: false, motivo: 'La lectura de texto (OCR) no funciona al abrir index.html como archivo. Use INICIAR-SERVIDOR.bat o la dirección web de la app. El código de barras y la captura manual sí funcionan.' };
    }
    if (typeof root.WebAssembly !== 'object' || typeof root.Worker !== 'function') {
      return { ok: false, motivo: 'Este navegador no soporta WebAssembly/Workers, necesarios para el OCR. Actualice el navegador.' };
    }
    return { ok: true };
  };

  O.estaListo = function () { return !!worker; };

  /** Crea el motor OCR (la primera vez tarda unos segundos). */
  O.inicializar = function (alProgreso) {
    if (alProgreso) progresoActual = alProgreso;
    if (worker) return Promise.resolve(worker);
    if (inicializando) return inicializando;
    var disp = O.disponible();
    if (!disp.ok) return Promise.reject(new Error(disp.motivo));

    var rutas = root.APP_CONFIG.RUTAS_OCR;
    inicializando = U.cargarLibreria('ocr').then(function (T) {
      return T.createWorker(cfg().OCR_IDIOMA, 1 /* LSTM */, {
        workerPath: U.urlAbsoluta(rutas.WORKER),
        corePath: U.urlAbsoluta(rutas.CORE),
        langPath: U.urlAbsoluta(rutas.IDIOMAS),
        gzip: true,
        workerBlobURL: false,   // worker desde archivo propio: así el modo sin conexión lo controla
        logger: function (m) { if (progresoActual) progresoActual(m); },
        errorHandler: function (e) { console.warn('OCR:', e); }
      });
    }).then(function (w) {
      return w.setParameters({
        tessedit_pageseg_mode: String(cfg().OCR_MODO_PAGINA),
        preserve_interword_spaces: '1'
      }).then(function () { worker = w; inicializando = null; return w; });
    }).catch(function (e) {
      inicializando = null;
      var msg = (e && e.message) || String(e);
      throw new Error('No se pudo iniciar el OCR: ' + msg);
    });
    return inicializando;
  };

  /** Escala de grises + estiramiento de contraste (mejora etiquetas con plástico/brillo). */
  O.prepararImagen = function (canvasOrigen) {
    var c = U.imagenACanvas(canvasOrigen, cfg().TAMANO_MAX_OCR);
    var ctx = c.getContext('2d');
    var img = ctx.getImageData(0, 0, c.width, c.height);
    var d = img.data, hist = new Uint32Array(256), i, total = c.width * c.height;
    for (i = 0; i < d.length; i += 4) {
      var g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
      d[i] = g; hist[g]++;
    }
    // Percentiles 2 % y 98 % para recortar brillos y sombras extremas
    var acumulado = 0, bajo = 0, alto = 255;
    for (i = 0; i < 256; i++) { acumulado += hist[i]; if (acumulado >= total * 0.02) { bajo = i; break; } }
    acumulado = 0;
    for (i = 255; i >= 0; i--) { acumulado += hist[i]; if (acumulado >= total * 0.02) { alto = i; break; } }
    var rango = Math.max(1, alto - bajo);
    for (i = 0; i < d.length; i += 4) {
      var v = Math.max(0, Math.min(255, ((d[i] - bajo) * 255) / rango));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  /**
   * Reconoce el texto de un canvas.
   * @returns {Promise<{texto:string, confianza:number}>}
   */
  O.reconocer = async function (canvas, alProgreso) {
    var w = await O.inicializar(alProgreso);
    progresoActual = alProgreso || null;
    var preparado = O.prepararImagen(canvas);
    var r = await w.recognize(preparado);
    return { texto: (r && r.data && r.data.text) || '', confianza: (r && r.data && r.data.confidence) || 0 };
  };

  O.terminar = async function () {
    if (worker) { try { await worker.terminate(); } catch (e) { /* sin acción */ } }
    worker = null;
  };

  R.OCR = O;
})(typeof window !== 'undefined' ? window : globalThis);
