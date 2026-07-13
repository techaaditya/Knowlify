import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthApp } from './pages/auth/AuthApp'
import { useAuthStore } from './store/authStore'
import './index.css'

/**
 * Auth gate: validates any persisted session on load, then routes between the
 * authenticated app and the auth screens. Unauthenticated users can only reach
 * the auth pages; authenticated users are kept out of them.
 */
const Root: React.FC = () => {
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  if (status === 'loading') {
    return (
      <div className="auth-boot">
        <span className="auth-boot-icon">🧠</span>
        <span className="spinner" />
      </div>
    )
  }

  return status === 'authenticated' ? <App /> : <AuthApp />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
