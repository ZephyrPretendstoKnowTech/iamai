import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { installPreloadErrorReload } from './preloadError.ts'
import './tokens.css'
import './app.css'

// A chunk the new build no longer ships reloads the page once (preloadError.ts).
installPreloadErrorReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
