export type BackgroundMessage =
  | { type: 'save-api-key'; apiKey: string }
  | { type: 'load-api-key' }
  | { type: 'ingest-content'; content: string; source?: string }
  | { type: 'agent-chat'; prompt: string }

export type SaveApiKeySuccess = { type: 'save-api-key:success' }
export type LoadApiKeySuccess = { type: 'load-api-key:success'; payload: string }
export type IngestContentSuccess = {
  type: 'ingest-content:success'
  payload: { entries: number }
}
export type AgentChatSuccess = { type: 'agent-chat:success'; payload: string }
export type BackgroundError = { type: 'error'; error: string }

export type BackgroundResponse =
  | SaveApiKeySuccess
  | LoadApiKeySuccess
  | IngestContentSuccess
  | AgentChatSuccess
  | BackgroundError

export type ContentScriptRequest =
  | { type: 'content:highlight-selection' }
  | { type: 'content:collect-page-text' }

export type HighlightSelectionSuccess = {
  type: 'content:highlight-selection:success'
}
export type CollectPageTextSuccess = {
  type: 'content:collect-page-text:success'
  payload: string
}
export type ContentScriptError = { type: 'error'; error: string }

export type ContentScriptResponse =
  | HighlightSelectionSuccess
  | CollectPageTextSuccess
  | ContentScriptError
