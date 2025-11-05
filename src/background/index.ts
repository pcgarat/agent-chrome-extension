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

type VectorStoreEntry = {
  id: string
  source?: string
  content: string
  embedding?: number[]
  createdAt?: number
}

type VectorStore = VectorStoreEntry[]

const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200
const MAX_VECTOR_ENTRIES = 60

function chunkText(text: string, chunkSize = MAX_CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const sanitized = text.replace(/\s+/g, ' ').trim()
  if (!sanitized) {
    return []
  }

  const chunks: string[] = []
  let start = 0
  while (start < sanitized.length) {
    const end = Math.min(start + chunkSize, sanitized.length)
    const slice = sanitized.slice(start, end).trim()
    if (slice.length > 0) {
      chunks.push(slice)
    }
    if (end === sanitized.length) {
      break
    }
    start = end - overlap
    if (start < 0) {
      start = 0
    }
  }
  return chunks
}

async function createEmbedding(apiKey: string, input: string): Promise<number[]> {
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
    throw new Error(`OpenAI embeddings failed: ${response.status} ${errorText}`)
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
  }

  const embedding = payload.data?.[0]?.embedding
  if (!embedding || embedding.length === 0) {
    throw new Error('No embedding returned from OpenAI')
  }

  return embedding
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length) {
    throw new Error('Embedding length mismatch')
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dot / Math.sqrt(normA * normB)
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
  const stored = (values[STORAGE_KEYS.vectorStore] as VectorStore | undefined) ?? []
  return stored.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt ?? Date.now()
  }))
}

async function persistVectorStore(store: VectorStore) {
  await browser.storage.local.set({ [STORAGE_KEYS.vectorStore]: store })
}

async function ingestContent(content: string, source?: string) {
  const apiKey = await loadApiKey()
  if (!apiKey) {
    throw new Error('No OpenAI API key configured')
  }

  const chunks = chunkText(content)
  if (chunks.length === 0) {
    throw new Error('No content available to index')
  }

  const store = await getVectorStore()

  for (const chunk of chunks) {
    const embedding = await createEmbedding(apiKey, chunk)
    store.push({
      id: crypto.randomUUID(),
      content: chunk,
      source,
      embedding,
      createdAt: Date.now()
    })
    if (store.length > MAX_VECTOR_ENTRIES) {
      store.splice(0, store.length - MAX_VECTOR_ENTRIES)
    }
  }

  await persistVectorStore(store)
  return chunks.length
}

async function agentChat(prompt: string): Promise<string> {
  const apiKey = await loadApiKey()
  if (!apiKey) {
    throw new Error('No OpenAI API key configured')
  }

  const vectorStore = await getVectorStore()
  const queryEmbedding = vectorStore.length > 0 ? await createEmbedding(apiKey, prompt) : null

  const contextualNotes = queryEmbedding
    ? vectorStore
        .filter((entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0)
        .map((entry) => ({
          entry,
          score: cosineSimilarity(entry.embedding!, queryEmbedding)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ entry, score }) => {
          const sourceLabel = entry.source ?? 'unknown source'
          return `${sourceLabel} (score: ${score.toFixed(2)}):\n${entry.content}`
        })
        .join('\n\n')
    : ''

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
        case 'ingest-content': {
          const entries = await ingestContent(message.content, message.source)
          return { type: 'ingest-content:success', payload: { entries } }
        }
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
