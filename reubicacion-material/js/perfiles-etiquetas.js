/* =============================================================================
 * perfiles-etiquetas.js — TIPOS DE ETIQUETA (dónde agregar un nuevo tipo)
 * -----------------------------------------------------------------------------
 * El lector NO usa coordenadas fijas. Busca PALABRAS GUÍA impresas en la
 * etiqueta (ej. "QTY", "LOT#", "CUST PT#") y toma el valor que aparece a su
 * derecha o en las líneas siguientes, validándolo con un PATRÓN.
 *
 * Cómo agregar un tipo nuevo:
 *   1. Copie un bloque { id: ..., ... } de la lista PERFILES.
 *   2. Cambie id, nombre y palabrasClave (textos únicos de esa etiqueta).
 *   3. En "campos" ponga las palabras guía de cada dato.
 *   4. Guarde y recargue. En "Detalles de captura" verá qué tipo se detectó.
 *
 * Campos disponibles: producto, cantidad, lote, dateCode.
 * Propiedades de cada campo:
 *   etiquetas         palabras guía, en orden de prioridad
 *   patron            nombre de un patrón de la lista PATRONES
 *   patronesAlternos  patrones a intentar si el primero no encuentra nada
 *   lineasSiguientes  cuántas líneas debajo de la palabra guía revisar
 *   buscarSinEtiqueta si no hay palabra guía, buscar el patrón en todo el texto
 *                     (el resultado se marca "Revisar")
 *   unidades          (cantidad) unidades válidas después del número
 *   buscarPorUnidad   (cantidad) buscar "número + unidad" en todo el texto
 *   unidadesPreferidas(cantidad) prioridad cuando hay varias cantidades
 * extras: otros identificadores que se muestran para que el usuario decida
 *         (no se asignan automáticamente).
 * identificadoresANSI: true si los códigos de barras traen prefijos estándar
 *         (P=parte, Q=cantidad, 1T=lote). Solo actívelo si lo confirmó.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};

  // ===== CONFIGURACIÓN EDITABLE: PATRONES =====
  var PATRONES = {
    // Número de parte Cardinal Health observado: 8717052-2, 797077-1
    PRODUCTO_CARDINAL: /\b\d{5,8}-\d{1,3}\b/,
    // Código alfanumérico que contiene al menos un dígito: 4C04003, AJ5611, T2662201T
    CODIGO: /\b(?=[A-Z0-9\-\/.]*\d)[A-Z0-9][A-Z0-9\-\/.]{1,28}[A-Z0-9]\b/,
    // Número largo: 1000009785
    NUMERO_LARGO: /\b\d{6,12}\b/,
    // Cantidad: 6343 / 6,343 / 395.000
    NUMERO: /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/,
    // Fechas: 2026-08-18, 22-JUN-26, 18/08/2026
    FECHA: /\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b|\b\d{1,2}[-\/. ](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|ENE|ABR|AGO|DIC)[A-Z]*[-\/. ]\d{2,4}\b|\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/
  };

  // Unidades de medida reconocidas después de una cantidad
  var UNIDADES = ['LY', 'YD', 'YDS', 'LM', 'M', 'MTS', 'LB', 'LBS', 'KG', 'IN', 'MM', 'SM', 'EA', 'PCS', 'PZ', 'PZA', 'ROLL', 'ROLLS', 'CS'];
  // ===== FIN CONFIGURACIÓN =====

  // ===== CONFIGURACIÓN EDITABLE: TIPOS DE ETIQUETA =====
  var PERFILES = [
    {
      // Etiqueta tipo 1 (imagen de ejemplo con 8717052-2 / 6343 / 309187)
      id: 'ahlstrom',
      nombre: 'Ahlstrom (Customer Part No.)',
      palabrasClave: [
        { texto: 'AHLSTROM', peso: 3 },
        { texto: 'CUSTOMER PART', peso: 2 },
        { texto: 'EXT UNIT CODE', peso: 2 },
        { texto: 'CUSTOMER ORDER', peso: 1 }
      ],
      puntajeMinimo: 3,
      identificadoresANSI: false,
      campos: {
        producto: { etiquetas: ['CUSTOMER PART NO', 'CUSTOMER PART', 'CUST PART NO', 'PART NO'], patron: 'PRODUCTO_CARDINAL', patronesAlternos: ['CODIGO'], lineasSiguientes: 2, buscarSinEtiqueta: true },
        cantidad: { etiquetas: ['QUANTITY', 'QTY'], patron: 'NUMERO', lineasSiguientes: 2, unidades: UNIDADES, buscarPorUnidad: true, unidadesPreferidas: ['LY', 'YD', 'LM', 'M'] },
        lote: { etiquetas: ['LOT NO', 'LOT #', 'LOT', 'ROLL ID', 'ROLL NO', 'ROLL #', 'BATCH'], patron: 'CODIGO', lineasSiguientes: 1 },
        dateCode: { etiquetas: ['DATE CODE', 'MFG DATE', 'PROD DATE', 'DATE'], patron: 'FECHA', lineasSiguientes: 1, buscarSinEtiqueta: true }
      },
      extras: [
        { nombre: 'Customer Order', etiquetas: ['CUSTOMER ORDER'], patron: 'CODIGO' },
        { nombre: 'Ext Unit Code', etiquetas: ['EXT UNIT CODE'], patron: 'CODIGO' }
      ]
    },
    {
      // Etiqueta tipo 2 (PGI Nonwovens: CUST PT# 797077-1 / QTY 5140 LY / LOT# T2662201T)
      id: 'pgi',
      nombre: 'PGI Nonwovens (CUST PT#)',
      palabrasClave: [
        { texto: 'PGI', peso: 3 },
        { texto: 'NONWOVENS', peso: 2 },
        { texto: 'CUST PT', peso: 3 },
        { texto: 'PACK TOTALS', peso: 2 },
        { texto: 'ROLL NUMBER', peso: 1 }
      ],
      puntajeMinimo: 3,
      identificadoresANSI: false,
      campos: {
        producto: { etiquetas: ['CUST PT#', 'CUST PT', 'CUSTPT', 'CUSTOMER PART'], patron: 'PRODUCTO_CARDINAL', patronesAlternos: ['CODIGO'], lineasSiguientes: 1, buscarSinEtiqueta: true },
        cantidad: { etiquetas: ['QTY'], patron: 'NUMERO', lineasSiguientes: 1, unidades: UNIDADES, buscarPorUnidad: true, unidadesPreferidas: ['LY', 'YD', 'LM'] },
        lote: { etiquetas: ['LOT#', 'LOTH', 'LOT NO', 'LOT'], patron: 'CODIGO', lineasSiguientes: 1 },
        dateCode: { etiquetas: ['DATE'], patron: 'FECHA', lineasSiguientes: 0, buscarSinEtiqueta: true }
      },
      extras: [
        { nombre: 'Item proveedor', etiquetas: ['ITEM'], patron: 'CODIGO' },
        { nombre: 'PO', etiquetas: ['PO#', 'POH', 'PO'], patron: 'CODIGO' },
        { nombre: 'Pack', etiquetas: ['PACK#', 'PACKH', 'PACK'], patron: 'CODIGO' }
      ]
    },
    {
      // Etiqueta tipo 3 (Item: 4C04003 / Lot#: AJ5611 / Quantity: 25174 YD)
      id: 'item-lot-qty',
      nombre: 'Item / Lot# / Quantity',
      palabrasClave: [
        { texto: 'ITEM', peso: 1 },
        { texto: 'LOT#', peso: 1 },
        { texto: 'QUANTITY', peso: 1 },
        { texto: 'AIRLAY', peso: 2 }
      ],
      puntajeMinimo: 3,
      identificadoresANSI: false,
      campos: {
        producto: { etiquetas: ['ITEM'], patron: 'PRODUCTO_CARDINAL', patronesAlternos: ['CODIGO'], lineasSiguientes: 1, buscarSinEtiqueta: true },
        cantidad: { etiquetas: ['QUANTITY', 'QTY'], patron: 'NUMERO', lineasSiguientes: 1, unidades: UNIDADES, buscarPorUnidad: true, unidadesPreferidas: ['YD', 'LY', 'LM'] },
        lote: { etiquetas: ['LOT#', 'LOTH', 'LOT NO', 'LOT'], patron: 'CODIGO', lineasSiguientes: 1 },
        dateCode: { etiquetas: ['DATE CODE', 'DATE'], patron: 'FECHA', lineasSiguientes: 1, buscarSinEtiqueta: true }
      },
      extras: []
    },
    {
      // Etiqueta tipo 4 (Magnera San Luis Potosí: MATL ID / IRMS / PACK ID / 10656 LY)
      // No tiene un campo "LOT" explícito: el lote NO se llena automáticamente.
      // Si su operación usa PACK ID o W.O. como lote, el usuario lo asigna con un toque
      // (o agregue 'PACK ID' en lote.etiquetas).
      id: 'magnera-slp',
      nombre: 'Magnera SLP (MATL ID)',
      palabrasClave: [
        { texto: 'MATL ID', peso: 3 },
        { texto: 'IRMS', peso: 3 },
        { texto: 'BSWT', peso: 2 },
        { texto: 'PACK ID', peso: 2 },
        { texto: 'MAGNERA SAN LUIS', peso: 2 }
      ],
      puntajeMinimo: 3,
      identificadoresANSI: false,
      campos: {
        producto: { etiquetas: ['MATL ID', 'MATL'], patron: 'NUMERO_LARGO', patronesAlternos: ['CODIGO'], lineasSiguientes: 1 },
        cantidad: { etiquetas: [], patron: 'NUMERO', unidades: UNIDADES, buscarPorUnidad: true, unidadesPreferidas: ['LY', 'LM', 'YD', 'LB'] },
        lote: { etiquetas: [], patron: 'CODIGO' },
        dateCode: { etiquetas: [], patron: 'FECHA', buscarSinEtiqueta: true }
      },
      extras: [
        { nombre: 'W.O.', etiquetas: ['W.O.', 'WO'], patron: 'CODIGO' },
        { nombre: 'Pack ID', etiquetas: ['PACK ID'], patron: 'CODIGO' },
        { nombre: 'IRMS', etiquetas: ['IRMS'], patron: 'CODIGO' }
      ]
    },
    {
      // Perfil genérico: se usa cuando no se reconoce el tipo de etiqueta.
      id: 'generica',
      nombre: 'Genérica (no identificada)',
      palabrasClave: [],
      puntajeMinimo: 999,
      identificadoresANSI: false,
      campos: {
        producto: { etiquetas: ['CUSTOMER PART NO', 'CUSTOMER PART', 'CUST PT#', 'CUST PT', 'PART NO', 'PART #', 'P/N', 'ITEM', 'MATL ID', 'MATERIAL'], patron: 'PRODUCTO_CARDINAL', patronesAlternos: ['CODIGO'], lineasSiguientes: 1, buscarSinEtiqueta: true },
        cantidad: { etiquetas: ['QUANTITY', 'QTY', 'CANTIDAD'], patron: 'NUMERO', lineasSiguientes: 1, unidades: UNIDADES, buscarPorUnidad: true, unidadesPreferidas: ['LY', 'YD', 'LM', 'M', 'EA', 'PCS'] },
        lote: { etiquetas: ['LOT NO', 'LOT#', 'LOTH', 'LOT', 'LOTE', 'BATCH'], patron: 'CODIGO', lineasSiguientes: 1 },
        dateCode: { etiquetas: ['DATE CODE', 'MFG DATE', 'DATE'], patron: 'FECHA', lineasSiguientes: 1, buscarSinEtiqueta: true }
      },
      extras: [
        { nombre: 'PO', etiquetas: ['PO#', 'PO NO'], patron: 'CODIGO' }
      ]
    }
  ];
  // ===== FIN CONFIGURACIÓN =====

  R.Etiquetas = {
    PATRONES: PATRONES,
    UNIDADES: UNIDADES,
    PERFILES: PERFILES,
    PERFIL_GENERICO: 'generica',
    obtener: function (id) {
      return PERFILES.find(function (p) { return p.id === id; }) || PERFILES.find(function (p) { return p.id === 'generica'; });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
