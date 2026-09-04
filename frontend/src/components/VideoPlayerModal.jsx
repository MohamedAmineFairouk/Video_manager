import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { api, thumbnailUrl, storyboardUrl } from '../api/client'
import {
  formatDuration, formatClock, levelToFilledStars,
  storyboardFrameIndex, STORYBOARD_COLS, STORYBOARD_TILE_WIDTH, STORYBOARD_TILE_HEIGHT,
} from '../utils'
import AddToPlaylistPopover from './AddToPlaylistPopover'
import ConfirmModal from './ConfirmModal'
import EntityPicker from './EntityPicker'

export default function VideoPlayerModal() {
  const { queue, index, isOpen, closePlayer, goTo, applyVideoUpdate, applyVideoDeleted } = usePlayer()
  const video = isOpen && index >= 0 ? queue[index] : null

  const videoRef = useRef(null)
  const seekRef = useRef(null)
  const pulseTimeoutRef = useRef(null)
  const playlistBtnRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(false)
  const [seekPreview, setSeekPreview] = useState(null)
  const [theater, setTheater] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  const [allCreators, setAllCreators] = useState([])
  const [draftCreators, setDraftCreators] = useState([])
  const [allTags, setAllTags] = useState([])
  const [draftTags, setDraftTags] = useState([])
  const [draftLevel, setDraftLevel] = useState(1)
  const [showPlaylistPopover, setShowPlaylistPopover] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => {
    api.get('/videos/creators').then(setAllCreators).catch(() => {})
    api.get('/videos/tags').then(setAllTags).catch(() => {})
  }, [])

  useEffect(() => {
    if (!video) return
    setDraftCreators(video.creators || [])
    setDraftTags(video.tags || [])
    setDraftLevel(video.sourceIndex && video.sourceIndex >= 1 && video.sourceIndex <= 5 ? video.sourceIndex : 1)
    setTheater(false)
    setShowPlaylistPopover(false)
    setSaveStatus('')
    setCurrentTime(0)
    setDuration(0)
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
    const el = videoRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

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
      creatorNames: draftCreators,
      tags: draftTags,
      sourceIndex: Math.max(0, Math.min(5, draftLevel)),
    })
    applyVideoUpdate(updated)
    setSaveStatus('Enregistré ✔')
    setTimeout(() => setSaveStatus(''), 1500)
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
      <div className="player-modal" onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
        <button className="player-close-btn" title="Fermer" onClick={handleClose}>✕</button>
        <div className={`player-shell ${theater ? 'theater' : ''}`}>
          <div className="player-layout">
            <div className="player-main-column">
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

              <div className="yt-controls">
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
                  </div>
                  <span className="yt-time">{formatClock(duration)}</span>
                </div>
                <div className="yt-actions">
                  <div className="yt-actions-left">
                    <button className="yt-btn" onClick={playOrPause}>{isPlaying ? '⏸' : '▶'}</button>
                    <button className="yt-btn" onClick={() => seekBy(-10)}>-10s</button>
                    <button className="yt-btn" onClick={() => seekBy(10)}>+10s</button>
                    <button className="yt-btn" disabled={index <= 0} onClick={() => handleGoTo(index - 1)}>Préc</button>
                    <button className="yt-btn" disabled={index >= queue.length - 1} onClick={() => handleGoTo(index + 1)}>Suiv</button>
                    <button className="yt-btn" onClick={toggleMute}>{videoRef.current?.muted ? '🔇' : '🔊'}</button>
                    <input className="yt-range" type="range" min="0" max="1" step="0.01" defaultValue={1} onInput={(e) => setVolume(e.target.value)} />
                  </div>
                  <div className="yt-actions-right">
                    <select className="yt-select" value={playbackRate} onChange={(e) => changeSpeed(e.target.value)}>
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </select>
                    <button className="yt-btn" onClick={() => setTheater((t) => !t)}>Théâtre</button>
                    <button className="yt-btn" onClick={toggleFullScreen}>Plein écran</button>
                    <button className={`yt-btn ${video.favorite ? 'active' : ''}`} onClick={toggleFavorite}>Favori</button>
                    <button ref={playlistBtnRef} className="yt-btn" onClick={() => setShowPlaylistPopover((s) => !s)}>+ Playlist</button>
                    {showPlaylistPopover && (
                      <AddToPlaylistPopover videoId={video.id} anchorRef={playlistBtnRef} onClose={() => setShowPlaylistPopover(false)} />
                    )}
                    <button className="yt-btn" onClick={() => setConfirmDeleteOpen(true)}>Supprimer</button>
                    <button className="yt-btn" onClick={handleClose}>Fermer</button>
                  </div>
                </div>
              </div>

              <section className="player-info-panel">
                <div className="player-info-row">
                  <h2 className="player-title-inline" title={video.title}>{video.title || 'Lecture vidéo'}</h2>

                  <div className="player-inline-field">
                    <label>Créateurs:</label>
                    {draftCreators.map((name) => (
                      <span key={name} className="creator-badge selected">
                        {name}
                        <span className="remove-badge" onClick={() => removeCreator(name)}>×</span>
                      </span>
                    ))}
                    <EntityPicker
                      items={allCreators}
                      excluded={draftCreators}
                      onSelect={addCreatorByName}
                      onCreate={createAndAddCreator}
                      placeholder="Ajouter un créateur..."
                    />
                  </div>

                  <div className="player-inline-field">
                    <label>Tags:</label>
                    {draftTags.map((name) => (
                      <span key={name} className="tag-badge selected">
                        {name}
                        <span className="remove-badge" onClick={() => removeTag(name)}>×</span>
                      </span>
                    ))}
                    <EntityPicker
                      items={allTags}
                      excluded={draftTags}
                      onSelect={addTagByName}
                      onCreate={createAndAddTag}
                      placeholder="Ajouter un tag..."
                    />
                  </div>

                  <div className="player-inline-field">
                    <label>Niveau:</label>
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

                  <div className="player-stat-list">
                    <div className="player-stat">
                      <span>Favoris:</span>
                      <strong>{video.favorite ? 'Oui' : 'Non'}</strong>
                    </div>
                    <div className="player-stat">
                      <span>{formatDuration(video.durationMs)}</span>
                    </div>
                    <div className="player-stat">
                      <span>👁 Vues:</span>
                      <strong>{video.viewCount ?? 0}</strong>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="up-next-panel">
              <h3 className="up-next-title">À suivre</h3>
              <div className="up-next-list">
                {upNext.length === 0 && <p className="up-next-empty">Aucune autre vidéo dans cette liste.</p>}
                {upNext.map((v, offset) => {
                  const targetIndex = index + offset + 1
                  return (
                    <button key={v.id} type="button" className="up-next-item" onClick={() => handleGoTo(targetIndex)}>
                      <img className="up-next-thumbnail" src={thumbnailUrl(v.id)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = 0.3 }} />
                      <div className="up-next-details">
                        <div className="up-next-video-title">{v.title || v.fileName || 'Vidéo sans titre'}</div>
                        <div className="up-next-meta">{v.creators?.length ? v.creators.join(', ') : 'Unknown'}</div>
                        <div className="up-next-meta">{formatDuration(v.durationMs) || 'Durée inconnue'}</div>
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
