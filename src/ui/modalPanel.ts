// A side panel that is modal only where it covers the page (owner, 2026-09-19):
// MFA Readiness's person panel sits beside the list on a wide screen and covers
// all of it below the pack's 760. There the page behind it goes inert and Tab
// stays inside the panel, so a keyboard never lands on content it can't see.

/** The width at and below which the person panel covers the page (the pack's stacked-row breakpoint). */
export const COVERS_PAGE = '(max-width: 760px)'

/**
 * Makes everything outside `el` inert: each sibling of `el` and of every
 * ancestor up to the root. Returns the undo, which restores only what this call
 * changed and is safe to call twice.
 */
export function inertOutside(el: HTMLElement): () => void {
  const changed: HTMLElement[] = []
  for (let node: HTMLElement = el; node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children) as HTMLElement[]) {
      if (sibling === node || sibling.inert) continue
      sibling.inert = true
      changed.push(sibling)
    }
  }
  return () => {
    for (const s of changed.splice(0)) s.inert = false
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** Keeps Tab and Shift+Tab inside `el`: past the last control back to the first, and the reverse. */
export function keepTabInside(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>, el: HTMLElement): void {
  if (e.key !== 'Tab') return
  const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
  const at = el.ownerDocument.activeElement
  if (items.length === 0) {
    e.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const inside = at !== null && el.contains(at)
  if (e.shiftKey && (at === first || !inside)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (at === last || !inside)) {
    e.preventDefault()
    first.focus()
  }
}
