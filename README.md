# Registro Servicios Inspección de Carga — Instalador PWA

## Qué es esto
Un wrapper PWA (Progressive Web App) que **instala un ícono en escritorio (Windows/Mac) y en celular (Android/iOS)**, y dentro carga tu app real de Google Apps Script. El backend (`Code_V11_FINAL.gs`) y los datos siguen viviendo 100% en Google (Sheets + Drive), sin cambios de arquitectura.

Esto **no agrega funcionamiento offline** — la app siempre requerirá Internet, tal como ya documentaste en el informe de cierre.

## Archivos incluidos
- `index.html` — página wrapper que embebe tu Apps Script en un iframe.
- `manifest.json` — metadata de instalación (nombre, íconos, colores).
- `service-worker.js` — habilita el prompt de instalación (solo cachea el shell, no los datos).
- `icons/icon-192.png`, `icons/icon-512.png` — íconos placeholder (ver sección Íconos).
- `Code_V11_FINAL.gs` — backend actualizado con el nuevo nombre en el título.

## Paso 1 — URL del Apps Script ✅ (ya integrada)
`index.html` ya apunta a tu deployment real:
```
https://script.google.com/macros/s/AKfycbwEpQ_7C0yKgnaJ__X5Xh76PkrAxC2-ecb7u-vFdrcPAHrzeyA-QrtoVabehMKDmkZ_/exec
```
Si en el futuro vuelves a desplegar el Apps Script y Google te entrega una URL nueva, deberás actualizar esta línea en `index.html`.

## ⚠️ Riesgo a verificar antes de distribuir: bloqueo de iframe
Google puede enviar cabeceras (`X-Frame-Options` / `Content-Security-Policy: frame-ancestors`) que impidan cargar tu Apps Script dentro de un iframe alojado en un dominio externo como GitHub Pages. No tengo forma de confirmarlo desde aquí sin acceso a tu deployment real en un navegador — **debes probarlo tú mismo apenas publiques**, antes de repartir el instalador a los operadores.

**Cómo probarlo:** publica el `index.html` en GitHub Pages y ábrelo. Si el iframe carga tu formulario con normalidad, todo bien. Si aparece en blanco o un error de tipo "refused to connect"/"denegó la conexión", significa que Google está bloqueando el iframe.

**Plan B si se bloquea (fácil de aplicar, dímelo y lo ajusto):** en vez de iframe, hacer que `index.html` **redirija** directamente a la URL de Apps Script (`window.location.href = "..."`). Se pierde el "wrapper visual" con splash screen, pero el ícono instalado sigue funcionando igual — al abrirlo, redirige y carga tu app.

## Paso 2 — Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub (público o privado con Pages habilitado en plan pago).
2. Sube estos 6 archivos/carpetas a la raíz del repo.
3. Ve a **Settings → Pages** → en "Source" selecciona la rama `main` y carpeta `/root`.
4. GitHub te entregará una URL tipo `https://tu-usuario.github.io/tu-repo/`.
5. Abre esa URL desde Chrome (PC o Android) o Safari (iPhone/iPad).

## Paso 3 — Instalar
- **Windows/Mac (Chrome/Edge):** aparece un ícono de instalación en la barra de direcciones, o el botón "Instalar app" que agregamos en la esquina inferior derecha.
- **Android (Chrome):** mismo botón, o menú ⋮ → "Instalar aplicación".
- **iPhone/iPad (Safari):** Safari **no soporta el prompt automático** (limitación de Apple, no nuestra). El usuario debe: botón compartir (□↑) → "Agregar a pantalla de inicio". Vale la pena avisar esto a los operadores en terreno.

## Index_APPS_SCRIPT.html — corregido ✅
Se actualizó el archivo (incluido en este paquete como `Index_APPS_SCRIPT.html`, renombrado solo para que no lo confundas con el `index.html` del wrapper — dentro de Apps Script sigue llamándose "Index") en 3 puntos:
- `<title>` de la pestaña.
- `<h1>` visible en la pantalla de inicio.
- El `manifest` embebido (base64 dentro del `<link rel="manifest">`), que **tenía el nombre de otro proyecto** ("BITÁCORA DE GESTIÓN Y SEGUIMIENTO - MINUTA STOCK/TRANSPORTE") pegado por error — probablemente de una plantilla reutilizada. También se eliminó la etiqueta visible "Bitácora ST Stock-Transporte" de la pantalla de inicio.

**Debes copiar el contenido de `Index_APPS_SCRIPT.html` dentro de tu proyecto de Apps Script**, reemplazando el archivo que ahí se llama "Index" — no subas este archivo a GitHub Pages, es solo para Apps Script.

## Dos archivos que se parecen — no los confundas
- **`index.html`** (minúscula) → va a GitHub Pages. Es el instalador/wrapper.
- **`Index_APPS_SCRIPT.html`** (con guion, mayúsculas) → va a Apps Script (script.google.com). Es tu formulario real de inspección.

## Pendiente de tu lado (no puedo hacerlo yo sin acceso a tu cuenta Google)
- Copiar el contenido de `Index_APPS_SCRIPT.html` dentro de tu proyecto Apps Script, en el archivo llamado "Index" (reemplazando todo su contenido).
- Renombrar el **deployment** en el editor de Apps Script (Configuración del proyecto → nombre del proyecto).
- Si quieres renombrar también el Google Sheet o la carpeta de Drive: hazlo manualmente desde Sheets/Drive. **No cambies la constante `DRIVE_FOLDER_NAME` en el `.gs`** sin también renombrar la carpeta real — si solo cambias el texto, el script buscará una carpeta con el nombre nuevo, no la encontrará, y creará una carpeta duplicada, dejando las fotos antiguas "huérfanas" en la carpeta vieja.

## Íconos
Los íconos en `icons/` son un placeholder funcional (fondo azul, texto "RIC"). Si tienes un logo definido, lo reemplazo por la versión final — solo pásamelo.
