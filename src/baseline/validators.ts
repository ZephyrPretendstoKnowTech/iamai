// The baseline validators (baseline-onboarding §3): each names the finding that
// created it, and each is a test over the pinned baseline. A `must` finding
// would stop the import; a `warn`/`info` goes in the report and on the step. The
// validators that need the strength inventory, the goal map or the auth-methods
// layer are deferred with the case (prompt 51 Part 3); the ones checkable on the
// normalised policy objects are here. Pure.
import type { CaPolicy } from './types.ts'
import firstParty from '../../data/first-party-apps.json' with { type: 'json' }

export type Level = 'must' | 'warn' | 'info'
export type ValidatorFinding = { id: string; level: Level; policy: string; detail: string }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const s = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Run the policy-shape validators over a normalised (pinned) policy set. */
export function runBaselineValidators(policies: CaPolicy[]): ValidatorFinding[] {
  const out: ValidatorFinding[] = []
  for (const p of policies) {
    const u = p.conditions?.users ?? {}
    const grant = p.grantControls
    const hasGrant = s(grant?.builtInControls).length > 0 || Boolean(grant?.authenticationStrength)
    const session = p.sessionControls
    const hasSession = Boolean(session) && Object.keys(session as object).length > 0

    // A policy that is only the author's own break-glass hardening is not one of
    // our goals; it becomes a not-assessed Cleanup row and the goal validators do
    // not run on it (owner resolution).
    const notAssessed = /break.?glass/i.test(p.displayName)

    // excl-01 (must): emergency accounts are excluded through a group, never named as users.
    if (!notAssessed) for (const x of s(u.excludeUsers)) if (GUID.test(x)) out.push({ id: 'excl-01', level: 'must', policy: p.displayName, detail: `names a user (${x}) in excludeUsers; emergency accounts are excluded through the group` })

    // sess-01 (must): a grant policy carries no LIFETIME session control (periodic
    // sign-in frequency or persistence). Every-time frequency alongside a grant is
    // allowed — a reauth prompt is not a lifetime (owner resolution).
    const sc = session as { signInFrequency?: { isEnabled?: boolean; frequencyInterval?: string }; persistentBrowser?: unknown } | null
    const periodicFrequency = Boolean(sc?.signInFrequency && sc.signInFrequency.isEnabled !== false && sc.signInFrequency.frequencyInterval && sc.signInFrequency.frequencyInterval !== 'everyTime')
    const persistence = Boolean(sc && 'persistentBrowser' in sc && sc.persistentBrowser)
    if (hasGrant && (periodicFrequency || persistence)) out.push({ id: 'sess-01', level: 'must', policy: p.displayName, detail: 'a grant policy also carries a lifetime session control (periodic sign-in frequency or persistence)' })

    // sess-02 (must): never-persistent applies only with all resources targeted.
    if ((session as { persistentBrowser?: { mode?: string } } | null)?.persistentBrowser?.mode === 'never' && !s(p.conditions?.applications?.includeApplications).some((a) => /^all$/i.test(a)))
      out.push({ id: 'sess-02', level: 'must', policy: p.displayName, detail: 'never-persistent without all resources targeted (all tabs share one token)' })

    // ret-01 (must): no retired grant (Require approved client app, read-only since 2026-06-30).
    if (s(grant?.builtInControls).some((c) => /approvedApplication/i.test(c))) out.push({ id: 'ret-01', level: 'must', policy: p.displayName, detail: 'uses the retired Require approved client app' })

    // shape-01 (must): a policy step ends in a grant or a session control.
    if (!hasGrant && !hasSession) out.push({ id: 'shape-01', level: 'must', policy: p.displayName, detail: 'has neither a grant nor a session control' })

    // app-01 (warn): author-specific app exclusions should have been stripped at pin time.
    for (const a of s(p.conditions?.applications?.excludeApplications)) if (GUID.test(a) && !FIRST_PARTY_HINT.has(a.toLowerCase())) out.push({ id: 'app-01', level: 'warn', policy: p.displayName, detail: `an author-specific app exclusion (${a}) survived normalisation` })
  }
  return out
}

// The authoritative first-party list (the same one drives the strip at pin time);
// app-01 flags only a GUID exclusion that is NOT first-party and survived.
const FIRST_PARTY_HINT = new Set((firstParty as { apps: { appId: string }[] }).apps.map((a) => a.appId.toLowerCase()))
