// The three sections a plan cannot be built without: the Conditional Access
// policies, the people, and the sign-in records. A scan that could not read one
// of them ends with gaps: Connect lists them with the roles that read them, no
// plan is built or stored, and the last good plan and its record stay as they
// were. A section a licence withholds (sign-in records without Entra ID P1) is
// not a gap: there was nothing to read, and the plan says so where it matters.
// A section read in part is not a gap either — the plan is built from what came
// back — but it is never counted as read: `unreadSources()` names it, and
// Connect lists it under every finished scan, complete or not.
// Pure; the runner (ui/scan/useScanRunner.ts) decides from it.
import { isLicenceGate, isPrivilegeDenial, rolesForSource } from './roles.ts'
import type { ConfigSectionKey, SourceKey, TenantSnapshot } from './types.ts'

export const CORE_SOURCES = ['config:caPolicies', 'users', 'signInEvidence'] as const
export type CoreSource = (typeof CORE_SOURCES)[number]

export type CoreGap = {
  source: CoreSource
  /** Graph's reason, or null when the scan lacks the section altogether. */
  reason: string | null
  /** The least-privileged roles that read the section, from the registry. */
  roles: string[]
}

/**
 * A section the scan got data out of, whole or in part. It is the test for
 * BUILDING a plan, and only that: a partly read section returned real rows, and
 * the rest of the derivation (scoring/fromSnapshot.ts, derive/readinessContext.ts)
 * reads it the same way. It is NOT a test for "read": `unreadSources()` below
 * counts only `ok`, so a partly read section is always named on Connect.
 */
const BUILDABLE = new Set(['ok', 'partial'])

/**
 * Whether the scan got data out of a section, whole or in part: the one test a
 * surface asks before it draws a count, an empty list, "off" or "none" from it.
 * A refusal, an error, a licence gate or a section the scan lacks is no reading,
 * and the surface says the section was not read instead of drawing a zero.
 */
export function sectionHasData(snapshot: Pick<TenantSnapshot, 'config' | 'sources'>, key: ConfigSectionKey | SourceKey): boolean {
  return BUILDABLE.has(sectionState(snapshot, key)?.status ?? '')
}

/** A section as the scan left it, a configuration section or a source; undefined where the scan lacks it. */
export function sectionState(snapshot: Pick<TenantSnapshot, 'config' | 'sources'>, key: ConfigSectionKey | SourceKey): { status: string; reason: string | null } | undefined {
  return (CONFIG_KEYS as string[]).includes(key) ? snapshot.config?.[key as ConfigSectionKey] : snapshot.sources?.[key as SourceKey]
}

/**
 * A section read in part for a reason other than a licence: the one test of
 * "partly read", which `unreadSources()` marks partial and a surface says over
 * the rows it did get. A licence that withheld part of a section is not one.
 */
export function partlyRead(snapshot: Pick<TenantSnapshot, 'config' | 'sources'>, key: ConfigSectionKey | SourceKey): boolean {
  const s = sectionState(snapshot, key)
  return s?.status === 'partial' && !readAsFarAsLicensed(s)
}

/**
 * A section read in full: `ok`, the one status that means read. A section read
 * in part, whatever the reason, is not: "nobody" said over it is a claim about
 * rows the scan never saw.
 */
export function readInFull(snapshot: Pick<TenantSnapshot, 'config' | 'sources'>, key: ConfigSectionKey | SourceKey): boolean {
  return sectionState(snapshot, key)?.status === 'ok'
}

/**
 * A section the scan got no data out of for a reason other than a licence: a
 * refusal, an error, or a section the scan lacks. What it holds is not known,
 * where a licence gate means there was nothing to read.
 */
export function notReadDespiteLicence(snapshot: Pick<TenantSnapshot, 'config' | 'sources'>, key: ConfigSectionKey | SourceKey): boolean {
  return !sectionHasData(snapshot, key) && !isLicenceGate(sectionState(snapshot, key)?.reason)
}

function stateOf(snapshot: TenantSnapshot, source: CoreSource): { status: string; reason: string | null } | null {
  if (source === 'config:caPolicies') {
    const s = snapshot.config?.caPolicies
    return s ? { status: s.status, reason: s.reason } : null
  }
  const s = snapshot.sources?.[source]
  return s ? { status: s.status, reason: s.reason } : null
}

/**
 * The core sections the scan could not read, in registry order; empty when the
 * scan can build a plan.
 *
 * A section read in PART is not a gap. A gap builds and stores no plan at all
 * and leaves the last good plan standing, and a partial read did return rows:
 * throwing away everything the scan did see, because some of it did not arrive,
 * would leave the operator with less than they had and no way forward. So the
 * plan is built from what was read and the shortfall is *named* instead —
 * `unreadSources()` reports the partly read section and Connect lists it under
 * the scan, on the complete tile as much as the gaps one (S4-7).
 */
export function coreGaps(snapshot: TenantSnapshot): CoreGap[] {
  const gaps: CoreGap[] = []
  for (const source of CORE_SOURCES) {
    const s = stateOf(snapshot, source)
    if (s && BUILDABLE.has(s.status)) continue
    if (s && s.status === 'disabled' && isLicenceGate(s.reason)) continue
    gaps.push({ source, reason: s?.reason ?? null, roles: rolesForSource(source).least })
  }
  return gaps
}

/** Every section the scan reads, in scan order: the list the unread report walks. */
export const CONFIG_KEYS: ConfigSectionKey[] = ['caPolicies', 'namedLocations', 'authStrengths', 'authMethodsPolicy', 'securityDefaults', 'crossTenantAccess', 'deviceRegistrationPolicy', 'roleAssignments', 'roleAssignmentSchedules', 'pimEligibility', 'subscribedSkus', 'organization', 'me', 'meMemberOf']
export const SOURCE_KEYS: SourceKey[] = ['registrationDetails', 'users', 'devices', 'spActivity', 'authMethods', 'appSignInSummary', 'signInEvidence']

/**
 * A section a licence withheld, whole or in part: it was read as far as the
 * tenant's licensing allows, so it is not something a different account could
 * read and it never goes on the unread list. Without Entra ID P1 the directory
 * comes back `partial` because Graph withholds `signInActivity`, not because
 * users were refused — listing it would send an admin to ask for permissions
 * they already have (the owner's rule: without P1, say it once at the page
 * level, not once per section).
 */
const readAsFarAsLicensed = (s: { status: string; reason: string | null }): boolean =>
  (s.status === 'disabled' || s.status === 'partial') && isLicenceGate(s.reason)

export type UnreadSection = {
  /** The registry key, which carries the section's label (pages.app.scan.sections). */
  source: string
  /**
   * Some of it arrived and some did not, so the plan is built on less than the
   * tenant holds. A sign-in read stopped short of its minimum ('insufficient')
   * or by an error, with a covered window, returned those hours: that is a read
   * in part too (readInPart).
   */
  partial: boolean
  /**
   * Graph refused the signed-in account (roles.ts isPrivilegeDenial): the one
   * reason another account or role could change. An error, a throttled read or
   * a read stopped short is not the account's doing, and Connect never says it
   * is. A section the scan lacks altogether has no reason, and is not a refusal.
   */
  refused: boolean
  /**
   * A read stopped short of its minimum with some hours covered (the sign-in
   * records, 'insufficient' or an error: readInPart): how many whole hours its
   * covered window holds. Absent for every other section and state.
   */
  coveredHours?: number
}

/**
 * Whether a read returned some of a section and not all of it: a read marked
 * partial, or one that stopped after it had covered some hours, short of the
 * sign-in read's minimum ('insufficient') or on an error (laneBCore.ts keeps
 * the window it covered on every stop). The one rule for "read in part": the
 * unread list below and the plan's evidence (roadmap/evidence.ts
 * sourceUnreadOf) both ask it, so a read cannot be "not read" on Connect and a
 * short window in the plan.
 */
export function readInPart(s: { status: string; coveredWindow?: unknown }): boolean {
  return s.status === 'partial' || ((s.status === 'error' || s.status === 'insufficient') && !!s.coveredWindow)
}

/** One unread section, classified once from the state the scan recorded for it. */
const unreadOf = (source: string, s: { status: string; reason: string | null; coveredWindow?: { from: string; to: string } | null }): UnreadSection => {
  const out: UnreadSection = { source, partial: readInPart(s), refused: isPrivilegeDenial(s.reason) }
  // Stopped short of the minimum with a window: the hours it holds, which the
  // collector's own stop rule measured the same way (laneBCore.ts: now back to
  // the oldest record read).
  if (out.partial && s.status !== 'partial' && s.coveredWindow) out.coveredHours = Math.floor((Date.parse(s.coveredWindow.to) - Date.parse(s.coveredWindow.from)) / 3_600_000)
  return out
}

/**
 * Every section the scan did not read in full (a refusal, an error, or a read
 * that returned only part of the section — never a licence gate), in scan
 * order: the configuration sections, then the sources, then the directory
 * audit read. A core section the scan lacks altogether counts; any other
 * missing key does not.
 *
 * `ok` is the only status that means read. `partial` is reported here for both
 * the configuration sections and the sources, marked as such, because a section
 * the scan half saw is the one thing the plan cannot warn about by itself: the
 * policy it did not see reads exactly like a policy the tenant does not have.
 */
export function unreadSources(snapshot: TenantSnapshot): UnreadSection[] {
  const out: UnreadSection[] = []
  for (const key of CONFIG_KEYS) {
    const s = snapshot.config?.[key]
    const source = `config:${key}`
    if (!s) {
      if ((CORE_SOURCES as readonly string[]).includes(source)) out.push({ source, partial: false, refused: false })
      continue
    }
    if (s.status === 'ok') continue
    if (readAsFarAsLicensed(s)) continue
    out.push(unreadOf(source, s))
  }
  for (const key of SOURCE_KEYS) {
    const s = snapshot.sources?.[key]
    if (!s) {
      if ((CORE_SOURCES as readonly string[]).includes(key)) out.push({ source: key, partial: false, refused: false })
      continue
    }
    if (s.status === 'ok') continue
    if (readAsFarAsLicensed(s)) continue
    out.push(unreadOf(key, s))
  }
  // The directory audit read beside the sign-in records (laneB.ts), stored apart
  // from them: every automatic recovery-test check needs it, so a scan that
  // tried it and failed says so like any other section. A snapshot from before
  // the read existed recorded no state for it, and is not said to have failed.
  const audit = snapshot.recoveryAuditSource
  if (audit && audit.status !== 'ok' && !readAsFarAsLicensed(audit)) out.push(unreadOf('recoveryAudit', audit))
  return out
}
