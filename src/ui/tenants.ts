// The tenants this browser knows (T3-A, owner D1 2026-10-03): the ones it holds
// records for and the ones an account is signed in to in this tab, for the
// Account menu's switcher. One tenant is open at a time; the others wait in the
// store until they are opened again or forgotten.
//
// Pure: the list and the move a choice makes are decided here, so Node tests
// can hold them. The reads (the store's keys, MSAL's accounts) and the moves
// themselves (the redirect, the active account, the restore) are ui/actions.ts's.
import type { AccountInfo } from '@azure/msal-browser'
import { app } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { relativeDays } from '../copy/dates.ts'

/** A tenant this browser holds records for: its id, and what its stored scan names, where it has one. */
export type StoredTenant = {
  tenantId: string
  /** The organisation's name, from the stored scan's organization read. */
  name: string | null
  /** The account that ran the stored scan (its `me` read): the login hint when the tenant is opened again. */
  signedInAs: string | null
  /** When the stored scan was saved (ScanRecord.at); null with none. */
  scannedAt?: string | null
}

/** One row of the switcher. */
export type TenantEntry = {
  tenantId: string
  name: string | null
  /** The account signed in to this tenant in this tab; null when choosing it needs a sign-in. */
  account: AccountInfo | null
  /** Who to suggest at the sign-in: the signed-in account, else the one that scanned. */
  loginHint: string | null
  /** This browser holds records for it, so it can be forgotten. */
  stored: boolean
  /** The tenant open now. */
  current: boolean
  /** When its stored scan was saved; null with none. */
  scannedAt: string | null
  /**
   * The name the row shows: tenantLabel, and where another row reads the same,
   * the account's domain beside it (or the start of the tenant id where the
   * domains match too), so two customers both called Contoso read apart (as
   * F-164 did for the wrong-tenant message).
   */
  label: string
}

/** What choosing a row does: nothing (it is open), open a signed-in account's tenant, or sign in to it. */
export type SwitchMove = { kind: 'stay' } | { kind: 'open'; account: AccountInfo } | { kind: 'signIn'; loginHint: string | null }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A key that names a real tenant: an Entra tenant id is a GUID. The sample's
 * records (demoMode.ts) share the database under ids that are not, and are
 * never a tenant to switch to or forget from here.
 */
export function isTenantId(id: string): boolean {
  return GUID.test(id)
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

/** What a stored scan record says about its tenant: the organisation's name and who scanned it. Anything else in it is not read. */
export function storedTenantOf(tenantId: string, record: unknown): StoredTenant {
  const config = (record as { snapshot?: { config?: Record<string, { rows?: unknown[] } | undefined> } } | null)?.snapshot?.config
  const org = config?.organization?.rows?.[0] as { displayName?: unknown } | undefined
  const me = config?.me?.rows?.[0] as { userPrincipalName?: unknown } | undefined
  return { tenantId, name: text(org?.displayName), signedInAs: text(me?.userPrincipalName), scannedAt: text((record as { at?: unknown } | null)?.at) }
}

/**
 * The switcher's rows: every stored tenant and every tenant an account is
 * signed in to, once each, the open one first and marked, the rest by name.
 * The open tenant is the session's own account, whatever MSAL lists, and its
 * name is the one the header shows.
 */
export function tenantEntries(stored: readonly StoredTenant[], accounts: readonly AccountInfo[], current: AccountInfo | null, currentName: string | null): TenantEntry[] {
  const rows = new Map<string, TenantEntry>()
  const row = (tenantId: string): TenantEntry => {
    let r = rows.get(tenantId)
    if (!r) {
      r = { tenantId, name: null, account: null, loginHint: null, stored: false, current: false, scannedAt: null, label: '' }
      rows.set(tenantId, r)
    }
    return r
  }
  for (const s of stored) {
    if (!isTenantId(s.tenantId)) continue
    const r = row(s.tenantId)
    r.stored = true
    r.name ??= s.name
    r.loginHint ??= s.signedInAs
    r.scannedAt ??= s.scannedAt ?? null
  }
  for (const a of accounts) {
    const r = row(a.tenantId)
    if (r.account) continue
    r.account = a
    r.loginHint = text(a.username) ?? r.loginHint
  }
  if (current) {
    const r = row(current.tenantId)
    r.current = true
    r.account = current
    r.name = currentName ?? r.name
    r.loginHint = text(current.username) ?? r.loginHint
  }
  const all = [...rows.values()]
  for (const r of all) r.label = tenantLabel(r)
  // Rows that read the same name: each gets its account's domain, or the start
  // of its tenant id where the domains do not tell them apart.
  const byName = new Map<string, TenantEntry[]>()
  for (const r of all) byName.set(r.label.toLowerCase(), [...(byName.get(r.label.toLowerCase()) ?? []), r])
  for (const same of byName.values()) {
    if (same.length < 2) continue
    const domains = same.map((r) => r.loginHint?.split('@')[1]?.toLowerCase() ?? null)
    const apart = domains.every((d) => d !== null) && new Set(domains).size === same.length
    same.forEach((r, i) => { r.label = fillText(app.shell.tenantDisambiguated, { tenant: r.label, detail: apart ? domains[i]! : r.tenantId.slice(0, 8) }) })
  }
  return all.sort((a, b) => Number(b.current) - Number(a.current) || a.label.localeCompare(b.label))
}

/**
 * How long ago a tenant that is not open was last scanned (owner, 2026-10-04): a
 * consultant sees which customer's plan is stale before opening it. Null for
 * the open tenant (the header says it) and for one with no stored scan.
 */
export function tenantScanAge(entry: Pick<TenantEntry, 'current' | 'scannedAt'>, nowMs = Date.now()): string | null {
  if (entry.current || !entry.scannedAt) return null
  return fillText(app.shell.tenantScanned, { age: relativeDays(entry.scannedAt, nowMs) })
}

/** A row's name: the organisation's, else the account's, else the tenant id. */
export function tenantLabel(entry: Pick<TenantEntry, 'tenantId' | 'name' | 'loginHint'>): string {
  return entry.name ?? entry.loginHint ?? fillText(app.shell.tenantUnnamed, { id: entry.tenantId })
}

/** What choosing a row does. */
export function switchMove(entry: TenantEntry): SwitchMove {
  if (entry.current) return { kind: 'stay' }
  if (entry.account) return { kind: 'open', account: entry.account }
  return { kind: 'signIn', loginHint: entry.loginHint }
}

/** A row Forget may delete from the switcher: stored here, and not the open tenant (that one is the menu's own Forget this tenant). */
export function forgettable(entry: TenantEntry): boolean {
  return entry.stored && !entry.current
}

