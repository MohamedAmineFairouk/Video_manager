import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../api/client'

export default function SettingsPage() {
  const [host, setHost] = useState('')
  const [currentHost, setCurrentHost] = useState('')
  const [status, setStatus] = useState('')

  const load = async () => {
    const h = await api.get('/config/host')
    setHost(h || '')
    setCurrentHost(h || 'non défini')
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!host.trim()) { setStatus('Veuillez saisir un host.'); return }
    await api.get(`/config/host/set?host=${encodeURIComponent(host.trim())}`)
    setCurrentHost(host.trim())
    setStatus('Host mis à jour ✔')
    setTimeout(() => setStatus(''), 1500)
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <h1 className="page-title">Réglages</h1>

        <div className="host-box" style={{ maxWidth: 480 }}>
          <p className="section-title">Host</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="host-input" type="text" placeholder="192.168.1.44" value={host} onChange={(e) => setHost(e.target.value)} />
            <button className="btn" style={{ width: 'auto', margin: 0 }} onClick={save}>Enregistrer</button>
          </div>
          <div className="muted-note">Host actuel: {currentHost}</div>
          <div className="status">{status}</div>
        </div>
      </main>
    </div>
  )
}
