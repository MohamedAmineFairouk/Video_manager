// Thèmes disponibles (couleurs définies dans styles/themes.css).
export const DEFAULT_THEME = 'ar44'

export const THEMES = [
  { id: 'ar44', name: 'Ar44 (bleu, défaut)', swatches: ['#05070a', '#1e293b', '#3b82f6', '#38bdf8', '#6366f1'] },
  { id: 'netflix', name: 'Netflix (noir et rouge)', swatches: ['#000000', '#262626', '#e50914', '#ff3b30', '#b91c1c'] },
  { id: 'rose-nuit', name: 'Rose et bleu nuit', swatches: ['#040718', '#1a2452', '#ec4899', '#f472b6', '#3b5bdb'] },
  { id: 'violet', name: 'Violet profond', swatches: ['#090512', '#2c204a', '#8b5cf6', '#c084fc', '#d946ef'] },
  { id: 'noir-violet', name: 'Noir et violet', swatches: ['#000000', '#24222c', '#a855f7', '#c084fc', '#7c3aed'] },
  { id: 'dracula', name: 'Dracula (violet, rose, cyan)', swatches: ['#191a21', '#44475a', '#bd93f9', '#ff79c6', '#8be9fd'] },
  { id: 'synthwave', name: 'Synthwave (violet, magenta, cyan)', swatches: ['#0d0221', '#30145c', '#f72585', '#4cc9f0', '#7209b7'] },
]

const STORAGE_KEY = 'ar44.theme'

// Applique un thème sur <html data-theme="..."> (le thème par défaut = pas d'attribut).
export function applyTheme(id) {
  const theme = THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME
  if (theme === DEFAULT_THEME) delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* stockage indisponible */ }
  return theme
}

// Thème mémorisé dans le navigateur : appliqué dès le démarrage, avant la réponse du serveur.
export function savedTheme() {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME } catch { return DEFAULT_THEME }
}
