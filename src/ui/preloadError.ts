// A chunk that fails to load after a deploy (Vite's vite:preloadError: the old
// page asks for a file the new build no longer ships) reloads the page once,
// so the person gets the new build instead of the error page. Once, per
// session: a second failure in the same session falls through to the error
// page, whose Reload is theirs to press. Pure core, so the once is testable.
export const PRELOAD_RELOAD_KEY = 'iamai.preloadReloaded'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Reload once: true when this call reloaded, false when a reload already happened this session. */
export function reloadOnceOnPreloadError(store: Store, reload: () => void): boolean {
  let done = false
  try {
    done = store.getItem(PRELOAD_RELOAD_KEY) === '1'
    if (!done) store.setItem(PRELOAD_RELOAD_KEY, '1')
  } catch {
    // storage unavailable: reload anyway, once per page
  }
  if (done) return false
  reload()
  return true
}

/** Listen for Vite's preload failures; a handled one is prevented so the importer never sees the error. */
export function installPreloadErrorReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceOnPreloadError(window.sessionStorage, () => window.location.reload())) event.preventDefault()
  })
}
