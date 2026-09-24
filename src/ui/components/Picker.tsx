import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
//
// The combobox is the ARIA one, coherently (task 017): DOM focus stays on the
// input, `aria-activedescendant` names the highlighted option, and the options
// themselves are not tab stops — Arrow keys move, Enter picks, Escape closes.
// The list holds options and nothing else; the heading, the "searching" note
// and the Done row sit outside it, because a listbox with prose in it is a
// listbox a screen reader reads wrong.
//
// None of this touches what the picker decides: which options exist, which are
// nominated and which are selected are the caller's, exactly as before.
//
// Where the caller hands it `onCommit`, the picker saves (owner, 2026-09-23:
// one control, no separate Save beside it): Done saves the selection and
// closes the list, removing a chip saves what is left, picking in a
// single-choice list saves the pick, and closing the list any other way after
// a change saves it too, so a pick is never left on screen unsaved.
export function Picker({
  selected,
  options,
  suggestions = [],
  onChange,
  onSearch,
  placeholder = T.placeholder,
  single = false,
  loading = false,
  labelledBy,
  readOnly = false,
  onCommit,
  listAll = false,
}: {
  selected: PickerOption[]
  options: PickerOption[] // results for the current query (caller filters/searches)
  suggestions?: PickerOption[] // shown when the query is empty
  onChange: (next: PickerOption[]) => void
  onSearch?: (query: string) => void
  placeholder?: string
  single?: boolean
  loading?: boolean
  /** The id of the label above the picker (a decision's `.dlabel`), where there is one. */
  labelledBy?: string
  /**
   * The list is IAMAI's and the person confirms it, rather than composing one.
   *
   * The campaign's support list is computed from the readiness the plan already
   * holds — every active admin, everyone with no method, everyone on SMS alone
   * — and a person adding somebody the evidence does not put there changes who
   * the plan says needs help, which is a number other steps read. So the chips
   * show and Save confirms them; there is nothing to type into and nothing to
   * take off (owner, 2026-09-22).
   */
  readOnly?: boolean
  /** Saves the selection: Done, a removed chip, a single pick, or the list closed after a change. */
  onCommit?: (selected: PickerOption[]) => void
  /**
   * The options are the whole choice, and few (walk list section 3 item 22: the
   * dormant accounts to keep, the people not ready to turn on without them):
   * empty, the list shows every one of them, under no Suggestions heading,
   * because no fact suggests any.
   */
  listAll?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const base = useId()
  const listId = `${base}-list`
  const optionId = (i: number): string => `${base}-option-${i}`
  // The selection as it stands, and as it stood when the list opened: closing
  // the list after a change saves it (`onCommit`), closing it unchanged does not.
  const latest = useRef(selected)
  latest.current = selected
  // The caller's save as it is now, for the click outside the list the effect below listens for.
  const commit = useRef(onCommit)
  commit.current = onCommit
  const openedWith = useRef('')
  const idsOf = (rows: PickerOption[]): string => rows.map((r) => r.id).join(' ')
  useEffect(() => {
    if (open) openedWith.current = idsOf(latest.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const save = (rows: PickerOption[]): void => {
    if (!commit.current) return
    openedWith.current = idsOf(rows)
    commit.current(rows)
  }
  const close = (): void => {
    setOpen(false)
    if (idsOf(latest.current) !== openedWith.current) save(latest.current)
  }
  // Done saves the selection as it stands, changed or not: it is how a
  // selection the picker opened with, and nobody has saved, is saved.
  const done = (): void => {
    setOpen(false)
    save(latest.current)
  }

  useEffect(() => {
    onSearch?.(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])
  const empty = query.trim().length === 0
  const shown = (empty ? (listAll ? options : suggestions) : options).filter((o) => !selectedIds.has(o.id))
  const list = listAll ? shown : shown.slice(0, 8)
  // Empty and nothing nominated remains: just the field, no header, no Done —
  // unless Done is what saves, so a selection the picker opened with can be saved.
  const showList = open && (!empty || loading || list.length > 0 || onCommit !== undefined)
  const at = Math.min(focused, Math.max(0, list.length - 1))

  const pick = (o: PickerOption): void => {
    onChange(single ? [o] : [...selected, o])
    setQuery('')
    if (single) {
      setOpen(false)
      save([o])
    }
  }
  const remove = (id: string): void => {
    const next = selected.filter((s) => s.id !== id)
    onChange(next)
    save(next)
  }

  return (
    <div className="picker" ref={ref} role="group" aria-labelledby={labelledBy}>
      {selected.length > 0 && (
        <div className="picker-chips">
          {selected.map((s) => (
            <span key={s.id} className="chip-select">
              <span className="chip-name">{s.name}</span>
              {s.badge && <span className="chip-badge">{s.badge}</span>}
              {!readOnly && <button type="button" className="chip-remove" aria-label={`${T.remove} ${s.name}`} title={T.remove} onClick={() => remove(s.id)}>
                <Icon name="close" size={12} />
              </button>}
            </span>
          ))}
        </div>
      )}
      {!readOnly && <div className="picker-search">
        <Icon name="search" className="picker-search-icon" />
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          aria-label={labelledBy ? undefined : placeholder}
          aria-labelledby={labelledBy}
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && list[at] ? optionId(at) : undefined}
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
              close()
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
            if (e.key === 'Enter' && list[at]) {
              e.preventDefault()
              pick(list[at])
            }
          }}
        />
      </div>}
      {!readOnly && showList && (
        <div className="picker-list">
          {empty && !listAll && list.length > 0 && <div className="picker-heading">{T.suggestions}</div>}
          {loading && <div className="picker-footer">{T.searching}</div>}
          {list.length === 0 && !loading && !empty && <div className="picker-footer">{T.noMatches}</div>}
          <div role="listbox" id={listId} aria-label={placeholder}>
            {list.map((o, i) => (
              <div
                key={o.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === at}
                className={`picker-option ${i === at ? 'focused' : ''}`}
                onMouseEnter={() => setFocused(i)}
                // The input keeps DOM focus (aria-activedescendant), so a press
                // must not move it: mousedown is where a browser would.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                <span className="picker-option-name">{o.name}</span>
                {(o.why ?? o.secondary) && <span className="picker-option-secondary">{o.why ?? o.secondary}</span>}
              </div>
            ))}
          </div>
          <div className="picker-footer">
            <Button size="sm" variant="tertiary" onClick={done}>
              {T.done}
            </Button>
            {!empty && <span className="picker-count">{fillText(T.results, { n: list.length })}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
