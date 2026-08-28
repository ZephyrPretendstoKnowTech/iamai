import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon.tsx'
import { COMPONENTS } from '../../copy/components.ts'

// ⓘ glyph with a hover/click popover: a title and one or two sentences.
// Replaces every "?" in the app. Keyboard: focus + Enter/Space toggles, Esc closes.
export function InfoTip({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span className="infotip" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={COMPONENTS.infoTip.about(title)}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation() // never toggles a clickable tile around it
          setOpen((o) => !o)
        }}
      >
        <Icon name="info" size={16} />
      </button>
      {open && (
        <span className="infotip-pop" role="tooltip" id={id}>
          <strong>{title}</strong>
          {text}
        </span>
      )}
    </span>
  )
}
