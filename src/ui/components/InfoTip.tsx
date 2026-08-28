import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.tsx'
import { COMPONENTS } from '../../copy/components.ts'

// ⓘ glyph with a hover/click popover: a title and one or two sentences.
// Replaces every "?" in the app. Keyboard: focus + Enter/Space toggles, Esc closes.
// The popover renders in a portal at the top layer, positioned from the
// button's viewport rectangle, and flips or shifts so it is never clipped by
// a parent or the window edge (ux-review-04 §3).
const GAP = 6
const MARGIN = 8

type Placement = { top: number; left: number; maxWidth: number }

function place(anchor: DOMRect, pop: { width: number; height: number }): Placement {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxWidth = Math.min(pop.width, vw - 2 * MARGIN)
  let left = anchor.left
  if (left + maxWidth > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - maxWidth)
  let top = anchor.bottom + GAP
  // Flip above when there is no room below and more room above.
  if (top + pop.height > vh - MARGIN && anchor.top - GAP - pop.height >= MARGIN) top = anchor.top - GAP - pop.height
  if (top + pop.height > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - pop.height)
  return { top, left, maxWidth }
}

export function InfoTip({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Placement | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<number | null>(null)
  const id = useId()
  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const closeSoon = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), 150)
  }
  const openNow = () => {
    cancelClose()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t) && popRef.current && !popRef.current.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Scrolling or resizing moves the anchor: follow it rather than vanish.
    const onMove = () => {
      if (!ref.current || !popRef.current) return
      const rect = popRef.current.getBoundingClientRect()
      setPos(place(ref.current.getBoundingClientRect(), { width: rect.width, height: rect.height }))
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  // Measure after the popover mounts, then place it against the button.
  useLayoutEffect(() => {
    if (!open || !ref.current || !popRef.current) return
    const anchor = ref.current.getBoundingClientRect()
    const rect = popRef.current.getBoundingClientRect()
    setPos(place(anchor, { width: rect.width, height: rect.height }))
  }, [open, title, text])

  const popover = open
    ? createPortal(
        <span
          className="infotip-pop"
          role="tooltip"
          id={id}
          ref={popRef}
          style={pos ? { top: pos.top, left: pos.left, maxWidth: pos.maxWidth, visibility: 'visible' } : { top: 0, left: 0, visibility: 'hidden' }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          <strong>{title}</strong>
          {text}
          {link && (
            <>
              {' '}
              <a href={link.href}>{link.label}</a>
            </>
          )}
        </span>,
        document.body,
      )
    : null

  return (
    <span className="infotip" ref={ref} onMouseEnter={openNow} onMouseLeave={closeSoon}>
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
      {popover}
    </span>
  )
}
