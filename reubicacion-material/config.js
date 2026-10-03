/* =============================================================================
 * config.js — CONFIGURACIÓN GENERAL DE LA APLICACIÓN
 * -----------------------------------------------------------------------------
 * Este es el archivo que normalmente necesitará modificar.
 * Cambie SOLO los valores (lo que está a la derecha de los dos puntos).
 * Después de modificarlo:
 *   - En PC (archivo local): recargue la página (F5).
 *   - Si usa la app instalada (PWA): suba el número CACHE_VERSION en
 *     service-worker.js para que las tablets descarguen la nueva versión.
 *
 * Los TIPOS DE ETIQUETA (OCR) se configuran en: js/perfiles-etiquetas.js
 * ========================================================================== */
(function () {
  'use strict';

  // ===== CONFIGURACIÓN EDITABLE =====
  var CONFIG = {

    VERSION: '1.0.0',

    // ---------------------------------------------------------------------
    // EMPRESA  (aparece en encabezado, PDF y Excel)
    // ---------------------------------------------------------------------
    EMPRESA: {
      NOMBRE: 'Cardinal Health',          // <-- CAMBIAR NOMBRE DE EMPRESA AQUÍ
      ALMACEN: 'Almacén'                  // <-- CAMBIAR NOMBRE DEL ALMACÉN AQUÍ
    },

    // ---------------------------------------------------------------------
    // TEXTOS DE LA INTERFAZ
    // ---------------------------------------------------------------------
    TEXTOS: {
      TITULO_APP: 'Reubicación de material',
      SUBTITULO: 'Formato digital de movimientos de almacén',
      TITULO_FORMATO: 'FORMATO PARA REUBICAR MATERIAL EN ALMACÉN'
    },

    // ---------------------------------------------------------------------
    // COLORES  (formato hexadecimal #RRGGBB)
    // Se aplican a la interfaz, PDF y Excel.
    // El color de la barra del sistema en la app instalada está en manifest.json
    // ---------------------------------------------------------------------
    COLORES: {
      PRIMARIO: '#E4002B',          // <-- ROJO CORPORATIVO (ajústelo a su manual de marca)
      PRIMARIO_OSCURO: '#B5001F',   // rojo para estados presionados
      SECUNDARIO: '#5B6064',        // gris de textos secundarios
      GRIS_CLARO: '#F2F3F4',        // fondos suaves
      BORDE: '#D5D7DA'              // bordes de tablas y campos
    },

    // ---------------------------------------------------------------------
    // LOGO
    // Coloque su archivo de logo en:  assets/logo.png
    // (reemplace el archivo de ejemplo con el mismo nombre)
    // ---------------------------------------------------------------------
    LOGO: {
      RUTA: 'assets/logo.png',            // <-- RUTA / NOMBRE DEL ARCHIVO DEL LOGO
      TEXTO_ALTERNATIVO: 'Cardinal Health',
      ALTO_PDF_MM: 11,                    // alto del logo en el PDF (milímetros)
      ALTO_EXCEL_PX: 38                   // alto del logo en el Excel (píxeles)
    },

    // ---------------------------------------------------------------------
    // CORREO
    // ---------------------------------------------------------------------
    CORREO: {
      DESTINO_PREDETERMINADO: '',         // <-- CORREO SUGERIDO la primera vez (puede quedar vacío)
      ASUNTO_PREFIJO: 'MOVIMIENTOS - ',   // asunto = prefijo + referencia
      CUERPO_TITULO: 'Movimiento de reubicación de material',

      // Envío automático REAL (opcional, futuro). Requiere un servicio propio
      // (por ejemplo Power Automate o un pequeño backend). Ver README, sección
      // "Envío automático (opcional)". Mientras HABILITADO sea false, el botón
      // correspondiente no aparece y la app no depende de ningún servidor.
      ENVIO_AUTOMATICO: {
        HABILITADO: false,
        URL: '',                          // ej. https://prod-00.westus.logic.azure.com/...
        TOKEN: ''                         // opcional, se envía en el encabezado Authorization
      }
    },

    // ---------------------------------------------------------------------
    // CAPTURA: cámara, código de barras y OCR
    // (Los patrones de cada tipo de etiqueta están en js/perfiles-etiquetas.js)
    // ---------------------------------------------------------------------
    CAPTURA: {
      // 'auto'      = tablets/celulares usan la cámara nativa; PC usa la cámara del navegador
      // 'nativa'    = siempre usar la cámara del sistema (input de archivo)
      // 'navegador' = siempre usar la vista de cámara dentro de la app
      MODO_CAMARA: 'auto',
      USAR_CODIGO_BARRAS: true,           // intentar leer códigos antes que el OCR
      USAR_OCR: true,                     // leer texto de la etiqueta
      OCR_IDIOMA: 'eng',                  // las etiquetas están en inglés
      OCR_MODO_PAGINA: '3',               // 3 = automático, 6 = bloque, 11 = texto disperso
      TAMANO_MAX_OCR: 2000,               // px del lado mayor para OCR (más = lento, más preciso)
      TAMANO_MAX_CODIGOS: 1600,           // px del lado mayor para lectura de códigos
      MAX_CODIGOS_POR_FOTO: 8,            // máximo de códigos a buscar en una foto
      ROTACION_AUTOMATICA: true,          // si la lectura es pobre, prueba la imagen girada 90° y 270°
      RECORDAR_ULTIMO_ORIGEN: true        // prellenar ubicación origen con la última usada
    },

    // ---------------------------------------------------------------------
    // UBICACIONES
    // ---------------------------------------------------------------------
    UBICACIONES: {
      FORZAR_MAYUSCULAS: true,
      // Patrón para reconocer una ubicación al escanearla (ej. K0104, A-12-03)
      PATRON_UBICACION: /^[A-Z]{1,3}[-\s]?\d{2,5}([-\s]?\d{1,3}){0,2}[A-Z]?$/
    },

    // ---------------------------------------------------------------------
    // REGLAS DE AGRUPACIÓN  (dónde modificar cuándo se suman cantidades)
    // Regla base (no editable): mismo PRODUCTO + mismo LOTE = se suma.
    // Lote distinto o con/sin lote = fila nueva. Producto distinto = fila nueva.
    // ---------------------------------------------------------------------
    AGRUPACION: {
      SEPARAR_POR_UNIDAD: true,           // no sumar si las unidades son distintas (LY vs LB)
      SEPARAR_POR_ORIGEN: false           // true = no sumar si la ubicación origen es distinta
    },

    // ---------------------------------------------------------------------
    // VALIDACIONES antes de exportar
    // ---------------------------------------------------------------------
    VALIDACION: {
      MONTACARGUISTA_OBLIGATORIO: false,
      ORIGEN_OBLIGATORIO: false,
      PERMITIR_DECIMALES: true,           // las etiquetas manejan LB/LY con decimales
      CANTIDAD_MAXIMA: 9999999
    },

    // ---------------------------------------------------------------------
    // COMENTARIOS: qué datos se escriben automáticamente en la columna
    // ---------------------------------------------------------------------
    COMENTARIOS: {
      INCLUIR_LOTE: true,                 // "Lote: 309187"
      INCLUIR_DATE_CODE: true,            // "Date Code: 22-JUN-26"
      INCLUIR_UNIDAD: true,               // "Unidad: LY"
      SEPARADOR: ' | '
    },

    // ---------------------------------------------------------------------
    // FORMATO DEL EXCEL
    // ---------------------------------------------------------------------
    EXCEL: {
      PREFIJO_ARCHIVO: 'Reubicacion',     // Reubicacion_71308_2026-10-02.xlsx
      NOMBRE_HOJA: 'Reubicacion',
      INCLUIR_LOGO: true,
      INCLUIR_NUMERO_FILA: false,         // agrega columna "#"
      ORIENTACION: 'landscape',           // impresión: 'landscape' o 'portrait'
      FILAS_CEBRA: true,                  // filas alternadas en gris
      ANCHOS: {                           // ancho de columnas (caracteres aprox.)
        NUMERO: 5, PRODUCTO: 20, CANTIDAD: 13, ORIGEN: 18, A: 4, DESTINO: 18, COMENTARIOS: 48
      }
    },

    // ---------------------------------------------------------------------
    // FORMATO DEL PDF
    // ---------------------------------------------------------------------
    PDF: {
      PREFIJO_ARCHIVO: 'Reubicacion',     // Reubicacion_71308_2026-10-02.pdf
      TAMANO: 'letter',                   // 'letter' (carta) o 'a4'
      ORIENTACION: 'portrait',            // 'portrait' (como el formato físico) o 'landscape'
      MARGEN_MM: 12,
      TAMANO_LETRA: 9,
      INCLUIR_LOGO: true,
      INCLUIR_NUMERO_FILA: false,
      FILAS_MINIMAS: 0,                   // rellenar con filas vacías hasta este número (0 = no)
      LINEA_FIRMA_CHECKER: false          // agrega línea "CHECKER" junto al montacarguista
    },

    // ---------------------------------------------------------------------
    // ALMACENAMIENTO LOCAL
    // ---------------------------------------------------------------------
    ALMACENAMIENTO: {
      PREFIJO: 'reubicacion_v1_',
      MAX_EVENTOS_REGISTRO: 300
    },

    // ---------------------------------------------------------------------
    // LIBRERÍAS LOCALES (normalmente NO se modifica; ver README para actualizar)
    // ---------------------------------------------------------------------
    LIBRERIAS: {
      excel: { archivos: ['libs/exceljs/exceljs.min.js'], global: 'ExcelJS' },
      pdf: { archivos: ['libs/jspdf/jspdf.umd.min.js', 'libs/jspdf/jspdf.plugin.autotable.min.js'], global: 'jspdf' },
      zxing: { archivos: ['libs/zxing/zxing.min.js'], global: 'ZXing' },
      ocr: { archivos: ['libs/tesseract/tesseract.min.js'], global: 'Tesseract' }
    },
    RUTAS_OCR: {
      WORKER: 'libs/tesseract/worker.min.js',
      CORE: 'libs/tesseract/core',
      IDIOMAS: 'libs/tesseract/lang'
    }
  };
  // ===== FIN CONFIGURACIÓN =====

  window.APP_CONFIG = CONFIG;
})();
