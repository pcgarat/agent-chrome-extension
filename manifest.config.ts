import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest(() => ({
  manifest_version: 3,
  name: 'Agent Chrome Extension',
  version: '0.0.1',
  description:
    'Base scaffolding for an AI agent Chrome extension with OpenAI, RAG, and context-aware capabilities.',
  action: {
    default_title: 'Agent Assistant',
    default_popup: 'src/popup/index.html'
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ],
  permissions: ['storage', 'activeTab', 'tabs', 'scripting'],
  host_permissions: ['<all_urls>']
}))
