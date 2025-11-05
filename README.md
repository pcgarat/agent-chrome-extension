# Agent Chrome Extension

Plantilla generada con una configuración equivalente a `create-chrome-ext` para construir una extensión de Chrome orientada a agente IA.

## Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior y `npm`.
- Google Chrome o Chromium con soporte para extensiones Manifest V3.
- (Opcional) Una cuenta de desarrollador en la Chrome Web Store para distribuir la extensión.

## Carga de la extensión en Chrome

1. Ejecuta `npm install` para instalar dependencias y `npm run dev` para iniciar Vite en modo watch.
2. Abre `chrome://extensions`, activa el **Modo desarrollador** y pulsa **Cargar descomprimida**.
3. Selecciona la carpeta `dist/` generada por Vite; Chrome recargará la extensión automáticamente cuando detecte cambios.

## Uso del popup y la página de opciones

- El popup (`src/popup/`) ofrece la interfaz principal de la extensión y se actualiza con `npm run dev`.
- La página de opciones (`src/options/`) permite configurar credenciales (por ejemplo, la API key del agente) y persiste ajustes usando el almacenamiento de Chrome.
- Para depurar, abre el inspector del popup u opciones desde `chrome://extensions` > **Fondo**, **Inspectar vistas**.

## Publicación de versiones en la Chrome Web Store

1. Ejecuta `npm run build` para generar la carpeta `dist/` lista para empaquetar.
2. Comprime `dist/` en un archivo `.zip` (por ejemplo `zip -r extension.zip dist`).
3. En el panel de la Chrome Web Store, crea una nueva versión, sube el `.zip`, completa las notas y envía la revisión.
4. Tras la aprobación, la actualización se propagará a todos los usuarios automáticamente.

## Scripts disponibles

- `npm install` – instala las dependencias.
- `npm run dev` – inicia Vite en modo watch para cargar la extensión en Chrome con recarga en caliente.
- `npm run build` – genera la extensión lista para empaquetar en `dist/`.
- `npm run preview` – sirve la build generada.
- `npm run lint` – analiza el código con ESLint y falla si existen advertencias o errores.
- `npm run typecheck` – valida los tipos con TypeScript usando `--noEmit`.
- `npm run check` – ejecuta `lint` y `typecheck` de forma secuencial.

## Interpretación del pipeline de CI

El workflow `ci.yml` se ejecuta en cada push y pull request. Un resultado verde indica que la instalación de dependencias, la compilación (`npm run build`) y las comprobaciones (`npm run check`) han sido correctas. Si el pipeline falla:

- Revisa los logs del job para identificar si falló `npm run lint`, `npm run typecheck` o `npm run build`.
- Corrige los errores locales ejecutando el comando correspondiente y vuelve a subir los cambios.
- En pull requests, puedes reintentar el workflow desde la pestaña **Actions** tras subir una corrección.

## Creación de releases desde GitHub

1. Asegúrate de que la rama principal tiene el pipeline verde y que la versión en `package.json` está actualizada.
2. Ve a **Releases** > **Draft a new release**, selecciona la etiqueta (`vX.Y.Z`) y el objetivo (normalmente `main`).
3. Completa las notas destacando cambios relevantes y publica la release.
4. Descarga el artefacto generado (o sube el `.zip` construido con `npm run build`) para compartirlo o enviarlo a la Chrome Web Store.

## Estructura principal

```
├── manifest.config.ts        # Manifest V3 gestionado por @crxjs/vite-plugin
├── src/background/           # Service worker con la lógica del agente
├── src/content/              # Content script para interactuar con la página
├── src/popup/                # UI del popup React
└── src/options/              # Página de opciones para configurar la API key
```

Consulta `ROADMAP.md` para ver los siguientes pasos previstos.
