// A page tip's collapse, remembered per page in the browser (localStorage), so
// a ? closed on Plan stays closed on the next visit and reopens on a click.
// The store is injectable, so a test can prove the collapse survives a reload.
export type TipStore = { getItem(key: string): string | null; setItem(key: string, value: string): void }

const KEY = (page: string): string => `iamai.tip.${page}`

function browserStore(): TipStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** True when the page's tip was collapsed and not reopened. */
export function tipCollapsed(page: string, store: TipStore | null = browserStore()): boolean {
  try {
    return store?.getItem(KEY(page)) === 'closed'
  } catch {
    return false
  }
}

/** Remember the page's tip as collapsed or open. */
export function setTipCollapsed(page: string, collapsed: boolean, store: TipStore | null = browserStore()): void {
  try {
    store?.setItem(KEY(page), collapsed ? 'closed' : 'open')
  } catch {
    // No storage: the tip stays as rendered for this visit.
  }
}
