/* =============================================================================
 * app.js — Controlador principal: estado del movimiento, tabla, botones,
 * validaciones, exportaciones, recuperación y modo sin conexión.
 * Configuración editable: config.js (no es necesario modificar este archivo).
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion;
  var U = R.Utils, P = R.Productos, UI = R.UI;
  var C = root.APP_CONFIG;

  var estado = {
    mov: null,
    guardadoHabilitado: false,
    avisoGuardadoMostrado: false,
    actualizacionSolicitada: false,
    eventoInstalacion: null
  };

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return U.formatearNumero(n); }

  // ---------------------------------------------------------------------------
  // Guardado automático
  // ---------------------------------------------------------------------------
  var guardar = U.debounce(function () {
    if (!estado.guardadoHabilitado || !estado.mov) return;
    if (!R.Storage.guardarMovimiento(estado.mov) && !estado.avisoGuardadoMostrado) {
      estado.avisoGuardadoMostrado = true;
      UI.toast('No se pudo guardar en este dispositivo (memoria llena o navegación privada). Si cierra la app se perderá el movimiento.', 'aviso', { duracion: 10000 });
    }
  }, 300);

  /** Registro de eventos (DETALLES DE CAPTURA). */
  function registrar(tipo, datos) {
    var ev = Object.assign({ fecha: new Date().toISOString(), tipo: tipo }, datos || {});
    estado.mov.eventos.unshift(ev);
    if (estado.mov.eventos.length > C.ALMACENAMIENTO.MAX_EVENTOS_REGISTRO) estado.mov.eventos.length = C.ALMACENAMIENTO.MAX_EVENTOS_REGISTRO;
    renderEventos();
  }

  // ---------------------------------------------------------------------------
  // Apariencia (colores, textos y logo desde config.js)
  // ---------------------------------------------------------------------------
  function aplicarConfiguracionVisual() {
    var s = document.documentElement.style;
    s.setProperty('--color-primario', C.COLORES.PRIMARIO);
    s.setProperty('--color-primario-oscuro', C.COLORES.PRIMARIO_OSCURO);
    s.setProperty('--color-secundario', C.COLORES.SECUNDARIO);
    s.setProperty('--color-gris-claro', C.COLORES.GRIS_CLARO);
    s.setProperty('--color-borde', C.COLORES.BORDE);
    var rgb = U.hexARgb(C.COLORES.PRIMARIO);
    s.setProperty('--color-primario-rgb', rgb.join(','));

    document.title = C.TEXTOS.TITULO_APP + ' | ' + C.EMPRESA.NOMBRE;
    $('tituloApp').textContent = C.TEXTOS.TITULO_APP;
    $('subtituloApp').textContent = C.TEXTOS.SUBTITULO;
    $('tituloFormato').textContent = C.TEXTOS.TITULO_FORMATO;
    $('versionApp').textContent = C.VERSION;
    $('empresaPie').textContent = C.EMPRESA.NOMBRE;

    var logo = $('logoApp');
    $('logoTexto').textContent = C.EMPRESA.NOMBRE;
    logo.alt = C.LOGO.TEXTO_ALTERNATIVO;
    logo.onerror = function () { logo.hidden = true; $('logoTexto').hidden = false; };
    logo.onload = function () { logo.hidden = false; $('logoTexto').hidden = true; };
    logo.src = C.LOGO.RUTA;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function renderEncabezado() {
    $('inpReferencia').value = estado.mov.referencia;
    $('inpFecha').value = estado.mov.fecha;
    $('inpMontacarguista').value = estado.mov.montacarguista;
    renderEspejos();
  }

  function renderEspejos() {
    $('espejoReferencia').textContent = estado.mov.referencia || '—';
    $('espejoMontacarguista').textContent = estado.mov.montacarguista || '';
    $('espejoFecha').textContent = U.fechaDMY(estado.mov.fecha);
  }

  function comentariosHTML(f) {
    var partes = [];
    if (f.lote) partes.push('<span class="chip-dato chip-lote">Lote: ' + U.escapeHtml(f.lote) + '</span>');
    if (f.dateCode) partes.push('<span class="chip-dato">Date Code: ' + U.escapeHtml(f.dateCode) + '</span>');
    if (f.comentarios) partes.push('<span class="texto-comentario">' + U.escapeHtml(f.comentarios) + '</span>');
    return partes.join(' ') || '<span class="text-secundario">—</span>';
  }

  function filaHTML(f, i) {
    var n = i + 1;
    var inputUbic = function (campo, valor, placeholder) {
      return '<input type="text" class="form-control input-tabla' + (campo === 'destino' ? ' input-destino' : '') + '" data-campo="' + campo + '"' +
        ' value="' + U.escapeHtml(valor) + '" placeholder="' + placeholder + '" aria-label="' + placeholder + ' fila ' + n + '"' +
        ' autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="next">';
    };
    return '<tr data-id="' + f.id + '">' +
      '<td class="col-num" data-label="Fila">' + n + '</td>' +
      '<td class="col-producto" data-label="Producto">' +
        (f.producto ? '<span class="valor-producto">' + U.escapeHtml(f.producto) + '</span>' : '<span class="falta">Sin producto</span>') +
        '<span class="metodo" title="Método de captura">' + U.escapeHtml(P.nombreFuente(f.fuentes.producto)) + (f.escaneos > 1 ? ' · ' + f.escaneos + ' lecturas' : '') + '</span>' +
      '</td>' +
      '<td class="col-cantidad" data-label="Cantidad"><span class="valor-cantidad">' + fmt(f.cantidad) + '</span>' +
        (f.unidad ? ' <span class="unidad">' + U.escapeHtml(f.unidad) + '</span>' : '') + '</td>' +
      '<td class="col-origen" data-label="Ubicación origen">' + inputUbic('origen', f.origen, 'Origen') + '</td>' +
      '<td class="col-a" aria-hidden="true">A</td>' +
      '<td class="col-destino" data-label="Ubicación destino">' + inputUbic('destino', f.destino, 'Destino') + '</td>' +
      '<td class="col-comentarios" data-label="Comentarios">' + comentariosHTML(f) + '</td>' +
      '<td class="col-acciones"><div class="acciones-fila">' +
        '<button type="button" class="btn btn-accion" data-accion="editar">Editar</button>' +
        '<button type="button" class="btn btn-accion" data-accion="dividir"' + (f.cantidad > 0 ? '' : ' disabled') + '>Dividir</button>' +
        '<button type="button" class="btn btn-accion btn-accion-peligro" data-accion="eliminar">Eliminar</button>' +
      '</div></td>' +
    '</tr>';
  }

  function renderTabla() {
    var filas = estado.mov.filas;
    $('cuerpoTabla').innerHTML = filas.map(filaHTML).join('');
    $('estadoVacio').hidden = filas.length > 0;
    $('tablaProductos').hidden = filas.length === 0;
    $('btnDestinoMasivo').hidden = filas.length === 0;
    var sinDestino = filas.filter(function (f) { return !String(f.destino || '').trim(); }).length;
    $('contadorFilas').textContent = filas.length === 0 ? 'Sin productos'
      : filas.length + (filas.length === 1 ? ' fila' : ' filas') + (sinDestino ? ' · ' + sinDestino + ' sin destino' : ' · todas con destino');
  }

  function resaltarFila(id) {
    var tr = document.querySelector('#cuerpoTabla tr[data-id="' + id + '"]');
    if (!tr) return;
    tr.classList.add('fila-resaltada');
    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { tr.classList.remove('fila-resaltada'); }, 2200);
  }

  var NOMBRES_EVENTO = {
    ESCANEO: 'Escaneo', MANUAL: 'Captura manual', SUMA: 'Suma automática', EDICION: 'Edición',
    DIVISION: 'División', ELIMINACION: 'Eliminación', LIMPIEZA: 'Hoja limpiada', PDF: 'PDF generado',
    EXCEL: 'Excel generado', CORREO: 'Envío', RECUPERADO: 'Movimiento recuperado', DESTINO: 'Destino masivo'
  };

  function renderEventos() {
    var ev = estado.mov.eventos;
    $('contadorEventos').textContent = ev.length;
    if (!ev.length) { $('listaEventos').innerHTML = '<li class="text-secundario">Todavía no hay eventos.</li>'; return; }
    $('listaEventos').innerHTML = ev.map(function (e) {
      var lineas = [];
      if (e.producto != null) lineas.push(['Producto detectado', e.producto, e.metodos && e.metodos.producto]);
      if (e.cantidad != null) lineas.push(['Cantidad detectada', fmt(e.cantidad) + (e.total != null && e.total !== e.cantidad ? ' (total en fila: ' + fmt(e.total) + ')' : ''), e.metodos && e.metodos.cantidad]);
      if (e.lote != null) lineas.push(['Lote detectado', e.lote || '(sin lote)', e.metodos && e.metodos.lote]);
      return '<li class="evento">' +
        '<div class="evento-cabecera"><span class="evento-tipo">' + U.escapeHtml(NOMBRES_EVENTO[e.tipo] || e.tipo) + '</span>' +
        '<span class="text-secundario">' + U.horaCorta(e.fecha) + (e.fila ? ' · Fila ' + e.fila : '') + '</span></div>' +
        (lineas.length ? '<dl class="evento-datos">' + lineas.map(function (l) {
          return '<dt>' + l[0] + ':</dt><dd>' + U.escapeHtml(l[1]) + (l[2] ? ' <span class="metodo-evento">' + U.escapeHtml(P.nombreFuente(l[2])) + '</span>' : '') + '</dd>';
        }).join('') + '</dl>' : '') +
        (e.perfil ? '<div class="small text-secundario">Tipo de etiqueta: ' + U.escapeHtml(e.perfil) + '</div>' : '') +
        (e.codigos && e.codigos.length ? '<div class="small text-secundario">Códigos leídos: ' + e.codigos.map(U.escapeHtml).join(', ') + '</div>' : '') +
        (e.nota ? '<div class="small">' + U.escapeHtml(e.nota) + '</div>' : '') +
      '</li>';
    }).join('');
  }

  function renderTodo() {
    renderEncabezado();
    renderTabla();
    renderEventos();
  }

  // ---------------------------------------------------------------------------
  // Validación visual
  // ---------------------------------------------------------------------------
  function limpiarMarcas() {
    document.querySelectorAll('.is-invalid').forEach(function (el) {
      if (!el.closest('.modal')) el.classList.remove('is-invalid');
    });
    document.querySelectorAll('#cuerpoTabla tr.fila-error').forEach(function (tr) { tr.classList.remove('fila-error'); });
  }

  function validar() {
    UI.limpiarAlerta('zonaValidacion');
    limpiarMarcas();
    var errores = P.validarMovimiento(estado.mov);
    if (!errores.length) return true;
    var mensajes = errores.slice(0, 12).map(function (e) { return e.mensaje; });
    if (errores.length > 12) mensajes.push('…y ' + (errores.length - 12) + ' observaciones más.');
    UI.alerta('zonaValidacion', { tipo: 'danger', titulo: 'No se puede generar el documento. Corrija lo siguiente:', mensajes: mensajes });

    var primero = null;
    errores.forEach(function (e) {
      var el = null;
      if (e.campo === 'referencia') el = $('inpReferencia');
      else if (e.campo === 'fecha') el = $('inpFecha');
      else if (e.campo === 'montacarguista') el = $('inpMontacarguista');
      else if (e.id) {
        var tr = document.querySelector('#cuerpoTabla tr[data-id="' + e.id + '"]');
        if (tr) {
          tr.classList.add('fila-error');
          el = tr.querySelector('[data-campo="' + e.campo + '"]');
        }
      }
      if (el) { el.classList.add('is-invalid'); if (!primero) primero = el; }
    });
    $('zonaValidacion').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (primero && primero.tagName === 'INPUT') setTimeout(function () { primero.focus({ preventScroll: true }); }, 400);
    return false;
  }

  /** Copia limpia del movimiento para exportar. */
  function snapshot() {
    var m = JSON.parse(JSON.stringify(estado.mov));
    m.referencia = String(m.referencia || '').trim();
    m.montacarguista = String(m.montacarguista || '').trim();
    return m;
  }

  // ---------------------------------------------------------------------------
  // Productos: agregar, sumar, editar, dividir, eliminar
  // ---------------------------------------------------------------------------
  function alGuardarFormulario(datos, ctx) {
    if (ctx.modo === 'editar') { guardarEdicion(datos); return; }
    var res = P.agregarOSumar(estado.mov.filas, datos);
    estado.mov.filas = res.filas;
    if (datos.origen && C.CAPTURA.RECORDAR_ULTIMO_ORIGEN) estado.mov.ultimoOrigen = datos.origen.toUpperCase();
    var lectura = ctx.modo === 'escaneo' ? R.Scanner.contextoUltimaLectura() : null;
    registrar(res.accion === 'sumada' ? 'SUMA' : (ctx.modo === 'escaneo' ? 'ESCANEO' : 'MANUAL'), {
      fila: res.indice + 1,
      producto: res.fila.producto,
      cantidad: res.cantidadAgregada,
      total: res.fila.cantidad,
      lote: P.limpiarCodigo(datos.lote),
      metodos: datos.fuentes,
      perfil: lectura && lectura.perfil,
      codigos: lectura && lectura.codigos
    });
    R.Formulario.cerrar();
    renderTabla();
    resaltarFila(res.fila.id);
    guardar();
    UI.limpiarAlerta('zonaValidacion');

    var siguiente = { texto: 'Escanear siguiente', fn: function () { R.Scanner.escanear(); } };
    if (res.accion === 'sumada') {
      UI.toast('Mismo producto y lote: se sumaron ' + fmt(res.cantidadAgregada) + ' a la fila ' + (res.indice + 1) + ' (total ' + fmt(res.fila.cantidad) + ').', 'exito', { accion: siguiente, duracion: 6000 });
    } else {
      UI.toast('Producto agregado en la fila ' + (res.indice + 1) + '.', 'exito', { accion: siguiente, duracion: 5000 });
    }
    res.advertencias.forEach(function (a) { UI.toast(a, 'aviso', { duracion: 10000 }); });
  }

  async function guardarEdicion(datos) {
    var filas = estado.mov.filas;
    var idx = filas.findIndex(function (f) { return f.id === datos.id; });
    if (idx < 0) { UI.toast('La fila ya no existe.', 'error'); R.Formulario.cerrar(); return; }
    var anterior = filas[idx];
    var nueva = P.crearFila(Object.assign({}, datos, { id: anterior.id, escaneos: anterior.escaneos }));
    var copia = filas.slice();
    copia[idx] = nueva;
    var nota = '';
    var cambioClave = P.claveAgrupacion(anterior) !== P.claveAgrupacion(nueva) || P.normalizarClave(anterior.unidad) !== P.normalizarClave(nueva.unidad);
    if (cambioClave) {
      var otra = P.buscarFilaParaSumar(copia, nueva, nueva.id);
      if (otra >= 0) {
        var decision = await R.Formulario.preguntarColision(otra + 1);
        if (decision === 'cancelar') return;
        if (decision === 'combinar') {
          var r = P.combinarFilas(copia, copia[otra].id, nueva.id);
          copia = r.filas;
          nota = 'Combinada con la fila ' + (otra + 1) + '.';
          r.advertencias.forEach(function (a) { UI.toast(a, 'aviso', { duracion: 10000 }); });
        }
      }
    }
    estado.mov.filas = copia;
    registrar('EDICION', { fila: idx + 1, producto: nueva.producto, cantidad: nueva.cantidad, lote: nueva.lote, metodos: nueva.fuentes, nota: nota });
    R.Formulario.cerrar();
    renderTabla();
    resaltarFila(nota ? copia[Math.min(idx, copia.length - 1)].id : nueva.id);
    guardar();
    UI.toast(nota || 'Fila ' + (idx + 1) + ' actualizada.', 'exito');
  }

  function editarFila(id) {
    var i = estado.mov.filas.findIndex(function (f) { return f.id === id; });
    if (i < 0) return;
    R.Formulario.abrir({ modo: 'editar', fila: estado.mov.filas[i], numeroFila: i + 1 });
  }

  async function dividirFila(id) {
    var i = estado.mov.filas.findIndex(function (f) { return f.id === id; });
    if (i < 0) return;
    var f = estado.mov.filas[i];
    var valor = await UI.pedirValor({
      titulo: 'Dividir fila ' + (i + 1),
      etiqueta: '¿Qué cantidad pasa a una fila nueva? (cantidad actual: ' + fmt(f.cantidad) + ')',
      tipo: 'text',
      inputmode: 'decimal',
      aceptar: 'Dividir',
      ayuda: 'La fila nueva copia producto, lote y ubicaciones. Después puede cambiar su destino o lote con Editar.',
      validar: function (v) {
        var c = P.parsearCantidad(v);
        if (!c.ok) return c.mensaje;
        if (c.valor >= Number(f.cantidad)) return 'Debe ser menor que ' + fmt(f.cantidad) + '.';
        return null;
      }
    });
    if (valor === null) return;
    try {
      var r = P.dividirFila(estado.mov.filas, id, P.parsearCantidad(valor).valor);
      estado.mov.filas = r.filas;
      registrar('DIVISION', { fila: i + 1, producto: f.producto, cantidad: P.parsearCantidad(valor).valor, lote: f.lote, nota: 'Separada en la fila ' + (r.indiceNueva + 1) + '.' });
      renderTabla();
      resaltarFila(r.filas[r.indiceNueva].id);
      guardar();
      UI.toast('Fila dividida: la cantidad separada está en la fila ' + (r.indiceNueva + 1) + '.', 'exito');
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  }

  async function eliminarFila(id) {
    var i = estado.mov.filas.findIndex(function (f) { return f.id === id; });
    if (i < 0) return;
    var f = estado.mov.filas[i];
    var ok = await UI.confirmar({
      titulo: 'Eliminar fila ' + (i + 1),
      mensaje: '¿Eliminar ' + (f.producto || 'esta fila') + ' (cantidad ' + fmt(f.cantidad) + (f.lote ? ', lote ' + f.lote : '') + ')?',
      aceptar: 'Eliminar', peligro: true
    });
    if (!ok) return;
    var respaldo = JSON.parse(JSON.stringify(f));
    estado.mov.filas = estado.mov.filas.filter(function (x) { return x.id !== id; });
    registrar('ELIMINACION', { fila: i + 1, producto: f.producto, cantidad: f.cantidad, lote: f.lote });
    renderTabla();
    guardar();
    UI.toast('Fila eliminada.', 'info', {
      duracion: 8000,
      accion: { texto: 'Deshacer', fn: function () {
        var copia = estado.mov.filas.slice();
        copia.splice(Math.min(i, copia.length), 0, respaldo);
        estado.mov.filas = copia;
        renderTabla(); resaltarFila(respaldo.id); guardar();
      } }
    });
  }

  async function destinoMasivo() {
    var pendientes = estado.mov.filas.filter(function (f) { return !String(f.destino || '').trim(); });
    if (!pendientes.length) { UI.toast('Todas las filas ya tienen ubicación destino.', 'info'); return; }
    var v = await UI.pedirValor({
      titulo: 'Asignar ubicación destino',
      etiqueta: 'Ubicación destino para las ' + pendientes.length + ' fila(s) sin destino',
      aceptar: 'Asignar',
      ayuda: 'Solo se llenan las filas vacías. Las que ya tienen destino no cambian.'
    });
    if (v === null) return;
    var valor = C.UBICACIONES.FORZAR_MAYUSCULAS ? v.toUpperCase() : v;
    estado.mov.filas.forEach(function (f) { if (!String(f.destino || '').trim()) f.destino = valor; });
    registrar('DESTINO', { nota: 'Destino ' + valor + ' asignado a ' + pendientes.length + ' fila(s).' });
    renderTabla();
    guardar();
    UI.toast('Destino ' + valor + ' asignado a ' + pendientes.length + ' fila(s).', 'exito');
  }

  // ---------------------------------------------------------------------------
  // Exportaciones
  // ---------------------------------------------------------------------------
  async function generarPDF() {
    if (!validar()) return;
    UI.cargando('Generando PDF…');
    try {
      var r = await R.ExportPDF.generar(snapshot());
      UI.ocultarCargando();
      registrar('PDF', { nota: r.nombre });
      guardar();
      UI.mostrarDocumento({ titulo: 'PDF listo', blob: r.blob, nombre: r.nombre, esPdf: true });
    } catch (e) {
      UI.ocultarCargando();
      console.error(e);
      UI.alerta('zonaValidacion', { tipo: 'danger', titulo: 'No se pudo generar el PDF', mensajes: [e.message || String(e)] });
    }
  }

  async function descargarExcel() {
    if (!validar()) return;
    UI.cargando('Generando Excel…');
    try {
      var r = await R.ExportExcel.generar(snapshot());
      UI.ocultarCargando();
      U.descargarBlob(r.blob, r.nombre);
      registrar('EXCEL', { nota: r.nombre });
      guardar();
      UI.mostrarDocumento({ titulo: 'Excel listo', blob: r.blob, nombre: r.nombre, esPdf: false, descargado: true });
    } catch (e) {
      UI.ocultarCargando();
      console.error(e);
      UI.alerta('zonaValidacion', { tipo: 'danger', titulo: 'No se pudo generar el Excel', mensajes: [e.message || String(e)] });
    }
  }

  function enviarCorreo() {
    if (!validar()) return;
    var s = snapshot();
    R.Email.abrir(s, async function () {
      var pdf = await R.ExportPDF.generar(s);
      var excel = await R.ExportExcel.generar(s);
      return { pdf: pdf, excel: excel };
    });
  }

  // ---------------------------------------------------------------------------
  // Limpiar / nuevo / recuperar
  // ---------------------------------------------------------------------------
  async function limpiarHoja() {
    if (!estado.mov.filas.length) { UI.toast('La hoja ya está vacía.', 'info'); return; }
    var ok = await UI.confirmar({
      titulo: 'Limpiar hoja',
      mensaje: '¿Está seguro de limpiar el movimiento actual? Se eliminarán todos los productos capturados.',
      aceptar: 'Limpiar', cancelar: 'Cancelar', peligro: true
    });
    if (!ok) return;
    var n = estado.mov.filas.length;
    estado.mov.filas = [];
    registrar('LIMPIEZA', { nota: n + ' fila(s) eliminadas.' });
    UI.limpiarAlerta('zonaValidacion');
    renderTabla();
    guardar();
    UI.toast('Hoja limpia. Se conservaron referencia, fecha y montacarguista.', 'info');
  }

  async function nuevoMovimiento() {
    if (P.tieneDatos(estado.mov)) {
      var ok = await UI.confirmar({
        titulo: 'Nuevo movimiento',
        mensaje: '¿Iniciar un movimiento nuevo? Se borrarán la referencia y todos los productos del movimiento actual. Si aún no lo exportó, hágalo antes.',
        aceptar: 'Iniciar nuevo', peligro: true
      });
      if (!ok) return;
    }
    var montacarguista = estado.mov.montacarguista;
    estado.mov = P.crearMovimiento();
    estado.mov.montacarguista = montacarguista;
    UI.limpiarAlerta('zonaValidacion');
    limpiarMarcas();
    renderTodo();
    guardar();
    $('inpReferencia').focus();
    UI.toast('Movimiento nuevo con fecha de hoy.' + (montacarguista ? ' Se conservó el montacarguista.' : ''), 'info');
  }

  /** Normaliza un movimiento guardado (por si viene de una versión anterior). */
  function normalizarMovimiento(m) {
    var base = P.crearMovimiento();
    var r = Object.assign(base, m);
    r.filas = (m.filas || []).map(function (f) { return P.crearFila(f); });
    r.eventos = Array.isArray(m.eventos) ? m.eventos : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '')) r.fecha = U.hoyISO();
    return r;
  }

  async function iniciarMovimiento() {
    var guardado = R.Storage.cargarMovimiento();
    estado.mov = P.crearMovimiento();
    if (guardado && P.tieneDatos(guardado)) {
      renderTodo();
      var cuando = guardado.actualizado ? new Date(guardado.actualizado) : null;
      var detalle = 'Referencia: ' + (guardado.referencia || '(sin referencia)') + '\n' +
        'Productos: ' + (guardado.filas || []).length + '\n' +
        (cuando && !isNaN(cuando) ? 'Último cambio: ' + U.fechaDMY(guardado.actualizado.slice(0, 10)) + ' ' + U.horaCorta(guardado.actualizado) : '');
      var recuperar = await UI.confirmar({
        titulo: 'Movimiento sin finalizar',
        mensaje: 'Hay un movimiento sin finalizar. ¿Desea recuperarlo?\n\n' + detalle,
        aceptar: 'Recuperar', cancelar: 'Descartar'
      });
      if (!recuperar) {
        var seguro = await UI.confirmar({
          titulo: 'Descartar movimiento',
          mensaje: 'El movimiento anterior se eliminará definitivamente. ¿Continuar?',
          aceptar: 'Sí, descartar', cancelar: 'No, recuperarlo', peligro: true
        });
        recuperar = !seguro;
      }
      if (recuperar) {
        estado.mov = normalizarMovimiento(guardado);
        registrar('RECUPERADO');
        UI.toast('Movimiento recuperado.', 'exito');
      } else {
        R.Storage.borrarMovimiento();
      }
    }
    estado.guardadoHabilitado = true;
    renderTodo();
    guardar();
  }

  // ---------------------------------------------------------------------------
  // Configuración y diagnóstico
  // ---------------------------------------------------------------------------
  function diagnostico() {
    var pdfFalso = null;
    try { pdfFalso = new File(['x'], 'prueba.pdf', { type: 'application/pdf' }); } catch (e) { /* sin acción */ }
    var ocr = R.OCR.disponible();
    var items = [
      ['Forma de apertura', U.modoArchivo() ? 'Archivo local (file://)' : root.location.protocol.replace(':', '').toUpperCase() + ' (' + root.location.host + ')', !U.modoArchivo()],
      ['Dispositivo', U.esIOS() ? 'iPad / iOS' : (U.esAndroid() ? 'Android (Samsung)' : 'PC'), true],
      ['Conexión a Internet', navigator.onLine ? 'Conectado' : 'Sin conexión (la app sigue funcionando)', true],
      ['Guardado local', R.Storage.disponible() ? 'Disponible' : 'No disponible (modo privado o memoria llena)', R.Storage.disponible()],
      ['Modo sin conexión', ('serviceWorker' in navigator) && navigator.serviceWorker.controller ? 'Activo' : (U.modoArchivo() ? 'No aplica al abrir como archivo' : 'Aún no activo (recargue una vez)'), !!(('serviceWorker' in navigator) && navigator.serviceWorker.controller)],
      ['Cámara dentro de la app', navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'Disponible' : 'No disponible (se usa la cámara del sistema)', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)],
      ['Lector de códigos', R.Barcode.tieneNativo() ? 'Nativo del navegador + ZXing' : 'ZXing (local)', true],
      ['Lectura de texto (OCR)', ocr.ok ? (R.OCR.estaListo() ? 'Listo' : 'Disponible (se prepara al primer uso)') : ocr.motivo, ocr.ok],
      ['Compartir archivos', pdfFalso && UI.puedeCompartir([pdfFalso]) ? 'Disponible' : 'No disponible (se usa descarga)', !!(pdfFalso && UI.puedeCompartir([pdfFalso]))]
    ];
    $('cfgDiagnostico').innerHTML = items.map(function (it) {
      return '<li><span class="diag-icono ' + (it[2] ? 'diag-ok' : 'diag-no') + '" aria-hidden="true">' + (it[2] ? '✓' : '!') + '</span>' +
        '<span><strong>' + U.escapeHtml(it[0]) + ':</strong> ' + U.escapeHtml(it[1]) + '</span></li>';
    }).join('');
  }

  function pintarLogoConfig() {
    var guardado = R.Storage.obtenerLogo();
    $('cfgLogoVista').hidden = !guardado;
    $('cfgLogoQuitar').hidden = !guardado;
    if (guardado) $('cfgLogoVista').src = guardado;
  }

  function abrirConfiguracion() {
    $('cfgCorreo').value = R.Storage.obtenerCorreo() || C.CORREO.DESTINO_PREDETERMINADO || '';
    $('cfgCorreo').classList.remove('is-invalid');
    pintarLogoConfig();
    diagnostico();
    UI.modal('modalConfig').show();
  }

  function initConfiguracion() {
    $('cfgCorreoGuardar').addEventListener('click', function () {
      var v = $('cfgCorreo').value.trim();
      var err = R.Email.validarCorreo(v);
      if (err) { $('cfgCorreo').classList.add('is-invalid'); $('cfgCorreoError').textContent = err; return; }
      R.Storage.guardarCorreo(v);
      $('cfgCorreo').classList.remove('is-invalid');
      UI.toast('Correo destino guardado en este dispositivo.', 'exito');
    });
    $('cfgLogo').addEventListener('change', function () {
      var archivo = this.files && this.files[0];
      this.value = '';
      if (!archivo) return;
      U.archivoACanvas(archivo, 600).then(function (c) {
        if (!R.Storage.guardarLogo(c.toDataURL('image/png'))) throw new Error('No hay espacio para guardar el logo.');
        U.limpiarCacheLogo();
        pintarLogoConfig();
        UI.toast('Logo guardado para PDF y Excel en este dispositivo.', 'exito');
      }).catch(function (e) { UI.toast(e.message || String(e), 'error'); });
    });
    $('cfgLogoQuitar').addEventListener('click', function () {
      R.Storage.borrarLogo();
      U.limpiarCacheLogo();
      pintarLogoConfig();
      UI.toast('Se usará assets/logo.png en los documentos.', 'info');
    });
    $('cfgPrepararOCR').addEventListener('click', function () {
      if (!R.OCR.disponible().ok) { UI.toast(R.OCR.disponible().motivo, 'aviso', { duracion: 10000 }); return; }
      UI.cargando('Preparando lector de texto…');
      R.Scanner.precalentarOCR().then(function (ok) {
        UI.ocultarCargando();
        diagnostico();
        UI.toast(ok ? 'Lector de texto listo. Ya puede trabajar sin conexión.' : 'No se pudo preparar el lector de texto.', ok ? 'exito' : 'error');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Modo sin conexión (Service Worker) e instalación
  // ---------------------------------------------------------------------------
  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator) || U.modoArchivo()) return;
    navigator.serviceWorker.register('service-worker.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', function () {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            UI.toast('Hay una versión nueva de la aplicación.', 'info', {
              duracion: 0,
              accion: { texto: 'Actualizar', fn: function () { estado.actualizacionSolicitada = true; nuevo.postMessage({ tipo: 'ACTIVAR' }); } }
            });
          }
        });
      });
    }).catch(function (e) { console.warn('Service worker no registrado:', e); });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!estado.actualizacionSolicitada) return;
      guardar.ejecutarYa();
      root.location.reload();
    });
  }

  function initConexion() {
    var pintar = function () {
      var en = navigator.onLine;
      $('indicadorConexion').hidden = en;
    };
    root.addEventListener('online', pintar);
    root.addEventListener('offline', pintar);
    pintar();
    root.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      estado.eventoInstalacion = e;
      $('btnInstalar').hidden = false;
    });
    $('btnInstalar').addEventListener('click', function () {
      if (!estado.eventoInstalacion) return;
      estado.eventoInstalacion.prompt();
      estado.eventoInstalacion.userChoice.finally(function () { estado.eventoInstalacion = null; $('btnInstalar').hidden = true; });
    });
  }

  function avisoModoArchivo() {
    if (!U.modoArchivo()) return;
    UI.alerta('zonaAvisos', {
      tipo: 'info',
      titulo: 'Abierto como archivo local',
      mensajes: ['Captura, edición, sumas, Excel y PDF funcionan sin Internet. La lectura de texto (OCR) y la instalación como app requieren abrir con INICIAR-SERVIDOR.bat (ver README). El código de barras sí funciona.']
    });
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  function initEventos() {
    $('inpReferencia').addEventListener('input', function () {
      estado.mov.referencia = this.value;
      this.classList.remove('is-invalid');
      renderEspejos(); guardar();
    });
    $('inpMontacarguista').addEventListener('input', function () {
      estado.mov.montacarguista = this.value;
      this.classList.remove('is-invalid');
      renderEspejos(); guardar();
    });
    $('inpFecha').addEventListener('change', function () {
      estado.mov.fecha = this.value;
      this.classList.remove('is-invalid');
      renderEspejos(); guardar();
    });
    $('espejoMontacarguistaZona').addEventListener('click', function () { $('inpMontacarguista').focus(); });

    $('btnEscanear').addEventListener('click', function () { R.Scanner.escanear(); });
    $('btnSeleccionarFoto').addEventListener('click', function () { R.Scanner.seleccionarFoto(); });
    $('btnAgregarProducto').addEventListener('click', function () {
      R.Formulario.abrir({ modo: 'nuevo', origenSugerido: C.CAPTURA.RECORDAR_ULTIMO_ORIGEN ? estado.mov.ultimoOrigen : '' });
    });
    $('btnDestinoMasivo').addEventListener('click', destinoMasivo);

    // Tabla: edición directa de ubicaciones
    var tbody = $('cuerpoTabla');
    tbody.addEventListener('input', function (ev) {
      var inp = ev.target.closest('[data-campo]');
      if (!inp) return;
      var tr = inp.closest('tr');
      var f = estado.mov.filas.find(function (x) { return x.id === tr.getAttribute('data-id'); });
      if (!f) return;
      f[inp.getAttribute('data-campo')] = inp.value.trim();
      inp.classList.remove('is-invalid');
      guardar();
    });
    tbody.addEventListener('change', function (ev) {
      var inp = ev.target.closest('[data-campo]');
      if (!inp) return;
      var tr = inp.closest('tr');
      var f = estado.mov.filas.find(function (x) { return x.id === tr.getAttribute('data-id'); });
      if (!f) return;
      var v = inp.value.trim();
      if (C.UBICACIONES.FORZAR_MAYUSCULAS) v = v.toUpperCase();
      inp.value = v;
      f[inp.getAttribute('data-campo')] = v;
      if (inp.getAttribute('data-campo') === 'destino' && v) tr.classList.remove('fila-error');
      var sinDestino = estado.mov.filas.filter(function (x) { return !String(x.destino || '').trim(); }).length;
      $('contadorFilas').textContent = estado.mov.filas.length + (estado.mov.filas.length === 1 ? ' fila' : ' filas') + (sinDestino ? ' · ' + sinDestino + ' sin destino' : ' · todas con destino');
      guardar();
    });
    // Enter en un destino pasa al siguiente destino (rápido para el checker)
    tbody.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var inp = ev.target.closest('[data-campo]');
      if (!inp) return;
      ev.preventDefault();
      var todos = Array.prototype.slice.call(tbody.querySelectorAll('[data-campo="' + inp.getAttribute('data-campo') + '"]'));
      var sig = todos[todos.indexOf(inp) + 1];
      if (sig) sig.focus(); else inp.blur();
    });
    tbody.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-accion]');
      if (!btn) return;
      var id = btn.closest('tr').getAttribute('data-id');
      var accion = btn.getAttribute('data-accion');
      if (accion === 'editar') editarFila(id);
      else if (accion === 'dividir') dividirFila(id);
      else if (accion === 'eliminar') eliminarFila(id);
    });

    $('btnPDF').addEventListener('click', generarPDF);
    $('btnExcel').addEventListener('click', descargarExcel);
    $('btnCorreo').addEventListener('click', enviarCorreo);
    $('btnLimpiar').addEventListener('click', limpiarHoja);
    $('btnNuevo').addEventListener('click', nuevoMovimiento);
    $('btnConfig').addEventListener('click', abrirConfiguracion);

    // Guardar inmediatamente al salir o pasar a segundo plano
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') guardar.ejecutarYa(); });
    root.addEventListener('pagehide', function () { guardar.ejecutarYa(); });
  }

  // ---------------------------------------------------------------------------
  // Inicio
  // ---------------------------------------------------------------------------
  function iniciar() {
    if (!root.bootstrap) {
      document.body.insertAdjacentHTML('afterbegin', '<div style="padding:16px;background:#fff3cd;border-bottom:1px solid #e0c36b">No se cargó Bootstrap (libs/bootstrap/bootstrap.bundle.min.js). Verifique que copió la carpeta libs completa.</div>');
      return;
    }
    aplicarConfiguracionVisual();
    UI.init();
    R.Scanner.init({
      alGuardar: alGuardarFormulario,
      origenSugerido: function () { return C.CAPTURA.RECORDAR_ULTIMO_ORIGEN ? estado.mov.ultimoOrigen : ''; }
    });
    R.Email.init({ alRegistrar: function (t) { registrar('CORREO', { nota: t }); guardar(); } });
    initEventos();
    initConfiguracion();
    initConexion();
    avisoModoArchivo();
    registrarServiceWorker();
    iniciarMovimiento().catch(function (e) {
      console.error(e);
      estado.mov = estado.mov || P.crearMovimiento();
      estado.guardadoHabilitado = true;
      renderTodo();
    });
  }

  root.addEventListener('error', function (ev) {
    console.error('Error no controlado:', ev.error || ev.message);
  });
  root.addEventListener('unhandledrejection', function (ev) {
    console.error('Promesa rechazada:', ev.reason);
    if (UI && UI.toast && document.getElementById('zonaToasts')) {
      UI.toast('Ocurrió un error inesperado: ' + ((ev.reason && ev.reason.message) || ev.reason) + '. Sus datos siguen guardados.', 'error');
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
