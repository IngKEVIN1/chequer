/* =============================================================================
 * storage.js — Guardado local (localStorage) del movimiento y la configuración.
 * Nada se envía a ningún servidor. Las fotografías NO se guardan.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};

  function clave(nombre) {
    return ((root.APP_CONFIG && root.APP_CONFIG.ALMACENAMIENTO.PREFIJO) || 'reubicacion_') + nombre;
  }

  var S = {
    ultimoError: null,

    /** true si el navegador permite guardar (en modo privado puede fallar). */
    disponible: function () {
      try {
        var k = clave('__prueba');
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    },

    leer: function (nombre, porDefecto) {
      try {
        var v = localStorage.getItem(clave(nombre));
        return v === null ? porDefecto : JSON.parse(v);
      } catch (e) {
        return porDefecto;
      }
    },

    escribir: function (nombre, valor) {
      try {
        localStorage.setItem(clave(nombre), JSON.stringify(valor));
        S.ultimoError = null;
        return true;
      } catch (e) {
        S.ultimoError = e;
        return false;
      }
    },

    borrar: function (nombre) {
      try { localStorage.removeItem(clave(nombre)); } catch (e) { /* sin acción */ }
    },

    // --- Movimiento en curso ---------------------------------------------
    guardarMovimiento: function (mov) {
      mov.actualizado = new Date().toISOString();
      return S.escribir('movimiento_actual', mov);
    },
    cargarMovimiento: function () {
      var mov = S.leer('movimiento_actual', null);
      if (!mov || typeof mov !== 'object' || !Array.isArray(mov.filas)) return null;
      return mov;
    },
    borrarMovimiento: function () { S.borrar('movimiento_actual'); },

    // --- Correo destino (configuración) ------------------------------------
    obtenerCorreo: function () { return S.leer('correo_destino', ''); },
    guardarCorreo: function (correo) { return S.escribir('correo_destino', String(correo || '').trim()); },

    // --- Logo para documentos (opcional, cargado desde Configuración) ------
    obtenerLogo: function () { return S.leer('logo_documentos', null); },
    guardarLogo: function (dataURL) { return S.escribir('logo_documentos', dataURL); },
    borrarLogo: function () { S.borrar('logo_documentos'); },

    // --- Avisos ya mostrados --------------------------------------------------
    avisoVisto: function (id) { return !!S.leer('aviso_' + id, false); },
    marcarAviso: function (id) { S.escribir('aviso_' + id, true); }
  };

  R.Storage = S;
})(typeof window !== 'undefined' ? window : globalThis);
