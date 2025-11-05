# Roadmap para la extensión de Chrome tipo agente IA

## Estado actual del repositorio
- El repositorio solo contiene un README vacío, por lo que tendrás que crear la estructura de la extensión desde cero.

## Recomendaciones para una extensión “agente” con mínimo código

### 1. Arranque rápido de la extensión
1. Usa un generador como [Plasmo Framework](https://www.plasmo.com/) o [create-chrome-ext](https://www.npmjs.com/package/create-chrome-ext) para scaffolding. Estos kits te crean `manifest.json`, scripts y empaquetado con un solo comando.
2. Si prefieres hacerlo manualmente, bastará con tres archivos iniciales:
   - `manifest.json` (Manifest V3, declarando permisos como `scripting`, `activeTab`, `storage` y host permissions).
   - `service_worker.js` (o `background.js`) para lógica del agente.
   - Alguna UI mínima: `popup.html` + `popup.js` o un `options.html` para introducir la API key.

### 2. Conexión rápida a OpenAI
1. Guarda la API key en `chrome.storage.sync` desde tu UI inicial.
2. El `service_worker` puede hacer las llamadas `fetch` a OpenAI `chat.completions` usando esa key. Para minimizar código, encapsula la llamada en una función que acepte `messages` y devuelva la respuesta.

### 3. Añadir RAG y contexto sin mucho código
1. Usa una librería que abstraiga la indexación, p. ej.:
   - [LangChain.js](https://js.langchain.com/docs/get_started/installation) con `MemoryVectorStore` + `HNSWLib`.
   - [LlamaIndex TS](https://www.llamaindex.ai/) si prefieres otra API.
2. Para cargar documentos sin servidor:
   - Permite que el usuario “pegue” PDFs/URLs: puedes usar `chrome.scripting` para inyectar un content script que extraiga el texto de la pestaña actual y lo envíe al service worker.
   - Almacena los embeddings en `chrome.storage.local` o en IndexedDB mediante la propia librería.
3. Pipeline RAG mínimo:
   - Content script → envía texto a service worker.
   - Service worker crea embeddings con `text-embedding-3-small` y los guarda en la vector store.
   - Al preguntar, recupera los documentos más cercanos y los añade al prompt antes de llamar a OpenAI.

### 4. Interacción con la página con el mínimo esfuerzo
1. Declara un content script único que:
   - Inyecte un observador DOM ligero (MutationObserver) para detectar selecciones de texto o campos de entrada.
   - Exporte un par de funciones (`highlight`, `insertText`) que el service worker pueda invocar vía `chrome.tabs.sendMessage`.
2. Desde el popup, expón botones “Explicar texto seleccionado” o “Rellenar formulario”, que simplemente envían mensajes al background y éste al content script.
3. Con Manifest V3, puedes aprovechar `chrome.scripting.executeScript` desde el background para ejecutar pequeñas acciones sin mantener mucho código en el content script.

### 5. Minimizar mantenimiento
- Centraliza toda la lógica del agente en el service worker (gestión de memoria, RAG, llamadas a OpenAI). El popup y el content script solo envían/reciben mensajes.
- Configura el build (si usas Plasmo o Vite) para que haga bundling automático; así solo tocas archivos fuente TS/JS y estilos.

### 6. Seguridad y despliegue rápido
- Nunca hardcodees la API key; usa `chrome.storage` + `declarativeNetRequest` si quieres filtrar dominios.
- Para distribución privada, empaqueta la extensión desde `chrome://extensions` → “Pack extension”.

