import { useViewPreferences } from '../context/ViewPreferencesContext'

const SIZES = [
  { key: 'small', label: 'S' },
  { key: 'medium', label: 'M' },
  { key: 'large', label: 'L' },
]

export default function ViewToggle() {
  const { viewMode, setViewMode, gridSize, setGridSize } = useViewPreferences()

  return (
    <div className="view-toggle">
      <div className="view-toggle-group">
        <button
          type="button"
          className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
          title="Vue mosaïque"
          onClick={() => setViewMode('grid')}
        >▦</button>
        <button
          type="button"
          className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
          title="Vue liste"
          onClick={() => setViewMode('list')}
        >☰</button>
      </div>

      {viewMode === 'grid' && (
        <div className="view-toggle-group">
          {SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`view-toggle-btn ${gridSize === s.key ? 'active' : ''}`}
              title={`Taille ${s.label}`}
              onClick={() => setGridSize(s.key)}
            >{s.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
