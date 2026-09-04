import VideoCard from './VideoCard'

export default function VideoGrid({ videos, onOpen, onToggleFavorite, emptyMessage = 'Aucune vidéo trouvée.', extraAction }) {
  if (!videos.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }
  return (
    <div className="video-grid">
      {videos.map((video, index) => (
        <VideoCard
          key={video.id}
          video={video}
          onOpen={() => onOpen(video, index)}
          onToggleFavorite={onToggleFavorite}
          extraAction={extraAction}
        />
      ))}
    </div>
  )
}
