import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import VideoCard from './VideoCard'

const DRAG_THRESHOLD = 4

export default function VideoGrid({
  videos, onOpen, onToggleFavorite, emptyMessage = 'Aucune vidéo trouvée.',
  extraAction, onPlayNext, onAddToQueue, viewMode = 'grid', gridSize = 'medium',
  selectable, selectedIds, onToggleSelect, onMarqueeSelect, onClearSelection,
  reorderable, onReorder,
}) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [marqueeRect, setMarqueeRect] = useState(null)
  const cardRefs = useRef(new Map())
  const marqueeStateRef = useRef(null)

  const registerCardRef = useCallback((id) => (el) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }, [])

  if (!videos.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  const containerClass = viewMode === 'list' ? 'video-list' : 'video-grid'
  const containerProps = viewMode === 'grid' ? { 'data-size': gridSize } : {}

  const handleDragStart = (video) => (e) => {
    setDragId(video.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(video.id))
  }

  const handleDragOver = (video) => (e) => {
    e.preventDefault()
    if (video.id !== overId) setOverId(video.id)
  }

  const clearDragState = () => { setDragId(null); setOverId(null) }

  const handleDrop = (video) => (e) => {
    e.preventDefault()
    if (dragId == null || dragId === video.id) { clearDragState(); return }
    const fromIndex = videos.findIndex((v) => v.id === dragId)
    const toIndex = videos.findIndex((v) => v.id === video.id)
    clearDragState()
    if (fromIndex === -1 || toIndex === -1) return
    const next = [...videos]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    onReorder?.(next)
  }

  const rectsIntersect = (a, b) => (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  )

  const computeIntersecting = (rect) => {
    const ids = []
    cardRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect()
      if (rectsIntersect(rect, r)) ids.push(id)
    })
    return ids
  }

  const handleContainerMouseDown = (e) => {
    if (!selectable || e.button !== 0) return
    // Only start a marquee when pressing directly on the grid's empty background -
    // any click that lands on a card (or one of its buttons/checkbox) must keep
    // behaving normally (open video, toggle favorite, toggle its own checkbox...).
    if (e.target !== e.currentTarget) return

    const start = { x: e.clientX, y: e.clientY }
    marqueeStateRef.current = { start, dragged: false }

    const onMove = (ev) => {
      const state = marqueeStateRef.current
      if (!state) return
      const dx = ev.clientX - state.start.x
      const dy = ev.clientY - state.start.y
      if (!state.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      state.dragged = true
      const rect = {
        left: Math.min(state.start.x, ev.clientX),
        right: Math.max(state.start.x, ev.clientX),
        top: Math.min(state.start.y, ev.clientY),
        bottom: Math.max(state.start.y, ev.clientY),
      }
      setMarqueeRect(rect)
      onMarqueeSelect?.(computeIntersecting(rect))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const wasDragged = marqueeStateRef.current?.dragged
      marqueeStateRef.current = null
      setMarqueeRect(null)
      if (!wasDragged) onClearSelection?.()
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <>
      <div className={containerClass} {...containerProps} onMouseDown={handleContainerMouseDown}>
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            ref={registerCardRef(video.id)}
            video={video}
            layout={viewMode}
            onOpen={() => onOpen(video)}
            onToggleFavorite={onToggleFavorite}
            extraAction={extraAction}
            onPlayNext={onPlayNext}
            onAddToQueue={onAddToQueue}
            selectable={selectable}
            selected={selectedIds?.has(video.id)}
            onToggleSelect={onToggleSelect}
            draggable={reorderable}
            isDragging={dragId === video.id}
            isDragOver={overId === video.id && dragId !== video.id}
            onDragStart={reorderable ? handleDragStart(video) : undefined}
            onDragOver={reorderable ? handleDragOver(video) : undefined}
            onDrop={reorderable ? handleDrop(video) : undefined}
            onDragEnd={reorderable ? clearDragState : undefined}
          />
        ))}
      </div>
      {marqueeRect && createPortal(
        <div
          className="marquee-select-box"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.right - marqueeRect.left,
            height: marqueeRect.bottom - marqueeRect.top,
          }}
        />,
        document.body
      )}
    </>
  )
}
