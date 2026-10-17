import { useEffect, useMemo, useRef, useState } from 'react'

// Liste déroulante à choix multiple avec recherche (filtres créateurs / tags).
// Sans recherche : seuls les éléments ayant plus de `minCount` vidéos sont proposés (les
// éléments déjà choisis restent toujours visibles). Avec recherche : tous les éléments
// correspondants. Un clic coche/décoche sans fermer la liste ; "Tout" vide la sélection.
// `matchMode` : 'any' (au moins un des choix) ou 'all' (tous les choix), basculable.
export default function MultiFilterSelect({
  values, onChange, items, counts,
  extraOptions = [], // [{ value, label, count }] proposés en tête (ex. UKWN = sans créateur)
  matchMode, onMatchModeChange,
  minCount = 0, noun = 'élément', nounPlural, searchPlaceholder = 'Rechercher...',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const plural = nounPlural || `${noun}s`
  const selected = useMemo(() => new Set(values), [values])

  const labelOf = (v) => extraOptions.find((o) => o.value === v)?.label ?? v
  const countOf = (v) => extraOptions.find((o) => o.value === v)?.count ?? (counts.get(v) || 0)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...items].sort((a, b) => a.localeCompare(b))
    const matching = q
      ? sorted.filter((c) => c.toLowerCase().includes(q))
      : sorted.filter((c) => (counts.get(c) || 0) > minCount || selected.has(c))
    const list = matching.map((c) => ({ value: c, label: c, count: counts.get(c) || 0 }))
    if (!q) list.unshift({ value: null, label: 'Tout', count: null }, ...extraOptions)
    return list
  }, [items, counts, query, minCount, extraOptions, selected])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => { setHighlight(0) }, [query])

  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const toggle = (v) => {
    if (v === null) { onChange([]); return }
    onChange(selected.has(v) ? values.filter((x) => x !== v) : [...values, v])
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[highlight]) toggle(options[highlight].value) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  const triggerLabel = values.length === 0 ? 'Tout'
    : values.length === 1 ? labelOf(values[0])
    : `${values.length} ${plural}`
  const triggerTitle = values.length ? values.map(labelOf).join(', ') : `Tous les ${plural}`

  return (
    <div className="creator-filter-select creator-combo" ref={rootRef}>
      <button type="button" className={`creator-combo-trigger ${values.length ? 'has-value' : ''}`} onClick={() => setOpen((o) => !o)} title={triggerTitle}>
        <span className="creator-combo-label">{triggerLabel}</span>
        {values.length === 1 && <span className="creator-count-badge">{countOf(values[0])}</span>}
        <span className="creator-combo-caret">▾</span>
      </button>

      {open && (
        <div className="creator-combo-panel">
          <input
            ref={inputRef}
            type="text"
            className="creator-combo-search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {onMatchModeChange && (
            <div className="multi-filter-mode">
              <button type="button" className={matchMode === 'any' ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); onMatchModeChange('any') }}
                title={`Vidéos ayant au moins un des ${plural} choisis`}>Au moins un</button>
              <button type="button" className={matchMode === 'all' ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); onMatchModeChange('all') }}
                title={`Vidéos ayant tous les ${plural} choisis`}>Tous</button>
            </div>
          )}
          <ul className="creator-combo-list" ref={listRef}>
            {options.length === 0 && <li className="creator-combo-empty">Aucun {noun}</li>}
            {options.map((o, i) => {
              const isChecked = o.value === null ? values.length === 0 : selected.has(o.value)
              return (
                <li
                  key={o.value ?? '__all__'}
                  className={`creator-combo-option ${i === highlight ? 'highlight' : ''} ${isChecked ? 'selected' : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); toggle(o.value) }}
                >
                  <span className={`multi-filter-check ${isChecked ? 'checked' : ''}`}>{isChecked ? '✓' : ''}</span>
                  <span className="creator-combo-label">{o.label}</span>
                  {o.count != null && <span className="creator-count-badge">{o.count}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
