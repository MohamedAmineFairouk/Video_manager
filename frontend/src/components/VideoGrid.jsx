import { useState } from 'react'
import VideoCard from './VideoCard'

export default function VideoGrid({
  videos, onOpen, onToggleFavorite, emptyMessage = 'Aucune vidéo trouvée.',
  extraAction, viewMode = 'grid', gridSize = 'medium',
  selectable, selectedIds, onToggleSelect,
  reorderable, onReorder,
}) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

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

  return (
    <div className={containerClass} {...containerProps}>
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          layout={viewMode}
          onOpen={() => onOpen(video)}
          onToggleFavorite={onToggleFavorite}
          extraAction={extraAction}
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
  )
}
