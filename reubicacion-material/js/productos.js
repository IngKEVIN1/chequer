/* =============================================================================
 * productos.js — Lógica de negocio: filas, AGRUPACIÓN de cantidades,
 * división de filas, comentarios y VALIDACIONES.
 * No toca la pantalla: es lógica pura (se prueba en tests/pruebas.html).
 *
 * ===== REGLAS DE AGRUPACIÓN (dónde modificarlas) =====
 *   MISMO PRODUCTO + MISMO LOTE              -> SUMAR en la misma fila
 *   MISMO PRODUCTO + LOTE DIFERENTE          -> NUEVA fila
 *   MISMO PRODUCTO CON LOTE + SIN LOTE       -> NUEVA fila
 *   PRODUCTO DIFERENTE                       -> NUEVA fila
 *   Opcional (config.js > AGRUPACION):
 *     SEPARAR_POR_UNIDAD  -> unidades distintas (LY vs LB) no se suman
 *     SEPARAR_POR_ORIGEN  -> ubicaciones origen distintas no se suman
 *   Funciones: claveAgrupacion() y sonCompatibles()
 * ===== FIN REGLAS =====
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  function cfg() { return root.APP_CONFIG; }

  /** Limpia un código: sin espacios extremos y en mayúsculas. */
  function limpiarCodigo(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toUpperCase();
  }

  /** Normaliza para comparar: mayúsculas y SIN espacios (los guiones sí cuentan). */
  function normalizarClave(v) {
    return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();
  }

  function redondear(n) { return Math.round(Number(n) * 1000) / 1000; }

  var P = {};

  P.limpiarCodigo = limpiarCodigo;
  P.normalizarClave = normalizarClave;

  P.crearMovimiento = function () {
    return {
      id: U.generarId(),
      referencia: '',
      fecha: U.hoyISO(),
      montacarguista: '',
      filas: [],
      eventos: [],
      ultimoOrigen: '',
      creado: new Date().toISOString(),
      actualizado: new Date().toISOString()
    };
  };

  /** Crea una fila con todos los campos normalizados. */
  P.crearFila = function (d) {
    d = d || {};
    var ubic = cfg().UBICACIONES;
    var ubicacion = function (v) {
      var s = String(v == null ? '' : v).trim();
      return ubic.FORZAR_MAYUSCULAS ? s.toUpperCase() : s;
    };
    return {
      id: d.id || U.generarId(),
      producto: limpiarCodigo(d.producto),
      cantidad: redondear(d.cantidad) || 0,
      unidad: limpiarCodigo(d.unidad),
      lote: limpiarCodigo(d.lote),
      dateCode: String(d.dateCode || '').trim(),
      origen: ubicacion(d.origen),
      destino: ubicacion(d.destino),
      comentarios: String(d.comentarios || '').trim(),
      fuentes: {
        producto: (d.fuentes && d.fuentes.producto) || 'MANUAL',
        cantidad: (d.fuentes && d.fuentes.cantidad) || 'MANUAL',
        lote: (d.fuentes && d.fuentes.lote) || (d.lote ? 'MANUAL' : '')
      },
      escaneos: d.escaneos == null ? 1 : d.escaneos
    };
  };

  /** Clave base de agrupación: PRODUCTO + LOTE (lote vacío es un valor distinto). */
  P.claveAgrupacion = function (fila) {
    return normalizarClave(fila.producto) + '||' + normalizarClave(fila.lote);
  };

  /** Reglas opcionales adicionales (unidad / origen). */
  P.sonCompatibles = function (existente, nueva) {
    var reglas = cfg().AGRUPACION;
    if (reglas.SEPARAR_POR_UNIDAD && existente.unidad && nueva.unidad &&
        normalizarClave(existente.unidad) !== normalizarClave(nueva.unidad)) return false;
    if (reglas.SEPARAR_POR_ORIGEN && normalizarClave(existente.origen) !== normalizarClave(nueva.origen)) return false;
    return true;
  };

  /** Busca la fila con la que se puede sumar. Devuelve el índice o -1. */
  P.buscarFilaParaSumar = function (filas, nueva, excluirId) {
    if (!normalizarClave(nueva.producto)) return -1; // sin producto nunca se suma
    var clave = P.claveAgrupacion(nueva);
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].id === excluirId) continue;
      if (P.claveAgrupacion(filas[i]) === clave && P.sonCompatibles(filas[i], nueva)) return i;
    }
    return -1;
  };

  function unirTextos(a, b, sep) {
    var lista = [];
    [a, b].forEach(function (t) {
      String(t || '').split(sep).map(function (x) { return x.trim(); }).forEach(function (x) {
        if (x && lista.indexOf(x) === -1) lista.push(x);
      });
    });
    return lista.join(sep);
  }

  function unirFuente(a, b) {
    if (!a) return b || '';
    if (!b || a === b) return a;
    return 'MIXTO';
  }

  /** Suma "nueva" dentro de "existente". Devuelve fila nueva + advertencias. */
  P.fusionarFilas = function (existente, nueva) {
    var advertencias = [];
    var r = JSON.parse(JSON.stringify(existente));
    r.cantidad = redondear(Number(existente.cantidad) + Number(nueva.cantidad));
    if (!r.unidad && nueva.unidad) r.unidad = nueva.unidad;
    if (!r.origen && nueva.origen) r.origen = nueva.origen;
    else if (nueva.origen && normalizarClave(nueva.origen) !== normalizarClave(r.origen)) {
      advertencias.push('La ubicación origen era distinta (' + r.origen + ' / ' + nueva.origen + '). Se conservó ' + r.origen + '. Use DIVIDIR si necesita separarlas.');
    }
    if (!r.destino && nueva.destino) r.destino = nueva.destino;
    else if (nueva.destino && normalizarClave(nueva.destino) !== normalizarClave(r.destino)) {
      advertencias.push('La ubicación destino era distinta (' + r.destino + ' / ' + nueva.destino + '). Se conservó ' + r.destino + '.');
    }
    r.dateCode = unirTextos(existente.dateCode, nueva.dateCode, ', ');
    r.comentarios = unirTextos(existente.comentarios, nueva.comentarios, ' / ');
    r.fuentes = {
      producto: unirFuente(existente.fuentes.producto, nueva.fuentes.producto),
      cantidad: unirFuente(existente.fuentes.cantidad, nueva.fuentes.cantidad),
      lote: unirFuente(existente.fuentes.lote, nueva.fuentes.lote)
    };
    r.escaneos = (existente.escaneos || 1) + (nueva.escaneos || 1);
    return { fila: r, advertencias: advertencias };
  };

  /**
   * Agrega una fila aplicando las reglas de agrupación.
   * No modifica el arreglo recibido: devuelve uno nuevo.
   * @returns {{filas:Array, accion:'sumada'|'nueva', indice:number, fila:Object, advertencias:Array}}
   */
  P.agregarOSumar = function (filas, datos) {
    var nueva = P.crearFila(datos);
    var copia = filas.slice();
    var idx = P.buscarFilaParaSumar(copia, nueva);
    if (idx >= 0) {
      var res = P.fusionarFilas(copia[idx], nueva);
      copia[idx] = res.fila;
      return { filas: copia, accion: 'sumada', indice: idx, fila: res.fila, advertencias: res.advertencias, cantidadAgregada: nueva.cantidad };
    }
    copia.push(nueva);
    return { filas: copia, accion: 'nueva', indice: copia.length - 1, fila: nueva, advertencias: [], cantidadAgregada: nueva.cantidad };
  };

  /** Combina la fila "idOrigen" dentro de "idDestino" (usado al editar). */
  P.combinarFilas = function (filas, idDestino, idOrigen) {
    var iD = filas.findIndex(function (f) { return f.id === idDestino; });
    var iO = filas.findIndex(function (f) { return f.id === idOrigen; });
    if (iD < 0 || iO < 0 || iD === iO) return { filas: filas, advertencias: [] };
    var res = P.fusionarFilas(filas[iD], filas[iO]);
    var copia = filas.slice();
    copia[iD] = res.fila;
    copia.splice(iO, 1);
    return { filas: copia, advertencias: res.advertencias };
  };

  /** Divide una fila: separa "cantidadNueva" en una fila nueva debajo. */
  P.dividirFila = function (filas, id, cantidadNueva) {
    var i = filas.findIndex(function (f) { return f.id === id; });
    if (i < 0) throw new Error('No se encontró la fila a dividir.');
    var original = filas[i];
    var cant = redondear(cantidadNueva);
    if (!(cant > 0) || cant >= Number(original.cantidad)) {
      throw new Error('La cantidad a separar debe ser mayor que 0 y menor que ' + U.formatearNumero(original.cantidad) + '.');
    }
    var a = JSON.parse(JSON.stringify(original));
    var b = JSON.parse(JSON.stringify(original));
    a.cantidad = redondear(original.cantidad - cant);
    b.id = U.generarId();
    b.cantidad = cant;
    b.fuentes = { producto: original.fuentes.producto, cantidad: 'MANUAL', lote: original.fuentes.lote };
    b.escaneos = 0;
    var copia = filas.slice();
    copia.splice(i, 1, a, b);
    return { filas: copia, indiceNueva: i + 1 };
  };

  /**
   * Convierte texto a cantidad. Acepta "6343", "6,343", "395.5", "12,5".
   * @returns {{ok:boolean, valor?:number, mensaje?:string}}
   */
  P.parsearCantidad = function (texto) {
    var v = cfg().VALIDACION;
    var s = String(texto == null ? '' : texto).trim().replace(/\s+/g, '');
    if (!s) return { ok: false, mensaje: 'La cantidad está vacía.' };
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');   // separador de miles
    else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');                // coma decimal
    if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, mensaje: 'La cantidad solo debe contener números.' };
    var n = parseFloat(s);
    if (!isFinite(n) || n <= 0) return { ok: false, mensaje: 'La cantidad debe ser mayor que cero.' };
    if (!v.PERMITIR_DECIMALES && Math.floor(n) !== n) return { ok: false, mensaje: 'La cantidad debe ser un número entero.' };
    if (n > v.CANTIDAD_MAXIMA) return { ok: false, mensaje: 'La cantidad es demasiado grande (máximo ' + U.formatearNumero(v.CANTIDAD_MAXIMA) + ').' };
    return { ok: true, valor: redondear(n) };
  };

  /** Texto final de la columna COMENTARIOS. Ej: "Lote: 309187 | Unidad: LY | Tarima dañada" */
  P.componerComentarios = function (fila) {
    var c = cfg().COMENTARIOS;
    var partes = [];
    if (c.INCLUIR_LOTE && fila.lote) partes.push('Lote: ' + fila.lote);
    if (c.INCLUIR_DATE_CODE && fila.dateCode) partes.push('Date Code: ' + fila.dateCode);
    if (c.INCLUIR_UNIDAD && fila.unidad) partes.push('Unidad: ' + fila.unidad);
    if (fila.comentarios) partes.push(fila.comentarios);
    return partes.join(c.SEPARADOR);
  };

  P.tieneDatos = function (mov) {
    return !!(mov && ((mov.filas && mov.filas.length) || String(mov.referencia || '').trim() || String(mov.montacarguista || '').trim()));
  };

  /**
   * Valida el movimiento antes de exportar.
   * @returns {Array<{fila:number|null, id:string|null, campo:string, mensaje:string}>}
   */
  P.validarMovimiento = function (mov) {
    var v = cfg().VALIDACION;
    var errores = [];
    if (!String(mov.referencia || '').trim()) errores.push({ fila: null, id: null, campo: 'referencia', mensaje: 'Falta la referencia.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mov.fecha || '')) errores.push({ fila: null, id: null, campo: 'fecha', mensaje: 'La fecha no es válida.' });
    if (v.MONTACARGUISTA_OBLIGATORIO && !String(mov.montacarguista || '').trim()) {
      errores.push({ fila: null, id: null, campo: 'montacarguista', mensaje: 'Falta el nombre del montacarguista.' });
    }
    if (!mov.filas || !mov.filas.length) {
      errores.push({ fila: null, id: null, campo: 'filas', mensaje: 'Debe capturar al menos un producto.' });
      return errores;
    }
    mov.filas.forEach(function (f, i) {
      var n = i + 1;
      if (!String(f.producto || '').trim()) errores.push({ fila: n, id: f.id, campo: 'producto', mensaje: 'Falta el producto en la fila ' + n + '.' });
      var c = P.parsearCantidad(f.cantidad);
      if (!c.ok) errores.push({ fila: n, id: f.id, campo: 'cantidad', mensaje: 'Cantidad inválida en la fila ' + n + ': ' + c.mensaje });
      if (v.ORIGEN_OBLIGATORIO && !String(f.origen || '').trim()) errores.push({ fila: n, id: f.id, campo: 'origen', mensaje: 'Falta ubicación origen en la fila ' + n + '.' });
      if (!String(f.destino || '').trim()) errores.push({ fila: n, id: f.id, campo: 'destino', mensaje: 'Falta ubicación destino en la fila ' + n + '.' });
    });
    return errores;
  };

  /** Etiqueta legible del método de captura. */
  P.nombreFuente = function (f) {
    return ({
      'OCR': 'OCR',
      'BARCODE': 'Código de barras',
      'OCR+BARCODE': 'OCR + código de barras',
      'MANUAL': 'Manual',
      'MIXTO': 'Mixto'
    })[f] || (f || '—');
  };

  R.Productos = P;
})(typeof window !== 'undefined' ? window : globalThis);
