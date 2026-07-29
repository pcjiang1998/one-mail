import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyAppTheme, getStoredAppTheme } from './lib/theme'

document.documentElement.dataset.platform = window.electron?.process?.platform ?? 'browser'

applyAppTheme(getStoredAppTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
