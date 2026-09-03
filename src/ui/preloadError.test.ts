// A chunk that fails to load reloads the page once per session: the first
// failure reloads and marks the session, the second falls through to the error
// page; a blocked storage still reloads.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRELOAD_RELOAD_KEY, reloadOnceOnPreloadError } from './preloadError.ts'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m }
}

test('the first preload failure reloads and marks the session; the second does not reload', () => {
  const store = memory()
  let reloads = 0
  assert.equal(reloadOnceOnPreloadError(store, () => reloads++), true)
  assert.equal(reloads, 1)
  assert.equal(store.map.get(PRELOAD_RELOAD_KEY), '1')
  assert.equal(reloadOnceOnPreloadError(store, () => reloads++), false)
  assert.equal(reloads, 1, 'once per session')
})

test('a storage that throws still reloads', () => {
  let reloads = 0
  const broken = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
  assert.equal(reloadOnceOnPreloadError(broken, () => reloads++), true)
  assert.equal(reloads, 1)
})
