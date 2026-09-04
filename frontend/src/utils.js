export function formatDuration(ms) {
  if (!ms) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return '00:00'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

// Level is stored 1-5 where 1 = 5 stars (best) ... 5 = 1 star, matching the legacy VLC source-index scale.
export function levelToFilledStars(level) {
  const normalized = typeof level === 'number' && level >= 1 && level <= 5 ? level : 1
  return 6 - normalized
}

// Must match StoryboardService constants on the backend.
export const STORYBOARD_COLS = 5
export const STORYBOARD_ROWS = 4
export const STORYBOARD_FRAME_COUNT = STORYBOARD_COLS * STORYBOARD_ROWS
export const STORYBOARD_TILE_WIDTH = 160
export const STORYBOARD_TILE_HEIGHT = 90

export function storyboardFrameIndex(ratio) {
  const clamped = Math.max(0, Math.min(0.999, ratio))
  return Math.floor(clamped * STORYBOARD_FRAME_COUNT)
}
