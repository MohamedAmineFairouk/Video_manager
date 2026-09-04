import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../router'
import { api } from '../api/client'
import PinInput from '../components/PinInput'

export default function LoginPage() {
  const { login } = useAuth()
  const { navigate } = useRouter()

  const [hasPin, setHasPin] = useState(null) // null = loading
  const [step, setStep] = useState('enter') // 'enter' | 'create' | 'confirm'
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/config/credentials/exists')
      .then((exists) => { setHasPin(exists); setStep(exists ? 'enter' : 'create') })
      .catch(() => { setHasPin(true); setStep('enter') })
  }, [])

  const handleEnterComplete = async (value) => {
    setBusy(true)
    setError('')
    try {
      await login(value)
      navigate('/')
    } catch {
      setError('Code incorrect')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateComplete = (value) => {
    setFirstPin(value)
    setPin('')
    setStep('confirm')
  }

  const handleConfirmComplete = async (value) => {
    if (value !== firstPin) {
      setError('Les codes ne correspondent pas, recommence')
      setPin('')
      setFirstPin('')
      setStep('create')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post(`/config/credentials/set?pin=${value}`)
      await login(value)
      navigate('/')
    } catch {
      setError('Erreur lors de la configuration')
    } finally {
      setBusy(false)
    }
  }

  if (hasPin === null) {
    return <div className="login-shell"><div className="status">Chargement...</div></div>
  }

  const instructions = {
    enter: 'Entre ton code',
    create: 'Choisis un code à 4 chiffres',
    confirm: 'Confirme ton code',
  }[step]

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src="/2938237.png" alt="icon" className="login-brand-logo" />
          <span className="brand-name login-brand-title">Ar44</span>
          <p className="login-tagline">Your hedgehog. Your honey paradise.</p>
        </div>

        <p className="login-instruction">{instructions}</p>

        {step === 'enter' && (
          <PinInput key="enter" length={4} value={pin} onChange={setPin} onComplete={handleEnterComplete} error={!!error} />
        )}
        {step === 'create' && (
          <PinInput key="create" length={4} value={pin} onChange={setPin} onComplete={handleCreateComplete} />
        )}
        {step === 'confirm' && (
          <PinInput key="confirm" length={4} value={pin} onChange={setPin} onComplete={handleConfirmComplete} error={!!error} />
        )}

        {busy && <div className="status" style={{ textAlign: 'center' }}>...</div>}
        {error && <div className="status" style={{ color: '#f87171', textAlign: 'center' }}>{error}</div>}
      </div>
    </div>
  )
}
