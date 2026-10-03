/* =============================================================================
 * interprete.js — Convierte el TEXTO (OCR) y los CÓDIGOS DE BARRAS leídos de
 * una etiqueta en campos: producto, cantidad, lote, date code.
 *
 * Principios:
 *   - Nunca inventa datos: si no hay evidencia, el campo queda vacío.
 *   - Cada campo indica su FUENTE (OCR / BARCODE / OCR+BARCODE) y CONFIANZA:
 *       alta  = texto y código de barras coinciden
 *       media = encontrado junto a su palabra guía (ej. "QTY 5140")
 *       baja  = deducido solo por formato, corregido o en conflicto -> "Revisar"
 *   - Un código de barras sin prefijo estándar NO se asume como número de parte;
 *     solo se usa para CONFIRMAR o CORREGIR lo que el OCR leyó.
 *
 * Los tipos de etiqueta y sus palabras guía están en perfiles-etiquetas.js.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;
  var cacheRegex = {};

  function E() { return R.Etiquetas; }

  // ---------------------------------------------------------------------------
  // Normalización
  // ---------------------------------------------------------------------------
  function normalizarLinea(s) {
    return U.quitarAcentos(s).toUpperCase()
      .replace(/[\u2018\u2019`\u00B4]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[|\u00A6]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function claveComparacion(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase(); }

  // Letras que el OCR suele confundir dentro de las palabras guía (QUANTITY -> QUANTlTY)
  var CONFUSIONES = { I: '[I1L]', L: '[L1I]', O: '[O0Q]', S: '[S5]', B: '[B8]', Z: '[Z2]' };

  /** Regex tolerante para una palabra guía: signos opcionales, espacios flexibles. */
  function regexEtiqueta(et) {
    if (cacheRegex[et]) return cacheRegex[et];
    var cuerpo = '';
    for (var i = 0; i < et.length; i++) {
      var ch = et[i];
      if (CONFUSIONES[ch]) cuerpo += CONFUSIONES[ch];
      else if (/[A-Z0-9]/.test(ch)) cuerpo += ch;
      else if (ch === ' ') cuerpo += '\\s*';
      else cuerpo += '\\s*' + ch.replace(/[.*+?^${}()|[\]\\\/\-]/g, '\\$&') + '?';
    }
    var re = new RegExp('(?:^|[^A-Z0-9])(' + cuerpo + ')(?![A-Z0-9])');
    cacheRegex[et] = re;
    return re;
  }

  function patron(nombre) {
    var re = E().PATRONES[nombre];
    return re ? new RegExp(re.source, re.flags.replace('g', '')) : null;
  }

  function patronGlobal(nombre) {
    var re = E().PATRONES[nombre];
    return re ? new RegExp(re.source, re.flags.replace('g', '') + 'g') : null;
  }

  // ---------------------------------------------------------------------------
  // Corrección de caracteres que el OCR confunde en zonas numéricas
  // ---------------------------------------------------------------------------
  function corregirDigitos(tok) {
    return tok.replace(/[OQD]/g, '0').replace(/[IL!]/g, '1').replace(/S/g, '5')
      .replace(/B/g, '8').replace(/Z/g, '2').replace(/G/g, '6');
  }

  /** Corrige tokens con forma de número de parte (8717O52-2 -> 8717052-2). */
  function corregirProducto(texto) {
    var re = /\b[0-9OQDILSBZG]{5,8}-[0-9OQDILSBZG]{1,3}\b/g, m;
    while ((m = re.exec(texto))) {
      var digitos = (m[0].match(/\d/g) || []).length;
      if (digitos >= 4) {
        var c = corregirDigitos(m[0]);
        if (patron('PRODUCTO_CARDINAL').test(c)) return c;
      }
    }
    return null;
  }

  function corregirZonaNumerica(texto) {
    return texto.replace(/[0-9OQDILSBZG,.]{2,}/g, function (tok) {
      var limpio = tok.replace(/[,.]/g, '');
      var dig = (limpio.match(/\d/g) || []).length;
      return dig > 0 && dig >= Math.ceil(limpio.length * 0.6) ? corregirDigitos(tok) : tok;
    });
  }

  // ---------------------------------------------------------------------------
  // Extracción de valores
  // ---------------------------------------------------------------------------
  function numeroLimpio(s) { return String(s).replace(/,/g, ''); }

  function extraerCantidad(texto, def) {
    var t = corregirZonaNumerica(texto); // misma longitud que el original (cambios 1 a 1)
    var re = patron('NUMERO');
    var m = re.exec(t);
    if (!m) return null;
    var valor = numeroLimpio(m[0]);
    if (!(parseFloat(valor) > 0)) return null;
    var corregido = texto.substr(m.index, m[0].length) !== m[0];
    var unidad = '';
    var resto = t.slice(m.index + m[0].length);
    var mu = /^\s*([A-Z]{1,5})\b/.exec(resto);
    if (mu && (def.unidades || []).indexOf(mu[1]) >= 0) unidad = mu[1];
    return { valor: valor, unidad: unidad, corregido: corregido };
  }

  function extraerValor(texto, def, tipo) {
    if (!texto) return null;
    if (tipo === 'cantidad') return extraerCantidad(texto, def);
    var nombres = [def.patron].concat(def.patronesAlternos || []);
    for (var i = 0; i < nombres.length; i++) {
      var re = patron(nombres[i]);
      if (!re) continue;
      var m = re.exec(texto);
      if (m) return { valor: m[0], patron: nombres[i] };
      if (nombres[i] === 'PRODUCTO_CARDINAL') {
        var c = corregirProducto(texto);
        if (c) return { valor: c, patron: nombres[i], corregido: true };
      }
    }
    return null;
  }

  function campoVacio() {
    return { valor: '', unidad: '', fuente: '', confianza: '', nota: '', alternativas: [], estado: '' };
  }

  function crearResultado(v, confianza, nota) {
    var c = campoVacio();
    c.valor = v.valor;
    c.unidad = v.unidad || '';
    c.fuente = 'OCR';
    c.confianza = v.corregido ? 'baja' : confianza;
    c.nota = nota + (v.corregido ? ' (se corrigieron caracteres dudosos: O→0, I→1, S→5…)' : '');
    return c;
  }

  /** Busca un campo: 1) junto a su palabra guía, 2) debajo, 3) por formato. */
  function buscarCampo(lineas, def, tipo) {
    if (!def) return campoVacio();
    var etiquetas = def.etiquetas || [];
    var siguientes = def.lineasSiguientes == null ? 1 : def.lineasSiguientes;

    for (var e = 0; e < etiquetas.length; e++) {
      var re = regexEtiqueta(etiquetas[e]);
      for (var i = 0; i < lineas.length; i++) {
        var m = re.exec(lineas[i]);
        if (!m) continue;
        var resto = lineas[i].slice(m.index + m[0].length).replace(/^[\s:#.=>\-]+/, '');
        var v = extraerValor(resto, def, tipo);
        if (v) return crearResultado(v, 'media', 'Junto a "' + etiquetas[e] + '"');
        for (var k = 1; k <= siguientes && i + k < lineas.length; k++) {
          v = extraerValor(lineas[i + k], def, tipo);
          if (v) return crearResultado(v, 'media', 'Debajo de "' + etiquetas[e] + '"');
        }
      }
    }

    // Cantidad sin palabra guía: número seguido de unidad (ej. "10656 LY")
    if (tipo === 'cantidad' && def.buscarPorUnidad) {
      var encontrados = [];
      var reU = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([A-Z]{1,5})\b/g, mu;
      lineas.forEach(function (l) {
        reU.lastIndex = 0;
        while ((mu = reU.exec(l))) {
          if ((def.unidades || []).indexOf(mu[2]) >= 0 && parseFloat(numeroLimpio(mu[1])) > 0) {
            encontrados.push({ valor: numeroLimpio(mu[1]), unidad: mu[2] });
          }
        }
      });
      var preferidas = def.unidadesPreferidas || [];
      for (var p = 0; p < preferidas.length; p++) {
        var elegido = encontrados.find(function (x) { return x.unidad === preferidas[p]; });
        if (elegido) {
          var c = crearResultado(elegido, 'baja', 'Sin palabra guía: número con unidad ' + elegido.unidad);
          c.alternativas = encontrados.filter(function (x) { return x !== elegido; })
            .map(function (x) { return x.valor + ' ' + x.unidad; });
          return c;
        }
      }
    }

    // Por formato en todo el texto (confianza baja)
    if (def.buscarSinEtiqueta && def.patron && tipo !== 'cantidad') {
      var lista = [];
      var reG = patronGlobal(def.patron), mg;
      lineas.forEach(function (l) {
        reG.lastIndex = 0;
        while ((mg = reG.exec(l))) { if (lista.indexOf(mg[0]) === -1) lista.push(mg[0]); }
      });
      if (!lista.length && def.patron === 'PRODUCTO_CARDINAL') {
        lineas.forEach(function (l) { var c2 = corregirProducto(l); if (c2 && lista.indexOf(c2) === -1) lista.push(c2); });
      }
      if (lista.length) {
        var r = crearResultado({ valor: lista[0] }, 'baja', 'Encontrado solo por formato (sin palabra guía)');
        r.alternativas = lista.slice(1, 5);
        return r;
      }
    }
    return campoVacio();
  }

  // ---------------------------------------------------------------------------
  // Tipo de etiqueta
  // ---------------------------------------------------------------------------
  function detectarPerfil(textoNorm) {
    var mejor = null;
    E().PERFILES.forEach(function (p) {
      var puntaje = 0;
      (p.palabrasClave || []).forEach(function (k) {
        if (regexEtiqueta(k.texto).test(textoNorm)) puntaje += k.peso;
      });
      if (puntaje >= p.puntajeMinimo && (!mejor || puntaje > mejor.puntaje)) mejor = { perfil: p, puntaje: puntaje };
    });
    return mejor || { perfil: E().obtener(E().PERFIL_GENERICO), puntaje: 0 };
  }

  // ---------------------------------------------------------------------------
  // Códigos de barras
  // ---------------------------------------------------------------------------
  // Identificadores de aplicación GS1 más comunes en logística
  var AI_GS1 = {
    '00': { l: 18, n: 'SSCC' }, '01': { l: 14, n: 'GTIN' }, '02': { l: 14, n: 'GTIN contenido' },
    '10': { v: 20, n: 'Lote', campo: 'lote' }, '11': { l: 6, n: 'Fecha producción', campo: 'dateCode', fecha: true },
    '13': { l: 6, n: 'Fecha empaque', fecha: true }, '15': { l: 6, n: 'Consumir antes', fecha: true },
    '17': { l: 6, n: 'Caducidad', fecha: true }, '21': { v: 20, n: 'Serie' },
    '30': { v: 8, n: 'Cantidad', campo: 'cantidad' }, '37': { v: 8, n: 'Cantidad', campo: 'cantidad' },
    '240': { v: 30, n: 'ID adicional' }, '241': { v: 30, n: 'Parte del cliente', campo: 'producto' },
    '400': { v: 30, n: 'Orden de compra' }
  };

  function fechaGS1(v) { return /^\d{6}$/.test(v) ? '20' + v.slice(0, 2) + '-' + v.slice(2, 4) + '-' + v.slice(4, 6) : v; }

  /** Interpreta GS1-128 en forma "(10)ABC(30)50" o con separador GS. */
  function parsearGS1(texto) {
    var t = String(texto || '');
    var marcado = false;
    if (t.indexOf(']C1') === 0) { t = t.slice(3); marcado = true; }
    var res = [], m;
    if (/^\(\d{2,4}\)/.test(t)) {
      var re = /\((\d{2,4})\)([^(]*)/g;
      while ((m = re.exec(t))) res.push({ ai: m[1], valor: m[2].trim() });
      return res.length ? res : null;
    }
    if (!marcado && t.indexOf('\x1d') < 0) return null;
    var pos = 0;
    while (pos < t.length) {
      if (t[pos] === '\x1d') { pos++; continue; }
      var ai = null;
      for (var len = 2; len <= 4 && !ai; len++) { if (AI_GS1[t.substr(pos, len)]) ai = t.substr(pos, len); }
      if (!ai && /^31\d\d/.test(t.substr(pos, 4))) { res.push({ ai: t.substr(pos, 4), valor: t.substr(pos + 4, 6) }); pos += 10; continue; }
      if (!ai) break;
      var d = AI_GS1[ai];
      if (d.l) { res.push({ ai: ai, valor: t.substr(pos + ai.length, d.l) }); pos += ai.length + d.l; }
      else {
        var fin = t.indexOf('\x1d', pos + ai.length);
        if (fin < 0) fin = t.length;
        res.push({ ai: ai, valor: t.slice(pos + ai.length, fin) });
        pos = fin;
      }
    }
    return res.length ? res : null;
  }

  // Identificadores ANSI MH10.8.2 (solo si el perfil los habilita)
  var DI_ANSI = [
    { re: /^1T(.+)$/, campo: 'lote', n: 'Lote (1T)' },
    { re: /^1P(.+)$/, extra: 'Parte proveedor (1P)' },
    { re: /^P(.+)$/, campo: 'producto', n: 'Parte (P)' },
    { re: /^Q(\d+(?:\.\d+)?)$/, campo: 'cantidad', n: 'Cantidad (Q)' },
    { re: /^S(.+)$/, extra: 'Serie (S)' },
    { re: /^K(.+)$/, extra: 'PO (K)' }
  ];

  function analizarCodigos(codigos, perfil) {
    var estructurados = { producto: [], cantidad: [], lote: [], dateCode: [] };
    var extras = [];
    var crudos = (codigos || []).map(function (c) {
      return { texto: String(c.texto || '').trim(), formato: c.formato || '', metodo: c.metodo || '', interpretacion: '' };
    }).filter(function (c) { return c.texto; });

    crudos.forEach(function (c) {
      var gs1 = parsearGS1(c.texto);
      if (gs1) {
        c.interpretacion = 'GS1: ' + gs1.map(function (x) { return '(' + x.ai + ')' + x.valor; }).join(' ');
        c.estructurado = true;
        gs1.forEach(function (x) {
          var d = AI_GS1[x.ai] || { n: 'AI ' + x.ai };
          var valor = d.fecha ? fechaGS1(x.valor) : x.valor;
          if (d.campo) estructurados[d.campo].push({ valor: valor, tipo: 'GS1 ' + x.ai });
          else extras.push({ nombre: d.n + ' (GS1)', valor: valor, fuente: 'BARCODE' });
        });
        return;
      }
      if (perfil.identificadoresANSI) {
        for (var i = 0; i < DI_ANSI.length; i++) {
          var m = DI_ANSI[i].re.exec(c.texto);
          if (m) {
            c.estructurado = true;
            if (DI_ANSI[i].campo) {
              estructurados[DI_ANSI[i].campo].push({ valor: m[1], tipo: DI_ANSI[i].n });
              c.interpretacion = DI_ANSI[i].n;
            } else {
              extras.push({ nombre: DI_ANSI[i].extra, valor: m[1], fuente: 'BARCODE' });
              c.interpretacion = DI_ANSI[i].extra;
            }
            break;
          }
        }
      }
    });
    return { estructurados: estructurados, extras: extras, crudos: crudos };
  }

  function sonIguales(a, b, campo) {
    if (campo === 'cantidad') {
      var x = parseFloat(numeroLimpio(a)), y = parseFloat(numeroLimpio(b));
      return isFinite(x) && x === y;
    }
    return claveComparacion(a) === claveComparacion(b);
  }

  /** Variantes de un código sin prefijos de identificador (P, Q, 1T, T, S...). */
  function variantesCodigo(texto) {
    var v = [texto];
    var m = /^(1T|1P|P|Q|T|S|K)(.{3,})$/.exec(texto);
    if (m) v.push(m[2]);
    return v;
  }

  function aplicarCodigos(campos, analisis) {
    // 1) Códigos estructurados (GS1 / ANSI): tienen prioridad sobre el OCR
    Object.keys(analisis.estructurados).forEach(function (campo) {
      var cands = analisis.estructurados[campo];
      if (!cands.length) return;
      var c = campos[campo];
      var cv = cands[0].valor;
      if (!c.valor) {
        campos[campo] = campoVacio();
        campos[campo].valor = cv;
        campos[campo].fuente = 'BARCODE';
        campos[campo].confianza = 'media';
        campos[campo].nota = 'Código de barras (' + cands[0].tipo + ')';
      } else if (sonIguales(c.valor, cv, campo)) {
        c.fuente = 'OCR+BARCODE';
        c.confianza = 'alta';
        c.nota += ' · confirmado por código de barras';
      } else {
        c.alternativas.unshift(c.valor);
        c.nota = 'El código de barras (' + cv + ') no coincide con el texto (' + c.valor + '). Verifique.';
        c.valor = cv;
        c.fuente = 'BARCODE';
        c.confianza = 'baja';
      }
    });

    // 2) Códigos simples: solo confirman o corrigen lo que el OCR ya encontró
    var simples = analisis.crudos.filter(function (c) { return !c.estructurado; });
    ['producto', 'lote', 'cantidad'].forEach(function (campo) {
      var c = campos[campo];
      if (c.fuente === 'OCR+BARCODE' || c.fuente === 'BARCODE') return;
      if (c.valor) {
        for (var i = 0; i < simples.length; i++) {
          var vars = variantesCodigo(simples[i].texto);
          for (var j = 0; j < vars.length; j++) {
            if (sonIguales(c.valor, vars[j], campo)) {
              c.fuente = 'OCR+BARCODE';
              c.confianza = 'alta';
              c.nota += ' · confirmado por código de barras';
              simples[i].interpretacion = simples[i].interpretacion || ('Confirma ' + campo);
              return;
            }
          }
        }
        if (campo === 'cantidad') return;
        // Corrección: el código difiere en 1-2 caracteres del texto leído
        for (var a = 0; a < simples.length; a++) {
          var vs = variantesCodigo(simples[a].texto);
          for (var b = 0; b < vs.length; b++) {
            var x = claveComparacion(c.valor), y = claveComparacion(vs[b]);
            if (y.length >= 5 && Math.abs(x.length - y.length) <= 1) {
              var d = U.levenshtein(x, y);
              var formatoOk = campo !== 'producto' || patron('PRODUCTO_CARDINAL').test(vs[b]) || !patron('PRODUCTO_CARDINAL').test(c.valor);
              if (d > 0 && d <= 2 && formatoOk) {
                c.alternativas.unshift(c.valor);
                c.nota = 'Corregido con código de barras (el OCR leyó ' + c.valor + ')';
                c.valor = vs[b];
                c.fuente = 'BARCODE';
                c.confianza = 'media';
                simples[a].interpretacion = simples[a].interpretacion || ('Corrige ' + campo);
                return;
              }
            }
          }
        }
      } else if (campo === 'producto') {
        // Producto no leído por OCR: solo se toma de un código cuyo formato completo
        // coincide con el patrón de número de parte (y se marca "Revisar").
        var reCompleto = new RegExp('^(?:' + E().PATRONES.PRODUCTO_CARDINAL.source + ')$');
        var coincidencias = [];
        simples.forEach(function (s) {
          variantesCodigo(s.texto).forEach(function (v) {
            if (reCompleto.test(v) && coincidencias.indexOf(v) === -1) coincidencias.push(v);
          });
        });
        if (coincidencias.length) {
          c.valor = coincidencias[0];
          c.fuente = 'BARCODE';
          c.confianza = 'baja';
          c.nota = 'Tomado de un código de barras por su formato. Verifique.';
          c.alternativas = coincidencias.slice(1);
        }
      }
    });
  }

  function calcularEstado(campos, perfil) {
    Object.keys(campos).forEach(function (k) {
      var c = campos[k];
      if (c.valor) c.estado = c.confianza === 'baja' ? 'revisar' : 'ok';
      else if (k === 'producto' || k === 'cantidad') c.estado = 'revisar';
      else if (k === 'lote' && perfil.campos.lote && (perfil.campos.lote.etiquetas || []).length) c.estado = 'revisar';
      else c.estado = 'vacio';
    });
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------
  var I = {};

  /**
   * @param {{texto?:string, codigos?:Array<{texto,formato,metodo}>, perfilId?:string}} entrada
   * @returns {{perfil, campos, extras, codigos, lineas, puntaje}}
   */
  I.interpretar = function (entrada) {
    entrada = entrada || {};
    var lineas = String(entrada.texto || '').split(/\r?\n/).map(normalizarLinea).filter(Boolean);
    var textoNorm = lineas.join('\n');
    var det = entrada.perfilId
      ? { perfil: E().obtener(entrada.perfilId), puntaje: null, manual: true }
      : detectarPerfil(textoNorm);
    var perfil = det.perfil;

    var campos = {
      producto: buscarCampo(lineas, perfil.campos.producto, 'producto'),
      cantidad: buscarCampo(lineas, perfil.campos.cantidad, 'cantidad'),
      lote: buscarCampo(lineas, perfil.campos.lote, 'lote'),
      dateCode: buscarCampo(lineas, perfil.campos.dateCode, 'dateCode')
    };

    var extras = [];
    (perfil.extras || []).forEach(function (ex) {
      var r = buscarCampo(lineas, { etiquetas: ex.etiquetas, patron: ex.patron || 'CODIGO', lineasSiguientes: ex.lineasSiguientes || 0 }, 'extra');
      if (r.valor) extras.push({ nombre: ex.nombre, valor: r.valor, fuente: 'OCR' });
    });

    var analisis = analizarCodigos(entrada.codigos, perfil);
    aplicarCodigos(campos, analisis);
    extras = extras.concat(analisis.extras);

    // Un extra igual a un campo ya asignado no se repite
    extras = extras.filter(function (x) {
      return !Object.keys(campos).some(function (k) { return campos[k].valor && claveComparacion(campos[k].valor) === claveComparacion(x.valor); });
    });

    calcularEstado(campos, perfil);

    var puntaje = 0;
    if (campos.producto.valor) puntaje += campos.producto.confianza === 'baja' ? 2 : 4;
    if (campos.cantidad.valor) puntaje += campos.cantidad.confianza === 'baja' ? 1 : 3;
    if (campos.lote.valor) puntaje += 1;
    if (det.puntaje) puntaje += Math.min(det.puntaje, 3);

    return {
      perfil: { id: perfil.id, nombre: perfil.nombre, puntaje: det.puntaje, manual: !!det.manual },
      campos: campos,
      extras: extras,
      codigos: analisis.crudos,
      lineas: lineas,
      puntaje: puntaje
    };
  };

  // Expuestas para pruebas y depuración
  I.normalizarLinea = normalizarLinea;
  I.parsearGS1 = parsearGS1;
  I.detectarPerfil = function (texto) {
    return detectarPerfil(String(texto || '').split(/\r?\n/).map(normalizarLinea).join('\n')).perfil.id;
  };

  R.Interprete = I;
})(typeof window !== 'undefined' ? window : globalThis);
