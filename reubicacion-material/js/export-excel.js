/* =============================================================================
 * export-excel.js — Genera el Excel (.xlsx) con formato profesional.
 * Librería: ExcelJS (local en libs/exceljs). Se eligió en lugar de SheetJS
 * gratuito porque SheetJS Community NO escribe estilos (colores, bordes,
 * negritas) y el formato profesional es un requisito.
 *
 * ===== DÓNDE CAMBIAR EL FORMATO DEL EXCEL =====
 *   - Anchos, logo, orientación, columna "#": config.js > EXCEL
 *   - Colores: config.js > COLORES
 *   - Estructura (filas de encabezado, estilos): constantes y funciones de abajo
 * ===== FIN =====
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  var FILA_ENCABEZADO = 7;  // fila de títulos de la tabla (se congela)
  var BORDE = { style: 'thin', color: { argb: 'FFB8BBBF' } };
  var BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

  function argb(hex) { return 'FF' + String(hex || '#000000').replace('#', '').toUpperCase(); }

  function columnas(X) {
    var c = [];
    if (X.INCLUIR_NUMERO_FILA) c.push({ clave: 'num', titulo: '#', ancho: X.ANCHOS.NUMERO });
    c.push(
      { clave: 'producto', titulo: 'PRODUCTO', ancho: X.ANCHOS.PRODUCTO },
      { clave: 'cantidad', titulo: 'CANTIDAD', ancho: X.ANCHOS.CANTIDAD },
      { clave: 'origen', titulo: 'UBICACIÓN ORIGEN', ancho: X.ANCHOS.ORIGEN },
      { clave: 'a', titulo: 'A', ancho: X.ANCHOS.A },
      { clave: 'destino', titulo: 'UBICACIÓN DESTINO', ancho: X.ANCHOS.DESTINO },
      { clave: 'comentarios', titulo: 'COMENTARIOS', ancho: X.ANCHOS.COMENTARIOS }
    );
    return c;
  }

  /** Estima alto de fila para que el texto ajustado se vea completo. */
  function altoFila(texto, anchoColumna) {
    var caracteresPorLinea = Math.max(10, Math.floor(anchoColumna * 1.15));
    var lineas = String(texto || '').split('\n').reduce(function (t, l) {
      return t + Math.max(1, Math.ceil(l.length / caracteresPorLinea));
    }, 0);
    return Math.max(20, lineas * 15 + 4);
  }

  var X = {};

  /**
   * @param {Object} mov movimiento validado
   * @returns {Promise<{blob:Blob, nombre:string}>}
   */
  X.generar = async function (mov) {
    var ExcelJS;
    try {
      ExcelJS = await U.cargarLibreria('excel');
    } catch (e) {
      throw new Error('No se pudo cargar el generador de Excel. ' + e.message);
    }
    var C = root.APP_CONFIG, CX = C.EXCEL;
    var cols = columnas(CX);
    var n = cols.length;
    var colorPrimario = argb(C.COLORES.PRIMARIO);
    var colorGris = argb(C.COLORES.SECUNDARIO);

    var wb = new ExcelJS.Workbook();
    wb.creator = C.EMPRESA.NOMBRE;
    wb.created = new Date();
    wb.title = C.TEXTOS.TITULO_FORMATO + ' ' + mov.referencia;

    var ws = wb.addWorksheet(CX.NOMBRE_HOJA.slice(0, 31), {
      views: [{ state: 'frozen', xSplit: 0, ySplit: FILA_ENCABEZADO, topLeftCell: 'A' + (FILA_ENCABEZADO + 1), activeCell: 'A' + (FILA_ENCABEZADO + 1) }],
      pageSetup: {
        paperSize: C.PDF.TAMANO === 'a4' ? 9 : 1,
        orientation: CX.ORIENTACION,
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
      },
      headerFooter: { oddFooter: '&L&8' + C.EMPRESA.NOMBRE + ' | Ref. ' + mov.referencia + '&R&8Página &P de &N' }
    });
    ws.columns = cols.map(function (c) { return { key: c.clave, width: c.ancho }; });

    // --- Fila 1: logo + empresa -----------------------------------------
    var logo = CX.INCLUIR_LOGO ? await U.obtenerLogo() : null;
    ws.mergeCells(1, 1, 1, n);
    var c1 = ws.getCell(1, 1);
    c1.value = C.EMPRESA.NOMBRE + (C.EMPRESA.ALMACEN ? ' | ' + C.EMPRESA.ALMACEN : '');
    c1.font = logo ? { size: 10, color: { argb: colorGris } } : { size: 14, bold: true, color: { argb: colorPrimario } };
    c1.alignment = { horizontal: logo ? 'right' : 'left', vertical: 'middle' };
    ws.getRow(1).height = Math.max(30, (C.LOGO.ALTO_EXCEL_PX + 10) * 0.75);
    if (logo) {
      var idImagen = wb.addImage({ base64: logo.dataURL, extension: 'png' });
      var alto = C.LOGO.ALTO_EXCEL_PX;
      ws.addImage(idImagen, { tl: { col: 0.1, row: 0.12 }, ext: { width: Math.round(alto * logo.ancho / logo.alto), height: alto }, editAs: 'oneCell' });
    }

    // --- Fila 2: título ----------------------------------------------------
    ws.mergeCells(2, 1, 2, n);
    var titulo = ws.getCell(2, 1);
    titulo.value = C.TEXTOS.TITULO_FORMATO;
    titulo.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorPrimario } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 28;
    ws.getRow(3).height = 6;

    // --- Filas 4-5: datos generales ----------------------------------------
    var colEtqDer = n - 1;
    function dato(fila, col, etiqueta, valor, colFinValor) {
      var e = ws.getCell(fila, col);
      e.value = etiqueta;
      e.font = { bold: true, size: 10, color: { argb: colorGris } };
      e.alignment = { horizontal: 'right', vertical: 'middle' };
      if (colFinValor && colFinValor > col + 1) ws.mergeCells(fila, col + 1, fila, colFinValor);
      var v = ws.getCell(fila, col + 1);
      v.value = valor;
      v.font = { bold: true, size: 12 };
      v.alignment = { horizontal: 'left', vertical: 'middle' };
      v.border = { bottom: { style: 'thin', color: { argb: 'FF8A8D91' } } };
      v.numFmt = '@';
    }
    dato(4, 1, 'REFERENCIA:', String(mov.referencia), 3);
    dato(4, colEtqDer, 'FECHA:', U.fechaDMY(mov.fecha));
    dato(5, 1, 'MONTACARGUISTA:', String(mov.montacarguista || ''), 3);
    dato(5, colEtqDer, 'ALMACÉN:', String(C.EMPRESA.ALMACEN || ''));
    ws.getRow(4).height = 22;
    ws.getRow(5).height = 22;
    ws.getRow(6).height = 8;

    // --- Fila 7: encabezados -------------------------------------------------
    var enc = ws.getRow(FILA_ENCABEZADO);
    cols.forEach(function (c, i) {
      var cel = enc.getCell(i + 1);
      cel.value = c.titulo;
      cel.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.clave === 'a' ? colorGris : colorPrimario } };
      cel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cel.border = BORDES;
    });
    enc.height = 24;

    // --- Datos ---------------------------------------------------------------
    mov.filas.forEach(function (f, idx) {
      var valores = {
        num: idx + 1,
        producto: String(f.producto),               // texto: conserva ceros iniciales
        cantidad: Number(f.cantidad),               // número real para sumar en Excel
        origen: String(f.origen || ''),
        a: 'A',
        destino: String(f.destino || ''),
        comentarios: R.Productos.componerComentarios(f)
      };
      var fila = ws.getRow(FILA_ENCABEZADO + 1 + idx);
      var cebra = CX.FILAS_CEBRA && idx % 2 === 1;
      cols.forEach(function (c, i) {
        var cel = fila.getCell(i + 1);
        cel.value = valores[c.clave];
        cel.border = BORDES;
        cel.font = { size: 11 };
        cel.alignment = { vertical: 'middle', horizontal: 'left' };
        if (cebra) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6F7' } };
        switch (c.clave) {
          case 'num': cel.alignment = { vertical: 'middle', horizontal: 'center' }; cel.font = { size: 10, color: { argb: colorGris } }; break;
          case 'producto': cel.numFmt = '@'; cel.font = { size: 11, bold: true }; break;
          case 'cantidad':
            cel.numFmt = Math.floor(valores.cantidad) === valores.cantidad ? '#,##0' : '#,##0.###';
            cel.alignment = { vertical: 'middle', horizontal: 'right' };
            break;
          case 'origen': case 'destino': cel.numFmt = '@'; cel.alignment = { vertical: 'middle', horizontal: 'center' }; break;
          case 'a':
            cel.alignment = { vertical: 'middle', horizontal: 'center' };
            cel.font = { size: 10, bold: true, color: { argb: colorGris } };
            cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECEDEE' } };
            break;
          case 'comentarios': cel.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; break;
        }
      });
      fila.height = altoFila(valores.comentarios, CX.ANCHOS.COMENTARIOS);
    });

    // --- Pie -------------------------------------------------------------------
    var filaPie = FILA_ENCABEZADO + mov.filas.length + 2;
    var pie = ws.getCell(filaPie, 1);
    pie.value = 'Total de filas: ' + mov.filas.length + '   |   Generado: ' + U.fechaDMY(U.hoyISO()) + ' ' + U.horaCorta(new Date().toISOString());
    pie.font = { size: 9, italic: true, color: { argb: colorGris } };
    ws.mergeCells(filaPie, 1, filaPie, n);

    ws.autoFilter = { from: { row: FILA_ENCABEZADO, column: 1 }, to: { row: FILA_ENCABEZADO, column: n } };
    ws.pageSetup.printTitlesRow = FILA_ENCABEZADO + ':' + FILA_ENCABEZADO;

    var buffer;
    try {
      buffer = await wb.xlsx.writeBuffer();
    } catch (e) {
      throw new Error('No se pudo crear el archivo Excel: ' + (e.message || e));
    }
    return {
      blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      nombre: U.nombreArchivo(CX.PREFIJO_ARCHIVO, mov.referencia, mov.fecha, 'xlsx')
    };
  };

  R.ExportExcel = X;
})(window);
