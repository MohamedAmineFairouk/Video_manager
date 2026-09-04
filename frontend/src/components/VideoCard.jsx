import { useEffect, useRef, useState } from 'react'
import { formatDuration, levelToFilledStars, STORYBOARD_COLS, STORYBOARD_ROWS, STORYBOARD_FRAME_COUNT } from '../utils'
import { thumbnailUrl, storyboardUrl } from '../api/client'

export function LevelStars({ level, size = 15 }) {
  const filled = levelToFilledStars(level)
  return (
    <span className="level-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="star" style={{ fontSize: size, color: i <= filled ? '#facc15' : '#334155' }}>★</span>
      ))}
    </span>
  )
}

function CreatorBadges({ creators }) {
  return creators?.length
    ? creators.map((c) => <span key={c} className="creator-badge">{c}</span>)
    : <span className="creator-badge" style={{ background: '#64748b' }}>Unknown</span>
}

function TagBadges({ tags, max = 2 }) {
  if (!tags?.length) return null
  const shown = tags.slice(0, max)
  const rest = tags.length - shown.length
  return (
    <>
      {shown.map((t) => <span key={t} className="tag-badge">{t}</span>)}
      {rest > 0 && <span className="tag-badge">+{rest}</span>}
    </>
  )
}

function TagsText({ tags }) {
  if (!tags?.length) return null
  return <span className="tag-text">{tags.join(', ')}</span>
}

function ViewCount({ count }) {
  return <span className="view-count" title="Nombre de vues">👁 {count ?? 0}</span>
}

function DurationText({ durationMs }) {
  const text = formatDuration(durationMs)
  if (!text) return null
  return <span className="view-count" title="Durée">⏱ {text}</span>
}

function DragHandle() {
  return <span className="drag-handle" title="Glisser pour réordonner">⠿</span>
}

function HoverStoryboard({ videoId, active }) {
  const [frame, setFrame] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current)
      setFrame(0)
      return
    }
    intervalRef.current = setInterval(() => {
      setFrame((f) => (f + 1) % STORYBOARD_FRAME_COUNT)
    }, 350)
    return () => clearInterval(intervalRef.current)
  }, [active])

  if (!active) return null

  const col = frame % STORYBOARD_COLS
  const row = Math.floor(frame / STORYBOARD_COLS)

  return (
    <div
      className="video-thumb-hover-preview"
      style={{
        backgroundImage: `url(${storyboardUrl(videoId)})`,
        backgroundSize: `${STORYBOARD_COLS * 100}% ${STORYBOARD_ROWS * 100}%`,
        backgroundPosition: `${(col / (STORYBOARD_COLS - 1)) * 100}% ${(row / (STORYBOARD_ROWS - 1)) * 100}%`,
      }}
    />
  )
}

export default function VideoCard({
  video, layout = 'grid', onOpen, onToggleFavorite, extraAction,
  selectable, selected, onToggleSelect,
  draggable, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  const [hovering, setHovering] = useState(false)
  const handleThumbError = (e) => { e.currentTarget.style.opacity = 0.3 }

  const dragProps = draggable
    ? { draggable: true, onDragStart, onDragOver, onDrop, onDragEnd }
    : {}
  const dragStateClass = `${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`.trim()

  if (layout === 'list') {
    return (
      <div className={`video-list-item ${dragStateClass}`} {...dragProps}>
        {draggable && <DragHandle />}
        {selectable && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(video)}
            style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
          />
        )}
        <div
          className="video-list-thumb-wrap"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <img
            src={thumbnailUrl(video.id)}
            className="video-list-thumb"
            loading="lazy"
            alt=""
            onClick={() => onOpen(video)}
            onError={handleThumbError}
          />
          <HoverStoryboard videoId={video.id} active={hovering} />
          <div className="video-list-duration">{formatDuration(video.durationMs)}</div>
        </div>
        <div className="video-list-info" onClick={() => onOpen(video)}>
          <div className="video-list-title" title={video.title}>{video.title}</div>
          <div className="video-list-meta">
            <CreatorBadges creators={video.creators} />
            <TagBadges tags={video.tags} max={4} />
            <LevelStars level={video.sourceIndex} />
            <DurationText durationMs={video.durationMs} />
            <ViewCount count={video.viewCount} />
          </div>
        </div>
        <div className="video-list-actions">
          <div
            className={`favorite-icon ${video.favorite ? 'favorite-active' : ''}`}
            style={{ position: 'static' }}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(video) }}
            title="Favori"
          >♥</div>
          {extraAction && (
            <div
              className="favorite-icon"
              style={{ position: 'static' }}
              onClick={(e) => { e.stopPropagation(); extraAction.onClick(video) }}
              title={extraAction.title}
            >{extraAction.icon}</div>
          )}
        </div>
      </div>
    )
  }

  const topRightAction = selectable
    ? { node: (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(video)}
          style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, cursor: 'pointer', zIndex: 10 }}
        />
      ) }
    : extraAction
      ? { node: (
          <div
            className="favorite-icon"
            style={{ left: 'auto', right: 8 }}
            onClick={(e) => { e.stopPropagation(); extraAction.onClick(video) }}
            title={extraAction.title}
          >{extraAction.icon}</div>
        ) }
      : null

  return (
    <div className={`video-card ${dragStateClass}`} {...dragProps}>
      {draggable && (
        <div className="drag-handle drag-handle-grid" title="Glisser pour réordonner">⠿</div>
      )}
      <div
        className={`favorite-icon ${video.favorite ? 'favorite-active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(video) }}
        title="Favori"
      >♥</div>
      {topRightAction?.node}
      <div
        className="video-thumb-wrap"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <img
          src={thumbnailUrl(video.id)}
          className="video-thumb"
          loading="lazy"
          alt=""
          onClick={() => onOpen(video)}
          onError={handleThumbError}
        />
        <HoverStoryboard videoId={video.id} active={hovering} />
      </div>
      <div className="video-overlay">
        <div className="video-title" title={video.title}>{video.title}</div>
        <div className="video-meta">
          <CreatorBadges creators={video.creators} />
          <TagsText tags={video.tags} />
          <LevelStars level={video.sourceIndex} />
          <ViewCount count={video.viewCount} />
        </div>
      </div>
      <div className="video-duration" style={topRightAction ? { top: 32 } : undefined}>{formatDuration(video.durationMs)}</div>
    </div>
  )
}
