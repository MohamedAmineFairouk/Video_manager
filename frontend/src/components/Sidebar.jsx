import { Link, useRouter } from '../router'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Bibliothèque' },
  { to: '/favorites', label: 'Favoris' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/recently', label: 'Récemment vus' },
  { to: '/stats', label: 'Statistiques' },
]

export default function Sidebar({ onAddVideo, children }) {
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
        <button className="icon-round-btn" style={{ marginLeft: 'auto' }} title="Réglages" onClick={() => navigate('/settings')}>⚙</button>
        <button className="icon-round-btn danger" title="Déconnexion" onClick={handleLogout}>✕</button>
      </div>

      <div className="nav-chip-wrap">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className={`nav-chip ${path === item.to ? 'active' : ''}`}>
            {item.label}
          </Link>
        ))}
        {onAddVideo && (
          <button className="nav-chip highlight" onClick={onAddVideo}>Ajouter une vidéo</button>
        )}
      </div>

      {children}
    </div>
  )
}
