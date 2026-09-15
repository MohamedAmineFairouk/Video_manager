import { useCallback, useEffect, useRef, useState } from 'react'
import { thumbnailUrl } from '../api/client'
import { formatDuration } from '../utils'

export function pickRandom(list, count) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export default function VideoCarousel({ videos, onOpen }) {
  const trackRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => { updateArrows() }, [videos, updateArrows])

  const scrollBy = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  if (!videos.length) return null

  return (
    <section className="carousel-section">
      <div className="carousel-panel">
        <div className="carousel-header">
          <h3 className="carousel-title"><span className="carousel-title-icon">✨</span> Découverte aléatoire</h3>
        </div>
        <div className={`carousel-wrap ${canLeft ? 'fade-left' : ''} ${canRight ? 'fade-right' : ''}`}>
          <button
            type="button"
            className={`carousel-nav carousel-nav-left ${canLeft ? '' : 'is-hidden'}`}
            onClick={() => scrollBy(-1)}
            aria-label="Précédent"
          >‹</button>

          <div className="carousel-track" ref={trackRef} onScroll={updateArrows}>
            {videos.map((v) => (
              <button
                type="button"
                key={v.id}
                className="carousel-item"
                onClick={() => onOpen(v)}
                title={v.title}
              >
                <img
                  src={thumbnailUrl(v.id)}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.opacity = 0.2 }}
                />
                <span className="carousel-item-glow" />
                {formatDuration(v.durationMs) && (
                  <span className="carousel-item-duration">{formatDuration(v.durationMs)}</span>
                )}
                <span className="carousel-play">▶</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`carousel-nav carousel-nav-right ${canRight ? '' : 'is-hidden'}`}
            onClick={() => scrollBy(1)}
            aria-label="Suivant"
          >›</button>
        </div>
      </div>
    </section>
  )
}
