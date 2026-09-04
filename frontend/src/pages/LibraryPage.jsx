import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import VideoGrid from '../components/VideoGrid'
import ViewToggle from '../components/ViewToggle'
import Pagination from '../components/Pagination'
import { api } from '../api/client'
import { usePlayer } from '../context/PlayerContext'
import { useViewPreferences } from '../context/ViewPreferencesContext'
import { useRouter } from '../router'

export default function LibraryPage() {
  const [videos, setVideos] = useState([])
  const [creators, setCreators] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const [sort, setSort] = useState('oldest')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [tagFilter, setTagFilter] = useState(new Set())
  const [levelFilter, setLevelFilter] = useState(null) // 1..5, inverted scale like the star UI
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selected, setSelected] = useState(new Set())
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creatingPlaylist, setCreatingPlaylist] = useState(false)
  const [scanning, setScanning] = useState(false)

  const { openPlayer } = usePlayer()
  const { viewMode, gridSize } = useViewPreferences()
  const { navigate } = useRouter()

  const loadAll = async () => {
    setLoading(true)
    setStatus('Chargement des vidéos...')
    try {
      const [videoList, creatorList, tagList] = await Promise.all([
        api.get('/videos'),
        api.get('/videos/creators'),
        api.get('/videos/tags'),
      ])
      setVideos(videoList)
      setCreators(creatorList)
      setTags(tagList)
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
    if (tagFilter.size > 0) {
      list = list.filter((v) => {
        const videoTags = v.tags || []
        return Array.from(tagFilter).every((t) => videoTags.includes(t))
      })
    }
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
  }, [videos, creatorFilter, tagFilter, levelFilter, favoriteOnly, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

  const resetFilters = () => {
    setCreatorFilter(''); setTagFilter(new Set()); setLevelFilter(null); setFavoriteOnly(false); setSort('oldest'); setPage(1)
  }

  const toggleTagFilter = (tag) => {
    setTagFilter((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
    setPage(1)
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

  const scanFolder = async () => {
    setScanning(true)
    setStatus('Analyse du dossier vidéos...')
    try {
      const result = await api.post('/videos/import-from-disk')
      setStatus(`${result.imported} vidéo(s) importée(s), ${result.durationsUpdated} durée(s) mise(s) à jour.`)
      await loadAll()
    } catch {
      setStatus('Erreur lors du scan du dossier')
    } finally {
      setScanning(false)
    }
  }

  const createPlaylistFromSelection = async () => {
    const name = newPlaylistName.trim()
    if (!name || selected.size === 0) return
    setCreatingPlaylist(true)
    try {
      const playlist = await api.post('/playlists', { name })
      await Promise.all(
        Array.from(selected).map((videoId) => api.post(`/playlists/${playlist.id}/videos`, { videoId }))
      )
      navigate(`/playlists/${playlist.id}`)
    } finally {
      setCreatingPlaylist(false)
    }
  }

  return (
    <div className="app">
      <Sidebar>
        <div className="filter-panel">
          <div className="filter-panel-header">
            <span className="section-title">Filtres</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="filter-reset-btn" title="Scanner le dossier vidéos" disabled={scanning} onClick={scanFolder}>{scanning ? '⏳' : '🔄'}</button>
              <button className="filter-reset-btn" title="Réinitialiser les filtres" onClick={resetFilters}>↺</button>
            </div>
          </div>

          <select className="selector-compact" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name-asc">Nom (A-Z)</option>
            <option value="name-desc">Nom (Z-A)</option>
            <option value="recent">Plus récent</option>
            <option value="oldest">Plus ancien</option>
          </select>

          <select className="selector-compact" value={creatorFilter} onChange={(e) => { setCreatorFilter(e.target.value); setPage(1) }}>
            <option value="">Tous les créateurs</option>
            {creators.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="filter-row-split">
            <div className="filter-stars-compact">
              {[1, 2, 3, 4, 5].map((i) => {
                const levelValue = 6 - i
                const filled = levelFilter && i <= 6 - levelFilter
                return (
                  <span
                    key={i}
                    className="star"
                    style={{ color: filled ? '#facc15' : '#334155' }}
                    onClick={() => { setLevelFilter(levelFilter === levelValue ? null : levelValue); setPage(1) }}
                  >★</span>
                )
              })}
            </div>
            <label className={`filter-favorite-toggle ${favoriteOnly ? 'active' : ''}`}>
              <input type="checkbox" checked={favoriteOnly} onChange={(e) => { setFavoriteOnly(e.target.checked); setPage(1) }} />
              ♥ Favoris
            </label>
          </div>

          {tags.length > 0 && (
            <div>
              <p className="section-title" style={{ fontSize: 11, marginBottom: 6 }}>Tags</p>
              <div className="tag-filter-list">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tag-filter-chip ${tagFilter.has(t) ? 'active' : ''}`}
                    onClick={() => toggleTagFilter(t)}
                  >{t}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {status && <div className="status">{status}</div>}

        <details className="accordion">
          <summary>Sélection {selected.size > 0 ? `(${selected.size})` : ''}</summary>
          <div className="accordion-body">
            <div className="compact-grid">
              <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 8px', marginTop: 0 }}
                onClick={() => setSelected(new Set(pageItems.map((v) => v.id)))}>Tout sél.</button>
              <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 8px', marginTop: 0 }}
                onClick={() => setSelected(new Set())}>Annuler</button>
            </div>
            <button className="btn" style={{ fontSize: 12, padding: '7px 8px', background: 'rgba(34,212,153,0.95)' }} onClick={exportM3U}>Exporter M3U</button>

            {selected.size > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                <input
                  className="host-input"
                  type="text"
                  placeholder="Nom de la playlist"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createPlaylistFromSelection() }}
                  style={{ fontSize: 12, padding: '7px 8px' }}
                />
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: '7px 8px' }}
                  disabled={!newPlaylistName.trim() || creatingPlaylist}
                  onClick={createPlaylistFromSelection}
                >Créer une playlist avec la sélection</button>
              </div>
            )}
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
              <select
                className="page-size-select"
                value={pageSize === Infinity ? 'all' : pageSize}
                onChange={(e) => { setPageSize(e.target.value === 'all' ? Infinity : Number(e.target.value)); setPage(1) }}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="all">Tout</option>
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
    </div>
  )
}
