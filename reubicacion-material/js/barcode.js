/* =============================================================================
 * barcode.js — Lectura de códigos de barras / QR desde una fotografía.
 *
 * Estrategia:
 *   1) API nativa BarcodeDetector (Chrome Android / Samsung: rápida y lee
 *      todos los códigos de la foto a la vez).
 *   2) Si no existe o no encontró nada: librería ZXing (funciona en iPad,
 *      Safari, Windows y sin Internet). ZXing lee un código por pasada, así que
 *      se tapa cada código encontrado y se vuelve a buscar.
 * Todo se procesa en el dispositivo. La imagen no sale del equipo.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  var FORMATOS_NATIVOS = ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'pdf417'];
  var detectorNativo = null;

  function cfg() { return root.APP_CONFIG.CAPTURA; }

  function sinDuplicados(lista) {
    var vistos = {};
    return lista.filter(function (c) {
      if (!c.texto || vistos[c.texto]) return false;
      vistos[c.texto] = true;
      return true;
    });
  }

  async function obtenerDetectorNativo() {
    if (detectorNativo !== null) return detectorNativo || null;
    detectorNativo = false;
    try {
      if (!('BarcodeDetector' in root)) return null;
      var soportados = await root.BarcodeDetector.getSupportedFormats();
      var formatos = FORMATOS_NATIVOS.filter(function (f) { return soportados.indexOf(f) >= 0; });
      if (!formatos.length) return null;
      detectorNativo = new root.BarcodeDetector({ formats: formatos });
      return detectorNativo;
    } catch (e) {
      return null;
    }
  }

  async function leerNativo(canvas) {
    var det = await obtenerDetectorNativo();
    if (!det) return [];
    var res = await det.detect(canvas);
    return res.map(function (r) { return { texto: r.rawValue, formato: r.format, metodo: 'nativo' }; });
  }

  /** Tapa con blanco la zona de un código ya leído para buscar el siguiente. */
  function taparZona(ctx, puntos, mitadAncho) {
    if (!puntos || !puntos.length) return;
    ctx.fillStyle = '#ffffff';
    if (puntos.length >= 3) {
      var xs = puntos.map(function (p) { return p.x; }), ys = puntos.map(function (p) { return p.y; });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var margen = Math.max(maxX - minX, maxY - minY) * 0.25 + mitadAncho * 0.2;
      ctx.fillRect(minX - margen, minY - margen, (maxX - minX) + 2 * margen, (maxY - minY) + 2 * margen);
      return;
    }
    // Código lineal: los dos puntos marcan una línea a lo largo del código
    var a = puntos[0], b = puntos[puntos.length - 1];
    var dx = b.x - a.x, dy = b.y - a.y;
    var largo = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / largo, uy = dy / largo;      // a lo largo
    var nx = -uy, ny = ux;                      // perpendicular
    var extra = largo * 0.08 + 6;
    var p1 = { x: a.x - ux * extra, y: a.y - uy * extra };
    var p2 = { x: b.x + ux * extra, y: b.y + uy * extra };
    ctx.beginPath();
    ctx.moveTo(p1.x + nx * mitadAncho, p1.y + ny * mitadAncho);
    ctx.lineTo(p2.x + nx * mitadAncho, p2.y + ny * mitadAncho);
    ctx.lineTo(p2.x - nx * mitadAncho, p2.y - ny * mitadAncho);
    ctx.lineTo(p1.x - nx * mitadAncho, p1.y - ny * mitadAncho);
    ctx.closePath();
    ctx.fill();
  }

  async function leerZXing(canvasOriginal, alProgreso) {
    var Z = await U.cargarLibreria('zxing');
    var hints = new Map();
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_93, Z.BarcodeFormat.CODABAR,
      Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.ITF, Z.BarcodeFormat.UPC_A,
      Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.PDF_417
    ]);
    var lector = new Z.MultiFormatReader();
    lector.setHints(hints);

    var trabajo = U.imagenACanvas(canvasOriginal, cfg().TAMANO_MAX_CODIGOS);
    var ctx = trabajo.getContext('2d');
    var encontrados = [];
    var zonas = [];         // { puntos, mitad, texto }
    var maximo = cfg().MAX_CODIGOS_POR_FOTO;
    var intentos = 0;

    while (encontrados.length < maximo && intentos < maximo * 2) {
      intentos++;
      // Redibuja la imagen y tapa los códigos ya leídos
      ctx.drawImage(canvasOriginal, 0, 0, trabajo.width, trabajo.height);
      zonas.forEach(function (z) { taparZona(ctx, z.puntos, z.mitad); });

      var resultado;
      try {
        var fuente = new Z.HTMLCanvasElementLuminanceSource(trabajo);
        var bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(fuente));
        resultado = lector.decodeWithState(bitmap);
      } catch (e) {
        break; // NotFoundException u otro: ya no hay más códigos legibles
      }
      var texto = resultado.getText();
      var puntos = (resultado.getResultPoints() || []).map(function (p) { return { x: p.getX(), y: p.getY() }; });
      var existente = zonas.find(function (z) { return z.texto === texto; });
      if (existente) {
        // Volvió a leer el mismo código: ampliar la zona tapada
        existente.mitad *= 1.8;
        if (existente.mitad > Math.max(trabajo.width, trabajo.height)) break;
      } else {
        var largo = puntos.length >= 2 ? Math.hypot(puntos[1].x - puntos[0].x, puntos[1].y - puntos[0].y) : 40;
        zonas.push({ texto: texto, puntos: puntos, mitad: Math.max(12, largo * 0.22) });
        encontrados.push({ texto: texto, formato: Z.BarcodeFormat[resultado.getBarcodeFormat()] || '', metodo: 'zxing' });
        if (alProgreso) alProgreso(encontrados.length);
      }
      await U.dormir(0); // deja respirar a la interfaz
    }
    return encontrados;
  }

  var B = {};

  B.tieneNativo = function () { return 'BarcodeDetector' in root; };

  /**
   * Lee todos los códigos posibles de un canvas.
   * Nunca lanza error: si algo falla devuelve { codigos: [], error }.
   */
  B.leer = async function (canvas, alProgreso) {
    var codigos = [];
    var errores = [];
    try {
      codigos = await leerNativo(canvas);
    } catch (e) {
      errores.push('Lector nativo: ' + (e.message || e));
    }
    if (!codigos.length) {
      try {
        codigos = await leerZXing(canvas, alProgreso);
      } catch (e) {
        errores.push('ZXing: ' + (e.message || e));
      }
    }
    return { codigos: sinDuplicados(codigos), error: errores.join(' · ') };
  };

  R.Barcode = B;
})(typeof window !== 'undefined' ? window : globalThis);
