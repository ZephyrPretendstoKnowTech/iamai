// The (i)'s open state (ui/components/InfoTip.tsx), as a pure reducer so every
// gesture is testable without a browser (F-091).
//
// Hover and focus show the tip for as long as the pointer or focus stays; a
// press (a click, a tap, Enter or Space) keeps it open until the next press, Esc
// or a press elsewhere. Before, hover opened it, so the click that followed
// closed it, and Enter closed a tip that focus had just opened.

export type TipState = { open: boolean; pinned: boolean }
export type TipEvent = 'hover' | 'leave' | 'focus' | 'blur' | 'press' | 'escape' | 'outside'

export const TIP_CLOSED: TipState = { open: false, pinned: false }

export function tipNext(s: TipState, e: TipEvent): TipState {
  switch (e) {
    case 'hover':
    case 'focus':
      return s.open ? s : { open: true, pinned: false }
    case 'leave':
    case 'blur':
      return s.pinned ? s : TIP_CLOSED
    case 'press':
      return s.pinned ? TIP_CLOSED : { open: true, pinned: true }
    case 'escape':
    case 'outside':
      return TIP_CLOSED
  }
}
