import browser from 'webextension-polyfill'

import type { ContentScriptRequest, ContentScriptResponse } from '../shared/messages'

function highlightSelection() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return
  }

  const range = selection.getRangeAt(0)
  const span = document.createElement('span')
  span.style.backgroundColor = 'rgba(120, 169, 255, 0.4)'
  span.style.borderRadius = '4px'
  range.surroundContents(span)
}

async function extractPageText(): Promise<string> {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const chunks: string[] = []
  let node = walker.nextNode()
  while (node) {
    const value = node.textContent?.trim()
    if (value) {
      chunks.push(value)
    }
    node = walker.nextNode()
  }
  return chunks.join('\n')
}

browser.runtime.onMessage.addListener(
  async (message: ContentScriptRequest): Promise<ContentScriptResponse | void> => {
    if (message?.type === 'content:highlight-selection') {
      highlightSelection()
      return { type: 'content:highlight-selection:success' }
    }

    if (message?.type === 'content:collect-page-text') {
      const text = await extractPageText()
      return { type: 'content:collect-page-text:success', payload: text }
    }

    return undefined
  }
)

export {}
