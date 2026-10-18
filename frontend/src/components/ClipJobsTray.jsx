import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { usePlayer } from '../context/PlayerContext'

const ACTIVE = new Set(['pending', 'running'])

// Demandée au lancement d'une création : la notification système de fin ne s'affiche
// que si l'utilisateur l'a autorisée (sinon seule la notification dans l'appli apparaît).
export function requestClipNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  } catch { /* notifications indisponibles */ }
}

function notifySystem(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return
    new Notification(title, { body, icon: '/2938237.png' })
  } catch { /* notifications indisponibles */ }
}

// Créations de vidéos (éditeur ✂) en arrière-plan : le serveur les traite une par une,
// ce panneau affiche la file (en attente / en cours) et notifie la fin de chacune.
export default function ClipJobsTray() {
  const { openPlayer } = usePlayer()
  const [jobs, setJobs] = useState([])
  const [collapsed, setCollapsed] = useState(false)
  // Tâches suivies pendant cette session (les tâches déjà terminées au chargement de la page ne sont pas affichées).
  const trackedRef = useRef(new Map()) // id → dernier statut connu
  const [dismissed, setDismissed] = useState(() => new Set())

  const refresh = useCallback(async () => {
    let list
    try { list = await api.get('/videos/clip-jobs') } catch { return }
    const tracked = trackedRef.current
    let created = false
    let finished = false
    for (const job of list) {
      const prev = tracked.get(job.id)
      if (prev === undefined && !ACTIVE.has(job.status)) continue
      if (prev !== undefined && ACTIVE.has(prev) && !ACTIVE.has(job.status)) {
        finished = true
        if (job.status === 'done') {
          created = true
          notifySystem('Vidéo créée', job.title)
        } else {
          notifySystem('Échec de la création', `${job.title} : ${job.error || 'erreur'}`)
        }
      }
      tracked.set(job.id, job.status)
    }
    if (created) window.dispatchEvent(new Event('ar44:videos-changed'))
    if (finished) setCollapsed(false)
    setJobs(list.filter((j) => tracked.has(j.id)))
  }, [])

  // Une création vient d'être lancée : elle est suivie tout de suite, sans attendre le prochain tick.
  useEffect(() => {
    function onStarted(e) {
      const job = e.detail
      if (job?.id) {
        trackedRef.current.set(job.id, job.status || 'pending')
        setJobs((prev) => (prev.some((j) => j.id === job.id) ? prev : [...prev, job]))
        setCollapsed(false)
      }
      refresh()
    }
    window.addEventListener('ar44:clip-job-started', onStarted)
    refresh()
    return () => window.removeEventListener('ar44:clip-job-started', onStarted)
  }, [refresh])

  const hasActive = jobs.some((j) => ACTIVE.has(j.status))
  useEffect(() => {
    if (!hasActive) return undefined
    const timer = setInterval(refresh, 1500)
    return () => clearInterval(timer)
  }, [hasActive, refresh])

  const openVideo = async (job) => {
    dismiss(job.id)
    try {
      const all = await api.get('/videos')
      const video = all.find((v) => v.id === job.newVideoId)
      if (video) openPlayer([video], 0)
    } catch { /* la vidéo reste visible dans la bibliothèque */ }
  }

  const dismiss = (id) => setDismissed((prev) => new Set(prev).add(id))

  const visible = jobs.filter((j) => !dismissed.has(j.id))
  if (!visible.length) return null

  const activeCount = visible.filter((j) => ACTIVE.has(j.status)).length
  const queuePosition = (job) => visible.filter((j) => j.status === 'pending' && j.createdAt <= job.createdAt).length

  return (
    <div className="clip-tray">
      <div className="clip-tray-header" onClick={() => setCollapsed((c) => !c)}>
        <span>✂ {activeCount ? `Création${activeCount > 1 ? 's' : ''} en cours (${activeCount})` : 'Créations terminées'}</span>
        <span className="clip-tray-toggle">{collapsed ? '▴' : '▾'}</span>
      </div>
      {!collapsed && (
        <div className="clip-tray-list">
          {visible.map((job) => (
            <div key={job.id} className={`clip-tray-item ${job.status}`}>
              <div className="clip-tray-row">
                <span className="clip-tray-title" title={job.title}>{job.title}</span>
                {!ACTIVE.has(job.status) && (
                  <button className="clip-tray-close" title="Masquer" onClick={() => dismiss(job.id)}>✕</button>
                )}
              </div>
              {job.status === 'running' && (
                <>
                  <div className="editor-progress"><div style={{ width: `${Math.round((job.progress || 0) * 100)}%` }} /></div>
                  <span className="clip-tray-status">En cours… {Math.round((job.progress || 0) * 100)} %</span>
                </>
              )}
              {job.status === 'pending' && (
                <span className="clip-tray-status">⏳ En attente ({queuePosition(job)}{queuePosition(job) > 1 ? 'e' : 're'} dans la file)</span>
              )}
              {job.status === 'done' && (
                <div className="clip-tray-row">
                  <span className="clip-tray-status ok">✔ Vidéo créée</span>
                  <button className="clip-tray-open" onClick={() => openVideo(job)}>▶ Ouvrir</button>
                </div>
              )}
              {job.status === 'error' && (
                <span className="clip-tray-status err">Échec : {job.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
