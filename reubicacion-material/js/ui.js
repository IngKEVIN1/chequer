/* =============================================================================
 * ui.js — Componentes de interfaz reutilizables (Bootstrap 5):
 * avisos (toasts), alertas, confirmaciones, captura de un valor,
 * indicador de "procesando" y ventana de "documento listo".
 * Se usan en lugar de alert()/confirm() del navegador.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  function $(id) { return document.getElementById(id); }
  function modal(id) { return root.bootstrap.Modal.getOrCreateInstance($(id)); }

  /** Resuelve una promesa cuando el modal termina de cerrarse. */
  function alCerrar(id, fn) {
    var el = $(id);
    var h = function () { el.removeEventListener('hidden.bs.modal', h); fn(); };
    el.addEventListener('hidden.bs.modal', h);
  }

  var UI = {};

  UI.modal = modal;

  /**
   * Cierra un modal de forma segura: si todavía se está abriendo (animación),
   * Bootstrap ignoraría la orden; en ese caso se cierra al terminar de abrir.
   */
  UI.ocultar = function (id) {
    var el = $(id);
    if (!el) return;
    if (el.getAttribute('data-abriendo') === '1') {
      var h = function () { el.removeEventListener('shown.bs.modal', h); modal(id).hide(); };
      el.addEventListener('shown.bs.modal', h);
    } else {
      modal(id).hide();
    }
  };

  /** Marca qué modales están en animación de apertura (se llama una vez al iniciar). */
  UI.init = function () {
    document.querySelectorAll('.modal').forEach(function (el) {
      el.addEventListener('show.bs.modal', function () { el.setAttribute('data-abriendo', '1'); });
      el.addEventListener('shown.bs.modal', function () { el.removeAttribute('data-abriendo'); });
      el.addEventListener('hidden.bs.modal', function () { el.removeAttribute('data-abriendo'); });
    });
  };

  /** Abre un modal y espera a que se cierre. */
  UI.esperarCierre = function (id) {
    return new Promise(function (resolve) { alCerrar(id, resolve); });
  };

  // ---------------------------------------------------------------------------
  // Avisos breves (toasts)
  // ---------------------------------------------------------------------------
  /**
   * @param {string} mensaje
   * @param {'exito'|'error'|'aviso'|'info'} tipo
   * @param {{duracion?:number, accion?:{texto:string, fn:Function}}} opciones
   */
  UI.toast = function (mensaje, tipo, opciones) {
    opciones = opciones || {};
    var clases = { exito: 'toast-exito', error: 'toast-error', aviso: 'toast-aviso', info: 'toast-info' };
    var el = document.createElement('div');
    el.className = 'toast toast-app ' + (clases[tipo] || clases.info);
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', tipo === 'error' ? 'assertive' : 'polite');
    el.innerHTML =
      '<div class="d-flex align-items-start">' +
        '<div class="toast-body flex-grow-1">' + U.escapeHtml(mensaje) + '</div>' +
        (opciones.accion ? '<button type="button" class="btn btn-sm btn-light m-2 toast-accion">' + U.escapeHtml(opciones.accion.texto) + '</button>' : '') +
        '<button type="button" class="btn-close m-2" data-bs-dismiss="toast" aria-label="Cerrar"></button>' +
      '</div>';
    $('zonaToasts').appendChild(el);
    if (opciones.accion) {
      el.querySelector('.toast-accion').addEventListener('click', function () {
        opciones.accion.fn();
        root.bootstrap.Toast.getOrCreateInstance(el).hide();
      });
    }
    var t = new root.bootstrap.Toast(el, { delay: opciones.duracion || (tipo === 'error' ? 8000 : 4000), autohide: opciones.duracion !== 0 });
    el.addEventListener('hidden.bs.toast', function () { el.remove(); });
    t.show();
  };

  // ---------------------------------------------------------------------------
  // Alertas dentro de la página
  // ---------------------------------------------------------------------------
  /**
   * @param {string} contenedorId
   * @param {{tipo:'danger'|'warning'|'info'|'success', titulo?:string, mensajes?:string[], html?:string}} op
   */
  UI.alerta = function (contenedorId, op) {
    var cont = $(contenedorId);
    if (!cont) return null;
    var lista = (op.mensajes || []).length > 1
      ? '<ul class="mb-0 ps-3">' + op.mensajes.map(function (m) { return '<li>' + U.escapeHtml(m) + '</li>'; }).join('') + '</ul>'
      : (op.mensajes && op.mensajes[0] ? '<div>' + U.escapeHtml(op.mensajes[0]) + '</div>' : '');
    cont.innerHTML =
      '<div class="alert alert-' + op.tipo + ' alert-dismissible fade show" role="alert">' +
        (op.titulo ? '<div class="fw-semibold mb-1">' + U.escapeHtml(op.titulo) + '</div>' : '') +
        lista + (op.html || '') +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>' +
      '</div>';
    return cont.firstElementChild;
  };

  UI.limpiarAlerta = function (contenedorId) { var c = $(contenedorId); if (c) c.innerHTML = ''; };

  // ---------------------------------------------------------------------------
  // Confirmación
  // ---------------------------------------------------------------------------
  /**
   * @param {{titulo:string, mensaje:string, aceptar?:string, cancelar?:string, peligro?:boolean}} op
   * @returns {Promise<boolean>}
   */
  UI.confirmar = function (op) {
    return new Promise(function (resolve) {
      var aceptado = false;
      $('confirmarTitulo').textContent = op.titulo || 'Confirmar';
      $('confirmarMensaje').textContent = op.mensaje || '';
      var btnA = $('confirmarAceptar'), btnC = $('confirmarCancelar');
      btnA.textContent = op.aceptar || 'Aceptar';
      btnC.textContent = op.cancelar || 'Cancelar';
      btnA.className = 'btn btn-lg ' + (op.peligro ? 'btn-peligro' : 'btn-primario');
      btnA.onclick = function () { aceptado = true; UI.ocultar('modalConfirmar'); };
      alCerrar('modalConfirmar', function () { resolve(aceptado); });
      modal('modalConfirmar').show();
    });
  };

  // ---------------------------------------------------------------------------
  // Pedir un valor (reemplaza a prompt())
  // ---------------------------------------------------------------------------
  /**
   * @param {{titulo:string, etiqueta:string, valor?:string, tipo?:string, inputmode?:string,
   *          ayuda?:string, aceptar?:string, validar?:function(string):(string|null)}} op
   * @returns {Promise<string|null>} null si se canceló
   */
  UI.pedirValor = function (op) {
    return new Promise(function (resolve) {
      var resultado = null;
      var input = $('valorInput');
      $('valorTitulo').textContent = op.titulo || '';
      $('valorEtiqueta').textContent = op.etiqueta || '';
      $('valorAyuda').textContent = op.ayuda || '';
      $('valorAceptar').textContent = op.aceptar || 'Aceptar';
      input.type = op.tipo || 'text';
      input.setAttribute('inputmode', op.inputmode || (op.tipo === 'email' ? 'email' : 'text'));
      input.value = op.valor || '';
      input.classList.remove('is-invalid');
      $('valorError').textContent = '';

      $('formValor').onsubmit = function (ev) {
        ev.preventDefault();
        var v = input.value.trim();
        var error = op.validar ? op.validar(v) : (v ? null : 'Este campo es obligatorio.');
        if (error) {
          input.classList.add('is-invalid');
          $('valorError').textContent = error;
          input.focus();
          return;
        }
        resultado = v;
        UI.ocultar('modalValor');
      };
      var alMostrar = function () { $('modalValor').removeEventListener('shown.bs.modal', alMostrar); input.focus(); input.select(); };
      $('modalValor').addEventListener('shown.bs.modal', alMostrar);
      alCerrar('modalValor', function () { resolve(resultado); });
      modal('modalValor').show();
    });
  };

  // ---------------------------------------------------------------------------
  // Capa "procesando"
  // ---------------------------------------------------------------------------
  UI.cargando = function (texto) {
    $('capaCargandoTexto').textContent = texto || 'Procesando…';
    $('capaCargando').hidden = false;
  };
  UI.ocultarCargando = function () { $('capaCargando').hidden = true; };

  // ---------------------------------------------------------------------------
  // Compartir archivos (Web Share API) con detección de soporte
  // ---------------------------------------------------------------------------
  UI.puedeCompartir = function (archivos) {
    try {
      return !!(root.navigator && navigator.canShare && navigator.share && navigator.canShare({ files: archivos }));
    } catch (e) { return false; }
  };

  /** @returns {Promise<'compartido'|'cancelado'|'error'>} */
  UI.compartir = function (datos) {
    return navigator.share(datos).then(function () { return 'compartido'; }).catch(function (e) {
      if (e && e.name === 'AbortError') return 'cancelado';
      console.warn('Compartir:', e);
      return 'error';
    });
  };

  // ---------------------------------------------------------------------------
  // Ventana "documento listo" (PDF o Excel)
  // ---------------------------------------------------------------------------
  /**
   * @param {{titulo:string, blob:Blob, nombre:string, esPdf?:boolean, descargado?:boolean}} op
   */
  UI.mostrarDocumento = function (op) {
    var archivo;
    try { archivo = new File([op.blob], op.nombre, { type: op.blob.type }); } catch (e) { archivo = null; }
    $('documentoTitulo').textContent = op.titulo;
    $('documentoNombre').textContent = op.nombre;
    $('documentoTamano').textContent = U.formatearBytes(op.blob.size);
    $('documentoAviso').textContent = op.descargado
      ? 'Se inició la descarga. Si no aparece, use el botón Descargar.'
      : '';

    var btnDesc = $('docDescargar'), btnAbrir = $('docAbrir'), btnComp = $('docCompartir');
    btnDesc.textContent = op.descargado ? 'Descargar de nuevo' : 'Descargar';
    btnDesc.onclick = function () { U.descargarBlob(op.blob, op.nombre); UI.toast('Descarga iniciada: ' + op.nombre, 'exito'); };

    btnAbrir.hidden = !op.esPdf;
    btnAbrir.onclick = function () {
      var url = URL.createObjectURL(op.blob);
      var w = root.open(url, '_blank');
      if (!w) { U.descargarBlob(op.blob, op.nombre); UI.toast('El navegador bloqueó la ventana; se descargó el archivo.', 'aviso'); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    };

    var compartible = archivo && UI.puedeCompartir([archivo]);
    btnComp.hidden = !compartible;
    btnComp.onclick = function () {
      UI.compartir({ files: [archivo], title: op.nombre }).then(function (r) {
        if (r === 'error') UI.toast('No se pudo compartir. Use Descargar.', 'error');
      });
    };
    $('documentoSinCompartir').hidden = !!compartible;
    modal('modalDocumento').show();
  };

  R.UI = UI;
})(window);
