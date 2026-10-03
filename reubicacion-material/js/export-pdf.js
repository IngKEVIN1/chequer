/* =============================================================================
 * export-pdf.js — Genera el PDF que representa el formato físico.
 * Librerías: jsPDF + jsPDF-AutoTable (locales en libs/jspdf).
 * Se dibuja en vectores (texto real, nítido, buscable y ligero) en lugar de
 * una "foto" de la pantalla con html2canvas, que pesaría más, se vería
 * borrosa al imprimir y cortaría filas entre páginas.
 *
 * ===== DÓNDE CAMBIAR EL FORMATO DEL PDF =====
 *   - Tamaño, orientación, márgenes, letra, filas vacías, firma: config.js > PDF
 *   - Colores y logo: config.js > COLORES / LOGO
 *   - Diseño del encabezado: función dibujarEncabezado()
 *   - Columnas y anchos: función definirColumnas()
 * ===== FIN =====
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion = root.Reubicacion || {};
  var U = R.Utils;

  function definirColumnas(CP) {
    var c = [];
    if (CP.INCLUIR_NUMERO_FILA) c.push({ clave: 'num', titulo: '#', ancho: 8, alinear: 'center' });
    c.push(
      { clave: 'producto', titulo: 'PRODUCTO', ancho: 32, alinear: 'left', negrita: true },
      { clave: 'cantidad', titulo: 'CANTIDAD', ancho: 22, alinear: 'right' },
      { clave: 'origen', titulo: 'UBICACIÓN\nORIGEN', ancho: 24, alinear: 'center' },
      { clave: 'a', titulo: 'A', ancho: 7, alinear: 'center' },
      { clave: 'destino', titulo: 'UBICACIÓN\nDESTINO', ancho: 24, alinear: 'center' },
      { clave: 'comentarios', titulo: 'COMENTARIOS', ancho: 'auto', alinear: 'left' }
    );
    return c;
  }

  var P = {};

  /**
   * @param {Object} mov movimiento validado
   * @returns {Promise<{blob:Blob, nombre:string}>}
   */
  P.generar = async function (mov) {
    try {
      await U.cargarLibreria('pdf');
    } catch (e) {
      throw new Error('No se pudo cargar el generador de PDF. ' + e.message);
    }
    var jsPDF = root.jspdf && root.jspdf.jsPDF;
    if (!jsPDF) throw new Error('La librería jsPDF no está disponible.');

    var C = root.APP_CONFIG, CP = C.PDF;
    var doc = new jsPDF({ orientation: CP.ORIENTACION, unit: 'mm', format: CP.TAMANO });
    if (typeof doc.autoTable !== 'function') throw new Error('Falta el complemento de tablas (jspdf.plugin.autotable.min.js).');

    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = CP.MARGEN_MM;
    var rojo = U.hexARgb(C.COLORES.PRIMARIO);
    var gris = U.hexARgb(C.COLORES.SECUNDARIO);
    var logo = CP.INCLUIR_LOGO ? await U.obtenerLogo() : null;
    var altoLogo = C.LOGO.ALTO_PDF_MM;
    var altoCaja = 12;
    var inicioTabla = M + Math.max(altoLogo, altoCaja) + 16;

    function dibujarEncabezado() {
      var y = M;
      // Logo (o nombre de empresa si no hay logo)
      if (logo) {
        var w = altoLogo * logo.ancho / logo.alto, h = altoLogo;
        if (w > 70) { h = h * 70 / w; w = 70; }
        doc.addImage(logo.dataURL, 'PNG', M, y, w, h, 'logo', 'FAST'); // 'FAST' comprime la imagen
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(rojo[0], rojo[1], rojo[2]);
        doc.text(C.EMPRESA.NOMBRE, M, y + 7);
      }
      // Caja de REFERENCIA (arriba a la derecha, como el formato físico)
      var anchoCaja = 52, xCaja = W - M - anchoCaja;
      doc.setDrawColor(gris[0], gris[1], gris[2]);
      doc.setLineWidth(0.3);
      doc.rect(xCaja, y, anchoCaja, altoCaja);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(gris[0], gris[1], gris[2]);
      doc.text('REFERENCIA', xCaja + 2, y + 3.6);
      var tamRef = 14;
      doc.setFontSize(tamRef);
      while (doc.getTextWidth(String(mov.referencia)) > anchoCaja - 4 && tamRef > 7) { tamRef -= 1; doc.setFontSize(tamRef); }
      doc.setTextColor(20, 20, 20);
      doc.text(String(mov.referencia), xCaja + anchoCaja - 2, y + 10, { align: 'right' });

      // Título subrayado
      y += Math.max(altoLogo, altoCaja) + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(25, 25, 25);
      doc.text(C.TEXTOS.TITULO_FORMATO, W / 2, y, { align: 'center' });
      var anchoTitulo = doc.getTextWidth(C.TEXTOS.TITULO_FORMATO);
      doc.setDrawColor(rojo[0], rojo[1], rojo[2]);
      doc.setLineWidth(0.7);
      doc.line(W / 2 - anchoTitulo / 2, y + 1.8, W / 2 + anchoTitulo / 2, y + 1.8);

      // Línea informativa
      y += 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(gris[0], gris[1], gris[2]);
      doc.text(C.EMPRESA.NOMBRE + (C.EMPRESA.ALMACEN ? ' | ' + C.EMPRESA.ALMACEN : ''), M, y);
      doc.text('Fecha: ' + U.fechaDMY(mov.fecha), W - M, y, { align: 'right' });
    }

    // --- Tabla ------------------------------------------------------------------
    var cols = definirColumnas(CP);
    var indiceA = cols.findIndex(function (c) { return c.clave === 'a'; });
    var head = [cols.map(function (c) { return c.titulo; })];
    var body = mov.filas.map(function (f, i) {
      var v = {
        num: String(i + 1),
        producto: f.producto,
        cantidad: U.formatearNumero(f.cantidad) + (f.unidad && !C.COMENTARIOS.INCLUIR_UNIDAD ? ' ' + f.unidad : ''),
        origen: f.origen || '',
        a: 'A',
        destino: f.destino || '',
        comentarios: R.Productos.componerComentarios(f)
      };
      return cols.map(function (c) { return v[c.clave]; });
    });
    while (body.length < CP.FILAS_MINIMAS) {
      body.push(cols.map(function (c) { return c.clave === 'a' ? 'A' : ''; }));
    }
    var columnStyles = {};
    cols.forEach(function (c, i) {
      columnStyles[i] = { cellWidth: c.ancho, halign: c.alinear };
      if (c.negrita) columnStyles[i].fontStyle = 'bold';
      if (c.clave === 'a') { columnStyles[i].fillColor = [236, 237, 238]; columnStyles[i].textColor = gris; columnStyles[i].fontStyle = 'bold'; }
    });

    doc.autoTable({
      head: head,
      body: body,
      startY: inicioTabla,
      theme: 'grid',
      margin: { top: inicioTabla, left: M, right: M, bottom: 18 },
      styles: {
        font: 'helvetica', fontSize: CP.TAMANO_LETRA, cellPadding: 1.8, minCellHeight: 7,
        lineColor: [170, 172, 175], lineWidth: 0.2, textColor: [25, 25, 25], valign: 'middle', overflow: 'linebreak'
      },
      headStyles: { fillColor: rojo, textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: CP.TAMANO_LETRA - 0.5 },
      alternateRowStyles: { fillColor: [248, 248, 249] },
      columnStyles: columnStyles,
      rowPageBreak: 'avoid',
      didParseCell: function (data) {
        if (data.section === 'head' && data.column.index === indiceA) data.cell.styles.fillColor = gris;
        if (data.section === 'body' && data.column.index === indiceA) data.cell.styles.fillColor = [236, 237, 238];
      },
      didDrawPage: dibujarEncabezado
    });

    // --- Montacarguista y fecha (parte inferior, como el formato físico) ----------
    var y = doc.lastAutoTable.finalY + 14;
    var altoPie = CP.LINEA_FIRMA_CHECKER ? 26 : 14;
    if (y + altoPie > H - 18) {
      doc.addPage();
      dibujarEncabezado();
      y = inicioTabla + 8;
    }
    function lineaDato(etiqueta, valor, x1, x2, yy) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(gris[0], gris[1], gris[2]);
      doc.text(etiqueta, x1, yy);
      var xi = x1 + doc.getTextWidth(etiqueta) + 2;
      doc.setDrawColor(90, 90, 90);
      doc.setLineWidth(0.3);
      doc.line(xi, yy + 1, x2, yy + 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(20, 20, 20);
      doc.text(String(valor || ''), xi + 1.5, yy - 0.6);
    }
    lineaDato('MONTACARGUISTA:', mov.montacarguista, M, W * 0.58, y);
    lineaDato('FECHA:', U.fechaDMY(mov.fecha), W * 0.66, W - M, y);
    if (CP.LINEA_FIRMA_CHECKER) lineaDato('CHECKER:', '', M, W * 0.58, y + 12);

    // --- Número de página -----------------------------------------------------------
    var total = doc.getNumberOfPages();
    var generado = 'Generado: ' + U.fechaDMY(U.hoyISO()) + ' ' + U.horaCorta(new Date().toISOString()) + ' | ' + mov.filas.length + ' fila(s)';
    for (var i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(gris[0], gris[1], gris[2]);
      doc.text(generado, M, H - 8);
      doc.text('Página ' + i + ' de ' + total, W - M, H - 8, { align: 'right' });
    }

    doc.setProperties({ title: C.TEXTOS.TITULO_FORMATO + ' ' + mov.referencia, author: C.EMPRESA.NOMBRE, creator: C.EMPRESA.NOMBRE });
    var blob;
    try {
      blob = doc.output('blob');
    } catch (e) {
      throw new Error('No se pudo crear el archivo PDF: ' + (e.message || e));
    }
    return { blob: blob, nombre: U.nombreArchivo(CP.PREFIJO_ARCHIVO, mov.referencia, mov.fecha, 'pdf') };
  };

  R.ExportPDF = P;
})(window);
