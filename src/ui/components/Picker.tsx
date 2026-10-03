import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.tsx'
import { Button } from './Button.tsx'
import { app } from '../../content/content.ts'
import { pickerList } from './pickerList.ts'

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
  confirmRemoval,
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
  /**
   * Taking a chip off asks first, with this question for the chip (F-007: one
   * click on the × beside an emergency access account saved at once, removed a
   * plan step and turned the exclusions advice against the account). Keep is
   * focused; Take it off removes and saves as any removal does. Pickers without
   * it save a removal at once (owner, 2026-09-23, #15).
   */
  confirmRemoval?: (chip: PickerOption) => string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  // The chip whose removal is being asked about (confirmRemoval), and where focus
  // goes when the question closes: the chip kept, or the next chip or the search.
  const [pending, setPending] = useState<PickerOption | null>(null)
  const focusAfter = useRef<string | null>(null)
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
  const commitIfChanged = (): void => {
    if (idsOf(latest.current) !== openedWith.current) save(latest.current)
  }
  const close = (): void => {
    setOpen(false)
    commitIfChanged()
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
    // A press outside saves what the picker saves on leaving it at once, as
    // before, and hides the list when the press ends, not when it starts: the
    // list sits in the page's flow, so hiding it on mousedown moved the button
    // under the pointer and its click never landed (N-034: Save Countries saved
    // on the second click only).
    const onDoc = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      commitIfChanged()
      document.addEventListener('mouseup', () => setOpen(false), { once: true })
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])
  const empty = query.trim().length === 0
  const { list, count, none } = pickerList({ empty, listAll, options, suggestions, selectedIds })
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
  const removeId = (id: string): string => `${base}-remove-${id}`
  const keep = (): void => {
    if (pending) focusAfter.current = removeId(pending.id)
    setPending(null)
  }
  const takeOff = (): void => {
    if (!pending) return
    const at = selected.findIndex((s) => s.id === pending.id)
    const after = selected[at + 1] ?? selected[at - 1] ?? null
    focusAfter.current = after ? removeId(after.id) : `${base}-search`
    setPending(null)
    remove(pending.id)
  }
  useEffect(() => {
    if (pending !== null || focusAfter.current === null) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  }, [pending, selected])

  return (
    <div className="picker" ref={ref} role="group" aria-labelledby={labelledBy}>
      {selected.length > 0 && (
        <div className="picker-chips">
          {selected.map((s) => (
            <span key={s.id} className="chip-select">
              <span className="chip-name">{s.name}</span>
              {s.badge && <span className="chip-badge">{s.badge}</span>}
              {!readOnly && <button type="button" className="chip-remove" id={removeId(s.id)} aria-label={`${T.remove} ${s.name}`} title={T.remove} onClick={() => (confirmRemoval ? setPending(s) : remove(s.id))}>
                <Icon name="close" size={12} />
              </button>}
            </span>
          ))}
        </div>
      )}
      {pending && confirmRemoval && (
        <div className="picker-confirm" role="alertdialog" aria-labelledby={`${base}-confirm`} key={pending.id} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); keep() } }}>
          <p id={`${base}-confirm`}>{confirmRemoval(pending)}</p>
          <div className="picker-confirm-actions">
            <Button size="sm" variant="secondary" autoFocus onClick={keep}>
              {T.keep}
            </Button>
            <Button size="sm" variant="secondary" onClick={takeOff}>
              {T.takeOff}
            </Button>
          </div>
        </div>
      )}
      {!readOnly && <div className="picker-search">
        <Icon name="search" className="picker-search-icon" />
        <input
          type="search"
          id={`${base}-search`}
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
          {none !== null && !loading && <div className="picker-footer">{none}</div>}
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
            {count !== null && <span className="picker-count">{count}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
