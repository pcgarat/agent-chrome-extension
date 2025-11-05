# Agent Chrome Extension

Plantilla generada con una configuración equivalente a `create-chrome-ext` para construir una extensión de Chrome orientada a agente IA.

## Scripts disponibles

- `npm install` – instala las dependencias.
- `npm run dev` – inicia Vite en modo watch para cargar la extensión en Chrome con recarga en caliente.
- `npm run build` – compila la extensión lista para empaquetar en `dist/`.
- `npm run preview` – sirve la build generada.

## Estructura principal

```
├── manifest.config.ts        # Manifest V3 gestionado por @crxjs/vite-plugin
├── src/background/           # Service worker con la lógica del agente
├── src/content/              # Content script para interactuar con la página
├── src/popup/                # UI del popup React
└── src/options/              # Página de opciones para configurar la API key
```

Consulta `ROADMAP.md` para ver los siguientes pasos previstos.
