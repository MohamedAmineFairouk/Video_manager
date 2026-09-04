import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../router'

export default function LoginPage() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Identifiants invalides')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-row" style={{ justifyContent: 'center', marginBottom: 6 }}>
          <img src="/2938237.png" alt="icon" className="brand-logo" />
          <span className="brand-name">Ar44</span>
        </div>
        <input className="host-input" type="text" placeholder="Utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="host-input" type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="status" style={{ color: '#f87171' }}>{error}</div>}
        <button className="btn" type="submit" disabled={submitting}>Se connecter</button>
      </form>
    </div>
  )
}
