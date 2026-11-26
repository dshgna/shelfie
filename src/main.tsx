import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { getSupabaseClient, setKeepSignedIn } from './auth/client'
import { createSupabaseAuthService } from './auth/service'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const auth = createSupabaseAuthService({
  createClient: getSupabaseClient,
  setKeepSignedIn,
  appUrl: new URL(import.meta.env.BASE_URL, window.location.origin).href,
})

createRoot(root).render(
  <StrictMode>
    <AuthProvider service={auth}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
