import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'

export default function AddToPlaylistPopover({ videoId, anchorRef, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [memberIds, setMemberIds] = useState(new Set())
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/playlists'),
      api.get(`/playlists/membership/${videoId}`),
    ]).then(([all, membership]) => {
      if (cancelled) return
      setPlaylists(all)
      setMemberIds(new Set(membership))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [videoId])

  const updatePosition = () => {
    const el = anchorRef?.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left, minWidth: Math.max(rect.width, 280) })
  }

  useEffect(() => {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current?.contains(e.target)) return
      if (anchorRef?.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, anchorRef])

  const toggle = async (playlist) => {
    const isMember = memberIds.has(playlist.id)
    const next = new Set(memberIds)
    if (isMember) {
      next.delete(playlist.id)
      setMemberIds(next)
      await api.del(`/playlists/${playlist.id}/videos/${videoId}`)
    } else {
      next.add(playlist.id)
      setMemberIds(next)
      await api.post(`/playlists/${playlist.id}/videos`, { videoId })
    }
  }

  const createAndAdd = async () => {
    const name = newName.trim()
    if (!name) return
    const created = await api.post('/playlists', { name })
    await api.post(`/playlists/${created.id}/videos`, { videoId })
    setPlaylists((prev) => [created, ...prev])
    setMemberIds((prev) => new Set(prev).add(created.id))
    setNewName('')
  }

  if (!pos) return null

  return createPortal(
    <div
      className="playlist-popover"
      ref={popoverRef}
      style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
    >
      {loading && <div className="muted-note">Chargement...</div>}
      {!loading && playlists.length === 0 && <div className="muted-note">Aucune playlist. Crée la première ci-dessous.</div>}
      {!loading && playlists.map((p) => (
        <label key={p.id} className="playlist-popover-item">
          <input type="checkbox" checked={memberIds.has(p.id)} onChange={() => toggle(p)} />
          {p.name}
        </label>
      ))}
      <div className="playlist-popover-new">
        <input
          type="text"
          placeholder="Nouvelle playlist"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createAndAdd() }}
        />
        <button type="button" className="btn" style={{ width: 'auto', margin: 0, padding: '6px 10px' }} onClick={createAndAdd}>+</button>
      </div>
    </div>,
    document.body
  )
}
