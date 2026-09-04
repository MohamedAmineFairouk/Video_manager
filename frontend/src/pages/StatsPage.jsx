import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import BarChart from '../components/BarChart'
import ConfirmModal from '../components/ConfirmModal'
import { api } from '../api/client'
import { formatClock } from '../utils'

function StatCard({ label, value }) {
  return (
    <div className="video-card" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#dbeafe' }}>{value}</div>
    </div>
  )
}

function sum(data) {
  return data.reduce((acc, d) => acc + (Number(d.value) || 0), 0)
}

export default function StatsPage() {
  const [stats, setStats] = useState(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [resetting, setResetting] = useState(false)

  const [creators, setCreators] = useState([])
  const [creatorsLoading, setCreatorsLoading] = useState(true)
  const [tags, setTags] = useState([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null) // { type: 'creator'|'tag', id, name }
  const [clearTagsOpen, setClearTagsOpen] = useState(false)
  const [clearTagsStatus, setClearTagsStatus] = useState('')

  const reload = () => api.get('/stats/overview').then(setStats).catch(() => {})
  const loadCreators = () => {
    setCreatorsLoading(true)
    api.get('/videos/creators/detailed').then(setCreators).finally(() => setCreatorsLoading(false))
  }
  const loadTags = () => {
    setTagsLoading(true)
    api.get('/videos/tags/detailed').then(setTags).finally(() => setTagsLoading(false))
  }

  useEffect(() => { reload(); loadCreators(); loadTags() }, [])

  const confirmReset = async () => {
    if (!resetPassword) return
    setResetting(true)
    setResetStatus('')
    try {
      await api.post('/stats/reset', { password: resetPassword })
      setResetStatus('Statistiques réinitialisées ✔')
      setResetPassword('')
      setResetOpen(false)
      reload()
    } catch (err) {
      setResetStatus(err.message || 'Mot de passe incorrect')
    } finally {
      setResetting(false)
    }
  }

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'creator') {
      await api.del(`/videos/creators/${deleteTarget.id}`)
      setCreators((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    } else {
      await api.del(`/videos/tags/${deleteTarget.id}`)
      setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  const confirmClearTagAssignments = async () => {
    const result = await api.post('/videos/tags/clear-assignments')
    setClearTagsStatus(`${result.videosUpdated} vidéo(s) mise(s) à jour ✔`)
    setClearTagsOpen(false)
    setTimeout(() => setClearTagsStatus(''), 3000)
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <div className="stats-page-header">
          <h1 className="page-title" style={{ margin: 0 }}>Statistiques</h1>
          <button className="btn-secondary danger-button" style={{ width: 'auto' }} onClick={() => setResetOpen((o) => !o)}>
            Réinitialiser les compteurs
          </button>
        </div>
        <p className="page-subtitle">Ton activité et tes habitudes de visionnage</p>

        {resetOpen && (
          <div className="host-box" style={{ maxWidth: 420, marginBottom: 20, borderColor: 'rgba(239,68,68,0.4)' }}>
            <p className="muted-note" style={{ marginTop: 0 }}>
              Cette action supprime définitivement l'historique des vues et des accès. Confirme avec ton mot de passe.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="host-input"
                type="password"
                placeholder="Mot de passe"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmReset() }}
                autoFocus
              />
              <button
                className="btn"
                style={{ width: 'auto', margin: 0, background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                disabled={!resetPassword || resetting}
                onClick={confirmReset}
              >Confirmer</button>
            </div>
            {resetStatus && (
              <div className="status" style={{ color: resetStatus.includes('✔') ? '#4ade80' : '#f87171' }}>{resetStatus}</div>
            )}
          </div>
        )}

        {!stats && <div className="status">Chargement...</div>}

        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
              <StatCard label="Temps total regardé" value={formatClock(stats.totalWatchSeconds ?? 0)} />
              <StatCard label="Durée moyenne / vue" value={formatClock(stats.averageWatchSeconds ?? 0)} />
              <StatCard label="Vues aujourd'hui" value={stats.todayVideoViews ?? 0} />
              <StatCard label="Connexions aujourd'hui" value={stats.todayAppAccesses ?? 0} />
            </div>

            <div className="stats-section">
              <h2 className="stats-section-title">🕒 Quand je me connecte (par heure, historique complet)</h2>
              <div className="stats-chart-card">
                <BarChart data={stats.connectionsByHour} color="#6366f1" height={130} />
              </div>
            </div>

            <div className="stats-section">
              <h2 className="stats-section-title">🔌 Connexions</h2>
              <div className="stats-grid">
                <div className="stats-chart-card">
                  <div className="stats-chart-card-header">
                    <span className="stats-chart-card-title">Par jour (30j)</span>
                    <span className="stats-chart-card-total">{sum(stats.connectionsByDay ?? [])} total</span>
                  </div>
                  <BarChart data={stats.connectionsByDay} color="#38bdf8" />
                </div>
                <div className="stats-chart-card">
                  <div className="stats-chart-card-header">
                    <span className="stats-chart-card-title">Par semaine (12s)</span>
                    <span className="stats-chart-card-total">{sum(stats.connectionsByWeek ?? [])} total</span>
                  </div>
                  <BarChart data={stats.connectionsByWeek} color="#38bdf8" />
                </div>
                <div className="stats-chart-card">
                  <div className="stats-chart-card-header">
                    <span className="stats-chart-card-title">Par mois (12m)</span>
                    <span className="stats-chart-card-total">{sum(stats.connectionsByMonth ?? [])} total</span>
                  </div>
                  <BarChart data={stats.connectionsByMonth} color="#38bdf8" />
                </div>
              </div>
            </div>

            <div className="stats-section">
              <h2 className="stats-section-title">▶️ Minutes regardées</h2>
              <div className="stats-grid">
                <div className="stats-chart-card">
                  <div className="stats-chart-card-header">
                    <span className="stats-chart-card-title">Par jour (30j)</span>
                    <span className="stats-chart-card-total">{sum(stats.watchMinutesByDay ?? [])} min</span>
                  </div>
                  <BarChart data={stats.watchMinutesByDay} color="#22d493" valueSuffix=" min" />
                </div>
                <div className="stats-chart-card">
                  <div className="stats-chart-card-header">
                    <span className="stats-chart-card-title">Par semaine (12s)</span>
                    <span className="stats-chart-card-total">{sum(stats.watchMinutesByWeek ?? [])} min</span>
                  </div>
                  <BarChart data={stats.watchMinutesByWeek} color="#22d493" valueSuffix=" min" />
                </div>
              </div>
            </div>

            {Array.isArray(stats.topVideosByWatchTime) && stats.topVideosByWatchTime.length > 0 && (
              <div className="stats-section">
                <h2 className="stats-section-title">🏆 Top vidéos (minutes regardées)</h2>
                <div className="stats-chart-card">
                  <BarChart data={stats.topVideosByWatchTime} color="#facc15" valueSuffix=" min" height={160} />
                </div>
              </div>
            )}
          </>
        )}

        <div className="stats-section">
          <h2 className="stats-section-title">⚙ Créateurs</h2>
          <p className="muted-note" style={{ marginBottom: 12 }}>
            Supprimer un créateur le retire de toutes les vidéos associées.
          </p>

          {creatorsLoading && <div className="status">Chargement...</div>}
          {!creatorsLoading && creators.length === 0 && <div className="empty-state">Aucun créateur pour le moment.</div>}

          <div className="creator-manage-list">
            {creators.map((c) => (
              <div key={c.id} className="creator-manage-item">
                <span>{c.name}</span>
                <button className="creator-manage-delete" title="Supprimer" onClick={() => setDeleteTarget({ type: 'creator', id: c.id, name: c.name })}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <h2 className="stats-section-title" style={{ margin: 0 }}>🏷 Tags</h2>
            <button className="btn-secondary danger-button" style={{ width: 'auto' }} onClick={() => setClearTagsOpen(true)}>
              Retirer tous les tags des vidéos
            </button>
          </div>
          <p className="muted-note" style={{ marginBottom: 12 }}>
            Supprimer un tag le retire de toutes les vidéos associées. "Retirer tous les tags" détache les tags des vidéos sans supprimer la liste ci-dessous.
          </p>
          {clearTagsStatus && <div className="status" style={{ color: '#4ade80' }}>{clearTagsStatus}</div>}

          {tagsLoading && <div className="status">Chargement...</div>}
          {!tagsLoading && tags.length === 0 && <div className="empty-state">Aucun tag pour le moment.</div>}

          <div className="creator-manage-list">
            {tags.map((t) => (
              <div key={t.id} className="creator-manage-item">
                <span>{t.name}</span>
                <button className="creator-manage-delete" title="Supprimer" onClick={() => setDeleteTarget({ type: 'tag', id: t.id, name: t.name })}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <ConfirmModal
        open={!!deleteTarget}
        text={`Supprimer ${deleteTarget?.type === 'tag' ? 'le tag' : 'le créateur'} "${deleteTarget?.name}" ? Il sera retiré de toutes les vidéos.`}
        onConfirm={confirmDeleteTarget}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={clearTagsOpen}
        text="Retirer tous les tags de toutes les vidéos ? La liste de tags ci-dessous sera conservée, seules les associations avec les vidéos seront supprimées."
        onConfirm={confirmClearTagAssignments}
        onCancel={() => setClearTagsOpen(false)}
      />
    </div>
  )
}
