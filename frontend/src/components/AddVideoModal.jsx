import { useState } from 'react'
import { api } from '../api/client'

export default function AddVideoModal({ open, onClose, onAdded }) {
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setStatus('Ajout en cours...')
    const form = e.target
    const formData = new FormData(form)
    try {
      await api.postForm('/videos/upload', formData)
      setStatus('Vidéo ajoutée !')
      setTimeout(() => {
        form.reset()
        setStatus('')
        setSubmitting(false)
        onAdded()
        onClose()
      }, 700)
    } catch (err) {
      setStatus('Erreur: ' + err.message)
      setSubmitting(false)
    }
  }

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const defaultCreatedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal-box" onSubmit={handleSubmit}>
        <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        <h2 className="modal-title">Nouvelle vidéo</h2>
        <input name="title" type="text" placeholder="Titre de la vidéo" required />
        <input name="fileName" type="text" placeholder="Nom du fichier (ex: A69_001_DDDD.mp4)" required />
        <input name="creators" type="text" placeholder="Créateurs (séparés par virgule)" />
        <input name="sourceIndex" type="number" min="1" max="5" placeholder="Niveau (1-5)" />
        <input name="createdAt" type="text" defaultValue={defaultCreatedAt} readOnly />
        <label style={{ fontSize: 13, color: '#e0e7ef' }}>
          Thumbnail <span style={{ color: '#f87171' }}>*</span>
          <input name="thumbnail" type="file" accept="image/*" required style={{ marginLeft: 8 }} />
        </label>
        <label style={{ fontSize: 13, color: '#e0e7ef' }}>
          Vidéo (optionnelle)
          <input name="videoFile" type="file" accept="video/mp4,video/*" style={{ marginLeft: 8 }} />
        </label>
        <button type="submit" className="nav-chip highlight" disabled={submitting} style={{ marginTop: 10, fontSize: '1.05rem', justifyContent: 'center' }}>
          Ajouter
        </button>
        <div style={{ fontSize: 13, minHeight: 18, color: '#bae6fd', textAlign: 'center' }}>{status}</div>
      </form>
    </div>
  )
}
