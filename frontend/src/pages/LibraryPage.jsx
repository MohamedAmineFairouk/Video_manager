import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import VideoGrid from '../components/VideoGrid'
import ViewToggle from '../components/ViewToggle'
import Pagination from '../components/Pagination'
import AddVideoModal from '../components/AddVideoModal'
import { api } from '../api/client'
import { usePlayer } from '../context/PlayerContext'
import { useViewPreferences } from '../context/ViewPreferencesContext'

export default function LibraryPage() {
  const [videos, setVideos] = useState([])
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const [sort, setSort] = useState('recent')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState(null) // 1..5, inverted scale like the star UI
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selected, setSelected] = useState(new Set())
  const [addModalOpen, setAddModalOpen] = useState(false)

  const { openPlayer } = usePlayer()
  const { viewMode, gridSize } = useViewPreferences()

  const loadAll = async () => {
    setLoading(true)
    setStatus('Chargement des vidéos...')
    try {
      const [videoList, creatorList] = await Promise.all([
        api.get('/videos'),
        api.get('/videos/creators'),
      ])
      setVideos(videoList)
      setCreators(creatorList)
      setStatus('')
    } catch {
      setStatus('Erreur chargement vidéos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const filtered = useMemo(() => {
    let list = videos
    if (creatorFilter) list = list.filter((v) => v.creators?.includes(creatorFilter))
    if (levelFilter) list = list.filter((v) => String(v.sourceIndex) === String(levelFilter))
    if (favoriteOnly) list = list.filter((v) => v.favorite === true)

    const sorted = [...list]
    switch (sort) {
      case 'name-asc': sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break
      case 'name-desc': sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break
      case 'recent': sorted.sort((a, b) => (b.id || 0) - (a.id || 0)); break
      case 'oldest': sorted.sort((a, b) => (a.id || 0) - (b.id || 0)); break
      default: break
    }
    return sorted
  }, [videos, creatorFilter, levelFilter, favoriteOnly, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

  const resetFilters = () => {
    setCreatorFilter(''); setLevelFilter(null); setFavoriteOnly(false); setSort('recent'); setPage(1)
  }

  const handleOpen = (video) => {
    const startIndex = filtered.findIndex((v) => v.id === video.id)
    openPlayer(filtered, startIndex, {
      onVideoUpdated: (updated) => setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v))),
      onVideoDeleted: (id) => setVideos((prev) => prev.filter((v) => v.id !== id)),
    })
  }

  const toggleFavorite = async (video) => {
    await api.get(`/videos/favorite/toggle?id=${video.id}`)
    setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, favorite: !v.favorite } : v)))
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const exportM3U = () => {
    const chosen = pageItems.filter((v) => selected.has(v.id))
    if (!chosen.length) { setStatus('Veuillez sélectionner au moins une vidéo.'); return }
    let content = '#EXTM3U\n'
    chosen.forEach((v) => {
      content += `#EXTINF:${Math.floor((v.durationMs || 0) / 1000)},${v.title || 'Vidéo'}\n${v.url}\n`
    })
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arcad_playlist_${Date.now()}.m3u`
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Playlist M3U exportée (${chosen.length} vidéo(s)).`)
  }

  return (
    <div className="app">
      <Sidebar onAddVideo={() => setAddModalOpen(true)}>
        <div className="filter-box">
          <p className="section-title">Tri</p>
          <select className="selector" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name-asc">Nom (A-Z)</option>
            <option value="name-desc">Nom (Z-A)</option>
            <option value="recent">Plus récent</option>
            <option value="oldest">Plus ancien</option>
          </select>
        </div>

        <div className="filter-box">
          <p className="section-title">Creator</p>
          <select className="selector" value={creatorFilter} onChange={(e) => { setCreatorFilter(e.target.value); setPage(1) }}>
            <option value="">Tous</option>
            {creators.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="filter-box">
          <p className="section-title">Level</p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
            {[1, 2, 3, 4, 5].map((i) => {
              const levelValue = 6 - i
              const filled = levelFilter && i <= 6 - levelFilter
              return (
                <span key={i} style={{ cursor: 'pointer', fontSize: 22, color: filled ? '#facc15' : '#334155' }}
                  onClick={() => { setLevelFilter(levelValue); setPage(1) }}>★</span>
              )
            })}
          </div>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px', marginTop: 2 }} onClick={() => { setLevelFilter(null); setPage(1) }}>Tous</button>
        </div>

        <div className="filter-box">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={favoriteOnly} onChange={(e) => { setFavoriteOnly(e.target.checked); setPage(1) }} />
            Favoris
          </label>
        </div>

        <div className="filter-box">
          <button className="btn-secondary" onClick={resetFilters}>Réinitialiser les filtres</button>
        </div>

        <div className="status">{status}</div>

        <details className="accordion" open>
          <summary>Sélection</summary>
          <div className="accordion-body">
            <div className="compact-grid">
              <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 8px', marginTop: 0 }}
                onClick={() => setSelected(new Set(pageItems.map((v) => v.id)))}>Tout sél.</button>
              <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 8px', marginTop: 0 }}
                onClick={() => setSelected(new Set())}>Annuler</button>
            </div>
            <button className="btn" style={{ fontSize: 12, padding: '7px 8px', background: 'rgba(34,212,153,0.95)' }} onClick={exportM3U}>Exporter M3U</button>
            <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 6 }}>{selected.size > 0 ? `${selected.size} sélectionné(s)` : ''}</div>
          </div>
        </details>
      </Sidebar>

      <main className="content">
        <div className="brand-row">
          <img src="/2938237.png" alt="icon" className="brand-logo" />
          <span className="brand-name" style={{ fontSize: '2.1rem' }}>Ar44</span>
        </div>

        <div className="list-controls">
          <div className="count-box">{filtered.length} vidéo(s)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ViewToggle />
            <label style={{ fontSize: 13, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
              Afficher
              <select className="page-size-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </label>
          </div>
        </div>

        <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />

        {!loading && (
          <VideoGrid
            videos={pageItems}
            onOpen={handleOpen}
            onToggleFavorite={toggleFavorite}
            viewMode={viewMode}
            gridSize={gridSize}
            selectable
            selectedIds={selected}
            onToggleSelect={(video) => toggleSelect(video.id)}
          />
        )}
      </main>

      <AddVideoModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdded={loadAll} />
    </div>
  )
}
