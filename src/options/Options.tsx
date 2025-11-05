import { FormEvent, useCallback, useEffect, useState } from 'react'
import browser from 'webextension-polyfill'

export function Options() {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const result = await browser.runtime.sendMessage({ type: 'load-api-key' })
      if (result?.type === 'error') {
        const message = String(result.error ?? 'No se pudo cargar la API key')
        setStatus(`Error: ${message}`)
        setTimeout(() => setStatus(null), 2000)
        return
      }

      if (result?.payload) {
        setApiKey(result.payload as string)
      }
    })()
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      try {
        const result = await browser.runtime.sendMessage({ type: 'save-api-key', apiKey })
        if (result?.type === 'error') {
          throw new Error(String(result.error ?? 'No se pudo guardar la API key'))
        }
        setStatus('Guardado correctamente')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus(`Error: ${message}`)
      } finally {
        setTimeout(() => setStatus(null), 2000)
      }
    },
    [apiKey]
  )

  return (
    <main className="options">
      <h1>Configuración del agente</h1>
      <form onSubmit={handleSubmit} className="stack">
        <label htmlFor="apiKey">OpenAI API Key</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <button type="submit">Guardar</button>
        {status && <p className="status">{status}</p>}
      </form>
    </main>
  )
}
