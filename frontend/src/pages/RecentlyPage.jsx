import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import VideoGrid from '../components/VideoGrid'
import ViewToggle from '../components/ViewToggle'
import Pagination from '../components/Pagination'
import { api } from '../api/client'
import { usePlayer } from '../context/PlayerContext'
import { useViewPreferences } from '../context/ViewPreferencesContext'

export default function RecentlyPage() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const { openPlayer, addToQueue } = usePlayer()
  const { viewMode, gridSize } = useViewPreferences()

  const load = async () => {
    setLoading(true)
    try {
      setVideos(await api.get('/videos/recently-watched'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalPages = Math.max(1, Math.ceil(videos.length / pageSize))
  const clampedPage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => videos.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [videos, clampedPage, pageSize]
  )

  const handleOpen = (video) => {
    // Only a playlist's own videos should pre-fill "up next" - see PlaylistDetailPage.
    openPlayer([video], 0, {
      onVideoUpdated: (updated) => setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v))),
      onVideoDeleted: (id) => setVideos((prev) => prev.filter((v) => v.id !== id)),
    })
  }

  const toggleFavorite = async (video) => {
    await api.get(`/videos/favorite/toggle?id=${video.id}`)
    setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, favorite: !v.favorite } : v)))
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <div className="list-controls">
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Récemment vus</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>Les 20 dernières vidéos visionnées</p>
          </div>
          <ViewToggle />
        </div>
        <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />
        {!loading && (
          <VideoGrid
            videos={pageItems}
            onOpen={handleOpen}
            onToggleFavorite={toggleFavorite}
            extraAction={{
              icon: '➕',
              title: 'Ajouter à la liste de lecture actuelle',
              onClick: addToQueue,
            }}
            emptyMessage="Aucune vidéo regardée récemment."
            viewMode={viewMode}
            gridSize={gridSize}
          />
        )}
        <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />
      </main>
    </div>
  )
}
