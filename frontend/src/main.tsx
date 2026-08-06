import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Electron erkennen
if ((window as any).pingr?.isElectron) {
  document.body.classList.add('electron-app')
}
import { registerServiceWorker } from './utils/pwa'
import { applyTheme } from './store/themeStore'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element nicht gefunden')

registerServiceWorker()
// Theme beim App-Start anwenden
const savedTheme = (localStorage.getItem('pingr_theme') || 'dark') as any
applyTheme(savedTheme)
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)