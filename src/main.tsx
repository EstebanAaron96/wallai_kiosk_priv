import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
