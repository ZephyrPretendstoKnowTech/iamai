import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COMPONENTS } from '../../copy/components.ts'
import { TIP_CLOSED, tipNext } from './tipState.ts'
import type { TipEvent } from './tipState.ts'

// An outlined "i" with a 24px target; the tip on hover or focus with a
// hairline (prompt 47 Part 1). Text is at most 25 words, which the contract
// measures. The tip renders in a portal at the top layer, positioned from the
// button's rectangle, and flips or shifts so it is never clipped.
//
// Hover and focus show it while they last; a press (click, tap, Enter or Space)
// keeps it open until the next press, Esc or a press elsewhere (tipState.ts,
// F-091). Hover used to open it, so the click that followed closed it, and
// Enter closed a tip focus had just opened. A tap fires focus and then click:
// focus shows it and the click keeps it (task 017). While it is open the button
// is described by it, so the text is announced rather than only drawn.
const GAP = 6
const MARGIN = 8

type Placement = { top: number; left: number; maxWidth: number }

function place(anchor: DOMRect, pop: { width: number; height: number }): Placement {
  // The scrollbar is not usable page space. innerWidth included it and placed
  // the right edge of phone-sized tips underneath the scrollbar.
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const maxWidth = Math.min(pop.width, vw - 2 * MARGIN)
  let left = anchor.left
  if (left + maxWidth > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - maxWidth)
  let top = anchor.bottom + GAP
  if (top + pop.height > vh - MARGIN && anchor.top - GAP - pop.height >= MARGIN) top = anchor.top - GAP - pop.height
  if (top + pop.height > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - pop.height)
  return { top, left, maxWidth }
}

export function InfoTip({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) {
  const [tip, setTip] = useState(TIP_CLOSED)
  const open = tip.open
  const send = (e: TipEvent): void => setTip((s) => tipNext(s, e))
  const [pos, setPos] = useState<Placement | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<number | null>(null)
  const id = useId()
  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  // The pointer crossing from the button to the tip leaves one and enters the other: a moment's grace.
  const leaveSoon = (e: TipEvent) => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => send(e), 150)
  }
  const showNow = (e: TipEvent) => {
    cancelClose()
    send(e)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t) && popRef.current && !popRef.current.contains(t)) send('outside')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') send('escape')
    }
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

  useLayoutEffect(() => {
    if (!open || !ref.current || !popRef.current) return
    const anchor = ref.current.getBoundingClientRect()
    const rect = popRef.current.getBoundingClientRect()
    setPos(place(anchor, { width: rect.width, height: rect.height }))
  // Width clamping can wrap the text onto more lines: measure that height too.
  }, [open, title, text, pos?.maxWidth])

  const popover = open
    ? createPortal(
        <span
          className="infotip-pop"
          role="tooltip"
          id={id}
          ref={popRef}
          style={pos ? { top: pos.top, left: pos.left, maxWidth: pos.maxWidth, visibility: 'visible' } : { top: 0, left: 0, visibility: 'hidden' }}
          onMouseEnter={() => showNow('hover')}
          onMouseLeave={() => leaveSoon('leave')}
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
    <span className="infotip" ref={ref} onMouseEnter={() => showNow('hover')} onMouseLeave={() => leaveSoon('leave')}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={COMPONENTS.infoTip.about(title)}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onFocus={() => showNow('focus')}
        onBlur={() => leaveSoon('blur')}
        onClick={(e) => {
          e.stopPropagation()
          showNow('press')
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      {popover}
    </span>
  )
}
