// A synthetic tenant's interactive sign-in log, generated on demand by index:
// record k is the k-th newest counted from `anchorMs`, three records to a
// second, `spacingS` seconds between seconds. Nothing is held, so a test can
// read hundreds of thousands of records through the real runLaneB, and the
// same record (same id, same time) exists for every scan of the same anchor.
//
// fakeGraph answers the page URLs runLaneB asks for: 'start' (the newest
// first) or 'le:<iso>' (those created at or before it), with '#<index>' for
// the pages after the first, as Graph's nextLink does.
import firstParty from '../../data/first-party-apps.json' with { type: 'json' }
import { mapRow } from '../graph/collect/laneBCore.ts'
import { SIGN_IN_PAGE_SIZE } from '../graph/collect/constants.ts'
import type { StoredSignIn } from '../graph/collect/types.ts'

export const PEOPLE = 2_000
/** Records per second: three different people, nobody twice in one second. */
export const RUN = 3

export type SynthOpts = { seed: number; anchorMs: number; spacingS?: number }

export const personId = (n: number): string => `person-${String(n).padStart(4, '0')}`
export const policyId = (n: number): string => `policy-${String(n).padStart(2, '0')}`

function hash(seed: number, n: number, salt: number): number {
  let h = Math.imul(seed ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(n + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(salt + 0x27d4eb2f, 0x165667b1)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}

const spacingMs = (o: SynthOpts): number => (o.spacingS ?? 25) * 1000
/** The newest second a record can have: a whole second before the anchor. */
const top = (o: SynthOpts): number => Math.floor(o.anchorMs / 1000) * 1000 - 1000
export const rowTimeMs = (o: SynthOpts, k: number): number => top(o) - Math.floor(k / RUN) * spacingMs(o)
export const whole = (ms: number): string => new Date(ms).toISOString().replace('.000Z', 'Z')
/** The first record created at or before `ms`. */
export const firstIndexAtOrBefore = (o: SynthOpts, ms: number): number => (top(o) <= ms ? 0 : RUN * Math.ceil((top(o) - ms) / spacingMs(o)))

type App = { appId: string; displayName: string; role?: string }
const APPS = (firstParty as { apps: App[] }).apps
const POOL: App[] = [
  ...APPS.filter((a) => a.role === 'technician tool'),
  ...APPS.filter((a) => a.role === 'server sign-in'),
  ...APPS.filter((a) => a.role === 'device sign-in'),
  ...APPS.filter((a) => !a.role).slice(0, 10),
  { appId: 'c0ffee00-0000-4000-a000-000000000001', displayName: 'FortiClient VPN' },
  { appId: 'c0ffee00-0000-4000-a000-000000000002', displayName: 'Contoso HR' },
  { appId: 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c', displayName: 'Azure Portal' },
]
const OS = ['Windows 11', 'Windows 10', 'MacOs 14.4', 'iOS 17.5', 'Android 14', 'Linux', '']
const BROWSER = ['Chrome 118.0.0', 'Edge 118.0', 'Mobile Safari 17.1', 'Rich Client 4.61', '']
const TRUST = ['Azure AD joined', 'Hybrid Azure AD joined', 'Azure AD registered', '', undefined]
const RISK = ['none', 'none', 'none', 'none', 'low', 'medium', 'high', 'hidden']
const LEGACY = ['Exchange ActiveSync', 'IMAP4', 'Authenticated SMTP', 'Other clients']
const RESOURCE = ['Office 365 Exchange Online', 'Microsoft Graph', 'Microsoft Teams', 'Windows Azure Service Management API']
const pick = <T,>(xs: readonly T[], h: number): T => xs[h % xs.length]

/** Policy 07 is enforced in the seconds older than this many, report-only in the newer ones, and both in the second between. */
const p7Switch = (o: SynthOpts): number => Math.floor((10 * 86_400_000) / spacingMs(o))

/** Record k as Graph returns it. */
export function rawSignIn(o: SynthOpts, k: number): Record<string, unknown> {
  const h = (salt: number) => hash(o.seed, k, salt)
  const run = Math.floor(k / RUN)
  const person = ((hash(o.seed, run, 1) % PEOPLE) + (k % RUN) * 667) % PEOPLE
  const at = whole(rowTimeMs(o, k))
  const legacy = h(2) % 33 === 0
  const p0 = h(3) % 10 === 0 ? 'failure' : 'success'
  const p5 = legacy ? 'failure' : 'notApplied'
  const p7 = run < p7Switch(o) ? pick(['reportOnlySuccess', 'reportOnlyFailure'], h(4)) : run > p7Switch(o) ? pick(['success', 'failure'], h(4)) : k % RUN === 0 ? 'reportOnlySuccess' : 'success'
  const results = [p0, pick(['reportOnlySuccess', 'reportOnlyFailure', 'reportOnlyNotApplied'], h(5)), 'notApplied', 'notEnabled', pick(['reportOnlyInterrupted', 'reportOnlyNotApplied'], h(6)), p5, h(7) % 2 ? 'success' : 'notApplied', p7, 'reportOnlyNotApplied', 'notApplied', 'notEnabled', h(8) % 4 === 0 ? 'unknownFutureValue' : 'notApplied']
  const applied = results.map((result, n) => ({ id: policyId(n), displayName: `Policy ${n}`, result, enforcedGrantControls: [], conditionsSatisfied: 'none' }))
  const methodRoll = h(9) % 50
  const method = methodRoll === 0 ? 'Passkey (device-bound)' : methodRoll < 10 ? 'Mobile app notification' : methodRoll < 15 ? 'Text message' : methodRoll < 20 ? 'Windows Hello for Business' : null
  const detailsRoll = h(10) % 25
  const app = pick(POOL, h(11))
  const cross = h(12) % 50 === 0 ? 'b2bCollaboration' : h(12) % 97 === 1 ? 'serviceProvider' : 'none'
  const network = h(13) % 5
  const trust = pick(TRUST, h(14))
  return {
    id: `${h(15).toString(16).padStart(8, '0')}-${(o.seed & 0xffff).toString(16).padStart(4, '0')}-4000-8000-${k.toString(16).padStart(12, '0')}`,
    createdDateTime: at,
    userId: personId(person),
    appId: app.appId,
    appDisplayName: app.displayName,
    resourceId: '00000003-0000-0000-c000-000000000000',
    resourceDisplayName: pick(RESOURCE, h(16)),
    resourceTenantId: 'synthetic-resource-tenant',
    homeTenantId: cross === 'none' ? 'synthetic-home-tenant' : `partner-tenant-${h(17) % 3}`,
    isInteractive: true,
    status: { errorCode: h(18) % 20 === 0 ? 50074 : 0, failureReason: 'Other.' },
    clientAppUsed: legacy ? pick(LEGACY, h(19)) : h(19) % 2 ? 'Browser' : 'Mobile Apps and Desktop clients',
    authenticationProtocol: h(20) % 200 === 0 ? 'deviceCode' : h(20) % 151 === 0 ? 'ropc' : 'none',
    originalTransferMethod: h(21) % 300 === 0 ? 'deviceCodeFlow' : 'none',
    authenticationRequirement: h(22) % 2 ? 'multiFactorAuthentication' : 'singleFactorAuthentication',
    mfaDetail: method && h(23) % 3 === 0 ? { authMethod: method, authDetail: null } : null,
    authenticationDetails: detailsRoll === 0 ? null : [
      { authenticationMethod: 'Password', succeeded: true, authenticationStepDateTime: at, authenticationStepResultDetail: 'Correct password' },
      ...(method ? [{ authenticationMethod: method, succeeded: true, authenticationStepDateTime: at, authenticationStepResultDetail: detailsRoll === 1 ? 'MFA requirement satisfied by claim in the token' : 'MFA successfully completed' }] : []),
    ],
    conditionalAccessStatus: p0 === 'failure' || p5 === 'failure' || p7 === 'failure' ? 'failure' : 'success',
    appliedConditionalAccessPolicies: applied,
    location: { city: 'Somewhere', countryOrRegion: pick(['US', 'GB', 'DE', 'AU'], h(24)) },
    riskLevelDuringSignIn: pick(RISK, h(25)),
    riskLevelAggregated: pick(RISK, h(26)),
    crossTenantAccessType: cross,
    deviceDetail: {
      deviceId: h(27) % 3 === 0 ? '' : `device-${person}-${h(27) % 2}`,
      displayName: h(28) % 2 ? `PC-${person}` : '',
      operatingSystem: pick(OS, h(29)),
      browser: pick(BROWSER, h(30)),
      isCompliant: h(31) % 3 === 0,
      isManaged: h(32) % 4 === 0,
      ...(trust === undefined ? {} : { trustType: trust }),
    },
    networkLocationDetails: network === 0 ? [{ networkType: 'trustedNamedLocation', networkNames: ['HQ'] }] : network === 1 ? [{ networkType: 'namedLocation', networkNames: ['Branch'] }] : [],
  }
}

export type FakeGraphOpts = SynthOpts & {
  nowMs: number
  pageSize?: number
  /** The history ends after this many records (from the anchor); unbounded when absent. */
  historyRows?: number
  /** The n-th request (1-based) fails when this returns an Error, or true for a network failure. */
  failOn?: (url: string, n: number) => Error | boolean | null | undefined
  /** This record is sent twice: at the end of its page and again at the start of the next. */
  repeatRow?: number
  /** Records Graph has beside the generated ones, each served just before generated record `at`. */
  insert?: { at: number; raw: Record<string, unknown> }[]
  /** Changes a generated record as this fake serves it. */
  variant?: (k: number, raw: Record<string, unknown>) => void
}

export function fakeGraph(o: FakeGraphOpts) {
  const pageSize = o.pageSize ?? SIGN_IN_PAGE_SIZE
  const end = o.historyRows ?? Number.POSITIVE_INFINITY
  const first = firstIndexAtOrBefore(o, o.nowMs)
  const urls: string[] = []
  const raw = (k: number): Record<string, unknown> => {
    const r = rawSignIn(o, k)
    o.variant?.(k, r)
    return r
  }
  const insertsAt = (k: number, through: number | null): Record<string, unknown>[] =>
    (o.insert ?? []).filter((x) => x.at === k && Date.parse(x.raw.createdDateTime as string) <= o.nowMs && (through === null || Date.parse(x.raw.createdDateTime as string) <= through)).map((x) => x.raw)
  return {
    urls,
    pageUrl: (through: string | null): string => (through === null ? 'start' : `le:${through}`),
    async fetchPage(url: string): Promise<{ value: unknown[]; '@odata.nextLink': string | null }> {
      urls.push(url)
      const failure = o.failOn?.(url, urls.length)
      if (failure instanceof Error) throw failure
      if (failure) throw new Error('The network connection was lost.')
      const [base, offset] = url.split('#')
      const through = base === 'start' ? null : Date.parse(base.slice(3))
      const start = offset !== undefined ? Number(offset) : through === null ? first : Math.max(first, firstIndexAtOrBefore(o, through))
      const value: unknown[] = []
      if (o.repeatRow !== undefined && offset !== undefined && start - 1 === o.repeatRow) value.push(raw(o.repeatRow))
      const stop = Math.min(start + pageSize, end)
      for (let k = start; k < stop; k++) value.push(...insertsAt(k, through), raw(k))
      return { value, '@odata.nextLink': stop < end ? `${base}#${stop}` : null }
    },
    /** The records this fake holds from now back to `windowStart`, mapped, in the order it serves them. */
    *rowsInWindow(windowStart: string): Generator<StoredSignIn> {
      const from = Date.parse(windowStart)
      for (let k = first; k < end && rowTimeMs(o, k) >= from; k++) {
        for (const extra of insertsAt(k, null)) if (Date.parse(extra.createdDateTime as string) >= from) yield mapRow(extra)!
        yield mapRow(raw(k))!
      }
    },
  }
}
