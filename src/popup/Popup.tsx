import { FormEvent, useCallback, useEffect, useState } from 'react'
import browser from 'webextension-polyfill'

export function Popup() {
  const [apiKey, setApiKey] = useState('')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHighlighting, setIsHighlighting] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [highlightMessage, setHighlightMessage] = useState<string | null>(null)
  const [selectionSummary, setSelectionSummary] = useState('')

  useEffect(() => {
    void (async () => {
      const result = await browser.runtime.sendMessage({ type: 'load-api-key' })
      if (result?.payload) {
        setApiKey(result.payload as string)
      }
    })()
  }, [])

  const onSaveKey = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      setError(null)
      try {
        await browser.runtime.sendMessage({ type: 'save-api-key', apiKey })
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
        const result = await browser.runtime.sendMessage({
          type: 'agent-chat',
          prompt
        })
        if (result?.payload) {
          setResponse(String(result.payload))
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
    try {
      const result = await browser.tabs.query({ active: true, currentWindow: true })
      const [tab] = result
      if (!tab?.id) {
        throw new Error('No active tab found')
      }

      const pageContent = await browser.tabs.sendMessage(tab.id, {
        type: 'content:collect-page-text'
      })

      const text = String(pageContent?.payload ?? '').trim()
      if (!text) {
        throw new Error('No readable content detected on this page')
      }

      await browser.runtime.sendMessage({
        type: 'ingest-content',
        source: tab.url,
        content: text
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const getActiveTabId = useCallback(async () => {
    const result = await browser.tabs.query({ active: true, currentWindow: true })
    const [tab] = result
    if (!tab?.id) {
      throw new Error('No active tab found')
    }
    return tab.id
  }, [])

  const onHighlightSelection = useCallback(async () => {
    setSelectionError(null)
    setHighlightMessage(null)
    setIsHighlighting(true)
    try {
      const tabId = await getActiveTabId()
      const result = await browser.tabs.sendMessage(tabId, { type: 'content:highlight-selection' })
      if (result?.error) {
        throw new Error(String(result.error))
      }
      const text = String(result?.payload ?? '').trim()
      if (!text) {
        throw new Error('No se detectó texto seleccionado')
      }
      setHighlightMessage('Selección resaltada correctamente')
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsHighlighting(false)
    }
  }, [getActiveTabId])

  const onSummarizeSelection = useCallback(async () => {
    setSelectionError(null)
    setHighlightMessage(null)
    setSelectionSummary('')
    setIsSummarizing(true)
    try {
      const tabId = await getActiveTabId()
      const selectionResult = await browser.tabs.sendMessage(tabId, {
        type: 'content:get-selection-text'
      })
      if (selectionResult?.error) {
        throw new Error(String(selectionResult.error))
      }
      const selectionText = String(selectionResult?.payload ?? '').trim()
      if (!selectionText) {
        throw new Error('No se detectó texto seleccionado')
      }

      const summaryResult = await browser.runtime.sendMessage({
        type: 'agent-chat:selection',
        selection: selectionText
      })

      if (summaryResult?.error) {
        throw new Error(String(summaryResult.error))
      }

      const summaryText = String(summaryResult?.payload ?? '').trim()
      if (!summaryText) {
        throw new Error('No se recibió un resumen')
      }

      setSelectionSummary(summaryText)
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSummarizing(false)
    }
  }, [getActiveTabId])

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
        <button onClick={onIngestPage}>Ingerir página actual</button>
      </section>

      <section>
        <h2>Selección</h2>
        <div className="stack">
          <button onClick={onHighlightSelection} disabled={isHighlighting || isSummarizing}>
            {isHighlighting ? 'Resaltando…' : 'Resaltar selección'}
          </button>
          <button onClick={onSummarizeSelection} disabled={isSummarizing}>
            {isSummarizing ? 'Resumiendo…' : 'Resumir selección'}
          </button>
        </div>
        {highlightMessage && <p className="status">{highlightMessage}</p>}
        {selectionError && <p className="error">{selectionError}</p>}
        {selectionSummary && (
          <pre className="response" role="status">
            {selectionSummary}
          </pre>
        )}
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
