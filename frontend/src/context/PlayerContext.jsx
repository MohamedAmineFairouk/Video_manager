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

  // `addToQueue` et `playNext` acceptent une vidéo ou une liste de vidéos (ex. une playlist entière).
  const addToQueue = useCallback((videoOrList) => {
    const videos = Array.isArray(videoOrList) ? videoOrList : [videoOrList]
    setQueue((prev) => {
      const ids = new Set(prev.map((v) => v.id))
      const added = videos.filter((v) => !ids.has(v.id) && ids.add(v.id))
      return added.length ? [...prev, ...added] : prev
    })
  }, [])

  const playNext = useCallback((videoOrList) => {
    const videos = Array.isArray(videoOrList) ? videoOrList : [videoOrList]
    const ids = new Set(videos.map((v) => v.id))
    setQueue((prev) => {
      // Only dedupe an occurrence ahead of the current index - removing one
      // at/before it would shift `index` off the currently playing item.
      const withoutDuplicateAhead = prev.filter((v, i) => !(ids.has(v.id) && i > index))
      const insertAt = Math.min(index + 1, withoutDuplicateAhead.length)
      return [...withoutDuplicateAhead.slice(0, insertAt), ...videos, ...withoutDuplicateAhead.slice(insertAt)]
    })
  }, [index])

  // Retire l'élément à la position `at` de la file (jamais la vidéo en cours).
  const removeFromQueue = useCallback((at) => {
    if (at === index || at < 0 || at >= queue.length) return
    setQueue((prev) => prev.filter((_, i) => i !== at))
    if (at < index) setIndex(index - 1)
  }, [index, queue.length])

  // Déplace l'élément de la position `from` vers `to`, en gardant `index`
  // pointé sur la vidéo en cours de lecture.
  const moveInQueue = useCallback((from, to) => {
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
    setQueue((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    if (from === index) setIndex(to)
    else if (from < index && to >= index) setIndex(index - 1)
    else if (from > index && to <= index) setIndex(index + 1)
  }, [index, queue.length])

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
      openPlayer, closePlayer, goTo, addToQueue, playNext, removeFromQueue, moveInQueue,
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
