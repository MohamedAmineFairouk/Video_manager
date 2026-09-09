import { createContext, useContext, useCallback, useState } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [onVideoUpdated, setOnVideoUpdated] = useState(null)
  const [onVideoDeleted, setOnVideoDeleted] = useState(null)

  const openPlayer = useCallback((videos, startIndex, handlers = {}) => {
    setQueue(videos)
    setIndex(startIndex)
    setIsOpen(true)
    setMinimized(false)
    setOnVideoUpdated(() => handlers.onVideoUpdated || null)
    setOnVideoDeleted(() => handlers.onVideoDeleted || null)
  }, [])

  const closePlayer = useCallback(() => {
    setIsOpen(false)
    setMinimized(false)
  }, [])

  const goTo = useCallback((newIndex) => {
    setIndex((prev) => {
      if (newIndex < 0 || newIndex >= queue.length) return prev
      return newIndex
    })
  }, [queue.length])

  const addToQueue = useCallback((video) => {
    setQueue((prev) => (prev.some((v) => v.id === video.id) ? prev : [...prev, video]))
  }, [])

  const playNext = useCallback((video) => {
    setQueue((prev) => {
      // Only dedupe an occurrence ahead of the current index - removing one
      // at/before it would shift `index` off the currently playing item.
      const withoutDuplicateAhead = prev.filter((v, i) => !(v.id === video.id && i > index))
      const insertAt = Math.min(index + 1, withoutDuplicateAhead.length)
      return [...withoutDuplicateAhead.slice(0, insertAt), video, ...withoutDuplicateAhead.slice(insertAt)]
    })
  }, [index])

  const applyVideoUpdate = useCallback((updated) => {
    setQueue((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
    onVideoUpdated?.(updated)
  }, [onVideoUpdated])

  const applyVideoDeleted = useCallback((videoId) => {
    onVideoDeleted?.(videoId)
    setIsOpen(false)
  }, [onVideoDeleted])

  return (
    <PlayerContext.Provider value={{
      queue, index, isOpen, minimized, setMinimized,
      openPlayer, closePlayer, goTo, addToQueue, playNext,
      applyVideoUpdate, applyVideoDeleted,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
