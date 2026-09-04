import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import VideoGrid from '../components/VideoGrid'
import Pagination from '../components/Pagination'
import AddVideoModal from '../components/AddVideoModal'
import { api } from '../api/client'
import { usePlayer } from '../context/PlayerContext'

export default function RecentlyPage() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const { openPlayer } = usePlayer()

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
    const startIndex = videos.findIndex((v) => v.id === video.id)
    openPlayer(videos, startIndex, {
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
      <Sidebar onAddVideo={() => setAddModalOpen(true)} />
      <main className="content">
        <h1 className="page-title">Récemment vus</h1>
        <p className="page-subtitle">Les 20 dernières vidéos visionnées</p>
        <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />
        {!loading && <VideoGrid videos={pageItems} onOpen={handleOpen} onToggleFavorite={toggleFavorite} emptyMessage="Aucune vidéo regardée récemment." />}
      </main>
      <AddVideoModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdded={load} />
    </div>
  )
}
