import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../api/client'
import { useRouter } from '../router'

function PlaylistCoverCard({ playlist, onOpen }) {
  const thumbs = playlist.thumbnailUrls || []
  return (
    <div className="playlist-cover-card" onClick={onOpen}>
      {thumbs.length === 0 && <div className="playlist-cover-empty">Playlist vide</div>}
      {thumbs.length > 0 && (
        <div className={`playlist-cover-grid ${thumbs.length === 1 ? 'single' : ''}`}>
          {thumbs.slice(0, 4).map((url, i) => <img key={i} src={url} alt="" />)}
        </div>
      )}
      <div className="playlist-cover-info">
        <div className="playlist-cover-title">{playlist.name}</div>
        <div className="playlist-cover-count">{playlist.videoCount} vidéo(s)</div>
      </div>
    </div>
  )
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const { navigate } = useRouter()

  useEffect(() => {
    api.get('/playlists').then(setPlaylists).finally(() => setLoading(false))
  }, [])

  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <div className="playlist-header">
          <div>
            <h1 className="page-title">Playlists</h1>
            <p className="page-subtitle">Organise tes vidéos comme sur YouTube</p>
          </div>
        </div>

        {!loading && playlists.length === 0 && (
          <p className="playlist-empty">Aucune playlist. Sélectionne des vidéos dans la Bibliothèque, ou utilise le bouton "+ Playlist" du lecteur.</p>
        )}

        <div className="playlist-cards-grid">
          {playlists.map((p) => (
            <PlaylistCoverCard key={p.id} playlist={p} onOpen={() => navigate(`/playlists/${p.id}`)} />
          ))}
        </div>
      </main>
    </div>
  )
}
