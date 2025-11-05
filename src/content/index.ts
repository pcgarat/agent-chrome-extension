import browser from 'webextension-polyfill'

function highlightSelection(): string | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const text = selection.toString().trim()
  if (!text) {
    return null
  }

  const range = selection.getRangeAt(0)
  const span = document.createElement('span')
  span.style.backgroundColor = 'rgba(120, 169, 255, 0.4)'
  span.style.borderRadius = '4px'

  try {
    const contents = range.extractContents()
    span.appendChild(contents)
    range.insertNode(span)
    selection.removeAllRanges()
  } catch (error) {
    // If we fail to highlight for any reason, keep the original selection intact.
    console.error('Failed to highlight selection', error)
    return null
  }

  return text
}

function getSelectionText(): string | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const text = selection.toString().trim()
  return text.length > 0 ? text : null
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

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type === 'content:highlight-selection') {
    const text = highlightSelection()
    if (!text) {
      return { type: 'content:highlight-selection:empty', error: 'No hay texto seleccionado' }
    }
    return { type: 'content:highlight-selection:success', payload: text }
  }

  if (message?.type === 'content:get-selection-text') {
    const text = getSelectionText()
    if (!text) {
      return { type: 'content:get-selection-text:empty', error: 'No hay texto seleccionado' }
    }
    return { type: 'content:get-selection-text:success', payload: text }
  }

  if (message?.type === 'content:collect-page-text') {
    const text = await extractPageText()
    return { type: 'content:collect-page-text:success', payload: text }
  }
})

export {}
