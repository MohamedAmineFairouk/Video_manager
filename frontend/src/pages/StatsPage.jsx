import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
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

export default function StatsPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/stats/overview').then(setData).catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="app">
        <Sidebar />
        <main className="content"><h1 className="page-title">Statistiques</h1><div className="status">Chargement...</div></main>
      </div>
    )
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <h1 className="page-title">Statistiques</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard label="Accès total" value={data.totalAppAccesses ?? 0} />
          <StatCard label="Accès aujourd'hui" value={data.todayAppAccesses ?? 0} />
          <StatCard label="Vues total" value={data.totalVideoViews ?? 0} />
          <StatCard label="Vues aujourd'hui" value={data.todayVideoViews ?? 0} />
          <StatCard label="Durée totale regardée" value={formatClock(data.totalWatchSeconds ?? 0)} />
          <StatCard label="Durée moyenne / vue" value={formatClock(data.averageWatchSeconds ?? 0)} />
        </div>

        {Array.isArray(data.topVideos) && data.topVideos.length > 0 && (
          <>
            <p className="section-title">Top vidéos</p>
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#93c5fd', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Titre</th>
                    <th style={{ padding: 8 }}>Vues</th>
                    <th style={{ padding: 8 }}>Temps regardé</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topVideos.map((v) => (
                    <tr key={v.videoId} style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                      <td style={{ padding: 8 }}>{v.title}</td>
                      <td style={{ padding: 8 }}>{v.views}</td>
                      <td style={{ padding: 8 }}>{formatClock(v.watchSeconds ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {Array.isArray(data.recentAccesses) && data.recentAccesses.length > 0 && (
          <>
            <p className="section-title">Accès récents</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#93c5fd', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Page</th>
                    <th style={{ padding: 8 }}>Utilisateur</th>
                    <th style={{ padding: 8 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAccesses.map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                      <td style={{ padding: 8 }}>{a.page}</td>
                      <td style={{ padding: 8 }}>{a.username || '—'}</td>
                      <td style={{ padding: 8 }}>{a.at ? new Date(a.at).toLocaleString('fr-FR') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
