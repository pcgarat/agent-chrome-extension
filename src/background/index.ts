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

const EMBEDDING_MODEL = 'text-embedding-3-small'
const CHAT_MODEL = 'gpt-4o-mini'
const MAX_SAVED_CONTENT_LENGTH = 4000
const MAX_CONTEXT_LENGTH = 6000
const TOP_MATCHES = 3

async function fetchEmbedding(apiKey: string, input: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI embeddings request failed: ${response.status} ${errorText}`)
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
  }

  const embedding = payload.data?.[0]?.embedding
  if (!embedding) {
    throw new Error('OpenAI embeddings response missing embedding data')
  }

  return embedding
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}…`
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return -Infinity
  }
  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0
  for (let i = 0; i < a.length; i += 1) {
    const valueA = a[i]
    const valueB = b[i]
    dotProduct += valueA * valueB
    magnitudeA += valueA * valueA
    magnitudeB += valueB * valueB
  }
  if (magnitudeA === 0 || magnitudeB === 0) {
    return -Infinity
  }
  return dotProduct / Math.sqrt(magnitudeA * magnitudeB)
}

function rankBySimilarity(
  queryEmbedding: number[],
  store: VectorStore,
  topN: number
): VectorStore {
  const scoredEntries = store
    .filter((entry) => Array.isArray(entry.embedding))
    .map((entry) => ({
      entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding as number[])
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)

  return scoredEntries.slice(0, topN).map(({ entry }) => entry)
}

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
  const apiKey = await loadApiKey()
  if (!apiKey) {
    throw new Error('No OpenAI API key configured')
  }

  const truncatedContent = truncateText(content, MAX_SAVED_CONTENT_LENGTH)
  const embedding = await fetchEmbedding(apiKey, truncatedContent)

  const store = await getVectorStore()
  const id = crypto.randomUUID()
  store.push({ id, content: truncatedContent, source, embedding })
  await persistVectorStore(store)
}

async function agentChat(prompt: string): Promise<string> {
  const apiKey = await loadApiKey()
  if (!apiKey) {
    throw new Error('No OpenAI API key configured')
  }

  const vectorStore = await getVectorStore()
  const truncatedPrompt = truncateText(prompt, MAX_CONTEXT_LENGTH)
  const queryEmbedding = await fetchEmbedding(apiKey, truncatedPrompt)
  const topEntries = rankBySimilarity(queryEmbedding, vectorStore, TOP_MATCHES)

  const contextualNotes = topEntries
    .map((entry) => `${entry.source ?? 'unknown source'}:\n${entry.content}`)
    .join('\n\n')

  const promptWithContext = contextualNotes.length > 0
    ? `Context:\n${truncateText(contextualNotes, MAX_CONTEXT_LENGTH)}\n\nUser prompt:\n${truncatedPrompt}`
    : truncatedPrompt

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an AI agent embedded in a Chrome extension. Use the supplied context when it is relevant.'
        },
        {
          role: 'user',
          content: promptWithContext
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
