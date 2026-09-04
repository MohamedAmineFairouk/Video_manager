import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(null) // null = loading

  const checkAuth = useCallback(async () => {
    try {
      const ok = await api.get('/config/auth/check')
      setAuthenticated(!!ok)
    } catch {
      setAuthenticated(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = useCallback(async (username, password) => {
    await api.post(`/config/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
    setAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    await api.get('/config/logout')
    setAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ authenticated, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
