import { createContext, useContext, useCallback, useState } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [onVideoUpdated, setOnVideoUpdated] = useState(null)
  const [onVideoDeleted, setOnVideoDeleted] = useState(null)

  const openPlayer = useCallback((videos, startIndex, handlers = {}) => {
    setQueue(videos)
    setIndex(startIndex)
    setIsOpen(true)
    setOnVideoUpdated(() => handlers.onVideoUpdated || null)
    setOnVideoDeleted(() => handlers.onVideoDeleted || null)
  }, [])

  const closePlayer = useCallback(() => setIsOpen(false), [])

  const goTo = useCallback((newIndex) => {
    setIndex((prev) => {
      if (newIndex < 0 || newIndex >= queue.length) return prev
      return newIndex
    })
  }, [queue.length])

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
      queue, index, isOpen,
      openPlayer, closePlayer, goTo,
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
