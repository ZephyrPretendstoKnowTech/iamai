import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.tsx'
import { Button } from './Button.tsx'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'

const T = app.picker

export type PickerOption = {
  id: string
  name: string
  secondary?: string // UPN, member count, type
  badge?: string // inferred role
  why?: string // "why suggested" line
}

// Typeahead multi-select over tenant objects: every decision picker. Empty, the
// list shows the nominations with their signal text; typing filters every object
// of the kind (the caller filters); chips are the selection. The list stays open
// until Escape, a click outside, or Done.
export function Picker({
  selected,
  options,
  suggestions = [],
  onChange,
  onSearch,
  placeholder = T.placeholder,
  single = false,
  loading = false,
}: {
  selected: PickerOption[]
  options: PickerOption[] // results for the current query (caller filters/searches)
  suggestions?: PickerOption[] // shown when the query is empty
  onChange: (next: PickerOption[]) => void
  onSearch?: (query: string) => void
  placeholder?: string
  single?: boolean
  loading?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useMemo(() => `picker-list-${Math.random().toString(36).slice(2, 8)}`, [])

  useEffect(() => {
    onSearch?.(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])
  const empty = query.trim().length === 0
  const list = (empty ? suggestions : options).filter((o) => !selectedIds.has(o.id)).slice(0, 8)
  // Empty and nothing nominated remains: just the field, no header, no Done.
  const showList = open && (!empty || loading || list.length > 0)

  const pick = (o: PickerOption): void => {
    onChange(single ? [o] : [...selected, o])
    setQuery('')
    if (single) setOpen(false)
  }
  const remove = (id: string): void => onChange(selected.filter((s) => s.id !== id))

  return (
    <div className="picker" ref={ref}>
      {selected.length > 0 && (
        <div className="picker-chips">
          {selected.map((s) => (
            <span key={s.id} className="chip-select">
              <span className="chip-name">{s.name}</span>
              <button type="button" className="chip-remove" aria-label={`${T.remove} ${s.name}`} title={T.remove} onClick={() => remove(s.id)}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="picker-search">
        <Icon name="search" className="picker-search-icon" />
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          aria-label={placeholder}
          aria-expanded={showList}
          aria-controls={listId}
          role="combobox"
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true)
            setFocused(0)
          }}
          onChange={(e) => {
            setQuery(e.currentTarget.value)
            setOpen(true)
            setFocused(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              // A search input clears itself on Escape and fires onChange, which
              // would reopen the list (prompt 19 §B): keep the text, close the list.
              e.preventDefault()
              setOpen(false)
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setFocused((f) => Math.min(f + 1, list.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setFocused((f) => Math.max(f - 1, 0))
            }
            if (e.key === 'Enter' && list[focused]) {
              e.preventDefault()
              pick(list[focused])
            }
          }}
        />
      </div>
      {showList && (
        <div className="picker-list" role="listbox" id={listId}>
          {empty && list.length > 0 && <div className="picker-heading">{T.suggestions}</div>}
          {loading && <div className="picker-footer">{T.searching}</div>}
          {list.length === 0 && !loading && <div className="picker-footer">{T.noMatches}</div>}
          {list.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={i === focused}
              className={`picker-option ${i === focused ? 'focused' : ''}`}
              onMouseEnter={() => setFocused(i)}
              onClick={() => pick(o)}
            >
              <span className="picker-option-name">{o.name}</span>
              {(o.why ?? o.secondary) && <span className="picker-option-secondary">{o.why ?? o.secondary}</span>}
            </button>
          ))}
          <div className="picker-footer">
            <Button size="sm" variant="tertiary" onClick={() => setOpen(false)}>
              {T.done}
            </Button>
            {!empty && <span className="picker-count">{fillText(T.results, { n: list.length })}</span>}
          </div>
        </div>
      )}
    </div>
  )

}
