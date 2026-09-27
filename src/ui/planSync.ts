// A tab that another tab has saved over stops saving (F-161).
//
// Every tab holds its own copy of a tenant's plan record and mapping and saves
// the whole of it on the next change. Two tabs used to overwrite each other in
// silence: a tab left open from yesterday, clicked once, put back yesterday's
// plan over today's answers, completions or a plan file just loaded in the
// other tab. Now each save is announced to the other tabs of this browser, with
// what was saved. A tab whose own copy differs is behind: it stops saving, and
// the shell asks for a reload before anything changes there.
//
// Every save is announced, and compared with the receiver's own last save:
// opening a second tab is not a change, since its first save writes the same
// words as the first tab's copy, and nobody is behind. A scan's save carries the
// new scan's facts and is a change. A tab that has loaded a store but not yet
// saved it holds LOADED for it, so any save announced meanwhile leaves it behind.
//
// The sample tenant is left out: it re-dates itself on every load, so two sample
// tabs never hold the same words, and nothing real can be lost there.

import { DEMO_TENANT_ID } from './demoMode.ts'

const CHANNEL = 'iamai-plan'

/** A store this tab has loaded and not yet saved: no announced save matches it. */
export const LOADED = 'loaded'

const sample = (tenantId: string): boolean => tenantId === DEMO_TENANT_ID

/** What a tab saved: the plan record, the mapping, or everything (a plan file loaded, the tenant forgotten). */
export type SavedStore = 'plan' | 'mapping' | 'replaced'
/** One tab's announcement: which tenant, which store, and its saved content as a key. */
export type PlanSaved = { tab: string; tenantId: string; store: SavedStore; key: string }
/** This tab's copy of a tenant's two stores, as keys; null before it has one. */
export type OwnCopy = { plan: string | null; mapping: string | null }

/** Whether another tab's save leaves this tab's copy behind: the tenant's whole record replaced, or a store saved with content this tab does not hold. */
export function leavesBehind(saved: Pick<PlanSaved, 'store' | 'key'>, own: OwnCopy | undefined): boolean {
  if (!own) return false
  if (saved.store === 'replaced') return true
  const mine = saved.store === 'plan' ? own.plan : own.mapping
  return mine !== null && mine !== saved.key
}

const TAB = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Math.random())
const own = new Map<string, OwnCopy>()
const behind = new Set<string>()
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null | undefined

function open(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  try {
    channel = new BroadcastChannel(CHANNEL)
    // Node's channel would keep a test process alive; a browser has no unref.
    ;(channel as unknown as { unref?: () => void }).unref?.()
    channel.addEventListener('message', (e: MessageEvent<PlanSaved>) => {
      const saved = e.data
      if (!saved || saved.tab === TAB || behind.has(saved.tenantId)) return
      if (!leavesBehind(saved, own.get(saved.tenantId))) return
      behind.add(saved.tenantId)
      for (const l of listeners) l()
    })
  } catch {
    // No BroadcastChannel: each tab saves as it did before.
    channel = null
  }
  return channel
}

/** This tab now holds this content for a tenant's store: it loaded it, or saved it. */
export function noteOwn(tenantId: string, store: 'plan' | 'mapping', key: string): void {
  if (sample(tenantId)) return
  open()
  own.set(tenantId, { ...(own.get(tenantId) ?? { plan: null, mapping: null }), [store]: key })
}

/**
 * Tell the other tabs this tab saved a tenant's store (after the write
 * succeeded). A tab that replaced the whole record (a plan file loaded here, or
 * the tenant forgotten) holds the latest one, so it is no longer behind.
 */
export function announceSaved(tenantId: string, store: SavedStore, key = ''): void {
  if (sample(tenantId)) return
  if (store !== 'replaced') noteOwn(tenantId, store, key)
  else {
    own.delete(tenantId)
    if (behind.delete(tenantId)) for (const l of listeners) l()
  }
  open()?.postMessage({ tab: TAB, tenantId, store, key } satisfies PlanSaved)
}

/** Whether another tab saved this tenant's plan since this tab's copy was made; while it has, this tab saves nothing. */
export function isBehind(tenantId: string | null | undefined): boolean {
  return !!tenantId && behind.has(tenantId)
}

export function subscribeBehind(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
