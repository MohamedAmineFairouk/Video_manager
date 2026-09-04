import { useEffect, useState } from 'react'
import { Link, useRouter } from '../router'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

const TILE_ITEMS = [
  { to: '/', label: 'Bibliothèque', icon: '🎬' },
  { to: '/favorites', label: 'Favoris', icon: '♥' },
  { to: '/playlists', label: 'Playlists', icon: '🎞️' },
  { to: '/recently', label: 'Récemment vus', icon: '🕘' },
]

function RecentPlaylists() {
  const [playlists, setPlaylists] = useState([])

  useEffect(() => {
    api.get('/playlists').then((all) => setPlaylists(all.slice(0, 5))).catch(() => {})
  }, [])

  if (playlists.length === 0) return null

  return (
    <div className="sidebar-playlists">
      <div className="sidebar-playlists-header">
        <span className="section-title" style={{ margin: 0 }}>Playlists récentes</span>
        <Link to="/playlists" className="sidebar-playlists-more">Voir tout</Link>
      </div>
      <div className="sidebar-playlists-list">
        {playlists.map((p) => (
          <Link key={p.id} to={`/playlists/${p.id}`} className="sidebar-playlist-item">
            <span className="sidebar-playlist-thumb">
              {p.thumbnailUrls?.[0]
                ? <img src={p.thumbnailUrls[0]} alt="" />
                : <span>🎞️</span>}
            </span>
            <span className="sidebar-playlist-info">
              <span className="sidebar-playlist-name">{p.name}</span>
              <span className="sidebar-playlist-count">{p.videoCount} vidéo(s)</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ children }) {
  const { path, navigate } = useRouter()
  const { logout } = useAuth()

  const handleLogout = async () => {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return
    await logout()
    navigate('/login')
  }

  return (
    <div className="sidebar">
      <div className="brand-row">
        <img src="/2938237.png" alt="icon" className="brand-logo" />
        <span className="brand-name">Ar44</span>
        <button className="icon-round-btn" style={{ marginLeft: 'auto' }} title="Statistiques" onClick={() => navigate('/stats')}>📊</button>
        <button className="icon-round-btn danger" title="Déconnexion" onClick={handleLogout}>✕</button>
      </div>

      <div className="nav-tile-grid">
        {TILE_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className={`nav-tile ${path === item.to ? 'active' : ''}`}>
            <span className="nav-tile-bubble">{item.icon}</span>
            <span className="nav-tile-label">{item.label}</span>
          </Link>
        ))}
      </div>

      {children}

      <RecentPlaylists />
    </div>
  )
}
