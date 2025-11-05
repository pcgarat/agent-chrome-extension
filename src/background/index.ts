import browser from 'webextension-polyfill'

const STORAGE_KEYS = {
  apiKey: 'agent:openai_api_key',
  vectorStore: 'agent:vector_store'
} as const

type AgentMessage =
  | { type: 'save-api-key'; apiKey: string }
  | { type: 'load-api-key' }
  | { type: 'ingest-content'; content: string; source?: string }
  | { type: 'agent-chat'; prompt: string }

interface AgentResponse {
  type: string
  payload?: unknown
  error?: string
}

type VectorStore = Array<{
  id: string
  source?: string
  content: string
  embedding?: number[]
}>

async function saveApiKey(apiKey: string) {
  await browser.storage.sync.set({ [STORAGE_KEYS.apiKey]: apiKey })
}

async function loadApiKey() {
  const values = await browser.storage.sync.get(STORAGE_KEYS.apiKey)
  return values[STORAGE_KEYS.apiKey] as string | undefined
}

async function getVectorStore(): Promise<VectorStore> {
  const values = await browser.storage.local.get(STORAGE_KEYS.vectorStore)
  return (values[STORAGE_KEYS.vectorStore] as VectorStore | undefined) ?? []
}

async function persistVectorStore(store: VectorStore) {
  await browser.storage.local.set({ [STORAGE_KEYS.vectorStore]: store })
}

async function ingestContent(content: string, source?: string) {
  const store = await getVectorStore()
  const id = crypto.randomUUID()
  store.push({ id, content, source })
  await persistVectorStore(store)
}

async function agentChat(prompt: string): Promise<string> {
  const apiKey = await loadApiKey()
  if (!apiKey) {
    throw new Error('No OpenAI API key configured')
  }

  const vectorStore = await getVectorStore()
  const contextualNotes = vectorStore
    .slice(-3)
    .map((entry) => `${entry.source ?? 'unknown source'}:\n${entry.content}`)
    .join('\n\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI agent embedded in a Chrome extension. Use the supplied context when it is relevant.'
        },
        {
          role: 'user',
          content:
            contextualNotes.length > 0
              ? `Context:\n${contextualNotes}\n\nUser prompt:\n${prompt}`
              : prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const message = payload.choices?.[0]?.message?.content?.trim()
  if (!message) {
    throw new Error('No content returned from OpenAI')
  }

  return message
}

browser.runtime.onInstalled.addListener(() => {
  void browser.storage.sync.set({ [STORAGE_KEYS.apiKey]: '' })
})

browser.runtime.onMessage.addListener(
  async (message: AgentMessage): Promise<AgentResponse> => {
    try {
      switch (message.type) {
        case 'save-api-key':
          await saveApiKey(message.apiKey)
          return { type: 'save-api-key:success' }
        case 'load-api-key': {
          const apiKey = await loadApiKey()
          return { type: 'load-api-key:success', payload: apiKey ?? '' }
        }
        case 'ingest-content':
          await ingestContent(message.content, message.source)
          return { type: 'ingest-content:success' }
        case 'agent-chat': {
          const completion = await agentChat(message.prompt)
          return { type: 'agent-chat:success', payload: completion }
        }
        default:
          return { type: 'error', error: 'Unknown message type' }
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      return { type: 'error', error: messageText }
    }
  }
)
