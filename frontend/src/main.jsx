import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { RouterProvider } from './router.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ViewPreferencesProvider } from './context/ViewPreferencesContext.jsx'
import './styles/global.css'
import './styles/player.css'
import './styles/playlists.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider>
      <AuthProvider>
        <ViewPreferencesProvider>
          <App />
        </ViewPreferencesProvider>
      </AuthProvider>
    </RouterProvider>
  </StrictMode>,
)
