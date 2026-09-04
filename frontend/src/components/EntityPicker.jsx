import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function EntityPicker({ items, excluded, onSelect, onCreate, placeholder = 'Ajouter...' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const available = useMemo(
    () => items.filter((c) => !excluded.includes(c)),
    [items, excluded]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available
    return available.filter((c) => c.toLowerCase().includes(q))
  }, [available, query])

  const trimmedQuery = query.trim()
  const exactMatch = available.some((c) => c.toLowerCase() === trimmedQuery.toLowerCase())
  const showCreateOption = trimmedQuery.length > 0 && !exactMatch

  const options = showCreateOption ? [...filtered, { create: true, label: trimmedQuery }] : filtered

  useEffect(() => { setHighlight(0) }, [query, open])

  const updatePosition = () => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220) })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const commit = (item) => {
    if (!item) return
    if (item.create) onCreate(item.label)
    else onSelect(item)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); commit(options[highlight]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const dropdown = open && options.length > 0 && pos && createPortal(
    <div
      className="entity-picker-dropdown"
      ref={dropdownRef}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {options.map((item, i) => {
        const isCreate = item.create
        const label = isCreate ? item.label : item
        return (
          <div
            key={isCreate ? '__create__' : item}
            className={`entity-picker-option ${isCreate ? 'entity-picker-create' : ''} ${i === highlight ? 'highlighted' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); commit(item) }}
            onMouseEnter={() => setHighlight(i)}
          >
            {isCreate ? <>Créer <strong>« {label} »</strong></> : label}
          </div>
        )
      })}
    </div>,
    document.body
  )

  return (
    <div className="entity-picker" ref={wrapRef}>
      <span className="entity-picker-icon">+</span>
      <input
        ref={inputRef}
        type="text"
        className="entity-picker-input"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={handleKeyDown}
      />
      {dropdown}
    </div>
  )
}
