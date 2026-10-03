/* =============================================================================
 * tests/casos.js — Pruebas automáticas de la lógica (agrupación, validación,
 * cantidades, intérprete de etiquetas y guardado). Se ejecutan abriendo
 * tests/pruebas.html en el navegador.
 * ========================================================================== */
(function (root) {
  'use strict';

  var R = root.Reubicacion;

  function prueba(nombre, fn) {
    try {
      var detalle = fn();
      return { nombre: nombre, ok: true, detalle: detalle || '' };
    } catch (e) {
      return { nombre: nombre, ok: false, detalle: e.message };
    }
  }
  function igual(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'Valor inesperado') + ': se obtuvo ' + JSON.stringify(a) + ', se esperaba ' + JSON.stringify(b));
  }
  function agregarVarios(lista) {
    var filas = [];
    lista.forEach(function (d) { filas = R.Productos.agregarOSumar(filas, d).filas; });
    return filas;
  }

  var TEXTOS = {
    ahlstrom: 'AHLSTROM\nCustomer Part No.      Customer Order\n8717052-2              STOCK\nQuantity\n6343                   WL264A0N/185753\nCARDINAL HEALTH 200, LLC\nRoll ID 309187',
    pgi: 'PGI Nonwovens (China), A Magnera Entity   22-Jun-26\nItem SCD7111F-2V47ST1\nCUST PT# 797077-1\nUNITS 1\nQTY 5140 LY\nPO# 66279   LOTH T2662201T\nPACK# 4287632',
    airlay: 'Item: 4C04003, AIRLAY 11"\nLot#: AJ5611\nQuantity: 25174   YD',
    magnera: 'MAGNERA SAN LUIS POTOSI, S.L.P.,MEXICO\nW.O.: 1071844\nMATL ID: 1000009785   IRMS: 202829\nWIDTH: 737 MM   10656 LY   2026-08-18\nBSWT: 25.000 GSM   395.000 LB\nPACK ID: L070202894   9744 LM'
  };

  function ejecutar() {
    var P = R.Productos, I = R.Interprete;
    return [
      prueba('CASO 1: Producto A lote 1 (100) + Producto A lote 1 (50) = una fila de 150', function () {
        var f = agregarVarios([{ producto: '8717052-2', cantidad: 100, lote: '309187' }, { producto: '8717052-2', cantidad: 50, lote: '309187' }]);
        igual(f.length, 1, 'Filas'); igual(f[0].cantidad, 150, 'Cantidad');
        return '1 fila, cantidad 150';
      }),
      prueba('CASO 2: Producto A lote 1 + Producto A lote 2 = 2 filas', function () {
        var f = agregarVarios([{ producto: '8717052-2', cantidad: 100, lote: '309187' }, { producto: '8717052-2', cantidad: 50, lote: '555555' }]);
        igual(f.length, 2, 'Filas'); igual([f[0].cantidad, f[1].cantidad], [100, 50]);
        return '2 filas (100 y 50)';
      }),
      prueba('CASO 3: Producto A con lote + Producto A sin lote = 2 filas', function () {
        var f = agregarVarios([{ producto: '8717052-2', cantidad: 100, lote: '309187' }, { producto: '8717052-2', cantidad: 50, lote: '' }]);
        igual(f.length, 2, 'Filas');
        return '2 filas';
      }),
      prueba('CASO 4: Producto A + Producto B = 2 filas', function () {
        var f = agregarVarios([{ producto: 'A-100', cantidad: 100 }, { producto: 'B-200', cantidad: 200 }]);
        igual(f.length, 2, 'Filas');
        return '2 filas';
      }),
      prueba('Ejemplo del requerimiento: 100+50 lote 309187, 75 lote 555555, 30 sin lote = 3 filas', function () {
        var f = agregarVarios([
          { producto: '8717052-2', cantidad: 100, lote: '309187' }, { producto: '8717052-2', cantidad: 50, lote: '309187' },
          { producto: '8717052-2', cantidad: 75, lote: '555555' }, { producto: '8717052-2', cantidad: 30, lote: '' }
        ]);
        igual(f.map(function (x) { return [x.cantidad, x.lote]; }), [[150, '309187'], [75, '555555'], [30, '']]);
        igual(P.componerComentarios(f[0]), 'Lote: 309187', 'Comentario');
        return '150 / 75 / 30; comentario "Lote: 309187"';
      }),
      prueba('Mayúsculas/espacios no separan el mismo producto y lote', function () {
        var f = agregarVarios([{ producto: '8717052-2', cantidad: 1, lote: 'aj5611' }, { producto: ' 8717052-2 ', cantidad: 2, lote: 'AJ5611' }]);
        igual(f.length, 1); igual(f[0].cantidad, 3);
      }),
      prueba('Unidades distintas (LY vs LB) no se suman', function () {
        var f = agregarVarios([{ producto: 'X-1', cantidad: 10, unidad: 'LY' }, { producto: 'X-1', cantidad: 5, unidad: 'LB' }]);
        igual(f.length, 2);
      }),
      prueba('CASO 5: OCR sin producto -> campo vacío marcado "revisar" (captura manual)', function () {
        var r = I.interpretar({ texto: 'texto ilegible ###', codigos: [] });
        igual(r.campos.producto.valor, ''); igual(r.campos.producto.estado, 'revisar');
        return 'Producto vacío, estado revisar';
      }),
      prueba('CASO 6: cantidad inválida se rechaza; la corregida se acepta', function () {
        igual(P.parsearCantidad('12a').ok, false); igual(P.parsearCantidad('').ok, false); igual(P.parsearCantidad('0').ok, false);
        igual(P.parsearCantidad('6,343').valor, 6343); igual(P.parsearCantidad('395.5').valor, 395.5); igual(P.parsearCantidad('12,5').valor, 12.5);
        return '"12a", "" y "0" rechazadas; "6,343" = 6343';
      }),
      prueba('CASO 7: falta destino -> mensaje con número de fila', function () {
        var mov = P.crearMovimiento(); mov.referencia = '71308';
        mov.filas = agregarVarios([{ producto: 'A', cantidad: 1, destino: 'K0104' }, { producto: 'B', cantidad: 2 }]);
        var e = P.validarMovimiento(mov);
        igual(e.length, 1); igual(e[0].mensaje, 'Falta ubicación destino en la fila 2.');
        mov.filas[1].destino = 'K0201';
        igual(P.validarMovimiento(mov).length, 0, 'Tras corregir');
        return e[0].mensaje;
      }),
      prueba('No se exporta un documento vacío ni sin referencia', function () {
        var mov = P.crearMovimiento();
        var m = P.validarMovimiento(mov).map(function (x) { return x.mensaje; });
        if (m.indexOf('Falta la referencia.') < 0 || m.indexOf('Debe capturar al menos un producto.') < 0) throw new Error(m.join(' / '));
        return m.join(' / ');
      }),
      prueba('DIVIDIR: 150 -> 100 + 50 conservando producto y lote', function () {
        var f = agregarVarios([{ producto: 'A', cantidad: 150, lote: 'L1', origen: 'K0104' }]);
        var r = P.dividirFila(f, f[0].id, 50);
        igual(r.filas.map(function (x) { return [x.cantidad, x.lote, x.origen]; }), [[100, 'L1', 'K0104'], [50, 'L1', 'K0104']]);
        var falla = false; try { P.dividirFila(f, f[0].id, 150); } catch (e) { falla = true; }
        igual(falla, true, 'Debe rechazar dividir la cantidad completa');
      }),
      prueba('CASO 9: guardar y recuperar movimiento (localStorage)', function () {
        if (!R.Storage.disponible()) return 'Guardado local no disponible en este navegador (se omite)';
        var mov = P.crearMovimiento(); mov.referencia = 'PRUEBA-9';
        mov.filas = agregarVarios([{ producto: 'A', cantidad: 5, lote: 'L' }]);
        var previo = R.Storage.cargarMovimiento();
        R.Storage.guardarMovimiento(mov);
        var leido = R.Storage.cargarMovimiento();
        if (previo) R.Storage.guardarMovimiento(previo); else R.Storage.borrarMovimiento();
        igual(leido.referencia, 'PRUEBA-9'); igual(leido.filas[0].cantidad, 5);
        return 'Recuperado correctamente';
      }),
      prueba('Etiqueta Ahlstrom: 8717052-2 / 6343 / lote 309187 (confirmado por código de barras)', function () {
        var r = I.interpretar({ texto: TEXTOS.ahlstrom, codigos: [{ texto: '8717052-2' }, { texto: '309187' }] });
        igual(r.perfil.id, 'ahlstrom'); igual(r.campos.producto.valor, '8717052-2'); igual(r.campos.cantidad.valor, '6343'); igual(r.campos.lote.valor, '309187');
        igual(r.campos.producto.fuente, 'OCR+BARCODE');
      }),
      prueba('Etiqueta PGI: 797077-1 / 5140 LY / lote T2662201T', function () {
        var r = I.interpretar({ texto: TEXTOS.pgi });
        igual(r.perfil.id, 'pgi'); igual([r.campos.producto.valor, r.campos.cantidad.valor, r.campos.cantidad.unidad, r.campos.lote.valor], ['797077-1', '5140', 'LY', 'T2662201T']);
      }),
      prueba('Etiqueta Item/Lot#/Quantity: 4C04003 / 25174 / AJ5611', function () {
        var r = I.interpretar({ texto: TEXTOS.airlay });
        igual([r.campos.producto.valor, r.campos.cantidad.valor, r.campos.lote.valor], ['4C04003', '25174', 'AJ5611']);
      }),
      prueba('Etiqueta Magnera: MATL ID 1000009785 / 10656 LY ("Revisar"), sin lote inventado', function () {
        var r = I.interpretar({ texto: TEXTOS.magnera });
        igual(r.perfil.id, 'magnera-slp'); igual(r.campos.producto.valor, '1000009785');
        igual([r.campos.cantidad.valor, r.campos.cantidad.estado], ['10656', 'revisar']); igual(r.campos.lote.valor, '');
      }),
      prueba('OCR con errores (8717O52-2) se corrige con el código de barras', function () {
        var r = I.interpretar({ texto: 'Customer Part No.\n8717O52-2', codigos: [{ texto: '8717052-2' }] });
        igual(r.campos.producto.valor, '8717052-2');
      }),
      prueba('Código de barras distinto al texto: gana el código estructurado y se marca Revisar', function () {
        var r = I.interpretar({ texto: 'QTY 100', codigos: [{ texto: '(30)120' }] });
        igual([r.campos.cantidad.valor, r.campos.cantidad.estado], ['120', 'revisar']);
      }),
      prueba('Un código de barras sin prefijo NO se asume como número de parte si no tiene ese formato', function () {
        var r = I.interpretar({ texto: '', codigos: [{ texto: '361800366685' }] });
        igual(r.campos.producto.valor, '');
      })
    ];
  }

  R.Pruebas = { ejecutar: ejecutar };
})(typeof window !== 'undefined' ? window : globalThis);
