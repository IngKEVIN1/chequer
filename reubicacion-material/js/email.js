/* =============================================================================
 * email.js — "ENVIAR CORREO"
 *
 * LO QUE UN NAVEGADOR SÍ Y NO PUEDE HACER (sin servidor):
 *   - mailto: abre el programa de correo con destinatario, asunto y texto,
 *     pero NO puede adjuntar archivos. Ningún navegador lo permite.
 *   - Web Share API (Samsung / iPad): abre el menú "Compartir" del sistema con
 *     los archivos ya adjuntos; el usuario elige Gmail/Outlook/Correo y el
 *     destinatario. El navegador no puede elegir la app ni el destinatario.
 *   - Archivo .eml: un borrador de correo CON los adjuntos ya incluidos.
 *     Al abrirlo con Outlook de escritorio (clásico) aparece listo para enviar.
 *   - Envío 100 % automático: requiere un servicio (Power Automate, Microsoft
 *     Graph o un backend). Queda preparado en config.js > CORREO.ENVIO_AUTOMATICO.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  var estado = { mov: null, pdf: null, excel: null, opciones: {} };

  function $(id) { return document.getElementById(id); }
  function cfg() { return root.APP_CONFIG.CORREO; }

  var Em = {};

  /** Acepta uno o varios correos separados por coma o punto y coma. */
  Em.validarCorreo = function (texto) {
    var lista = String(texto || '').split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lista.length) return 'Escriba un correo destino.';
    var malo = lista.find(function (c) { return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c); });
    return malo ? 'El correo "' + malo + '" no es válido.' : null;
  };

  Em.asunto = function (mov) { return cfg().ASUNTO_PREFIJO + mov.referencia; };

  Em.cuerpo = function (mov, nombresArchivos, notaAdjuntar) {
    var lineas = [
      cfg().CUERPO_TITULO,
      '',
      'Referencia: ' + mov.referencia,
      'Fecha: ' + U.fechaDMY(mov.fecha),
      'Montacarguista: ' + (mov.montacarguista || '—'),
      'Productos: ' + mov.filas.length + ' fila(s)'
    ];
    if (nombresArchivos && nombresArchivos.length) {
      lineas.push('', 'Archivos adjuntos:');
      nombresArchivos.forEach(function (n) { lineas.push('- ' + n); });
    }
    if (notaAdjuntar) lineas.push('', notaAdjuntar);
    return lineas.join('\n');
  };

  function correoActual() { return $('correoPara').value.trim(); }

  function validarCampoCorreo() {
    var error = Em.validarCorreo(correoActual());
    $('correoPara').classList.toggle('is-invalid', !!error);
    $('correoParaError').textContent = error || '';
    if (!error) R.Storage.guardarCorreo(correoActual());
    return !error;
  }

  function codificarEncabezado(s) {
    return /^[\x20-\x7E]*$/.test(s) ? s : '=?UTF-8?B?' + U.textoABase64(s) + '?=';
  }

  function partirBase64(b64) { return b64.replace(/.{1,76}/g, '$&\r\n'); }

  /** Construye un borrador .eml (RFC 5322) con adjuntos. */
  async function construirEml(para, asunto, cuerpo, adjuntos) {
    var limite = '----=_Reubicacion_' + Date.now().toString(36);
    var CRLF = '\r\n';
    var partes = [
      'To: ' + para,
      'Subject: ' + codificarEncabezado(asunto),
      'X-Unsent: 1',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="' + limite + '"',
      '',
      'This is a multi-part message in MIME format.',
      '',
      '--' + limite,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      partirBase64(U.textoABase64(cuerpo))
    ];
    for (var i = 0; i < adjuntos.length; i++) {
      var a = adjuntos[i];
      var b64 = await U.blobABase64(a.blob);
      partes.push(
        '--' + limite,
        'Content-Type: ' + a.blob.type + '; name="' + a.nombre + '"',
        'Content-Disposition: attachment; filename="' + a.nombre + '"',
        'Content-Transfer-Encoding: base64',
        '',
        partirBase64(b64)
      );
    }
    partes.push('--' + limite + '--', '');
    return new Blob([partes.join(CRLF)], { type: 'message/rfc822' });
  }

  function archivosComoFile() {
    try {
      return [
        new File([estado.pdf.blob], estado.pdf.nombre, { type: 'application/pdf' }),
        new File([estado.excel.blob], estado.excel.nombre, { type: estado.excel.blob.type })
      ];
    } catch (e) { return null; }
  }

  function registrar(texto) { if (estado.opciones.alRegistrar) estado.opciones.alRegistrar(texto); }

  // ---------------------------------------------------------------------------
  // Acciones de los botones
  // ---------------------------------------------------------------------------
  function compartir() {
    if (!validarCampoCorreo()) return;
    var files = archivosComoFile();
    if (!files) { R.UI.toast('Este navegador no permite compartir archivos.', 'error'); return; }
    var ambos = R.UI.puedeCompartir(files);
    var lista = ambos ? files : [files[0]];
    // Se llama directamente dentro del toque del usuario (requisito de Safari).
    R.UI.compartir({ files: lista, title: Em.asunto(estado.mov), text: Em.cuerpo(estado.mov, lista.map(function (f) { return f.name; })) })
      .then(function (r) {
        if (r === 'compartido') { R.UI.toast('Archivos enviados a la aplicación elegida. Verifique destinatario y asunto antes de enviar.', 'exito', { duracion: 7000 }); registrar('Compartido (' + lista.length + ' archivo/s)'); }
        else if (r === 'error') R.UI.toast('No se pudo abrir el menú Compartir. Use "Descargar archivos y abrir correo".', 'error');
      });
  }

  async function descargarYAbrirCorreo() {
    if (!validarCampoCorreo()) return;
    U.descargarBlob(estado.pdf.blob, estado.pdf.nombre);
    await U.dormir(600);
    U.descargarBlob(estado.excel.blob, estado.excel.nombre);
    await U.dormir(600);
    var cuerpo = Em.cuerpo(estado.mov, [estado.pdf.nombre, estado.excel.nombre],
      'IMPORTANTE: adjunte los dos archivos desde su carpeta Descargas antes de enviar.');
    var url = 'mailto:' + encodeURIComponent(correoActual()).replace(/%40/g, '@').replace(/%2C/gi, ',').replace(/%3B/gi, ';') +
      '?subject=' + encodeURIComponent(Em.asunto(estado.mov)) +
      '&body=' + encodeURIComponent(cuerpo).replace(/%0A/g, '%0D%0A');
    root.location.href = url;
    R.UI.toast('Se descargaron los archivos. En el correo que se abrió, adjúntelos desde Descargas.', 'info', { duracion: 9000 });
    registrar('Descarga + mailto');
  }

  async function descargarEml() {
    if (!validarCampoCorreo()) return;
    try {
      R.UI.cargando('Creando borrador de correo…');
      var eml = await construirEml(correoActual(), Em.asunto(estado.mov),
        Em.cuerpo(estado.mov, [estado.pdf.nombre, estado.excel.nombre]),
        [estado.pdf, estado.excel]);
      U.descargarBlob(eml, U.nombreArchivo('Correo_' + root.APP_CONFIG.PDF.PREFIJO_ARCHIVO, estado.mov.referencia, estado.mov.fecha, 'eml'));
      R.UI.toast('Borrador descargado. Ábralo: en Outlook de escritorio aparece listo con ambos adjuntos; solo presione Enviar.', 'exito', { duracion: 9000 });
      registrar('Borrador .eml');
    } catch (e) {
      R.UI.toast('No se pudo crear el borrador: ' + (e.message || e), 'error');
    } finally {
      R.UI.ocultarCargando();
    }
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && root.isSecureContext) return navigator.clipboard.writeText(texto);
    return new Promise(function (resolve, reject) {
      var t = document.createElement('textarea');
      t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy')); } catch (e) { reject(e); }
      t.remove();
    });
  }

  function copiarDatos() {
    var texto = correoActual() + '\n' + Em.asunto(estado.mov);
    copiarTexto(texto).then(function () {
      R.UI.toast('Copiado: destinatario y asunto.', 'exito');
    }).catch(function () {
      R.UI.toast('No se pudo copiar automáticamente. Selecciónelo y cópielo manualmente.', 'aviso');
    });
  }

  async function envioAutomatico() {
    var auto = cfg().ENVIO_AUTOMATICO;
    if (!auto.HABILITADO || !auto.URL) return;
    if (!validarCampoCorreo()) return;
    if (!navigator.onLine) { R.UI.toast('Sin conexión a Internet. El envío automático requiere conexión; use otra opción.', 'error'); return; }
    R.UI.cargando('Enviando correo…');
    try {
      var payload = {
        para: correoActual(),
        asunto: Em.asunto(estado.mov),
        cuerpo: Em.cuerpo(estado.mov, [estado.pdf.nombre, estado.excel.nombre]),
        adjuntos: [
          { nombre: estado.pdf.nombre, tipo: 'application/pdf', base64: await U.blobABase64(estado.pdf.blob) },
          { nombre: estado.excel.nombre, tipo: estado.excel.blob.type, base64: await U.blobABase64(estado.excel.blob) }
        ]
      };
      var headers = { 'Content-Type': 'application/json' };
      if (auto.TOKEN) headers.Authorization = 'Bearer ' + auto.TOKEN;
      var res = await fetch(auto.URL, { method: 'POST', headers: headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('El servicio respondió con error ' + res.status + '.');
      R.UI.toast('Correo enviado por el servicio configurado.', 'exito');
      registrar('Envío automático');
      R.UI.ocultar('modalCorreo');
    } catch (e) {
      R.UI.toast('No se pudo enviar automáticamente: ' + (e.message || e) + ' Use otra opción.', 'error', { duracion: 10000 });
    } finally {
      R.UI.ocultarCargando();
    }
  }

  function configurarOpciones() {
    var files = archivosComoFile();
    var ambos = files && R.UI.puedeCompartir(files);
    var soloPdf = !ambos && files && R.UI.puedeCompartir([files[0]]);
    var auto = cfg().ENVIO_AUTOMATICO;

    var bComp = $('btnCorreoCompartir');
    bComp.hidden = !(ambos || soloPdf);
    bComp.textContent = ambos ? 'Compartir PDF y Excel' : 'Compartir PDF';
    $('btnCorreoDescargarExcel').hidden = !soloPdf;
    $('btnCorreoAuto').hidden = !(auto.HABILITADO && auto.URL);

    // Opción recomendada según el dispositivo
    var recomendado = (ambos || soloPdf) ? bComp : (U.esTactil() ? $('btnCorreoMailto') : $('btnCorreoEml'));
    [bComp, $('btnCorreoMailto'), $('btnCorreoEml')].forEach(function (b) {
      b.classList.toggle('btn-primario', b === recomendado);
      b.classList.toggle('btn-secundario', b !== recomendado);
    });

    var exp;
    if (ambos) exp = 'Recomendado en este dispositivo: "Compartir PDF y Excel". Elija Outlook, Gmail o Correo; los dos archivos irán adjuntos. Escriba o pegue el destinatario en la app de correo (puede copiarlo con el botón Copiar).';
    else if (soloPdf) exp = 'Este navegador solo permite compartir el PDF (Chrome en Android no acepta compartir archivos de Excel). Comparta el PDF y adjunte el Excel desde Descargas, o use "Descargar archivos y abrir correo".';
    else if (U.esTactil()) exp = 'Este navegador no permite compartir archivos. Use "Descargar archivos y abrir correo" y adjunte los dos archivos desde Descargas.';
    else exp = 'En PC: "Crear borrador de Outlook" genera un correo con ambos archivos adjuntos (ábralo con Outlook de escritorio y presione Enviar). Alternativa: descargar los archivos y abrir su correo para adjuntarlos.';
    $('correoExplicacion').textContent = exp;
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------
  Em.init = function (opciones) {
    estado.opciones = opciones || {};
    $('btnCorreoCompartir').addEventListener('click', compartir);
    $('btnCorreoMailto').addEventListener('click', descargarYAbrirCorreo);
    $('btnCorreoEml').addEventListener('click', descargarEml);
    $('btnCorreoCopiar').addEventListener('click', copiarDatos);
    $('btnCorreoAuto').addEventListener('click', envioAutomatico);
    $('btnCorreoDescargarExcel').addEventListener('click', function () { U.descargarBlob(estado.excel.blob, estado.excel.nombre); });
    $('correoPara').addEventListener('change', validarCampoCorreo);
    $('correoPara').addEventListener('input', function () { $('correoPara').classList.remove('is-invalid'); });
  };

  /**
   * Flujo completo de "ENVIAR CORREO".
   * @param {Object} mov movimiento ya validado
   * @param {function():Promise<{pdf:{blob,nombre}, excel:{blob,nombre}}>} generarArchivos
   */
  Em.abrir = async function (mov, generarArchivos) {
    var correo = R.Storage.obtenerCorreo() || cfg().DESTINO_PREDETERMINADO || '';
    if (!correo || Em.validarCorreo(correo)) {
      correo = await R.UI.pedirValor({
        titulo: 'Correo destino',
        etiqueta: '¿A qué correo se enviarán los movimientos?',
        valor: correo,
        tipo: 'email',
        aceptar: 'Guardar y continuar',
        ayuda: 'Se guardará solo en este dispositivo y aparecerá automáticamente la próxima vez. Puede escribir varios separados por coma.',
        validar: Em.validarCorreo
      });
      if (correo === null) return;
      R.Storage.guardarCorreo(correo);
    }

    R.UI.cargando('Preparando PDF y Excel…');
    try {
      var archivos = await generarArchivos();
      estado.mov = mov;
      estado.pdf = archivos.pdf;
      estado.excel = archivos.excel;
    } catch (e) {
      R.UI.toast(e.message || String(e), 'error');
      return;
    } finally {
      R.UI.ocultarCargando();
    }

    $('correoPara').value = correo;
    $('correoPara').classList.remove('is-invalid');
    $('correoAsunto').textContent = Em.asunto(mov);
    $('correoCuerpo').textContent = Em.cuerpo(mov, [estado.pdf.nombre, estado.excel.nombre]);
    $('correoAdjuntos').innerHTML = [estado.pdf, estado.excel].map(function (a) {
      return '<li><strong>' + U.escapeHtml(a.nombre) + '</strong> <span class="text-secundario">(' + U.formatearBytes(a.blob.size) + ')</span></li>';
    }).join('');
    configurarOpciones();
    R.UI.modal('modalCorreo').show();
  };

  R.Email = Em;
})(window);
