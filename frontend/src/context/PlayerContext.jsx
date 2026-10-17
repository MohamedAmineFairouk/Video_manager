import { createContext, useContext, useCallback, useState } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [onVideoUpdated, setOnVideoUpdated] = useState(null)
  const [onVideoDeleted, setOnVideoDeleted] = useState(null)
  // Ids des vidéos ajoutées automatiquement à "À suivre" (les N suivantes de la
  // bibliothèque). Celles mises en file par l'utilisateur passent toujours avant.
  const [autoIds, setAutoIds] = useState(() => new Set())

  const openPlayer = useCallback((videos, startIndex, handlers = {}) => {
    setQueue(videos)
    setIndex(startIndex)
    setAutoIds(new Set())
    setIsOpen(true)
    setMinimized(false)
    setOnVideoUpdated(() => handlers.onVideoUpdated || null)
    setOnVideoDeleted(() => handlers.onVideoDeleted || null)
  }, [])

  // Lecture depuis une liste (bibliothèque) : si l'utilisateur n'a rien mis en file
  // après la vidéo en cours, "À suivre" est rempli avec les `fillCount` vidéos qui
  // suivent `video` dans `list` ; sinon la vidéo est lue tout de suite et la file
  // de l'utilisateur est conservée derrière elle (les ajouts automatiques sont retirés).
  const playFromList = useCallback((video, list, handlers = {}, fillCount = 20) => {
    const userAhead = isOpen
      ? queue.slice(index + 1).filter((v) => !autoIds.has(v.id) && v.id !== video.id)
      : []
    setOnVideoUpdated(() => handlers.onVideoUpdated || null)
    setOnVideoDeleted(() => handlers.onVideoDeleted || null)
    if (userAhead.length) {
      const history = queue.slice(0, index + 1)
      setQueue([...history, video, ...userAhead])
      setIndex(history.length)
      setAutoIds(new Set())
      return
    }
    const at = list.findIndex((v) => v.id === video.id)
    const following = at >= 0 ? list.slice(at + 1, at + 1 + fillCount) : []
    setQueue([video, ...following])
    setIndex(0)
    setAutoIds(new Set(following.map((v) => v.id)))
    setIsOpen(true)
    setMinimized(false)
  }, [isOpen, queue, index, autoIds])

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

  // Sans lecteur ouvert, ajouter à la file démarre un mini-lecteur sur ces vidéos
  // (l'ancienne file d'un lecteur fermé est abandonnée).
  const openMiniPlayer = useCallback((videos) => {
    const unique = videos.filter((v, i) => videos.findIndex((o) => o.id === v.id) === i)
    if (!unique.length) return
    setQueue(unique)
    setIndex(0)
    setIsOpen(true)
    setMinimized(true)
    setOnVideoUpdated(null)
    setOnVideoDeleted(null)
    setAutoIds(new Set())
  }, [])

  // Une vidéo mise en file par l'utilisateur n'est plus considérée comme automatique.
  const markAsUser = useCallback((videos) => {
    setAutoIds((prev) => {
      if (!videos.some((v) => prev.has(v.id))) return prev
      const next = new Set(prev)
      videos.forEach((v) => next.delete(v.id))
      return next
    })
  }, [])

  // `addToQueue` et `playNext` acceptent une vidéo ou une liste de vidéos (ex. une playlist entière).
  const addToQueue = useCallback((videoOrList) => {
    const videos = Array.isArray(videoOrList) ? videoOrList : [videoOrList]
    if (!isOpen) { openMiniPlayer(videos); return }
    const addedIds = new Set(videos.map((v) => v.id))
    setQueue((prev) => {
      // Une vidéo automatique encore à venir est "promue" : retirée de sa place
      // puis réinsérée dans la file utilisateur.
      const base = prev.filter((v, i) => !(i > index && autoIds.has(v.id) && addedIds.has(v.id)))
      const ids = new Set(base.map((v) => v.id))
      const added = videos.filter((v) => !ids.has(v.id) && ids.add(v.id))
      if (!added.length) return prev
      // Insertion après la file utilisateur, avant les vidéos ajoutées automatiquement.
      const firstAuto = base.findIndex((v, i) => i > index && autoIds.has(v.id) && !addedIds.has(v.id))
      const insertAt = firstAuto === -1 ? base.length : firstAuto
      return [...base.slice(0, insertAt), ...added, ...base.slice(insertAt)]
    })
    markAsUser(videos)
  }, [isOpen, openMiniPlayer, index, autoIds, markAsUser])

  const playNext = useCallback((videoOrList) => {
    const videos = Array.isArray(videoOrList) ? videoOrList : [videoOrList]
    if (!isOpen) { openMiniPlayer(videos); return }
    const ids = new Set(videos.map((v) => v.id))
    setQueue((prev) => {
      // Only dedupe an occurrence ahead of the current index - removing one
      // at/before it would shift `index` off the currently playing item.
      const withoutDuplicateAhead = prev.filter((v, i) => !(ids.has(v.id) && i > index))
      const insertAt = Math.min(index + 1, withoutDuplicateAhead.length)
      return [...withoutDuplicateAhead.slice(0, insertAt), ...videos, ...withoutDuplicateAhead.slice(insertAt)]
    })
    markAsUser(videos)
  }, [index, isOpen, openMiniPlayer, markAsUser])

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
      openPlayer, playFromList, closePlayer, goTo, addToQueue, playNext, removeFromQueue, moveInQueue,
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
