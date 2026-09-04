import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export default function AddToPlaylistPopover({ videoId, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [memberIds, setMemberIds] = useState(new Set())
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

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

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

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

  return (
    <div className="playlist-popover" ref={ref}>
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
    </div>
  )
}
