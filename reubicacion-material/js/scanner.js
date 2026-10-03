/* =============================================================================
 * scanner.js — Cámara, selección de fotos y flujo de lectura de etiquetas:
 *   foto -> códigos de barras -> OCR -> intérprete -> ventana de revisión
 *
 * Cámara:
 *   - Tablets / celulares: se abre la cámara NATIVA del sistema (mejor enfoque,
 *     flash, y funciona igual en Samsung y iPad).
 *   - PC: vista de cámara dentro de la app (getUserMedia), si existe webcam.
 *   - Siempre existe la opción de elegir una foto ya tomada.
 * Las fotos solo viven en memoria mientras se revisan; no se guardan.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  var estado = {
    canvas: null,           // foto original (en memoria)
    rotacion: 0,
    token: 0,               // invalida lecturas anteriores (omitir / cerrar / re-escanear)
    ultimoTexto: '',
    ultimosCodigos: [],
    ultimoResultado: null,
    campoUbicacion: null,
    stream: null,
    opciones: {}
  };

  function $(id) { return document.getElementById(id); }
  function cfg() { return root.APP_CONFIG.CAPTURA; }

  function usarCamaraNavegador() {
    var modo = cfg().MODO_CAMARA;
    var hay = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (modo === 'nativa') return false;
    if (modo === 'navegador') return hay;
    return hay && !U.esTactil();
  }

  function vistaPrevia(canvas) {
    try { return U.imagenACanvas(canvas, 900).toDataURL('image/jpeg', 0.8); } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------------
  // Lectura completa de una etiqueta
  // ---------------------------------------------------------------------------
  function necesitaRotar(r) { return !r.campos.producto.valor || !r.campos.cantidad.valor; }

  async function leerTexto(canvas, F) {
    var r = await R.OCR.reconocer(canvas, function (m) {
      if (!m || !m.status) return;
      if (m.status === 'recognizing text') F.mostrarProcesando('Leyendo texto de la etiqueta… ' + Math.round((m.progress || 0) * 100) + '%', (m.progress || 0) * 100);
      else F.mostrarProcesando('Preparando el lector de texto (la primera vez tarda más)…', null);
    });
    return r;
  }

  async function analizar(miToken) {
    var F = R.Formulario;
    var vigente = function () { return miToken === estado.token; };
    var canvas = U.rotarCanvas(estado.canvas, estado.rotacion);
    F.mostrarImagen(vistaPrevia(canvas));
    var avisos = [];
    var codigos = [];

    if (cfg().USAR_CODIGO_BARRAS) {
      F.mostrarProcesando('Buscando códigos de barras…', null);
      var rc = await R.Barcode.leer(canvas, function (n) { if (vigente()) F.mostrarProcesando('Códigos de barras encontrados: ' + n + '…', null); });
      codigos = rc.codigos;
      if (rc.error && !codigos.length) console.warn('Códigos de barras:', rc.error);
    }
    if (!vigente()) return;

    var texto = '';
    var resultado;
    var disp = R.OCR.disponible();
    if (disp.ok) {
      try {
        var lectura = await leerTexto(canvas, F);
        if (!vigente()) return;
        texto = lectura.texto;
        resultado = R.Interprete.interpretar({ texto: texto, codigos: codigos });

        // Giro automático: etiquetas fotografiadas de lado (como la de "Item / Lot#")
        if (cfg().ROTACION_AUTOMATICA && estado.rotacion === 0 && necesitaRotar(resultado)) {
          var giros = [90, 270];
          for (var i = 0; i < giros.length; i++) {
            F.mostrarProcesando('Lectura incompleta: probando la imagen girada ' + giros[i] + '°…', null);
            var l2 = await leerTexto(U.rotarCanvas(canvas, giros[i]), F);
            if (!vigente()) return;
            var r2 = R.Interprete.interpretar({ texto: l2.texto, codigos: codigos });
            if (r2.puntaje > resultado.puntaje) {
              resultado = r2; texto = l2.texto; estado.rotacion = giros[i];
              F.mostrarImagen(vistaPrevia(U.rotarCanvas(estado.canvas, estado.rotacion)));
            }
            if (!necesitaRotar(resultado)) break;
          }
        }
      } catch (e) {
        if (!vigente()) return;
        avisos.push(e.message || String(e));
        resultado = R.Interprete.interpretar({ texto: '', codigos: codigos });
      }
    } else {
      avisos.push(disp.motivo);
      resultado = R.Interprete.interpretar({ texto: '', codigos: codigos });
    }
    if (!vigente()) return;

    estado.ultimoTexto = texto;
    estado.ultimosCodigos = codigos;
    estado.ultimoResultado = resultado;
    F.cargarResultado(resultado, texto);
    finalizarMensaje(resultado, avisos);
  }

  function finalizarMensaje(resultado, avisos) {
    var c = resultado.campos;
    var mensaje, tipo;
    if (!c.producto.valor && !c.cantidad.valor) {
      mensaje = 'No se pudieron leer los datos principales. Capture manualmente o vuelva a escanear con más luz, más cerca y sin reflejos del plástico.';
      tipo = 'aviso';
    } else if (['producto', 'cantidad', 'lote'].some(function (k) { return c[k].estado === 'revisar'; })) {
      mensaje = 'Revise los campos marcados con "Revisar" antes de aceptar.';
      tipo = 'aviso';
    } else {
      mensaje = 'Lectura completa. Verifique los datos y presione Aceptar.';
      tipo = 'exito';
    }
    if (avisos.length) mensaje += ' ' + avisos.join(' ');
    R.Formulario.terminarProcesando(mensaje, tipo);
  }

  async function procesarImagen(fuente) {
    var miToken = ++estado.token;
    var F = R.Formulario;
    F.mostrarProcesando('Cargando imagen…', null);
    try {
      estado.canvas = fuente instanceof HTMLCanvasElement ? fuente : await U.archivoACanvas(fuente, 3000);
    } catch (e) {
      if (miToken !== estado.token) return;
      F.terminarProcesando(e.message + ' Puede capturar los datos manualmente.', 'error');
      return;
    }
    estado.rotacion = 0;
    estado.ultimoTexto = '';
    estado.ultimosCodigos = [];
    estado.ultimoResultado = null;
    try {
      await analizar(miToken);
    } catch (e) {
      if (miToken !== estado.token) return;
      console.error(e);
      F.terminarProcesando('Ocurrió un error al leer la etiqueta (' + (e.message || e) + '). Capture los datos manualmente.', 'error');
    }
  }

  /** Abre (o reutiliza) la ventana de revisión y procesa la imagen. */
  function iniciarRevision(fuente, previos) {
    var F = R.Formulario;
    if (F.estaAbierto()) {
      F.limpiarLectura();
    } else {
      F.abrir({ modo: 'escaneo', origenSugerido: estado.opciones.origenSugerido ? estado.opciones.origenSugerido() : '', previos: previos });
    }
    procesarImagen(fuente);
  }

  // ---------------------------------------------------------------------------
  // Cámara dentro del navegador (PC con webcam)
  // ---------------------------------------------------------------------------
  function detenerCamara() {
    if (estado.stream) {
      estado.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* sin acción */ } });
      estado.stream = null;
    }
    var v = $('camaraVideo');
    if (v) v.srcObject = null;
  }

  function mensajeErrorCamara(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'El permiso de cámara fue denegado. Actívelo en la configuración del navegador (ícono de candado junto a la dirección) o use "Elegir foto".';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No se encontró una cámara en este equipo. Use "Elegir foto".';
    if (n === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación (Teams, Zoom…). Ciérrela e intente de nuevo.';
    return 'No se pudo abrir la cámara (' + (e && (e.message || e.name) || 'error desconocido') + '). Use "Elegir foto".';
  }

  function abrirCamaraNavegador(previos) {
    estado.previosCamara = previos || null;
    $('camaraEstado').textContent = 'Abriendo cámara…';
    $('camaraEstado').className = 'camara-estado';
    $('btnTomarFoto').disabled = true;
    var m = R.UI.modal('modalCamara');
    var alMostrar = async function () {
      $('modalCamara').removeEventListener('shown.bs.modal', alMostrar);
      try {
        estado.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        var v = $('camaraVideo');
        v.srcObject = estado.stream;
        await v.play();
        $('camaraEstado').textContent = 'Encuadre la etiqueta completa y presione "Tomar foto".';
        $('btnTomarFoto').disabled = false;
      } catch (e) {
        detenerCamara();
        $('camaraEstado').textContent = mensajeErrorCamara(e);
        $('camaraEstado').className = 'camara-estado camara-error';
      }
    };
    $('modalCamara').addEventListener('shown.bs.modal', alMostrar);
    m.show();
  }

  async function tomarFotoNavegador() {
    var v = $('camaraVideo');
    if (!v.videoWidth) { R.UI.toast('La cámara aún no está lista.', 'aviso'); return; }
    var canvas = U.imagenACanvas(v, 3000);
    var previos = estado.previosCamara;
    R.UI.ocultar('modalCamara');
    await R.UI.esperarCierre('modalCamara');
    iniciarRevision(canvas, previos);
  }

  // ---------------------------------------------------------------------------
  // Ubicaciones (escanear etiqueta de rack / ubicación)
  // ---------------------------------------------------------------------------
  function buscarUbicacionEnTexto(texto) {
    var patron = root.APP_CONFIG.UBICACIONES.PATRON_UBICACION;
    var tokens = U.normalizarTexto(texto).split(/[\s,;:|]+/);
    return tokens.find(function (t) { return patron.test(t); }) || null;
  }

  async function leerUbicacion(archivo) {
    var campoNombre = estado.campoUbicacion;
    var boton = $(campoNombre === 'origen' ? 'btnEscanearOrigen' : 'btnEscanearDestino');
    var textoBoton = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Leyendo…';
    try {
      var canvas = await U.archivoACanvas(archivo, 2400);
      var patron = root.APP_CONFIG.UBICACIONES.PATRON_UBICACION;
      var rc = await R.Barcode.leer(canvas);
      var valor = null, metodo = '';
      var coincide = rc.codigos.find(function (c) { return patron.test(U.normalizarTexto(c.texto)); });
      if (coincide) { valor = U.normalizarTexto(coincide.texto); metodo = 'código de barras'; }
      else if (rc.codigos.length === 1) { valor = rc.codigos[0].texto.trim(); metodo = 'código de barras (verifique)'; }
      if (!valor && R.OCR.disponible().ok) {
        var l = await R.OCR.reconocer(canvas);
        valor = buscarUbicacionEnTexto(l.texto);
        metodo = 'OCR (verifique)';
      }
      if (valor) {
        R.Formulario.asignarUbicacion(campoNombre, valor);
        R.UI.toast('Ubicación ' + campoNombre + ': ' + valor + ' — leída por ' + metodo + '.', 'exito');
      } else {
        R.UI.toast('No se encontró una ubicación en la foto. Escríbala manualmente.', 'aviso');
      }
    } catch (e) {
      R.UI.toast('No se pudo leer la ubicación: ' + (e.message || e), 'error');
    } finally {
      boton.disabled = false;
      boton.textContent = textoBoton;
    }
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------
  var S = {};

  /**
   * @param {{alGuardar:function(datos, contexto), origenSugerido:function():string}} opciones
   */
  S.init = function (opciones) {
    estado.opciones = opciones || {};

    function alElegirArchivo(input, fn) {
      input.addEventListener('change', function () {
        var archivo = input.files && input.files[0];
        input.value = ''; // permite elegir la misma foto otra vez
        if (archivo) fn(archivo);
        // Si el usuario canceló la cámara no pasa nada: la app sigue igual
      });
    }

    alElegirArchivo($('inputCamara'), function (a) { iniciarRevision(a, estado.previosNativo); estado.previosNativo = null; });
    alElegirArchivo($('inputGaleria'), function (a) { iniciarRevision(a, estado.previosNativo); estado.previosNativo = null; });
    alElegirArchivo($('inputUbicacion'), function (a) { leerUbicacion(a); });

    $('btnTomarFoto').addEventListener('click', tomarFotoNavegador);
    $('btnCamaraArchivo').addEventListener('click', function () {
      var previos = estado.previosCamara;
      R.UI.ocultar('modalCamara');
      estado.previosNativo = previos;
      $('inputGaleria').click();
    });
    $('modalCamara').addEventListener('hidden.bs.modal', detenerCamara);

    R.Formulario.init({
      alGuardar: function (datos, ctx) {
        if (estado.opciones.alGuardar) estado.opciones.alGuardar(datos, ctx);
      },
      alReescanear: function () {
        // No se cancela la lectura actual aquí: si el usuario cancela la cámara,
        // la ventana debe seguir funcionando. La nueva foto invalida la anterior.
        if (usarCamaraNavegador()) {
          var previos = R.Formulario.valoresPrevios();
          R.Formulario.cerrar();
          R.UI.esperarCierre('modalFila').then(function () { abrirCamaraNavegador(previos); });
        } else {
          $('inputCamara').click();
        }
      },
      alRotar: function () {
        if (!estado.canvas) return;
        estado.rotacion = (estado.rotacion + 90) % 360;
        R.Formulario.limpiarLectura();
        var t = ++estado.token;
        analizar(t).catch(function (e) {
          if (t === estado.token) R.Formulario.terminarProcesando('Error al leer: ' + (e.message || e), 'error');
        });
      },
      alOmitir: function () {
        estado.token++;
        var r = R.Interprete.interpretar({ texto: estado.ultimoTexto, codigos: estado.ultimosCodigos });
        R.Formulario.cargarResultado(r, estado.ultimoTexto);
        R.Formulario.terminarProcesando('Lectura omitida. Capture los datos manualmente.', 'info');
      },
      alCambiarPerfil: function (perfilId) {
        if (!estado.ultimoResultado && !estado.ultimosCodigos.length && !estado.ultimoTexto) return;
        var r = R.Interprete.interpretar({ texto: estado.ultimoTexto, codigos: estado.ultimosCodigos, perfilId: perfilId || undefined });
        estado.ultimoResultado = r;
        R.Formulario.cargarResultado(r, estado.ultimoTexto);
        R.Formulario.terminarProcesando('Datos reinterpretados como: ' + r.perfil.nombre + '.', 'info');
      },
      alEscanearUbicacion: function (campoNombre) {
        estado.campoUbicacion = campoNombre;
        $('inputUbicacion').click();
      },
      alCerrar: function () {
        // Cancela cualquier lectura en curso y libera la foto de la memoria
        estado.token++;
        estado.canvas = null;
      }
    });
  };

  /** Botón ESCANEAR ETIQUETA */
  S.escanear = function () {
    if (usarCamaraNavegador()) abrirCamaraNavegador(null);
    else $('inputCamara').click();
  };

  /** Botón SELECCIONAR FOTO */
  S.seleccionarFoto = function () { $('inputGaleria').click(); };

  /** Información de la última lectura (para el registro de eventos). */
  S.contextoUltimaLectura = function () {
    var r = estado.ultimoResultado;
    return {
      perfil: r ? r.perfil.nombre : '',
      codigos: (estado.ultimosCodigos || []).map(function (c) { return c.texto; }),
      rotacion: estado.rotacion
    };
  };

  /** Prepara el OCR por adelantado (descarga/compila el motor). */
  S.precalentarOCR = function () {
    if (!R.OCR.disponible().ok) return Promise.resolve(false);
    return R.OCR.inicializar().then(function () { return true; }).catch(function () { return false; });
  };

  R.Scanner = S;
})(window);
