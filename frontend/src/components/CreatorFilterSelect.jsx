import { useEffect, useMemo, useRef, useState } from 'react'

// Liste déroulante des créateurs avec recherche.
// Sans recherche : seuls les créateurs ayant plus de `minCount` vidéos sont proposés.
// Avec recherche : tous les créateurs correspondants sont proposés, quel que soit leur nombre de vidéos.
export default function CreatorFilterSelect({ value, onChange, creators, counts, unknownValue, unknownCount, minCount = 5 }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...creators].sort((a, b) => a.localeCompare(b))
    const matching = q
      ? sorted.filter((c) => c.toLowerCase().includes(q))
      : sorted.filter((c) => (counts.get(c) || 0) > minCount)
    const list = matching.map((c) => ({ value: c, label: c, count: counts.get(c) || 0 }))
    if (!q) {
      list.unshift(
        { value: '', label: 'Tout', count: null },
        { value: unknownValue, label: 'UKWN', count: unknownCount },
      )
    }
    return list
  }, [creators, counts, query, minCount, unknownValue, unknownCount])

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

  const select = (v) => { onChange(v); setOpen(false) }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[highlight]) select(options[highlight].value) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  const currentLabel = value === '' ? 'Tout' : value === unknownValue ? 'UKWN' : value
  const currentCount = value === '' ? null : value === unknownValue ? unknownCount : counts.get(value) || 0

  return (
    <div className="creator-filter-select creator-combo" ref={rootRef}>
      <button type="button" className="creator-combo-trigger" onClick={() => setOpen((o) => !o)} title={currentLabel}>
        <span className="creator-combo-label">{currentLabel}</span>
        {currentCount != null && <span className="creator-count-badge">{currentCount}</span>}
        <span className="creator-combo-caret">▾</span>
      </button>

      {open && (
        <div className="creator-combo-panel">
          <input
            ref={inputRef}
            type="text"
            className="creator-combo-search"
            placeholder="Rechercher un créateur..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <ul className="creator-combo-list" ref={listRef}>
            {options.length === 0 && <li className="creator-combo-empty">Aucun créateur</li>}
            {options.map((o, i) => (
              <li
                key={o.value || '__all__'}
                className={`creator-combo-option ${i === highlight ? 'highlight' : ''} ${o.value === value ? 'selected' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); select(o.value) }}
              >
                <span className="creator-combo-label">{o.label}</span>
                {o.count != null && <span className="creator-count-badge">{o.count}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
