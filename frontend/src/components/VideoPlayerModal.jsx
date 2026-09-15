import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { api, anchorsApi, thumbnailUrl, storyboardUrl } from '../api/client'
import {
  formatDuration, formatClock, levelToFilledStars,
  storyboardFrameIndex, STORYBOARD_COLS, STORYBOARD_TILE_WIDTH, STORYBOARD_TILE_HEIGHT,
} from '../utils'
import AddToPlaylistPopover from './AddToPlaylistPopover'
import ConfirmModal from './ConfirmModal'
import EntityPicker from './EntityPicker'

function EditableEntityField({ icon, tooltip, items, editing, onToggleEdit, badgeClass, allItems, onSelect, onCreate, onRemove, placeholder }) {
  return (
    <div className={`player-inline-field ${editing ? 'editing' : ''}`}>
      {!editing ? (
        <button
          type="button"
          className={`entity-edit-toggle ${badgeClass === 'tag-badge' ? 'tag-variant' : ''}`}
          onClick={onToggleEdit}
          title={`Modifier : ${tooltip}`}
        >
          <span className="entity-edit-icon">{icon}</span>
          {items.length > 0 ? items.join(', ') : `Ajouter…`}
        </button>
      ) : (
        <>
          <span className="entity-edit-icon" title={tooltip}>{icon}</span>
          {items.map((name) => (
            <span key={name} className={`${badgeClass} selected`}>
              {name}
              <span className="remove-badge" onClick={() => onRemove(name)}>×</span>
            </span>
          ))}
          <EntityPicker
            items={allItems}
            excluded={items}
            onSelect={onSelect}
            onCreate={onCreate}
            placeholder={placeholder}
          />
        </>
      )}
    </div>
  )
}

export default function VideoPlayerModal() {
  const { queue, index, isOpen, minimized, setMinimized, closePlayer, goTo, applyVideoUpdate, applyVideoDeleted } = usePlayer()
  const video = isOpen && index >= 0 ? queue[index] : null

  const videoRef = useRef(null)
  const seekRef = useRef(null)
  const pulseTimeoutRef = useRef(null)
  const playlistBtnRef = useRef(null)
  const fullscreenWrapRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(false)
  const [seekPreview, setSeekPreview] = useState(null)
  const [theater, setTheater] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  const [draftTitle, setDraftTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [anchors, setAnchors] = useState([])
  const [selectedAnchorIds, setSelectedAnchorIds] = useState(new Set())

  const [allCreators, setAllCreators] = useState([])
  const [draftCreators, setDraftCreators] = useState([])
  const [editingCreators, setEditingCreators] = useState(false)
  const [allTags, setAllTags] = useState([])
  const [draftTags, setDraftTags] = useState([])
  const [editingTags, setEditingTags] = useState(false)
  const [draftLevel, setDraftLevel] = useState(1)
  const [showPlaylistPopover, setShowPlaylistPopover] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [isFullscreenActive, setIsFullscreenActive] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideControlsTimeoutRef = useRef(null)
  const [savingQueue, setSavingQueue] = useState(false)
  const [queuePlaylistName, setQueuePlaylistName] = useState('')
  const [savingQueueBusy, setSavingQueueBusy] = useState(false)

  useEffect(() => {
    api.get('/videos/creators').then(setAllCreators).catch(() => {})
    api.get('/videos/tags').then(setAllTags).catch(() => {})
  }, [])

  useEffect(() => {
    if (!video) return
    setDraftTitle(video.title || '')
    setEditingTitle(false)
    setDraftCreators(video.creators || [])
    setEditingCreators(false)
    setDraftTags(video.tags || [])
    setEditingTags(false)
    setDraftLevel(video.sourceIndex && video.sourceIndex >= 1 && video.sourceIndex <= 5 ? video.sourceIndex : 1)
    setTheater(false)
    setShowPlaylistPopover(false)
    setSaveStatus('')
    setCurrentTime(0)
    setDuration(0)
    setSavingQueue(false)
    setQueuePlaylistName('')
    setAnchors([])
    setSelectedAnchorIds(new Set())
    anchorsApi.list(video.id).then(setAnchors).catch(() => {})
    api.post(`/videos/${video.id}/watched`).catch(() => {})
  }, [video?.id])

  const reportSession = useCallback(() => {
    if (!video || !videoRef.current) return
    const seconds = Math.floor(videoRef.current.currentTime || 0)
    api.post(`/videos/${video.id}/watch-session?watchedSeconds=${seconds}&page=player`).catch(() => {})
  }, [video])

  const handleClose = useCallback(() => {
    reportSession()
    closePlayer()
  }, [reportSession, closePlayer])

  const toggleMinimize = useCallback(() => {
    setMinimized((m) => !m)
  }, [setMinimized])

  const saveQueueAsPlaylist = async () => {
    const name = queuePlaylistName.trim()
    if (!name || queue.length === 0 || savingQueueBusy) return
    setSavingQueueBusy(true)
    try {
      const created = await api.post('/playlists', { name })
      await Promise.all(queue.map((v) => api.post(`/playlists/${created.id}/videos`, { videoId: v.id })))
      setQueuePlaylistName('')
      setSavingQueue(false)
    } finally {
      setSavingQueueBusy(false)
    }
  }

  const handleGoTo = useCallback((newIndex) => {
    reportSession()
    goTo(newIndex)
  }, [reportSession, goTo])

  const playOrPause = () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused || el.ended) el.play()
    else el.pause()
  }

  const triggerPulse = () => {
    setPulse(false)
    window.clearTimeout(pulseTimeoutRef.current)
    // force reflow via rAF to restart animation
    requestAnimationFrame(() => setPulse(true))
  }

  const updateTimeline = () => {
    const el = videoRef.current
    if (!el) return
    setDuration(Number.isFinite(el.duration) ? el.duration : 0)
    setCurrentTime(Number.isFinite(el.currentTime) ? el.currentTime : 0)
  }

  const onSeekBarInput = (value) => {
    const el = videoRef.current
    if (!el || !Number.isFinite(el.duration)) return
    el.currentTime = (Number(value) / 100) * el.duration
  }

  const onSeekMouseMove = (e) => {
    const el = videoRef.current
    const seekEl = seekRef.current
    if (!el || !seekEl || !Number.isFinite(el.duration)) return
    const rect = seekEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const ratio = rect.width > 0 ? x / rect.width : 0
    const frame = storyboardFrameIndex(ratio)
    setSeekPreview({
      x,
      text: formatClock(el.duration * ratio),
      col: frame % STORYBOARD_COLS,
      row: Math.floor(frame / STORYBOARD_COLS),
    })
  }

  const seekBy = (seconds) => {
    const el = videoRef.current
    if (!el || Number.isNaN(el.currentTime)) return
    el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + seconds))
  }

  const setVolume = (value) => {
    const el = videoRef.current
    if (!el) return
    el.volume = Math.max(0, Math.min(1, Number(value)))
    el.muted = el.volume === 0
  }

  const toggleMute = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = !el.muted
  }

  const changeSpeed = (value) => {
    const el = videoRef.current
    if (!el) return
    el.playbackRate = Number(value) || 1
    setPlaybackRate(Number(value) || 1)
  }

  const toggleFullScreen = () => {
    const el = fullscreenWrapRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true)
    clearTimeout(hideControlsTimeoutRef.current)
    hideControlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  useEffect(() => {
    function onFullscreenChange() {
      const active = document.fullscreenElement === fullscreenWrapRef.current
      setIsFullscreenActive(active)
      if (active) resetControlsTimer()
      else {
        clearTimeout(hideControlsTimeoutRef.current)
        setControlsVisible(true)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      clearTimeout(hideControlsTimeoutRef.current)
    }
  }, [resetControlsTimer])

  const handleEnded = () => {
    if (index < queue.length - 1) handleGoTo(index + 1)
  }

  const toggleFavorite = async () => {
    await api.get(`/videos/favorite/toggle?id=${video.id}`)
    applyVideoUpdate({ ...video, favorite: !video.favorite })
  }

  const addCreatorByName = (name) => {
    if (!name || draftCreators.includes(name)) return
    setDraftCreators((prev) => [...prev, name])
  }

  const createAndAddCreator = async (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const res = await api.post(`/videos/creators?name=${encodeURIComponent(trimmed)}`)
    setAllCreators((prev) => [...prev, res].sort())
    addCreatorByName(res)
  }

  const removeCreator = (name) => {
    setDraftCreators((prev) => prev.filter((c) => c !== name))
  }

  const addTagByName = (name) => {
    if (!name || draftTags.includes(name)) return
    setDraftTags((prev) => [...prev, name])
  }

  const createAndAddTag = async (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const res = await api.post(`/videos/tags?name=${encodeURIComponent(trimmed)}`)
    setAllTags((prev) => [...prev, res].sort())
    addTagByName(res)
  }

  const removeTag = (name) => {
    setDraftTags((prev) => prev.filter((t) => t !== name))
  }

  const saveEdits = async () => {
    const updated = await api.put(`/videos/${video.id}`, {
      title: draftTitle.trim() || video.title,
      creatorNames: draftCreators,
      tags: draftTags,
      sourceIndex: Math.max(0, Math.min(5, draftLevel)),
    })
    applyVideoUpdate(updated)
    setSaveStatus('Enregistré ✔')
    setTimeout(() => setSaveStatus(''), 1500)
  }

  const seekToTime = (seconds) => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = seconds
    el.play()
  }

  const addAnchorHere = async () => {
    const el = videoRef.current
    if (!el || !video) return
    const seconds = Math.floor(el.currentTime || 0)
    const created = await anchorsApi.create(video.id, seconds)
    setAnchors((prev) => [...prev, created].sort((a, b) => a.seconds - b.seconds))
  }

  const toggleAnchorSelect = (id) => {
    setSelectedAnchorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const deleteSelectedAnchors = async () => {
    if (!video || selectedAnchorIds.size === 0) return
    const ids = Array.from(selectedAnchorIds)
    await anchorsApi.removeBatch(video.id, ids)
    setAnchors((prev) => prev.filter((a) => !selectedAnchorIds.has(a.id)))
    setSelectedAnchorIds(new Set())
  }

  const deleteAllAnchors = async () => {
    if (!video || anchors.length === 0) return
    await anchorsApi.removeAll(video.id)
    setAnchors([])
    setSelectedAnchorIds(new Set())
  }

  const confirmDelete = async () => {
    await api.get(`/videos/delete?id=${video.id}`)
    setConfirmDeleteOpen(false)
    applyVideoDeleted(video.id)
  }

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      const activeTag = document.activeElement?.tagName
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || document.activeElement?.isContentEditable
      if (e.key === 'PageDown') handleGoTo(index + 1)
      else if (e.key === 'PageUp') handleGoTo(index - 1)
      else if (e.key === 'ArrowRight') seekBy(10)
      else if (e.key === 'ArrowLeft') seekBy(-10)
      else if (e.key === 'Escape') handleClose()
      else if (e.key === ' ' && !isTyping) { e.preventDefault(); playOrPause() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, index, queue.length, handleGoTo, handleClose])

  if (!video) return null

  const upNext = queue.slice(index + 1, index + 51)
  const filledStars = levelToFilledStars(draftLevel)

  return (
    <>
      <div
        className={`player-modal ${minimized ? 'minimized' : ''}`}
        onClick={(e) => { if (!minimized && e.target === e.currentTarget) handleClose() }}
      >
        <button className="player-close-btn" title="Fermer" onClick={handleClose}>✕</button>
        <div className={`player-shell ${theater ? 'theater' : ''}`}>
          {minimized && (
            <div className="mini-player-header">
              <span className="mini-player-title" title={video.title}>{video.title || 'Lecture vidéo'}</span>
              <button className="yt-btn yt-btn-icon" title="Agrandir" onClick={toggleMinimize}>🗖</button>
              <button className="yt-btn yt-btn-icon" title="Fermer" onClick={handleClose}>✕</button>
            </div>
          )}
          <div className="player-layout">
            <div className="player-main-column">
              <div
                className="player-fullscreen-wrap"
                ref={fullscreenWrapRef}
                onMouseMove={isFullscreenActive ? resetControlsTimer : undefined}
              >
              <div className="player-video-wrap">
                <video
                  key={video.id}
                  ref={videoRef}
                  src={video.url}
                  autoPlay
                  onClick={playOrPause}
                  onPlay={() => { setIsPlaying(true); triggerPulse() }}
                  onPause={() => { setIsPlaying(false); triggerPulse() }}
                  onTimeUpdate={updateTimeline}
                  onLoadedMetadata={updateTimeline}
                  onVolumeChange={updateTimeline}
                  onWaiting={() => setBuffering(true)}
                  onStalled={() => setBuffering(true)}
                  onSeeking={() => setBuffering(true)}
                  onPlaying={() => setBuffering(false)}
                  onCanPlay={() => setBuffering(false)}
                  onSeeked={() => setBuffering(false)}
                  onEnded={handleEnded}
                />
                <div className={`center-play-button ${pulse ? 'pulse' : ''}`} onAnimationEnd={() => setPulse(false)}>
                  {isPlaying ? '⏸' : '▶'}
                </div>
                <div className={`buffering-indicator ${buffering ? 'show' : ''}`} />
              </div>

              <div className={`yt-controls ${isFullscreenActive && !controlsVisible ? 'controls-hidden' : ''}`}>
                <div className="yt-progress-row">
                  <span className="yt-time">{formatClock(currentTime)}</span>
                  <div className="yt-seek-wrap" ref={seekRef} onMouseMove={onSeekMouseMove} onMouseLeave={() => setSeekPreview(null)}>
                    <input
                      className="yt-seek"
                      type="range" min="0" max="100" step="0.1"
                      value={duration > 0 ? (currentTime / duration) * 100 : 0}
                      onInput={(e) => onSeekBarInput(e.target.value)}
                      onChange={() => {}}
                    />
                    {seekPreview && (
                      <div className="seek-preview visible" style={{ left: seekPreview.x }}>
                        <div
                          className="seek-preview-thumb"
                          style={{
                            backgroundImage: `url(${storyboardUrl(video.id)})`,
                            backgroundPosition: `-${seekPreview.col * STORYBOARD_TILE_WIDTH}px -${seekPreview.row * STORYBOARD_TILE_HEIGHT}px`,
                          }}
                        />
                        <span className="seek-preview-time">{seekPreview.text}</span>
                      </div>
                    )}
                    {duration > 0 && anchors.map((a) => (
                      <div
                        key={a.id}
                        className="anchor-tick"
                        style={{ left: `${Math.min(100, (a.seconds / duration) * 100)}%` }}
                        title={`Ancre à ${formatClock(a.seconds)}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); seekToTime(a.seconds) }}
                      />
                    ))}
                  </div>
                  <span className="yt-time">{formatClock(duration)}</span>
                </div>
                <div className="yt-actions">
                  <div className="yt-actions-left">
                    <button className="yt-btn yt-btn-icon" title={isPlaying ? 'Pause' : 'Lecture'} onClick={playOrPause}>{isPlaying ? '⏸' : '▶'}</button>
                    <button className="yt-btn yt-btn-icon" title="Reculer de 10s" onClick={() => seekBy(-10)}>⏪</button>
                    <button className="yt-btn yt-btn-icon" title="Avancer de 10s" onClick={() => seekBy(10)}>⏩</button>
                    <button className="yt-btn yt-btn-icon" title="Vidéo précédente" disabled={index <= 0} onClick={() => handleGoTo(index - 1)}>⏮</button>
                    <button className="yt-btn yt-btn-icon" title="Vidéo suivante" disabled={index >= queue.length - 1} onClick={() => handleGoTo(index + 1)}>⏭</button>
                    <button className="yt-btn yt-btn-icon" title={videoRef.current?.muted ? 'Activer le son' : 'Couper le son'} onClick={toggleMute}>{videoRef.current?.muted ? '🔇' : '🔊'}</button>
                    <input className="yt-range" type="range" min="0" max="1" step="0.01" defaultValue={1} onInput={(e) => setVolume(e.target.value)} />
                    <button className="yt-btn yt-btn-icon" title="Ajouter une ancre à la position actuelle" onClick={addAnchorHere}>📍</button>
                  </div>
                  <div className="yt-actions-right">
                    <select className="yt-select" title="Vitesse de lecture" value={playbackRate} onChange={(e) => changeSpeed(e.target.value)}>
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </select>
                    <button className="yt-btn yt-btn-icon hide-in-fullscreen" title="Réduire" onClick={toggleMinimize}>🗕</button>
                    <button className="yt-btn yt-btn-icon hide-in-fullscreen" title="Mode théâtre" onClick={() => setTheater((t) => !t)}>▭</button>
                    <button className={`yt-btn yt-btn-icon ${video.favorite ? 'active' : ''}`} title="Favori" onClick={toggleFavorite}>♥</button>
                    <button ref={playlistBtnRef} className="yt-btn yt-btn-icon hide-in-fullscreen" title="Ajouter à une playlist" onClick={() => setShowPlaylistPopover((s) => !s)}>➕</button>
                    {showPlaylistPopover && (
                      <AddToPlaylistPopover videoId={video.id} anchorRef={playlistBtnRef} onClose={() => setShowPlaylistPopover(false)} />
                    )}
                    <button className="yt-btn yt-btn-icon hide-in-fullscreen" title="Supprimer" onClick={() => setConfirmDeleteOpen(true)}>🗑️</button>
                    <button className="yt-btn yt-btn-icon" title="Plein écran" onClick={toggleFullScreen}>⛶</button>
                    <button className="yt-btn yt-btn-icon" title="Fermer" onClick={handleClose}>✕</button>
                  </div>
                </div>
              </div>
              </div>

              <section className="player-info-panel">
                <div className="player-info-main">
                <div className="player-info-row">
                  <EditableEntityField
                    icon="👤"
                    tooltip="Créateurs"
                    items={draftCreators}
                    editing={editingCreators}
                    onToggleEdit={() => setEditingCreators(true)}
                    badgeClass="creator-badge"
                    allItems={allCreators}
                    onSelect={addCreatorByName}
                    onCreate={createAndAddCreator}
                    onRemove={removeCreator}
                    placeholder="Ajouter un créateur..."
                  />

                  <EditableEntityField
                    icon="🏷️"
                    tooltip="Tags"
                    items={draftTags}
                    editing={editingTags}
                    onToggleEdit={() => setEditingTags(true)}
                    badgeClass="tag-badge"
                    allItems={allTags}
                    onSelect={addTagByName}
                    onCreate={createAndAddTag}
                    onRemove={removeTag}
                    placeholder="Ajouter un tag..."
                  />

                  <div className="player-inline-field">
                    <span className="entity-edit-icon" title="Niveau">⭐</span>
                    <div className="player-level-stars">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const levelValue = 6 - i
                        return (
                          <span
                            key={i}
                            className="star"
                            style={{ color: i <= filledStars ? '#facc15' : '#334155' }}
                            title={`${levelValue} étoile(s)`}
                            onClick={() => setDraftLevel(levelValue)}
                          >★</span>
                        )
                      })}
                    </div>
                    <span className="player-level-value">{draftLevel}</span>
                    <button className="player-save-btn" title="Enregistrer" onClick={saveEdits}>💾</button>
                    {saveStatus && <span className="muted-note">{saveStatus}</span>}
                  </div>
                </div>

                <div className="player-meta-row">
                  {!editingTitle ? (
                    <h2
                      className="player-title-inline editable"
                      title="Cliquer pour modifier le titre"
                      onClick={() => setEditingTitle(true)}
                    >{draftTitle || 'Lecture vidéo'}</h2>
                  ) : (
                    <input
                      type="text"
                      className="player-title-input"
                      value={draftTitle}
                      autoFocus
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => { setEditingTitle(false); saveEdits() }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') { setDraftTitle(video.title || ''); setEditingTitle(false) }
                      }}
                    />
                  )}

                  <div className="player-stat-list">
                    <div className="player-stat" title="Favori">{video.favorite ? '❤️' : '🤍'}</div>
                    <div className="player-stat" title="Durée">⏱ {formatDuration(video.durationMs)}</div>
                    <div className="player-stat" title="Vues">👁 {video.viewCount ?? 0}</div>
                  </div>
                </div>
                </div>

                <div className="player-anchors-row">
                  <div className="player-anchors-header">
                    <span className="entity-edit-icon" title="Ancres">📍</span>
                    <span className="player-anchors-hint">
                      {anchors.length > 0 ? `${anchors.length} ancre${anchors.length > 1 ? 's' : ''} enregistrée${anchors.length > 1 ? 's' : ''}` : 'Aucune ancre — cliquez sur 📍 pour en poser une'}
                    </span>
                    <div className="player-anchors-actions">
                      <button
                        type="button"
                        className="btn-secondary player-anchors-btn"
                        disabled={selectedAnchorIds.size === 0}
                        onClick={deleteSelectedAnchors}
                      >Supprimer la sélection</button>
                      <button
                        type="button"
                        className="btn-secondary player-anchors-btn danger"
                        disabled={anchors.length === 0}
                        onClick={deleteAllAnchors}
                      >Tout supprimer</button>
                    </div>
                  </div>
                  {anchors.length > 0 && (
                    <div className="anchor-list">
                      {anchors.map((a) => (
                        <label key={a.id} className={`anchor-chip ${selectedAnchorIds.has(a.id) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedAnchorIds.has(a.id)}
                            onChange={() => toggleAnchorSelect(a.id)}
                          />
                          <span className="anchor-chip-time" onClick={() => seekToTime(a.seconds)}>⏱ {formatClock(a.seconds)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="up-next-panel">
              <div className="up-next-header-row">
                <h3 className="up-next-title">À suivre</h3>
                <button
                  className="yt-btn yt-btn-icon"
                  title="Enregistrer la liste de lecture actuelle comme playlist"
                  onClick={() => setSavingQueue((s) => !s)}
                >💾</button>
              </div>
              {savingQueue && (
                <div className="save-queue-form">
                  <input
                    type="text"
                    placeholder="Nom de la playlist"
                    value={queuePlaylistName}
                    autoFocus
                    onChange={(e) => setQueuePlaylistName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveQueueAsPlaylist() }}
                  />
                  <button
                    type="button"
                    className="btn"
                    style={{ width: 'auto', margin: 0, padding: '6px 10px' }}
                    disabled={!queuePlaylistName.trim() || savingQueueBusy}
                    onClick={saveQueueAsPlaylist}
                  >{savingQueueBusy ? '...' : 'Créer'}</button>
                </div>
              )}
              <div className="up-next-list">
                {upNext.length === 0 && <p className="up-next-empty">Aucune autre vidéo dans cette liste.</p>}
                {upNext.map((v, offset) => {
                  const targetIndex = index + offset + 1
                  return (
                    <button key={v.id} type="button" className="up-next-item" onClick={() => handleGoTo(targetIndex)}>
                      <img className="up-next-thumbnail" src={thumbnailUrl(v.id)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = 0.3 }} />
                      <div className="up-next-details">
                        <div className="up-next-video-title">{v.title || v.fileName || 'Vidéo sans titre'}</div>
                        {v.creators?.length > 0 && <div className="up-next-meta">{v.creators.join(', ')}</div>}
                        <div className="up-next-meta">{formatDuration(v.durationMs) || 'Durée inconnue'}</div>
                        {v.tags?.length > 0 && (
                          <div className="up-next-tags">
                            {v.tags.slice(0, 3).map((t) => (
                              <span key={t} className="tag-badge">{t}</span>
                            ))}
                            {v.tags.length > 3 && <span className="tag-badge">+{v.tags.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        text={`Voulez-vous vraiment supprimer "${video.title || 'cette vidéo'}" ?`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}
