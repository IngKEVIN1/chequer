# Reubicación de material — Formato digital

Aplicación web local que sustituye el formato físico **"FORMATO PARA REUBICAR MATERIAL EN ALMACÉN"**.

Con ella se puede:
- Escanear etiquetas con la cámara, que lee códigos de barras y texto (OCR).
- Sumar automáticamente el mismo producto con el mismo lote.
- Editar la ubicación destino, que confirma el checker.
- Generar Excel y PDF y compartirlos o enviarlos por correo.

Todo se procesa **en el dispositivo**: las fotos no se suben a ningún servidor y no se necesita Internet para trabajar.

---

## 1. Requisitos

| Equipo | Navegador | Notas |
|---|---|---|
| PC Windows | Chrome o Edge actualizados | Funciona abriendo `index.html`. Para el OCR, use `INICIAR-SERVIDOR.bat`. |
| Samsung Galaxy Tab | Chrome para Android | Debe abrirse desde una dirección web (ver sección 5). |
| iPad | Safari (recomendado) o Chrome | Debe abrirse desde una dirección web (ver sección 6). |

No requiere Node.js, Python, PHP ni instalar programas. Todas las librerías están incluidas en `libs/`.

## 2. Estructura del proyecto

```
reubicacion-material/
├── index.html               Pantalla principal y ventanas
├── config.js                ← CONFIGURACIÓN (empresa, colores, logo, correo, Excel, PDF…)
├── manifest.json            Datos para instalar como app (PWA)
├── service-worker.js        Modo sin conexión (copia local de los archivos)
├── INICIAR-SERVIDOR.bat     Abre la app en http://localhost (PC Windows)
├── servidor-local.ps1       Servidor mínimo usado por el .bat (solo PowerShell)
├── README.md
├── css/
│   ├── bootstrap.min.css
│   └── styles.css           Estilos de la app
├── js/
│   ├── app.js               Controlador principal (tabla, botones, exportar, recuperar)
│   ├── productos.js         ← REGLAS DE AGRUPACIÓN y validaciones
│   ├── perfiles-etiquetas.js← TIPOS DE ETIQUETA (agregar uno nuevo aquí)
│   ├── interprete.js        Convierte texto/códigos en producto, cantidad, lote
│   ├── ocr.js               Lectura de texto (Tesseract, local)
│   ├── barcode.js           Lectura de códigos de barras (nativo + ZXing)
│   ├── scanner.js           Cámara, fotos y flujo de lectura
│   ├── formulario.js        Ventana de revisión / edición de fila
│   ├── export-excel.js      ← FORMATO DEL EXCEL
│   ├── export-pdf.js        ← FORMATO DEL PDF
│   ├── email.js             Opciones de envío por correo
│   ├── storage.js           Guardado local
│   ├── ui.js                Avisos, confirmaciones, ventanas
│   └── utils.js             Funciones de apoyo
├── assets/
│   ├── logo.png             ← SU LOGO (reemplazar)
│   └── icons/               Íconos de la app instalada
├── libs/                    Librerías locales (no requieren Internet)
│   ├── bootstrap/  exceljs/  jspdf/  zxing/
│   └── tesseract/  (motor OCR + idioma inglés)
└── tests/
    ├── pruebas.html         Pruebas automáticas (abrir en el navegador)
    └── casos.js
```

## 3. Uso en PC (Windows)

### Opción A: abrir directamente (sin OCR)
1. Doble clic en `index.html` (se abre en Chrome o Edge).
2. Funciona lo siguiente:
   - Captura manual, edición y suma automática.
   - Lectura de **códigos de barras**.
   - Excel, PDF y correo.
   - Recuperación del movimiento.
3. **No funcionan** el OCR (lectura de texto) ni la instalación como app. Es una restricción de los navegadores con archivos locales (`file://`), no del proyecto. La app muestra un aviso.

### Opción B (recomendada): `INICIAR-SERVIDOR.bat`
1. Doble clic en `INICIAR-SERVIDOR.bat`.
2. Se abre `http://localhost:8080/index.html` con **todas** las funciones, incluido el OCR.
3. Deje abierta la ventana negra mientras usa la app; ciérrela para terminar.

El servidor solo acepta conexiones de la misma computadora. Usa PowerShell, que ya viene en Windows.

Si su empresa bloquea los scripts de PowerShell, use la opción A o pida a TI que publique la carpeta en un servidor interno (sección 5).

### Cámara en PC
Si la PC tiene cámara web, "ESCANEAR ETIQUETA" abre una vista de cámara dentro de la app. Si no tiene cámara, use **"Elegir foto"** con una fotografía tomada con el celular.

## 4. Copiar el proyecto con USB

1. En su computadora personal, descomprima `reubicacion-material.zip`.
2. Copie **la carpeta completa** `reubicacion-material` a la memoria USB.
3. En la PC del trabajo, copie la carpeta a, por ejemplo, `Documentos\reubicacion-material`.
4. No mueva archivos sueltos: la app necesita las carpetas `css`, `js`, `libs` y `assets` junto a `index.html`.
5. Compruebe que todo llegó completo: abra `tests/pruebas.html` y debe decir **"20 de 20 pruebas correctas"**.

## 5. Samsung Galaxy Tab (Android, Chrome)

**Limitación real:** Android no permite abrir una carpeta de archivos HTML como aplicación. La tablet necesita cargar la app **una vez** desde una dirección web. Después de instalada, funciona **sin Internet**.

Los datos y las fotos **nunca** se envían a esa dirección: solo sirve para descargar los archivos de la app.

### Paso 1: publicar la carpeta (una sola vez)
Elija una opción (consulte la política de TI de su empresa):
- **Servidor interno de la empresa** (IIS, SharePoint con hosting estático, intranet). Pida a TI que publique la carpeta tal cual. Se necesita **HTTPS** para cámara, instalación y modo sin conexión.
- **GitHub Pages** (gratis):
  1. Cree una cuenta en github.com y un repositorio nuevo.
  2. Use **Add file → Upload files** y arrastre el *contenido* de la carpeta (todas las subcarpetas).
  3. Vaya a **Settings → Pages → Deploy from a branch → main / (root)**.
  4. La dirección quedará como `https://SU-USUARIO.github.io/NOMBRE-REPO/`.
  5. Nota: en la cuenta gratuita, el *código* queda público. Los datos capturados no, porque nunca salen de la tablet.

### Paso 2: instalar en la tablet
1. Abra la dirección en **Chrome**.
2. Menú **⋮ → "Instalar aplicación"** (o "Agregar a pantalla principal"). También puede aparecer el botón **"Instalar app"** en el encabezado.
3. Abra la app instalada **con Internet una vez**. Luego entre a **Configuración → "Preparar lector de texto"** y espere el mensaje de listo.
4. La primera vez que escanee, permita el acceso a la cámara.
5. Desde ese momento funciona sin conexión. El indicador "Sin conexión" solo informa; todo sigue funcionando.

### Cómo se comporta en Samsung
- **Escanear etiqueta** abre la cámara nativa (mejor enfoque y flash).
- El lector de códigos nativo de Chrome Android lee varios códigos de la foto a la vez.
- **Compartir:** Chrome Android solo permite compartir el **PDF**; no acepta compartir archivos Excel. Es una restricción de Chrome, no de la app.
  - La app lo detecta y ofrece "Compartir PDF" más "Descargar Excel" para adjuntarlo desde Descargas.
  - Otra opción: "Descargar archivos y abrir correo".
- Funciona en orientación vertical (filas como tarjetas) y horizontal (tabla).

## 6. iPad (Safari / Chrome)

### Instalar
1. Abra la dirección publicada (sección 5, paso 1) en **Safari**.
2. Botón **Compartir → "Agregar a pantalla de inicio"**.
3. Abra la app desde el ícono, con Internet una vez. Luego vaya a **Configuración → "Preparar lector de texto"**.

### Limitaciones específicas de iPad y sus soluciones
- **Use la app desde el ícono de la pantalla de inicio.** Safari puede borrar los datos de sitios web que no se visitan en 7 días; las apps agregadas a la pantalla de inicio no tienen ese límite.
- **Chrome en iPad** usa el motor de Safari: funciona igual, pero se recomienda Safari para instalar.
- **Cámara:** se usa la cámara del sistema. Las fotos HEIC se convierten automáticamente a JPG al seleccionarlas. Si alguna foto no abre, configure la cámara en **Ajustes → Cámara → Formatos → "Más compatible"**.
- **Compartir:** Safari sí permite compartir **PDF y Excel juntos** hacia Mail u Outlook. Es la opción recomendada en iPad.
- **Descargas:** se guardan en la app **Archivos → Descargas**.

## 7. Flujo de trabajo

1. **Nuevo movimiento** → capture la **Referencia** (la fecha de hoy se pone sola y se puede cambiar).
2. **ESCANEAR ETIQUETA** → tome la foto.
3. La app lee los códigos de barras y el texto, y muestra los datos en una ventana editable. Cada campo indica su origen:
   - **Código de barras**, **OCR**, **OCR + código de barras** o **Manual**.
   - **Revisar** (amarillo): el dato es dudoso o no se encontró. No se inventa nada.
4. Botones de la ventana:
   - **Aceptar**: agrega el producto.
   - **Editar**: lleva el cursor al campo pendiente.
   - **Volver a escanear**.
   - **Girar 90° y leer**: si la foto salió de lado.
   - **Tipo de etiqueta**: fuerza un perfil de etiqueta.
5. "Otros datos leídos" permite asignar con un toque un PACK ID o PO como lote, producto o comentario.
6. Si el producto y el lote ya existen, **se suma** en la misma fila y aparece un aviso.
7. El **checker** escribe la ubicación destino directamente en la tabla:
   - **Enter** pasa a la siguiente fila.
   - "Asignar destino a filas vacías" llena las faltantes de una vez.
8. **DIVIDIR** separa parte de una cantidad en otra fila (por ejemplo, para otro destino).
9. **GENERAR PDF / DESCARGAR EXCEL / ENVIAR CORREO**.

### Reglas de agrupación
| Caso | Resultado |
|---|---|
| Mismo producto + mismo lote | Se suma en la misma fila |
| Mismo producto + lote diferente | Fila nueva |
| Mismo producto con lote + sin lote | Fila nueva |
| Producto diferente | Fila nueva |
| Mismas claves pero unidad distinta (LY vs LB) | Fila nueva (configurable) |

Si se suma un producto con otra ubicación origen, la app avisa y conserva la primera. Si prefiere separarlas siempre, use `AGRUPACION.SEPARAR_POR_ORIGEN: true`.

## 8. Correo: qué puede y qué NO puede hacer un navegador

- **No** existe forma de que un navegador adjunte archivos usando `mailto:`, ni de que envíe un correo sin intervención del usuario. La app no finge hacerlo.
- Opciones reales implementadas (la app recomienda la mejor según el dispositivo):
  1. **Compartir PDF y Excel** (iPad; en Samsung solo el PDF). Abre el menú del sistema con los archivos adjuntos. Usted elige Outlook, Gmail o Correo y escribe o pega el destinatario (botón "Copiar destinatario y asunto").
  2. **Borrador de Outlook (.eml)** (PC). Descarga un correo ya armado con destinatario, asunto `MOVIMIENTOS - REFERENCIA`, resumen y **los dos archivos adjuntos**. Ábralo con Outlook de escritorio (clásico) y presione Enviar. En otros programas puede abrirse como mensaje recibido; use "Reenviar".
  3. **Descargar archivos y abrir correo**. Descarga PDF y Excel y abre su correo con destinatario, asunto y cuerpo llenos. Usted adjunta los archivos desde Descargas.
- El correo destino se pide la primera vez y se guarda en el dispositivo. Para cambiarlo, use la ventana de envío o **Configuración**.

### Envío automático (opcional, futuro)
Requiere un servicio externo y conexión a Internet. Ya está programado del lado de la app, pero **desactivado**.

1. Ejemplo con **Power Automate** (Microsoft 365). El disparador "When an HTTP request is received" requiere licencia Premium.
   - Disparador "When an HTTP request is received" con este esquema JSON:
     ```json
     { "type": "object", "properties": {
         "para": {"type": "string"}, "asunto": {"type": "string"}, "cuerpo": {"type": "string"},
         "adjuntos": {"type": "array", "items": {"type": "object", "properties": {
             "nombre": {"type": "string"}, "tipo": {"type": "string"}, "base64": {"type": "string"}}}}}}
     ```
   - Acción "Send an email (V2)". En adjuntos use el nombre y `base64ToBinary(item()?['base64'])`.
2. Copie la URL del flujo en `config.js`:
   ```js
   ENVIO_AUTOMATICO: { HABILITADO: true, URL: 'https://...', TOKEN: '' }
   ```
3. Aparecerá el botón "Enviar automáticamente". Solo informa éxito si el servicio responde correctamente.

## 9. Personalización (todo en `config.js`)

Busque los bloques `// ===== CONFIGURACIÓN EDITABLE =====`.

| Qué cambiar | Dónde |
|---|---|
| Nombre de empresa / almacén | `EMPRESA.NOMBRE`, `EMPRESA.ALMACEN` |
| Títulos y textos | `TEXTOS` |
| Colores | `COLORES.PRIMARIO` (rojo), `SECUNDARIO` (gris)… También `theme_color` en `manifest.json` y `<meta name="theme-color">` en `index.html` (barra del sistema) |
| Logo | Reemplace `assets/logo.png` (mismo nombre). Ruta en `LOGO.RUTA` |
| Correo predeterminado | `CORREO.DESTINO_PREDETERMINADO` |
| Asunto del correo | `CORREO.ASUNTO_PREFIJO` |
| Formato del Excel | `EXCEL` (anchos, logo, orientación, columna #); estructura en `js/export-excel.js` |
| Formato del PDF | `PDF` (carta/A4, orientación, márgenes, filas vacías, firma del checker); diseño en `js/export-pdf.js` |
| Reglas de agrupación | `AGRUPACION`; lógica en `js/productos.js` |
| Validaciones | `VALIDACION` (montacarguista u origen obligatorios, decimales) |
| Comentarios automáticos | `COMENTARIOS` (lote, date code, unidad) |
| OCR | `CAPTURA` (activar, idioma, tamaño de imagen, giro automático) |
| Patrón de ubicaciones | `UBICACIONES.PATRON_UBICACION` |

### Agregar el logo
1. Prepare su logo en PNG con fondo transparente o blanco (unos 600 × 150 px).
2. Nómbrelo `logo.png` y reemplace `assets/logo.png`.
3. Recargue la página. Si usa la app instalada, suba `CACHE_VERSION` en `service-worker.js` (sección 10).
4. Si abre la app como archivo (`file://`), el navegador puede impedir que el logo se inserte en PDF/Excel. En ese caso use **Configuración → "Cargar logo"** (se guarda en el dispositivo).

El proyecto **no incluye** el logo de Cardinal Health. El archivo actual es un ejemplo genérico.

### Agregar otro tipo de etiqueta
1. Abra `js/perfiles-etiquetas.js`.
2. Copie un bloque `{ id: ..., ... }` de `PERFILES` y péguelo antes del perfil `'generica'`.
3. Cambie:
   - `id` y `nombre`.
   - `palabrasClave`: textos que solo aparecen en esa etiqueta, con su peso. `puntajeMinimo` es el puntaje necesario para reconocerla.
   - `campos.producto.etiquetas`: palabras impresas junto al dato, por ejemplo `['PART NO', 'P/N']`. Igual para `cantidad`, `lote` y `dateCode`.
   - `patron`: uno de `PATRONES` (`PRODUCTO_CARDINAL`, `CODIGO`, `NUMERO_LARGO`, `NUMERO`, `FECHA`). Puede agregar patrones nuevos.
4. Guarde y pruebe. En la ventana de revisión, "Ver lo que se leyó" muestra el texto OCR y los códigos, y "Detalles de captura" muestra qué perfil se detectó.
5. Agregue un caso en `tests/casos.js` copiando las pruebas de etiquetas.

**Importante:** confirme con etiquetas reales qué texto acompaña al lote en la etiqueta Ahlstrom (se configuró `LOT NO`, `LOT`, `ROLL ID`, `ROLL NO`, `BATCH`). La foto de ejemplo no permitía leer esos textos pequeños. La etiqueta Magnera no tiene campo de lote, así que no se llena automáticamente; si su operación usa PACK ID como lote, agréguelo en `lote.etiquetas` de ese perfil.

## 10. Actualizar la app instalada
Después de cambiar cualquier archivo:
1. En `service-worker.js` suba `CACHE_VERSION` (por ejemplo, `'v1.0.1'`).
2. Publique los archivos.
3. En las tablets aparecerá "Hay una versión nueva" → **Actualizar**.

## 11. Actualizar librerías

| Librería | Versión incluida | Archivos |
|---|---|---|
| Bootstrap | 5.3.3 | `css/bootstrap.min.css`, `libs/bootstrap/bootstrap.bundle.min.js` |
| ExcelJS | 4.4.0 | `libs/exceljs/exceljs.min.js` |
| jsPDF | 2.5.2 | `libs/jspdf/jspdf.umd.min.js` |
| jsPDF-AutoTable | 3.8.4 | `libs/jspdf/jspdf.plugin.autotable.min.js` |
| ZXing (@zxing/library) | 0.21.3 | `libs/zxing/zxing.min.js` (archivo `umd/index.min.js` del paquete) |
| Tesseract.js | 5.1.1 | `libs/tesseract/tesseract.min.js`, `worker.min.js` |
| tesseract.js-core | 5.1.1 | `libs/tesseract/core/tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js` |
| Idioma inglés | 4.0.0_best_int | `libs/tesseract/lang/eng.traineddata.gz` (paquete `@tesseract.js-data/eng`) |

Para actualizar desde una PC con Internet:
1. Descargue los mismos archivos del paquete npm (por ejemplo, `https://cdn.jsdelivr.net/npm/exceljs@VERSION/dist/exceljs.min.js`).
2. Reemplácelos conservando el nombre.
3. Ejecute `tests/pruebas.html` y pruebe PDF y Excel.

Tesseract.js y tesseract.js-core deben ser de la **misma versión mayor**. ExcelJS y jsPDF 3.x/AutoTable 5.x cambian su forma de cargarse: si actualiza a esas versiones, revise `js/export-*.js`.

**Por qué ExcelJS y no SheetJS:** la edición gratuita de SheetJS no escribe estilos (colores, bordes, negritas, congelar paneles), y el Excel profesional era un requisito.

**Por qué jsPDF + AutoTable y no html2canvas:** genera texto real y nítido, archivos pequeños (unos 10 KB) y corta páginas sin partir filas.

## 12. Solución de problemas

### Cámara
- **"Permiso de cámara denegado":**
  - Chrome: candado junto a la dirección → Cámara → Permitir.
  - Android: Ajustes → Apps → Chrome → Permisos → Cámara.
  - iPad: Ajustes → Safari → Cámara → Permitir.
- **"La cámara está en uso":** cierre Teams, Zoom u otras apps que la usen.
- **Sin cámara en la PC:** use "Elegir foto".
- **Cancelé la cámara:** no pasa nada; la app sigue igual.

### OCR (lectura de texto)
- **"No funciona al abrir index.html como archivo":** use `INICIAR-SERVIDOR.bat` o la dirección publicada.
- **Primera lectura lenta:** el motor se prepara una sola vez (5 a 20 s). Use Configuración → "Preparar lector de texto".
- **Lecturas incorrectas o campos "Revisar":**
  - Acérquese hasta que la etiqueta llene la foto.
  - Evite reflejos del plástico (incline el teléfono).
  - Use buena luz y mantenga la foto enfocada.
  - Use "Girar 90° y leer" si la foto quedó de lado.
  - Elija manualmente el "Tipo de etiqueta".
- **Sin Internet y OCR no disponible en la tablet:** abra la app una vez con Internet y prepare el lector (sección 5).
- El OCR **nunca** es 100 % confiable. Por eso todos los datos se muestran para revisión antes de agregarse.

### PDF
- **No se descarga en iPad:** use "Compartir" o "Abrir / imprimir"; las descargas van a Archivos → Descargas.
- **"No se pudo cargar el generador de PDF":** falta `libs/jspdf/`. Vuelva a copiar la carpeta completa.
- **No aparece el logo:** vea la sección 9, "Agregar el logo".

### Excel
- **"No se pudo cargar el generador de Excel":** falta `libs/exceljs/exceljs.min.js`.
- **Chrome pregunta "descargar varios archivos":** acepte; ocurre en "Descargar archivos y abrir correo".
- **No se puede compartir el Excel en Samsung:** es una restricción de Chrome Android; adjúntelo desde Descargas.

### Datos
- **Recuperar un movimiento:** al volver a abrir la app aparece "Hay un movimiento sin finalizar. ¿Desea recuperarlo?".
- **No se guarda:** la navegación privada o de incógnito impide guardar. Use una ventana normal.
- Los datos se guardan **por dispositivo y por navegador**: no se comparten entre la tablet y la PC.

### Diagnóstico
Abra **Configuración → Diagnóstico**. Muestra:
- La forma de apertura.
- Si el modo sin conexión está activo.
- Si hay cámara.
- El estado del OCR.
- Si se pueden compartir archivos.

## 13. Privacidad y seguridad
- Las fotos se procesan en memoria y se descartan al cerrar la ventana de revisión; no se guardan.
- OCR y códigos de barras se ejecutan en el dispositivo; no se usan servicios externos.
- En el dispositivo (`localStorage`) solo se guardan:
  - El movimiento en curso.
  - El correo destino.
  - El logo opcional.

## 14. Pruebas
Abra `tests/pruebas.html`. Verifica:
- Casos 1 a 7 y 9 del requerimiento.
- División de filas.
- Validaciones.
- Lectura de los 4 tipos de etiqueta (con texto de ejemplo).
- Corrección por código de barras.

Los casos 8 (confirmación al limpiar) y 10 (sin Internet) se verificaron en un navegador real durante el desarrollo.
