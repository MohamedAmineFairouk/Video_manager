import { formatDuration, levelToFilledStars } from '../utils'
import { thumbnailUrl } from '../api/client'

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

export default function VideoCard({ video, onOpen, onToggleFavorite, extraAction }) {
  const creators = video.creators?.length ? video.creators : null
  return (
    <div className="video-card">
      <div
        className={`favorite-icon ${video.favorite ? 'favorite-active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(video) }}
        title="Favori"
      >♥</div>
      {extraAction && (
        <div
          className="favorite-icon"
          style={{ left: 'auto', right: 8 }}
          onClick={(e) => { e.stopPropagation(); extraAction.onClick(video) }}
          title={extraAction.title}
        >{extraAction.icon}</div>
      )}
      <img
        src={thumbnailUrl(video.id)}
        className="video-thumb"
        loading="lazy"
        alt=""
        onClick={() => onOpen(video)}
        onError={(e) => { e.currentTarget.style.opacity = 0.3 }}
      />
      <div className="video-overlay">
        <div className="video-title" title={video.title}>{video.title}</div>
        <div className="video-meta">
          {creators
            ? creators.map((c) => <span key={c} className="creator-badge">{c}</span>)
            : <span className="creator-badge" style={{ background: '#64748b' }}>Unknown</span>}
          <LevelStars level={video.sourceIndex} />
        </div>
      </div>
      <div className="video-duration" style={extraAction ? { top: 32 } : undefined}>{formatDuration(video.durationMs)}</div>
    </div>
  )
}
