import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Geist is the corporate typeface (Kível manual 2.5). Bundled rather than
// linked so the kiosk renders identically with no network and no locally
// installed fonts.
import '@fontsource/geist-sans/latin-300.css'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import './index.css'
import './styles/kiosk-hardening.css'
import App from './App.tsx'
import { setupIdleCursor } from './kiosk/idleCursor'

document.addEventListener('contextmenu', (event) => event.preventDefault())
setupIdleCursor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
