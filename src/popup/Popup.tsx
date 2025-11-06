import { FormEvent, useCallback, useEffect, useState } from 'react'
import browser from 'webextension-polyfill'

import type {
  BackgroundMessage,
  BackgroundResponse,
  ContentScriptRequest,
  ContentScriptResponse
} from '../shared/messages'

async function sendBackgroundMessage(message: BackgroundMessage) {
  return (await browser.runtime.sendMessage(message)) as BackgroundResponse
}

async function sendContentScriptMessage(tabId: number, message: ContentScriptRequest) {
  return (await browser.tabs.sendMessage(tabId, message)) as ContentScriptResponse
}

async function getActiveTab() {
  const result = await browser.tabs.query({ active: true, currentWindow: true })
  const [tab] = result
  if (!tab?.id) {
    throw new Error('No active tab found')
  }
  return tab
}

export function Popup() {
  const [apiKey, setApiKey] = useState('')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const result = await sendBackgroundMessage({ type: 'load-api-key' })
      if (result.type === 'error') {
        setError(String(result.error ?? 'No se pudo cargar la API key'))
        return
      }

      if (result.type === 'load-api-key:success') {
        setApiKey(result.payload)
      }
    })()
  }, [])

  const onSaveKey = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      setError(null)
      try {
        const result = await sendBackgroundMessage({ type: 'save-api-key', apiKey })
        if (result.type !== 'save-api-key:success') {
          const message =
            result.type === 'error'
              ? String(result.error ?? 'No se pudo guardar la API key')
              : 'No se pudo guardar la API key'
          throw new Error(message)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [apiKey]
  )

  const onSubmitPrompt = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      setError(null)
      setIsLoading(true)
      setResponse('')
      try {
        const result = await sendBackgroundMessage({ type: 'agent-chat', prompt })
        if (result.type === 'error') {
          throw new Error(String(result.error ?? 'Fallo la consulta al agente'))
        }

        if (result.type === 'agent-chat:success') {
          setResponse(result.payload)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
      }
    },
    [prompt]
  )

  const onIngestPage = useCallback(async () => {
    setError(null)
    setStatusMessage(null)
    try {
      const tab = await getActiveTab()
      const pageContent = await sendContentScriptMessage(tab.id, {
        type: 'content:collect-page-text'
      })

      if (pageContent.type !== 'content:collect-page-text:success') {
        throw new Error(String(pageContent.error ?? 'No se pudo extraer el contenido de la página'))
      }

      const text = pageContent.payload.trim()
      if (!text) {
        throw new Error('No readable content detected on this page')
      }

      const ingestResult = await sendBackgroundMessage({
        type: 'ingest-content',
        source: tab.url ?? undefined,
        content: text
      })

      if (ingestResult.type === 'error') {
        throw new Error(String(ingestResult.error ?? 'No se pudo indexar el contenido'))
      }

      if (ingestResult.type !== 'ingest-content:success') {
        throw new Error('No se pudo indexar el contenido')
      }

      const chunkCount = Number(ingestResult.payload.entries ?? 0)
      if (chunkCount > 0) {
        setStatusMessage(`Contenido indexado en ${chunkCount} fragmentos`)
      } else {
        setStatusMessage('Contenido indexado')
      }
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const onHighlightSelection = useCallback(async () => {
    setError(null)
    setStatusMessage(null)
    try {
      const tab = await getActiveTab()
      const result = await sendContentScriptMessage(tab.id, {
        type: 'content:highlight-selection'
      })

      if (result.type !== 'content:highlight-selection:success') {
        throw new Error(String(result.error ?? 'No se pudo resaltar la selección'))
      }

      setStatusMessage('Selección resaltada en la página')
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  return (
    <main className="popup">
      <h1>Agent Assistant</h1>

      <section>
        <h2>API Key</h2>
        <form onSubmit={onSaveKey} className="stack">
          <input
            type="password"
            value={apiKey}
            placeholder="OpenAI API Key"
            onChange={(event) => setApiKey(event.target.value)}
          />
          <button type="submit">Guardar API Key</button>
        </form>
      </section>

      <section>
        <h2>Contexto</h2>
        <div className="stack">
          <button type="button" onClick={onIngestPage}>
            Ingerir página actual
          </button>
          <button type="button" onClick={onHighlightSelection}>
            Resaltar selección
          </button>
        </div>
        {statusMessage && <p className="status">{statusMessage}</p>}
      </section>

      <section>
        <h2>Chat</h2>
        <form onSubmit={onSubmitPrompt} className="stack">
          <textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Haz una pregunta al agente"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Consultando…' : 'Preguntar'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        {response && (
          <pre className="response" role="status">
            {response}
          </pre>
        )}
      </section>
    </main>
  )
}
