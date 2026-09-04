import { useEffect } from 'react'
import { useRouter } from './router'
import { useAuth } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext'
import VideoPlayerModal from './components/VideoPlayerModal'
import { api } from './api/client'

import LoginPage from './pages/LoginPage'
import LibraryPage from './pages/LibraryPage'
import FavoritesPage from './pages/FavoritesPage'
import RecentlyPage from './pages/RecentlyPage'
import PlaylistsPage from './pages/PlaylistsPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import SettingsPage from './pages/SettingsPage'
import StatsPage from './pages/StatsPage'

function resolvePage(path) {
  if (path === '/' || path === '') return { Page: LibraryPage, name: 'index' }
  if (path === '/favorites') return { Page: FavoritesPage, name: 'favorites' }
  if (path === '/recently') return { Page: RecentlyPage, name: 'recently' }
  if (path === '/playlists') return { Page: PlaylistsPage, name: 'playlists' }
  const playlistMatch = path.match(/^\/playlists\/(\d+)$/)
  if (playlistMatch) return { Page: PlaylistDetailPage, name: 'playlist-detail', props: { playlistId: playlistMatch[1] } }
  if (path === '/settings') return { Page: SettingsPage, name: 'settings' }
  if (path === '/stats') return { Page: StatsPage, name: 'stats' }
  return null
}

export default function App() {
  const { path, navigate } = useRouter()
  const { authenticated } = useAuth()

  useEffect(() => {
    if (authenticated === false && path !== '/login') navigate('/login')
    if (authenticated === true && path === '/login') navigate('/')
  }, [authenticated, path, navigate])

  useEffect(() => {
    if (authenticated !== true) return
    const resolved = resolvePage(path)
    api.post(`/stats/access?page=${encodeURIComponent(resolved?.name || path)}`).catch(() => {})
  }, [path, authenticated])

  if (authenticated === null) {
    return <div className="login-shell"><div className="status">Chargement...</div></div>
  }

  if (path === '/login' || authenticated === false) {
    return <LoginPage />
  }

  const resolved = resolvePage(path)
  if (!resolved) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <p>Page introuvable.</p>
          <button className="btn" onClick={() => navigate('/')}>Retour à la bibliothèque</button>
        </div>
      </div>
    )
  }

  const { Page, props } = resolved

  return (
    <PlayerProvider>
      <Page {...props} />
      <VideoPlayerModal />
    </PlayerProvider>
  )
}
