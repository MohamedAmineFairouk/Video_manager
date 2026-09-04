import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AddVideoModal from '../components/AddVideoModal'
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
  const [newName, setNewName] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const { navigate } = useRouter()

  const load = async () => {
    setLoading(true)
    try {
      setPlaylists(await api.get('/playlists'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createPlaylist = async () => {
    const name = newName.trim()
    if (!name) return
    const created = await api.post('/playlists', { name })
    setPlaylists((prev) => [created, ...prev])
    setNewName('')
  }

  return (
    <div className="app">
      <Sidebar onAddVideo={() => setAddModalOpen(true)} />
      <main className="content">
        <div className="playlist-header">
          <div>
            <h1 className="page-title">Playlists</h1>
            <p className="page-subtitle">Organise tes vidéos comme sur YouTube</p>
          </div>
          <div className="playlist-toolbar">
            <input
              className="host-input"
              type="text"
              placeholder="Nom de la playlist"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist() }}
            />
            <button className="btn" onClick={createPlaylist}>+ Nouvelle playlist</button>
          </div>
        </div>

        {!loading && playlists.length === 0 && <p className="playlist-empty">Aucune playlist. Crée la première ci-dessus, ou depuis le bouton "+ Playlist" du lecteur.</p>}

        <div className="playlist-cards-grid">
          {playlists.map((p) => (
            <PlaylistCoverCard key={p.id} playlist={p} onOpen={() => navigate(`/playlists/${p.id}`)} />
          ))}
        </div>
      </main>
      <AddVideoModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdded={load} />
    </div>
  )
}
