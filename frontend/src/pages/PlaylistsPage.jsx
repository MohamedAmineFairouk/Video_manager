import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Sidebar from '../components/Sidebar'
import { api } from '../api/client'
import { useRouter } from '../router'
import { usePlayer } from '../context/PlayerContext'

function PlaylistCoverCard({ playlist, onOpen, onContextMenu }) {
  const thumbs = playlist.thumbnailUrls || []
  return (
    <div className="playlist-cover-card" onClick={onOpen} onContextMenu={onContextMenu}>
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

function PlaylistCardMenu({ pos, onAction, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return createPortal(
    <div className="video-context-menu" ref={menuRef} style={{ top: pos.y, left: pos.x }}>
      <button type="button" onClick={() => onAction('play')}>▶ Lire la playlist</button>
      <button type="button" onClick={() => onAction('next')}>⏭ Lire ensuite</button>
      <button type="button" onClick={() => onAction('queue')}>📥 Mettre en file d'attente</button>
    </div>,
    document.body
  )
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState(null) // { playlist, pos }
  const [status, setStatus] = useState('')
  const { navigate } = useRouter()
  const { isOpen, openPlayer, addToQueue, playNext } = usePlayer()

  useEffect(() => {
    api.get('/playlists').then(setPlaylists).finally(() => setLoading(false))
  }, [])

  const openMenu = (playlist) => (e) => {
    e.preventDefault()
    setMenu({ playlist, pos: { x: e.clientX, y: e.clientY } })
  }

  const runAction = async (action) => {
    const { playlist } = menu
    setMenu(null)
    const { videos = [] } = await api.get(`/playlists/${playlist.id}`)
    if (!videos.length) { setStatus(`La playlist "${playlist.name}" est vide.`); return }
    // Lecteur fermé : il n'y a pas de file visible, on lance directement la playlist.
    if (action === 'play' || !isOpen) { openPlayer(videos, 0); return }
    if (action === 'next') playNext(videos)
    else addToQueue(videos)
    setStatus(`${videos.length} vidéo(s) de "${playlist.name}" ajoutée(s) à la file d'attente.`)
  }

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

        {status && <div className="status">{status}</div>}

        {!loading && playlists.length === 0 && (
          <p className="playlist-empty">Aucune playlist. Sélectionne des vidéos dans la Bibliothèque, ou utilise le bouton "+ Playlist" du lecteur.</p>
        )}

        <div className="playlist-cards-grid">
          {playlists.map((p) => (
            <PlaylistCoverCard
              key={p.id}
              playlist={p}
              onOpen={() => navigate(`/playlists/${p.id}`)}
              onContextMenu={openMenu(p)}
            />
          ))}
        </div>
      </main>

      {menu && <PlaylistCardMenu pos={menu.pos} onAction={runAction} onClose={() => setMenu(null)} />}
    </div>
  )
}
