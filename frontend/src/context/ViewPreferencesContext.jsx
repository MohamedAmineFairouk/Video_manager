import { createContext, useContext, useEffect, useState } from 'react'

const ViewPreferencesContext = createContext(null)

const STORAGE_KEY = 'ar44.viewPreferences'
const DEFAULTS = { viewMode: 'grid', gridSize: 'medium' }

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

export function ViewPreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadInitial)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // ignore storage errors (private browsing, quota, etc.)
    }
  }, [prefs])

  const setViewMode = (viewMode) => setPrefs((p) => ({ ...p, viewMode }))
  const setGridSize = (gridSize) => setPrefs((p) => ({ ...p, gridSize }))

  return (
    <ViewPreferencesContext.Provider value={{ ...prefs, setViewMode, setGridSize }}>
      {children}
    </ViewPreferencesContext.Provider>
  )
}

export function useViewPreferences() {
  const ctx = useContext(ViewPreferencesContext)
  if (!ctx) throw new Error('useViewPreferences must be used inside ViewPreferencesProvider')
  return ctx
}
