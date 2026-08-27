import { useEffect, useMemo, useRef, useState } from 'react'
import { Chip } from './Chip.tsx'
import { Icon } from './Icon.tsx'
import { Button } from './Button.tsx'
import { COMPONENTS } from '../../copy/components.ts'

const T = COMPONENTS.picker

export type PickerOption = {
  id: string
  name: string
  secondary?: string // UPN, member count, type
  badge?: string // inferred role
}

// Typeahead multi-select over tenant objects. Empty query shows ranked
// suggestions; the list stays open until Esc, click-outside, or Done.
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
  const list = (query.trim().length === 0 ? suggestions : options).filter((o) => !selectedIds.has(o.id)).slice(0, 8)

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
            <button key={s.id} type="button" className="chip chip-select chip-selected" title={T.remove} onClick={() => remove(s.id)}>
              {s.name} <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Icon name="search" className="muted" />
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          aria-label={placeholder}
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.currentTarget.value)
            setOpen(true)
            setFocused(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
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
      {open && (
        <div className="picker-list" role="listbox">
          {loading && <div className="picker-footer">{T.searching}</div>}
          {list.length === 0 && !loading && <div className="picker-footer">{query ? T.noMatches : T.typeToSearch}</div>}
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
              <span>
                <span>{o.name}</span>
                {o.secondary && <div className="picker-option-secondary">{o.secondary}</div>}
              </span>
              {o.badge && <Chip status="neutral">{o.badge}</Chip>}
            </button>
          ))}
          <div className="picker-footer">
            <span>{query.trim().length === 0 ? T.suggestions : T.results(list.length)}</span>
            <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
              {T.done}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
