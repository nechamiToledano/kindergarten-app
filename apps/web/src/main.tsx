import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/app.css'
import App from './App.tsx'
import { AudioUnlockProvider } from './shared/audio/AudioUnlockProvider'
import { AuthProvider } from './shared/auth/AuthProvider'
import { OutboxProvider } from './shared/outbox/OutboxProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <OutboxProvider>
        <AudioUnlockProvider>
          <App />
        </AudioUnlockProvider>
      </OutboxProvider>
    </AuthProvider>
  </StrictMode>,
)
