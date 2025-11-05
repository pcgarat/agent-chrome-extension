import { createRoot } from 'react-dom/client'
import { Options } from './Options'
import '../styles.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Options root element not found')
}

const root = createRoot(container)
root.render(<Options />)
