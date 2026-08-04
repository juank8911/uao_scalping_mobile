import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SystemProvider } from 'jeikei-design-system'
import 'jeikei-design-system/dist/style.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemProvider>
      <App />
    </SystemProvider>
  </StrictMode>,
)
