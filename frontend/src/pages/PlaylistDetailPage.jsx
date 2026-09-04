import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import VideoGrid from '../components/VideoGrid'
import ViewToggle from '../components/ViewToggle'
import AddVideoModal from '../components/AddVideoModal'
import ConfirmModal from '../components/ConfirmModal'
import { api } from '../api/client'
import { useRouter } from '../router'
import { usePlayer } from '../context/PlayerContext'
import { useViewPreferences } from '../context/ViewPreferencesContext'

export default function PlaylistDetailPage({ playlistId }) {
  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const { navigate } = useRouter()
  const { openPlayer } = usePlayer()
  const { viewMode, gridSize } = useViewPreferences()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/playlists/${playlistId}`)
      setPlaylist(data)
      setNameDraft(data.name)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [playlistId])

  const saveRename = async () => {
    const name = nameDraft.trim()
    if (!name || name === playlist.name) { setRenaming(false); return }
    const updated = await api.put(`/playlists/${playlistId}`, { name })
    setPlaylist((p) => ({ ...p, name: updated.name }))
    setRenaming(false)
  }

  const deletePlaylist = async () => {
    await api.del(`/playlists/${playlistId}`)
    setConfirmDeleteOpen(false)
    navigate('/playlists')
  }

  const removeVideo = async (video) => {
    await api.del(`/playlists/${playlistId}/videos/${video.id}`)
    setPlaylist((p) => ({ ...p, videos: p.videos.filter((v) => v.id !== video.id), videoCount: p.videoCount - 1 }))
  }

  const toggleFavorite = async (video) => {
    await api.get(`/videos/favorite/toggle?id=${video.id}`)
    setPlaylist((p) => ({ ...p, videos: p.videos.map((v) => (v.id === video.id ? { ...v, favorite: !v.favorite } : v)) }))
  }

  const reorder = async (newVideos) => {
    setPlaylist((p) => ({ ...p, videos: newVideos }))
    await api.post(`/playlists/${playlistId}/reorder`, newVideos.map((v) => v.id))
  }

  const handleOpen = (video) => {
    const videos = playlist.videos
    const startIndex = videos.findIndex((v) => v.id === video.id)
    openPlayer(videos, startIndex, {
      onVideoUpdated: (updated) => setPlaylist((p) => ({ ...p, videos: p.videos.map((v) => (v.id === updated.id ? updated : v)) })),
      onVideoDeleted: (id) => setPlaylist((p) => ({ ...p, videos: p.videos.filter((v) => v.id !== id), videoCount: p.videoCount - 1 })),
    })
  }

  return (
    <div className="app">
      <Sidebar onAddVideo={() => setAddModalOpen(true)} />
      <main className="content">
        <button className="btn-secondary" style={{ width: 'auto', marginBottom: 14 }} onClick={() => navigate('/playlists')}>← Playlists</button>

        {!loading && playlist && (
          <>
            <div className="playlist-header">
              <div>
                {renaming ? (
                  <input
                    className="host-input"
                    style={{ fontSize: 22, fontWeight: 700 }}
                    value={nameDraft}
                    autoFocus
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveRename() }}
                    onBlur={saveRename}
                  />
                ) : (
                  <h1 className="page-title">{playlist.name}</h1>
                )}
                <p className="page-subtitle">{playlist.videoCount} vidéo(s)</p>
              </div>
              <div className="playlist-management">
                <button className="btn-secondary" onClick={() => setRenaming(true)}>Renommer</button>
                <button className="btn-secondary danger-button" onClick={() => setConfirmDeleteOpen(true)}>Supprimer</button>
              </div>
            </div>

            <div className="list-controls">
              <div />
              <ViewToggle />
            </div>

            <VideoGrid
              videos={playlist.videos}
              onOpen={handleOpen}
              onToggleFavorite={toggleFavorite}
              emptyMessage="Cette playlist est vide. Ajoute des vidéos depuis le lecteur (bouton + Playlist)."
              extraAction={{ icon: '✕', title: 'Retirer de la playlist', onClick: removeVideo }}
              viewMode={viewMode}
              gridSize={gridSize}
              reorderable
              onReorder={reorder}
            />
          </>
        )}
      </main>

      <ConfirmModal
        open={confirmDeleteOpen}
        text={`Supprimer la playlist "${playlist?.name}" ? Les vidéos ne seront pas supprimées.`}
        onConfirm={deletePlaylist}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      <AddVideoModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdded={load} />
    </div>
  )
}
