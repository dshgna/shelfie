import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { currentBuild, emailLinkBase } from './app-paths'
import { AuthProvider } from './auth/AuthProvider'
import { getSupabaseClient, setKeepSignedIn } from './auth/client'
import { createSupabaseAuthService } from './auth/service'
import { ErrorBoundary } from './ui/ErrorBoundary'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// Creating the service doesn't create the Supabase client (that happens on the first auth call),
// so a build without its settings still renders: AuthProvider moves to 'unavailable' and App shows
// the plain "can't start" screen. The error boundary covers anything else thrown while rendering.
const auth = createSupabaseAuthService({
  createClient: getSupabaseClient,
  setKeepSignedIn,
  appUrl: emailLinkBase(currentBuild(), window.location.origin),
})

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider service={auth}>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
