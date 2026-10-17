import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, storyboardUrl } from '../api/client'
import { STORYBOARD_COLS, STORYBOARD_ROWS, STORYBOARD_FRAME_COUNT } from '../utils'

const MIN_SEGMENT = 0.5 // secondes, même minimum que le backend (VideoClipService)
const VOLUME_MIN = 0.1
const VOLUME_MAX = 3
const VOLUME_PRESETS = [0.5, 1, 1.5, 2]

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00.0'
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const secText = sec.toFixed(1).padStart(4, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${secText}` : `${m}:${secText}`
}

// Accepte "75", "1:15", "1:15.5", "1:02:03"
function parseTime(text) {
  const parts = String(text).trim().split(':').map((p) => Number(p.replace(',', '.')))
  if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

function TimeInput({ value, onCommit }) {
  const [draft, setDraft] = useState(formatTime(value))
  useEffect(() => { setDraft(formatTime(value)) }, [value])
  const commit = () => {
    const parsed = parseTime(draft)
    if (parsed == null) setDraft(formatTime(value))
    else onCommit(parsed)
  }
  return (
    <input
      className="editor-time-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

/**
 * Éditeur "✂ Découper" : choisir graphiquement des segments d'une vidéo, puis créer
 * une nouvelle vidéo qui ne contient que ces segments (mêmes infos que l'originale).
 */
export default function VideoEditorModal({ video, startTime = 0, onClose, onOpenVideo }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const playModeRef = useRef(null) // { type: 'segment' | 'selection', index }

  const [duration, setDuration] = useState(video.durationMs ? video.durationMs / 1000 : 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [segments, setSegments] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [hover, setHover] = useState(null) // { x, time }
  const [title, setTitle] = useState(`${video.title || 'Vidéo'}_extrait`)
  const [storyboardOk, setStoryboardOk] = useState(true)
  // Réglage du son de la nouvelle vidéo (1 = inchangé). L'aperçu passe par Web Audio,
  // seul moyen d'écouter un niveau au-dessus de 100 % dans le navigateur.
  const [volume, setVolume] = useState(1)
  const audioRef = useRef(null) // { ctx, gain }

  const [job, setJob] = useState(null) // { id, status, progress, newVideoId, error }
  const [submitError, setSubmitError] = useState('')
  const busy = job && (job.status === 'pending' || job.status === 'running')
  const volumeChanged = Math.abs(volume - 1) > 0.005

  const totalSelected = useMemo(() => segments.reduce((acc, s) => acc + (s.end - s.start), 0), [segments])
  // Sans segment, on peut quand même créer une copie complète si le son a été modifié.
  const canSubmit = segments.length > 0 || volumeChanged
  const sortedSegments = useMemo(
    () => segments.map((s, i) => ({ ...s, i })).sort((a, b) => a.start - b.start),
    [segments]
  )

  const ensureAudioGraph = useCallback(() => {
    const el = videoRef.current
    if (!el || audioRef.current) return audioRef.current
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    try {
      const ctx = new Ctx()
      const gain = ctx.createGain()
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination)
      audioRef.current = { ctx, gain }
    } catch { audioRef.current = null }
    return audioRef.current
  }, [])

  const changeVolume = (value) => {
    const v = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, Number(value) || 1))
    setVolume(v)
    const graph = ensureAudioGraph()
    if (graph) { graph.gain.gain.value = v; graph.ctx.resume?.() }
  }

  useEffect(() => () => { audioRef.current?.ctx.close?.() }, [])

  // ---------- Lecture ----------
  const seek = useCallback((t) => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(duration || el.duration || 0, t))
    setCurrentTime(el.currentTime)
  }, [duration])

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    playModeRef.current = null
    if (el.paused) el.play(); else el.pause()
  }

  const playSegment = (index) => {
    const seg = segments[index]
    if (!seg) return
    setSelectedIndex(index)
    playModeRef.current = { type: 'segment', index }
    seek(seg.start)
    videoRef.current?.play()
  }

  const playSelection = () => {
    if (!sortedSegments.length) return
    playModeRef.current = { type: 'selection', order: 0 }
    seek(sortedSegments[0].start)
    videoRef.current?.play()
  }

  const onTimeUpdate = () => {
    const el = videoRef.current
    if (!el) return
    const t = el.currentTime
    setCurrentTime(t)
    const mode = playModeRef.current
    if (!mode || el.paused) return
    if (mode.type === 'segment') {
      const seg = segments[mode.index]
      if (seg && t >= seg.end) { el.pause(); playModeRef.current = null }
    } else if (mode.type === 'selection') {
      const seg = sortedSegments[mode.order]
      if (seg && t >= seg.end) {
        const next = sortedSegments[mode.order + 1]
        if (next) { playModeRef.current = { type: 'selection', order: mode.order + 1 }; el.currentTime = next.start }
        else { el.pause(); playModeRef.current = null }
      }
    }
  }

  // ---------- Segments ----------
  const clampSegment = useCallback((start, end) => {
    const max = duration || Infinity
    let s = Math.max(0, Math.min(start, max - MIN_SEGMENT))
    let e = Math.min(max, Math.max(end, s + MIN_SEGMENT))
    return { start: s, end: e }
  }, [duration])

  const updateSegment = useCallback((index, patch) => {
    setSegments((prev) => prev.map((seg, i) => {
      if (i !== index) return seg
      const next = { ...seg, ...patch }
      return clampSegment(next.start, next.end)
    }))
  }, [clampSegment])

  const addSegmentAt = (t) => {
    const len = Math.min(30, Math.max(MIN_SEGMENT, (duration || t + 30) - t))
    const seg = clampSegment(t, t + len)
    setSegments((prev) => [...prev, seg])
    setSelectedIndex(segments.length)
  }

  const setStartHere = () => {
    if (selectedIndex < 0 || !segments[selectedIndex]) { addSegmentAt(currentTime); return }
    const seg = segments[selectedIndex]
    updateSegment(selectedIndex, { start: currentTime, end: Math.max(seg.end, currentTime + MIN_SEGMENT) })
  }

  const setEndHere = () => {
    if (selectedIndex < 0 || !segments[selectedIndex]) {
      const start = Math.max(0, currentTime - 30)
      setSegments((prev) => [...prev, clampSegment(start, currentTime)])
      setSelectedIndex(segments.length)
      return
    }
    const seg = segments[selectedIndex]
    updateSegment(selectedIndex, { end: currentTime, start: Math.min(seg.start, currentTime - MIN_SEGMENT) })
  }

  const removeSegment = (index) => {
    setSegments((prev) => prev.filter((_, i) => i !== index))
    setSelectedIndex((sel) => (sel === index ? -1 : sel > index ? sel - 1 : sel))
  }

  // ---------- Timeline (glisser) ----------
  const timeFromClientX = useCallback((clientX) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !duration) return 0
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }, [duration])

  const startDrag = (e, index, kind) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedIndex(index)
    const seg = segments[index]
    dragRef.current = { index, kind, originTime: timeFromClientX(e.clientX), start: seg.start, end: seg.end }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', stopDrag, { once: true })
  }

  const onDragMove = useCallback((e) => {
    const drag = dragRef.current
    if (!drag) return
    const t = timeFromClientX(e.clientX)
    if (drag.kind === 'start') {
      updateSegment(drag.index, { start: Math.min(t, drag.end - MIN_SEGMENT) })
      seek(t)
    } else if (drag.kind === 'end') {
      updateSegment(drag.index, { end: Math.max(t, drag.start + MIN_SEGMENT) })
      seek(t)
    } else {
      const len = drag.end - drag.start
      const delta = t - drag.originTime
      const start = Math.max(0, Math.min((duration || Infinity) - len, drag.start + delta))
      updateSegment(drag.index, { start, end: start + len })
    }
  }, [timeFromClientX, updateSegment, seek, duration])

  const stopDrag = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onDragMove)
  }, [onDragMove])

  useEffect(() => () => window.removeEventListener('pointermove', onDragMove), [onDragMove])

  const onTrackPointerDown = (e) => {
    if (e.button !== 0) return
    playModeRef.current = null
    seek(timeFromClientX(e.clientX))
  }

  const onTrackMouseMove = (e) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    setHover({ x, time: (x / rect.width) * duration })
  }

  // ---------- Création ----------
  const submit = async () => {
    if (!canSubmit || busy) return
    setSubmitError('')
    try {
      const payload = { title: title.trim(), volume, segments: sortedSegments.map(({ start, end }) => ({ start, end })) }
      const created = await api.post(`/videos/${video.id}/clip`, payload)
      videoRef.current?.pause()
      setJob(created)
    } catch (e) {
      setSubmitError(e.message || 'La création a échoué.')
    }
  }

  useEffect(() => {
    if (!busy) return undefined
    const timer = setInterval(async () => {
      try {
        const next = await api.get(`/videos/clip-jobs/${job.id}`)
        setJob(next)
        if (next.status === 'done') window.dispatchEvent(new Event('ar44:videos-changed'))
      } catch { /* on réessaie au prochain tick */ }
    }, 1000)
    return () => clearInterval(timer)
  }, [busy, job?.id])

  // ---------- Clavier (prioritaire sur celui du lecteur) ----------
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Escape') { e.stopImmediatePropagation(); if (!busy) onClose(); return }
      if (typing) return
      const el = videoRef.current
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
      else if (e.key === 'ArrowLeft') seek((el?.currentTime || 0) - (e.shiftKey ? 1 : 5))
      else if (e.key === 'ArrowRight') seek((el?.currentTime || 0) + (e.shiftKey ? 1 : 5))
      else if (e.key === 'i' || e.key === 'I') setStartHere()
      else if (e.key === 'o' || e.key === 'O') setEndHere()
      else return
      e.stopImmediatePropagation()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  })

  const pct = (t) => (duration ? `${(t / duration) * 100}%` : '0%')

  return (
    <div className="modal-overlay editor-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="editor-box">
        <div className="editor-header">
          <h3 className="editor-title">✂ Découper « {video.title || 'Vidéo'} »</h3>
          <button className="yt-btn yt-btn-icon" title="Fermer" disabled={busy} onClick={onClose}>✕</button>
        </div>

        <div className="editor-preview">
          <video
            ref={videoRef}
            src={video.url}
            onLoadedMetadata={(e) => {
              if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration)
              e.currentTarget.currentTime = Math.max(0, startTime || 0)
            }}
            onTimeUpdate={onTimeUpdate}
            onPlay={() => { setIsPlaying(true); audioRef.current?.ctx.resume?.() }}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
          />
        </div>

        <div className="editor-transport">
          <button className="yt-btn yt-btn-icon" title="Reculer de 5 s (←)" onClick={() => seek(currentTime - 5)}>⏪</button>
          <button className="yt-btn yt-btn-icon" title="Reculer de 1 s (Maj+←)" onClick={() => seek(currentTime - 1)}>−1s</button>
          <button className="yt-btn yt-btn-icon" title="Lecture / pause (Espace)" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
          <button className="yt-btn yt-btn-icon" title="Avancer de 1 s (Maj+→)" onClick={() => seek(currentTime + 1)}>+1s</button>
          <button className="yt-btn yt-btn-icon" title="Avancer de 5 s (→)" onClick={() => seek(currentTime + 5)}>⏩</button>
          <span className="editor-clock">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <span className="editor-transport-spacer" />
          <button className="editor-mark-btn" title="Début du segment sélectionné à la position actuelle (I)" onClick={setStartHere}>[ Début ici</button>
          <button className="editor-mark-btn" title="Fin du segment sélectionné à la position actuelle (O)" onClick={setEndHere}>Fin ici ]</button>
          <button className="editor-mark-btn primary" title="Nouveau segment à partir de la position actuelle" onClick={() => addSegmentAt(currentTime)}>＋ Segment</button>
        </div>

        <div
          className="editor-track"
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          onMouseMove={onTrackMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          <div className="editor-filmstrip">
            {Array.from({ length: STORYBOARD_FRAME_COUNT }, (_, i) => (
              <div
                key={i}
                className="editor-frame"
                style={storyboardOk ? {
                  backgroundImage: `url(${storyboardUrl(video.id)})`,
                  backgroundSize: `${STORYBOARD_COLS * 100}% ${STORYBOARD_ROWS * 100}%`,
                  backgroundPosition: `${((i % STORYBOARD_COLS) / (STORYBOARD_COLS - 1)) * 100}% ${(Math.floor(i / STORYBOARD_COLS) / (STORYBOARD_ROWS - 1)) * 100}%`,
                } : undefined}
              />
            ))}
            <img src={storyboardUrl(video.id)} alt="" style={{ display: 'none' }} onError={() => setStoryboardOk(false)} />
          </div>

          {segments.map((seg, i) => (
            <div
              key={i}
              className={`editor-segment ${i === selectedIndex ? 'selected' : ''}`}
              style={{ left: pct(seg.start), width: pct(seg.end - seg.start) }}
              onPointerDown={(e) => startDrag(e, i, 'move')}
              title={`Segment ${i + 1} : ${formatTime(seg.start)} → ${formatTime(seg.end)}`}
            >
              <span className="editor-handle start" onPointerDown={(e) => startDrag(e, i, 'start')} />
              <span className="editor-segment-label">{sortedSegments.findIndex((s) => s.i === i) + 1}</span>
              <span className="editor-handle end" onPointerDown={(e) => startDrag(e, i, 'end')} />
            </div>
          ))}

          <div className="editor-playhead" style={{ left: pct(currentTime) }} />
          {hover && <div className="editor-hover-time" style={{ left: hover.x }}>{formatTime(hover.time)}</div>}
        </div>

        <div className="editor-body">
          <div className="editor-segments">
            <div className="editor-segments-header">
              <span>Segments ({segments.length})</span>
              <button className="editor-link-btn" disabled={!segments.length} onClick={playSelection}>▶ Lire la sélection</button>
            </div>
            {segments.length === 0 && (
              <p className="editor-empty">
                Aucun segment. Place-toi dans la vidéo puis « [ Début ici » / « Fin ici ] » (touches I / O),
                ou « ＋ Segment ». Glisse les poignées sur la frise pour ajuster.
                Sans segment, un changement de son s'applique à toute la vidéo.
              </p>
            )}
            {sortedSegments.map(({ start, end, i }, order) => (
              <div
                key={i}
                className={`editor-segment-row ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => setSelectedIndex(i)}
              >
                <span className="editor-segment-num">{order + 1}</span>
                <TimeInput value={start} onCommit={(t) => updateSegment(i, { start: Math.min(t, end - MIN_SEGMENT) })} />
                <span className="editor-arrow">→</span>
                <TimeInput value={end} onCommit={(t) => updateSegment(i, { end: Math.max(t, start + MIN_SEGMENT) })} />
                <span className="editor-segment-dur">{formatTime(end - start)}</span>
                <button className="yt-btn yt-btn-icon" title="Lire ce segment" onClick={(e) => { e.stopPropagation(); playSegment(i) }}>▶</button>
                <button className="yt-btn yt-btn-icon" title="Aller au début" onClick={(e) => { e.stopPropagation(); seek(start) }}>⇤</button>
                <button className="yt-btn yt-btn-icon editor-danger" title="Supprimer le segment" onClick={(e) => { e.stopPropagation(); removeSegment(i) }}>✕</button>
              </div>
            ))}
          </div>

          <div className="editor-output">
            <label className="editor-label">Son de la nouvelle vidéo</label>
            <div className="editor-volume">
              <span className="editor-volume-icon">{volume < 0.6 ? '🔈' : volume <= 1.2 ? '🔉' : '🔊'}</span>
              <input
                type="range"
                className="editor-volume-range"
                min={VOLUME_MIN}
                max={VOLUME_MAX}
                step="0.05"
                value={volume}
                disabled={busy}
                onChange={(e) => changeVolume(e.target.value)}
              />
              <span className={`editor-volume-value ${volumeChanged ? 'changed' : ''}`}>{Math.round(volume * 100)} %</span>
            </div>
            <div className="editor-volume-presets">
              {VOLUME_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`editor-chip ${Math.abs(volume - p) < 0.005 ? 'active' : ''}`}
                  disabled={busy}
                  onClick={() => changeVolume(p)}
                >{p === 1 ? 'Original' : `${Math.round(p * 100)} %`}</button>
              ))}
            </div>

            <label className="editor-label">Titre de la nouvelle vidéo</label>
            <input className="editor-title-input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
            <div className="editor-summary">
              <span>Durée finale : <strong>{formatTime(segments.length ? totalSelected : duration)}</strong></span>
              <span>Originale : {formatTime(duration)}</span>
            </div>
            <p className="editor-note">
              Créateurs, tags, étoiles, favori, commentaire et nombre de vues sont repris.
              Les ancres comprises dans les segments sont recalées. La vidéo originale n'est pas modifiée.
            </p>

            {job ? (
              <div className="editor-job">
                {busy && (
                  <>
                    <div className="editor-progress"><div style={{ width: `${Math.round((job.progress || 0) * 100)}%` }} /></div>
                    <span className="editor-job-text">Création en cours… {Math.round((job.progress || 0) * 100)} %</span>
                  </>
                )}
                {job.status === 'done' && (
                  <>
                    <span className="editor-job-text ok">✔ Nouvelle vidéo créée</span>
                    <div className="editor-job-actions">
                      <button className="btn" style={{ width: 'auto', margin: 0 }} onClick={() => onOpenVideo(job.newVideoId)}>Ouvrir la nouvelle vidéo</button>
                      <button className="btn-secondary" style={{ width: 'auto', margin: 0 }} onClick={() => setJob(null)}>Faire un autre extrait</button>
                    </div>
                  </>
                )}
                {job.status === 'error' && (
                  <>
                    <span className="editor-job-text err">Échec : {job.error}</span>
                    <button className="btn-secondary" style={{ width: 'auto', margin: 0 }} onClick={() => setJob(null)}>Réessayer</button>
                  </>
                )}
              </div>
            ) : (
              <>
                {submitError && <span className="editor-job-text err">{submitError}</span>}
                <button className="btn" disabled={!canSubmit || !title.trim()} onClick={submit}>
                  {segments.length
                    ? `✂ Créer la vidéo (${segments.length} segment${segments.length > 1 ? 's' : ''})`
                    : '🔊 Créer une copie avec le nouveau son'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
