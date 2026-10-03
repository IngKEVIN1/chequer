/* =============================================================================
 * formulario.js — Ventana para REVISAR una lectura, AGREGAR un producto
 * manualmente o EDITAR una fila. Todos los campos son editables y cada uno
 * muestra de dónde salió el dato (código de barras / OCR / manual).
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  var CAMPOS = ['producto', 'cantidad', 'unidad', 'lote', 'dateCode', 'origen', 'destino', 'comentarios'];
  var IDS = {
    producto: 'campoProducto', cantidad: 'campoCantidad', unidad: 'campoUnidad', lote: 'campoLote',
    dateCode: 'campoDateCode', origen: 'campoOrigen', destino: 'campoDestino', comentarios: 'campoComentarios'
  };
  var CON_FUENTE = ['producto', 'cantidad', 'lote', 'dateCode'];

  var estado = {
    modo: 'nuevo',          // 'escaneo' | 'nuevo' | 'editar'
    filaId: null,
    detectados: {},         // { campo: { valor, fuente, estado } }
    procesando: false,
    callbacks: {},
    resolverColision: null
  };

  function $(id) { return document.getElementById(id); }
  function campo(nombre) { return $(IDS[nombre]); }

  function textoFuente(f) { return R.Productos.nombreFuente(f); }

  /** Actualiza la insignia de origen del dato y el aviso "Revisar". */
  function pintarFuente(nombre) {
    var badge = document.querySelector('[data-fuente="' + nombre + '"]');
    var nota = document.querySelector('[data-nota="' + nombre + '"]');
    var el = campo(nombre);
    if (!badge || !el) return;
    var det = estado.detectados[nombre];
    var valor = el.value.trim();
    var clase = 'insignia', texto = '', aviso = '';

    if (det && det.valor && valor === String(det.valor)) {
      texto = textoFuente(det.fuente);
      if (det.estado === 'revisar') { clase += ' insignia-revisar'; texto = 'Revisar · ' + texto; aviso = det.nota || ''; }
      else { clase += ' insignia-ok'; aviso = det.nota || ''; }
    } else if (valor) {
      texto = 'Manual';
      clase += ' insignia-manual';
    } else if (det && det.estado === 'revisar') {
      texto = 'Revisar · no detectado';
      clase += ' insignia-revisar';
      aviso = 'No se pudo leer este dato. Captúrelo manualmente.';
    } else if (estado.modo === 'escaneo' && det) {
      texto = 'No detectado';
      clase += ' insignia-vacia';
    }
    badge.className = clase;
    badge.textContent = texto;
    badge.hidden = !texto;
    el.classList.toggle('campo-revisar', badge.classList.contains('insignia-revisar'));
    if (nota) { nota.textContent = aviso; nota.hidden = !aviso; }
  }

  function pintarAlternativas(nombre, alternativas) {
    var cont = document.querySelector('[data-alternativas="' + nombre + '"]');
    if (!cont) return;
    if (!alternativas || !alternativas.length) { cont.innerHTML = ''; cont.hidden = true; return; }
    cont.hidden = false;
    cont.innerHTML = '<span class="text-secundario small me-1">Otros valores leídos:</span>' + alternativas.map(function (a) {
      return '<button type="button" class="btn btn-chip" data-usar-alternativa="' + nombre + '" data-valor="' + U.escapeHtml(a) + '">' + U.escapeHtml(a) + '</button>';
    }).join('');
  }

  function aplicarValor(nombre, valor) {
    if (nombre === 'cantidad') {
      var m = /^([\d.,]+)\s*([A-Z]{1,5})?$/i.exec(String(valor).trim());
      if (m) {
        campo('cantidad').value = m[1];
        if (m[2]) campo('unidad').value = m[2].toUpperCase();
      } else campo('cantidad').value = valor;
    } else {
      campo(nombre).value = valor;
    }
    pintarFuente(nombre);
  }

  function pintarOtrosDatos(resultado) {
    var cont = $('filaOtrosDatos');
    var items = [];
    (resultado.extras || []).forEach(function (x) { items.push({ nombre: x.nombre, valor: x.valor, fuente: x.fuente }); });
    var asignados = CON_FUENTE.map(function (k) { return String(resultado.campos[k].valor || '').toUpperCase(); });
    (resultado.codigos || []).forEach(function (c) {
      if (asignados.indexOf(String(c.texto).toUpperCase()) >= 0) return;
      if (items.some(function (i) { return i.valor === c.texto; })) return;
      items.push({ nombre: 'Código ' + (c.formato || '').replace(/_/g, ' '), valor: c.texto, fuente: 'BARCODE' });
    });
    if (!items.length) { cont.innerHTML = ''; $('filaOtrosDatosZona').hidden = true; return; }
    $('filaOtrosDatosZona').hidden = false;
    cont.innerHTML = items.map(function (it) {
      var v = U.escapeHtml(it.valor);
      return '<div class="otro-dato">' +
        '<div class="otro-dato-texto"><span class="text-secundario">' + U.escapeHtml(it.nombre) + ':</span> <strong>' + v + '</strong></div>' +
        '<div class="otro-dato-acciones">' +
          '<button type="button" class="btn btn-chip" data-asignar="lote" data-valor="' + v + '">Usar como lote</button>' +
          '<button type="button" class="btn btn-chip" data-asignar="producto" data-valor="' + v + '">Usar como producto</button>' +
          '<button type="button" class="btn btn-chip" data-asignar="comentarios" data-valor="' + U.escapeHtml(it.nombre + ': ' + it.valor) + '">A comentarios</button>' +
        '</div></div>';
    }).join('');
  }

  function pintarDiagnostico(resultado, texto) {
    var lista = (resultado && resultado.codigos) || [];
    $('filaCodigosLeidos').innerHTML = lista.length
      ? lista.map(function (c) {
          return '<li><code>' + U.escapeHtml(c.texto) + '</code> <span class="text-secundario">' +
            U.escapeHtml([c.formato, c.metodo, c.interpretacion].filter(Boolean).join(' · ')) + '</span></li>';
        }).join('')
      : '<li class="text-secundario">No se leyeron códigos de barras.</li>';
    $('filaTextoOcr').textContent = texto || '(sin texto OCR)';
  }

  function limpiarFormulario() {
    CAMPOS.forEach(function (c) { campo(c).value = ''; campo(c).classList.remove('is-invalid', 'campo-revisar'); });
    estado.detectados = {};
    CON_FUENTE.forEach(function (c) { pintarFuente(c); pintarAlternativas(c, []); });
    $('filaErrores').innerHTML = '';
    $('filaColision').innerHTML = '';
    $('filaColision').hidden = true;
    $('filaOtrosDatos').innerHTML = '';
    $('filaOtrosDatosZona').hidden = true;
    $('filaDiagnostico').hidden = true;
    $('filaResumenLectura').hidden = true;
    $('filaProgreso').hidden = true;
    $('filaPerfilDetectado').textContent = '';
    F.mostrarImagen(null);
    // Restablece botones por si la ventana se cerró a media lectura
    estado.procesando = false;
    $('filaBtnPrincipal').disabled = false;
    $('filaBtnOmitir').hidden = true;
    $('filaBtnRotar').disabled = false;
    $('filaPerfil').disabled = false;
  }

  function configurarModo(modo, numeroFila) {
    estado.modo = modo;
    var esEscaneo = modo === 'escaneo';
    $('filaZonaImagen').hidden = !esEscaneo;
    $('filaBtnEditar').hidden = !esEscaneo;
    $('filaTitulo').textContent = esEscaneo ? 'Revisar etiqueta' : (modo === 'editar' ? 'Editar fila ' + numeroFila : 'Agregar producto');
    $('filaBtnSecundario').textContent = esEscaneo ? 'Volver a escanear' : 'Cancelar';
    $('filaBtnPrincipal').textContent = esEscaneo ? 'Aceptar' : (modo === 'editar' ? 'Guardar cambios' : 'Agregar');
  }

  function poblarPerfiles() {
    var sel = $('filaPerfil');
    sel.innerHTML = '<option value="">Detectar automáticamente</option>' + R.Etiquetas.PERFILES.map(function (p) {
      return '<option value="' + U.escapeHtml(p.id) + '">' + U.escapeHtml(p.nombre) + '</option>';
    }).join('');
  }

  var F = {};

  F.init = function (callbacks) {
    estado.callbacks = callbacks || {};
    poblarPerfiles();
    // Datalist de unidades
    $('listaUnidades').innerHTML = R.Etiquetas.UNIDADES.map(function (u) { return '<option value="' + u + '">'; }).join('');

    CAMPOS.forEach(function (c) {
      campo(c).addEventListener('input', function () {
        campo(c).classList.remove('is-invalid');
        if (CON_FUENTE.indexOf(c) >= 0) pintarFuente(c);
      });
    });
    // Mayúsculas en códigos al salir del campo
    ['producto', 'lote', 'unidad', 'origen', 'destino'].forEach(function (c) {
      campo(c).addEventListener('blur', function () {
        var v = campo(c).value.trim();
        var forzar = (c === 'origen' || c === 'destino') ? root.APP_CONFIG.UBICACIONES.FORZAR_MAYUSCULAS : true;
        campo(c).value = forzar ? v.toUpperCase() : v;
        if (CON_FUENTE.indexOf(c) >= 0) pintarFuente(c);
      });
    });

    $('modalFila').addEventListener('click', function (ev) {
      var alt = ev.target.closest('[data-usar-alternativa]');
      if (alt) { aplicarValor(alt.getAttribute('data-usar-alternativa'), alt.getAttribute('data-valor')); return; }
      var asig = ev.target.closest('[data-asignar]');
      if (asig) {
        var destino = asig.getAttribute('data-asignar'), valor = asig.getAttribute('data-valor');
        if (destino === 'comentarios') {
          var actual = campo('comentarios').value.trim();
          if (actual.indexOf(valor) === -1) campo('comentarios').value = actual ? actual + ' | ' + valor : valor;
        } else {
          aplicarValor(destino, valor);
        }
        R.UI.toast('Asignado a ' + destino + ': ' + valor, 'info', { duracion: 2000 });
      }
    });

    $('filaBtnPrincipal').addEventListener('click', function () { F.guardar(); });
    $('filaBtnSecundario').addEventListener('click', function () {
      if (estado.modo === 'escaneo' && estado.callbacks.alReescanear) estado.callbacks.alReescanear();
      else F.cerrar();
    });
    $('filaBtnEditar').addEventListener('click', function () { F.enfocarPendiente(); });
    $('filaBtnRotar').addEventListener('click', function () { if (estado.callbacks.alRotar) estado.callbacks.alRotar(); });
    $('filaBtnOmitir').addEventListener('click', function () { if (estado.callbacks.alOmitir) estado.callbacks.alOmitir(); });
    $('filaPerfil').addEventListener('change', function () {
      if (estado.callbacks.alCambiarPerfil) estado.callbacks.alCambiarPerfil($('filaPerfil').value);
    });
    $('btnEscanearOrigen').addEventListener('click', function () { if (estado.callbacks.alEscanearUbicacion) estado.callbacks.alEscanearUbicacion('origen'); });
    $('btnEscanearDestino').addEventListener('click', function () { if (estado.callbacks.alEscanearUbicacion) estado.callbacks.alEscanearUbicacion('destino'); });
    $('formFila').addEventListener('submit', function (ev) { ev.preventDefault(); F.guardar(); });
    $('modalFila').addEventListener('hidden.bs.modal', function () {
      if (estado.resolverColision) { estado.resolverColision('cancelar'); estado.resolverColision = null; }
      if (estado.callbacks.alCerrar) estado.callbacks.alCerrar();
    });
  };

  /**
   * Abre la ventana.
   * @param {{modo:string, fila?:Object, numeroFila?:number, origenSugerido?:string}} op
   */
  F.abrir = function (op) {
    limpiarFormulario();
    configurarModo(op.modo, op.numeroFila);
    estado.filaId = op.fila ? op.fila.id : null;
    $('filaPerfil').value = '';
    if (op.fila) {
      var f = op.fila;
      campo('producto').value = f.producto || '';
      campo('cantidad').value = f.cantidad != null && f.cantidad !== 0 ? String(f.cantidad) : '';
      campo('unidad').value = f.unidad || '';
      campo('lote').value = f.lote || '';
      campo('dateCode').value = f.dateCode || '';
      campo('origen').value = f.origen || '';
      campo('destino').value = f.destino || '';
      campo('comentarios').value = f.comentarios || '';
      estado.detectados = {
        producto: { valor: f.producto, fuente: f.fuentes.producto, estado: 'ok' },
        cantidad: { valor: String(f.cantidad), fuente: f.fuentes.cantidad, estado: 'ok' },
        lote: { valor: f.lote, fuente: f.fuentes.lote, estado: 'ok' }
      };
      CON_FUENTE.forEach(pintarFuente);
    } else {
      campo('origen').value = op.origenSugerido || '';
    }
    if (op.previos) {
      ['origen', 'destino', 'comentarios'].forEach(function (k) { if (op.previos[k]) campo(k).value = op.previos[k]; });
    }
    F.habilitarCampos(op.modo !== 'escaneo');
    R.UI.modal('modalFila').show();
    if (op.modo === 'nuevo') {
      var foco = function () { $('modalFila').removeEventListener('shown.bs.modal', foco); campo('producto').focus(); };
      $('modalFila').addEventListener('shown.bs.modal', foco);
    }
  };

  /** Limpia solo los datos leídos (para volver a escanear) y conserva ubicaciones y comentarios. */
  F.limpiarLectura = function () {
    ['producto', 'cantidad', 'unidad', 'lote', 'dateCode'].forEach(function (c) { campo(c).value = ''; campo(c).classList.remove('is-invalid', 'campo-revisar'); });
    estado.detectados = {};
    CON_FUENTE.forEach(function (c) { pintarFuente(c); pintarAlternativas(c, []); });
    $('filaErrores').innerHTML = '';
    $('filaOtrosDatos').innerHTML = '';
    $('filaOtrosDatosZona').hidden = true;
    $('filaDiagnostico').hidden = true;
    $('filaResumenLectura').hidden = true;
    $('filaPerfil').value = '';
    $('filaPerfilDetectado').textContent = '';
  };

  /** Valores de ubicación/comentarios escritos (para conservarlos al re-escanear). */
  F.valoresPrevios = function () {
    return { origen: campo('origen').value.trim(), destino: campo('destino').value.trim(), comentarios: campo('comentarios').value.trim() };
  };

  F.estaAbierto = function () { return $('modalFila').classList.contains('show'); };

  F.cerrar = function () { R.UI.ocultar('modalFila'); };

  F.mostrarImagen = function (url) {
    var img = $('filaVistaPrevia');
    if (url) { img.src = url; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
  };

  /** Muestra el avance de la lectura. porcentaje = null para barra indeterminada. */
  F.mostrarProcesando = function (texto, porcentaje) {
    estado.procesando = true;
    $('filaProgreso').hidden = false;
    $('filaProgresoTexto').textContent = texto;
    var barra = $('filaProgresoBarra');
    if (porcentaje == null) { barra.style.width = '100%'; barra.classList.add('progress-bar-animated', 'progress-bar-striped'); }
    else { barra.style.width = Math.round(porcentaje) + '%'; barra.classList.remove('progress-bar-animated', 'progress-bar-striped'); }
    $('filaBtnOmitir').hidden = false;
    $('filaBtnRotar').disabled = true;
    $('filaPerfil').disabled = true;
    $('filaBtnPrincipal').disabled = true;
  };

  F.terminarProcesando = function (mensaje, tipo) {
    estado.procesando = false;
    $('filaProgreso').hidden = true;
    $('filaBtnOmitir').hidden = true;
    $('filaBtnRotar').disabled = false;
    $('filaPerfil').disabled = false;
    $('filaBtnPrincipal').disabled = false;
    var zona = $('filaResumenLectura');
    if (mensaje) {
      zona.className = 'resumen-lectura resumen-' + (tipo || 'info');
      zona.textContent = mensaje;
      zona.hidden = false;
    } else zona.hidden = true;
    F.habilitarCampos(true);
  };

  F.habilitarCampos = function (habilitar) {
    CAMPOS.forEach(function (c) { campo(c).disabled = !habilitar; });
    $('btnEscanearOrigen').disabled = !habilitar;
    $('btnEscanearDestino').disabled = !habilitar;
  };

  /** Rellena los campos con el resultado del intérprete. */
  F.cargarResultado = function (resultado, textoOcr) {
    var c = resultado.campos;
    estado.detectados = {};
    CON_FUENTE.forEach(function (k) {
      estado.detectados[k] = { valor: c[k].valor, fuente: c[k].fuente, estado: c[k].estado, nota: c[k].nota };
      campo(k).value = c[k].valor || '';
      campo(k).classList.remove('is-invalid');
      pintarFuente(k);
      pintarAlternativas(k, c[k].alternativas);
    });
    if (c.cantidad.unidad) campo('unidad').value = c.cantidad.unidad;
    $('filaPerfil').value = resultado.perfil.manual ? resultado.perfil.id : '';
    $('filaPerfilDetectado').textContent = resultado.perfil.manual ? '' : 'Detectado: ' + resultado.perfil.nombre;
    pintarOtrosDatos(resultado);
    pintarDiagnostico(resultado, textoOcr);
    $('filaDiagnostico').hidden = false;
  };

  /** Botón EDITAR: lleva el cursor al primer dato que requiere revisión. */
  F.enfocarPendiente = function () {
    var orden = ['producto', 'cantidad', 'lote', 'destino'];
    var objetivo = orden.find(function (k) { return campo(k).classList.contains('campo-revisar') || !campo(k).value.trim(); }) || 'producto';
    campo(objetivo).focus();
    campo(objetivo).select && campo(objetivo).select();
  };

  F.asignarUbicacion = function (nombre, valor) {
    campo(nombre).value = valor;
    campo(nombre).classList.remove('is-invalid');
  };

  /** Lee y valida los datos del formulario. */
  F.leerDatos = function () {
    var errores = [];
    var v = {};
    CAMPOS.forEach(function (c) { v[c] = campo(c).value.trim(); });
    if (!v.producto) { errores.push('Capture el producto.'); campo('producto').classList.add('is-invalid'); }
    var cant = R.Productos.parsearCantidad(v.cantidad);
    if (!cant.ok) { errores.push('Cantidad: ' + cant.mensaje); campo('cantidad').classList.add('is-invalid'); }

    var fuentes = {};
    ['producto', 'cantidad', 'lote'].forEach(function (k) {
      var det = estado.detectados[k];
      var actual = k === 'cantidad' ? (cant.ok ? String(cant.valor) : v.cantidad) : v[k].toUpperCase();
      var detectado = det && det.valor != null ? (k === 'cantidad' ? String(R.Productos.parsearCantidad(det.valor).valor) : String(det.valor).toUpperCase()) : null;
      fuentes[k] = (det && det.fuente && detectado === actual && actual) ? det.fuente : (actual ? 'MANUAL' : '');
    });

    return {
      errores: errores,
      datos: {
        id: estado.filaId,
        producto: v.producto,
        cantidad: cant.ok ? cant.valor : 0,
        unidad: v.unidad,
        lote: v.lote,
        dateCode: v.dateCode,
        origen: v.origen,
        destino: v.destino,
        comentarios: v.comentarios,
        fuentes: fuentes
      }
    };
  };

  F.guardar = function () {
    if (estado.procesando) return;
    var r = F.leerDatos();
    if (r.errores.length) {
      $('filaErrores').innerHTML = '<div class="alert alert-danger py-2 mb-3" role="alert">' + r.errores.map(U.escapeHtml).join('<br>') + '</div>';
      var primero = document.querySelector('#formFila .is-invalid');
      if (primero) primero.focus();
      return;
    }
    $('filaErrores').innerHTML = '';
    if (estado.callbacks.alGuardar) estado.callbacks.alGuardar(r.datos, { modo: estado.modo, detectados: estado.detectados });
  };

  /**
   * Pregunta (dentro de la misma ventana) si combinar con una fila existente.
   * @returns {Promise<'combinar'|'separar'|'cancelar'>}
   */
  F.preguntarColision = function (numeroFila) {
    return new Promise(function (resolve) {
      estado.resolverColision = resolve;
      var z = $('filaColision');
      z.hidden = false;
      z.innerHTML = '<div class="alert alert-warning mb-3" role="alert">' +
        '<div class="fw-semibold mb-2">La fila ' + numeroFila + ' tiene el mismo producto y lote.</div>' +
        '<div class="d-flex flex-wrap gap-2">' +
          '<button type="button" class="btn btn-primario" data-colision="combinar">Sumar en la fila ' + numeroFila + '</button>' +
          '<button type="button" class="btn btn-secundario" data-colision="separar">Mantener separadas</button>' +
        '</div></div>';
      z.querySelectorAll('[data-colision]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = b.getAttribute('data-colision');
          estado.resolverColision = null;
          z.hidden = true; z.innerHTML = '';
          resolve(r);
        });
      });
      z.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  R.Formulario = F;
})(window);
