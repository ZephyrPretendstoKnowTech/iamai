// MFA Readiness's tenant setup checks (prompt 62, segment 3): can people in this
// tenant set up phishing-resistant sign-in at all? Each check is read from the
// scan and the readiness context once, names what an admin can see and change,
// and counts the people it blocks. Satisfied checks collapse; an unknown check
// says which read it is missing.
//
// The next check (`nextCheck`) is the one action that moves the most people: a
// setup check takes the slot when it blocks more people than the largest group
// of people waiting on their own action (a tie goes to setup, because those
// people cannot act until it lands). Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { AUTHENTICATOR_AAGUIDS, passkeyAllowed } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import type { ReadinessRow, ReadinessView } from './mfaReadiness.ts'
import { GROUP_ORDER } from './mfaReadiness.ts'

export type SetupKey = 'passkeyOn' | 'phonePasskey' | 'registration' | 'windowsHello' | 'tap' | 'migration' | 'step3' | 'attestation'
export type SetupOutcome = 'pass' | 'fail' | 'unknown' | 'note'
export type SetupCheck = { key: SetupKey; outcome: SetupOutcome; /** People this check stops from acting, where it fails. */ affects: number; /** The reason for an unknown check. */ reason: string | null }

const object = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

function methodConfig(snapshot: TenantSnapshot, id: string): { read: boolean; state: string | null } {
  const section = snapshot.config.authMethodsPolicy
  const row = section?.status === 'ok' || section?.status === 'partial' ? object(section.rows?.[0]) : null
  const configs = Array.isArray(row?.authenticationMethodConfigurations) ? (row?.authenticationMethodConfigurations as unknown[]) : null
  if (!configs) return { read: false, state: null }
  const c = configs.map(object).find((x) => String(x?.id ?? '').toLowerCase() === id)
  return { read: true, state: typeof c?.state === 'string' ? c.state : null }
}

/**
 * The policy's migration state: undefined where the policy was not read; null
 * where it was read and reports none (a tenant created after Microsoft retired the
 * legacy MFA and SSPR settings has nothing to migrate).
 */
function migrationState(snapshot: TenantSnapshot): string | null | undefined {
  const section = snapshot.config.authMethodsPolicy
  const row = section?.status === 'ok' || section?.status === 'partial' ? object(section.rows?.[0]) : null
  if (!row) return undefined
  return typeof row.policyMigrationState === 'string' ? row.policyMigrationState : null
}

const countWhere = (rows: readonly ReadinessRow[], f: (r: ReadinessRow) => boolean): number => rows.filter((r) => r.state !== null && f(r)).length

/** Every setup check, in the order the tile lists them. */
export function tenantSetupChecks(snapshot: TenantSnapshot, view: ReadinessView): SetupCheck[] {
  const ctx = view.context
  const rows = view.rows
  const needs = (r: ReadinessRow): boolean => r.state === 'method' || r.state === 'blocked'
  const p = ctx.passkey
  const checks: SetupCheck[] = []
  // 1. Passkey registration is on for everyone.
  const on: SetupOutcome = !p.read ? 'unknown' : p.enabled === true && p.selfService !== false ? 'pass' : p.enabled === false || p.selfService === false ? 'fail' : 'unknown'
  checks.push({ key: 'passkeyOn', outcome: on, affects: on === 'fail' ? countWhere(rows, needs) : 0, reason: !p.read ? 'passkeySettingsUnread' : null })
  // 2. Phones can hold a passkey: both Microsoft Authenticator models allowed.
  const phone = AUTHENTICATOR_AAGUIDS.map((a) => passkeyAllowed(p, a))
  const phoneOutcome: SetupOutcome = phone.every((v) => v === 'yes') ? 'pass' : phone.some((v) => v === 'no') ? 'fail' : 'unknown'
  checks.push({ key: 'phonePasskey', outcome: phoneOutcome, affects: phoneOutcome === 'fail' ? countWhere(rows, (r) => needs(r) && (r.readiness?.devices ?? []).some((d) => d.type === 'phone')) : 0, reason: phoneOutcome === 'unknown' ? 'passkeySettingsUnread' : null })
  // 3. People can register from where they work.
  const reg: SetupOutcome = ctx.registration === 'open' ? 'pass' : ctx.registration === 'trustedOnly' ? 'fail' : 'unknown'
  checks.push({ key: 'registration', outcome: reg, affects: reg === 'fail' ? countWhere(rows, (r) => r.readiness?.blocked === 'registrationLocation') : 0, reason: reg === 'unknown' ? 'policiesUnread' : null })
  // 4. Windows Hello for Business works on joined computers. Judged by the outcome
  // (owner decision, 2026-09-18: no Intune permission): somebody signing in with it on
  // a Windows computer proves it is switched on here; joined computers where nobody
  // does are a thing to confirm, never a failure; no joined computer, nothing to do.
  const devices = rows.filter((r) => r.state !== null).flatMap((r) => r.readiness?.devices ?? [])
  const seen = devices.some((d) => d.os === 'Windows' && d.proof?.cls === 'windowsHello')
  const joined = devices.some((d) => d.os === 'Windows' && (d.trust === 'joined' || d.trust === 'hybrid'))
  if (ctx.whfb === 'disabled') checks.push({ key: 'windowsHello', outcome: 'fail', affects: countWhere(rows, (r) => (r.readiness?.devices ?? []).some((d) => d.whyNot === 'notProvisioned')), reason: null })
  else if (seen || ctx.whfb === 'enabled') checks.push({ key: 'windowsHello', outcome: 'pass', affects: 0, reason: 'seen' })
  else if (joined) checks.push({ key: 'windowsHello', outcome: 'unknown', affects: 0, reason: 'notSeen' })
  else checks.push({ key: 'windowsHello', outcome: 'pass', affects: 0, reason: 'noJoined' })
  // 5. Temporary Access Pass, for somebody with no method at all.
  const tap = methodConfig(snapshot, 'temporaryaccesspass')
  const tapOutcome: SetupOutcome = !tap.read ? 'unknown' : tap.state === 'enabled' ? 'pass' : 'fail'
  checks.push({ key: 'tap', outcome: tapOutcome, affects: tapOutcome === 'fail' ? countWhere(rows, (r) => needs(r) && r.viability?.mfaCapable === false) : 0, reason: !tap.read ? 'methodsPolicyUnread' : null })
  // 6. The authentication-methods policy migration is complete.
  const mig = migrationState(snapshot)
  const migOutcome: SetupOutcome = mig === undefined ? 'unknown' : mig === null || mig === 'migrationComplete' ? 'pass' : 'fail'
  checks.push({ key: 'migration', outcome: migOutcome, affects: 0, reason: mig === undefined ? 'methodsPolicyUnread' : mig === null ? 'noState' : null })
  // 7. Emergency Access Step 3's passkey settings are the tenant's: keys are checked against them.
  checks.push({ key: 'step3', outcome: ctx.step3.applied ? 'pass' : 'note', affects: 0, reason: null })
  // 8. Attestation's consequence: never a failure.
  checks.push({ key: 'attestation', outcome: p.attestation === true ? 'note' : 'pass', affects: 0, reason: null })
  return checks
}

/** The checks still to do: failed first by the people they block, then unknown. */
export function remainingChecks(checks: readonly SetupCheck[]): SetupCheck[] {
  return checks.filter((c) => c.outcome === 'fail' || c.outcome === 'unknown').sort((a, b) => (a.outcome === b.outcome ? b.affects - a.affects : a.outcome === 'fail' ? -1 : 1))
}

/** The actionable groups of people, in the worklist's order. */
export const ACTION_STATES: readonly ReadinessState[] = GROUP_ORDER.filter((s) => s !== 'ready' && s !== 'seamless')

export type NextCheck = { kind: 'setup'; check: SetupCheck } | { kind: 'group'; state: ReadinessState } | { kind: 'none' }

/**
 * The one next check. A failing setup check that blocks more people than the
 * largest group waiting on its own action takes the slot (a tie goes to setup);
 * otherwise the largest group a person can act on (never Unknown, which waits on
 * IAMAI, and never Blocked, which waits on the setup check that owns it).
 */
export function nextCheck(view: ReadinessView, checks: readonly SetupCheck[]): NextCheck {
  const setup = remainingChecks(checks).find((c) => c.outcome === 'fail' && c.affects > 0) ?? null
  const groups = (['method', 'confirm', 'device'] as const).map((s) => ({ state: s, n: view.counts[s] })).filter((g) => g.n > 0).sort((a, b) => b.n - a.n)
  const largest = groups[0] ?? null
  if (setup && (!largest || setup.affects >= largest.n)) return { kind: 'setup', check: setup }
  if (largest) return { kind: 'group', state: largest.state }
  if (setup) return { kind: 'setup', check: setup }
  return { kind: 'none' }
}
