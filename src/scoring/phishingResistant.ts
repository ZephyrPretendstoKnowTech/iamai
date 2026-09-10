// Phishing-resistant readiness, once (Step 7; docs/design/mfa-readiness-evidence-capability-audit.md).
//
// The baseline's outcome is phishing-resistant MFA, not a passkey. A person is
// Ready when a method they hold NOW satisfies Microsoft's Phishing-resistant MFA
// authentication strength (windowsHelloForBusiness, fido2, x509CertificateMultiFactor)
// and IAMAI has seen qualifying proof on every platform it has seen them use.
// Nothing weaker is readiness: a registration is a claim, and one method's
// sign-in never proves another method.
//
//   Ready        a current qualifying method, qualifying proof, and no observed
//                platform without it
//   Needs proof  a current qualifying method, and proof missing somewhere IAMAI
//                has seen the person sign in (or nowhere proven at all)
//   Needs setup  no current qualifying method (including one that disappeared)
//   Unknown      the method inventory, or the sign-in records the proof is read
//                from, could not be read; never a finding of either kind
//
// A passkey is the preferred portable path and it is a recommendation, not the
// requirement: a person proven with Windows Hello on the only platform they use
// is Ready without one, and the recommendation to add one changes nothing here.
//
// Proof is at the strongest grain the records support — method class × platform
// family (deviceDetail.operatingSystem). It is never a physical device: a
// platform string is not a device identity, and a push approved on a phone
// during a Windows sign-in is a Windows sign-in.
//
// Every surface that states readiness reads `personReadiness` through the scored
// person (scoring/mfaViability.ts `readiness`): MFA Readiness's rows and counts,
// the Plan's MFA, guest and admin gates, the campaign's lists. Pure: no DOM, no
// network.
import type { AuthMethodSummary, MethodKind } from './mfaViability.ts'

// ---------------------------------------------------------------- vocabulary

/** A method as readiness reasons about it: the class a registration, a method row or a sign-in names. */
export type MethodClass = 'passkey' | 'windowsHello' | 'certificate' | 'authenticator' | 'oath' | 'phone'

/**
 * The classes that satisfy the Phishing-resistant MFA strength alone: a passkey
 * or FIDO2 security key (fido2), Windows Hello for Business, and a certificate
 * used as multifactor. The Windows Hello PIN or biometric is the local gesture
 * that unlocks the credential, not the credential.
 */
export const QUALIFYING_CLASSES: readonly MethodClass[] = ['passkey', 'windowsHello', 'certificate']

/** The order methods are listed in: the qualifying classes first, the portable one first. */
export const CLASS_ORDER: readonly MethodClass[] = ['passkey', 'windowsHello', 'certificate', 'authenticator', 'oath', 'phone']

export function isQualifying(c: MethodClass): boolean {
  return QUALIFYING_CLASSES.includes(c)
}

/** The platform families a sign-in record names (laneBCore.ts normaliseOs). */
export const PLATFORMS = ['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS'] as const
export type Platform = (typeof PLATFORMS)[number]

export function platformOf(os: string | null | undefined): Platform | null {
  return (PLATFORMS as readonly string[]).includes(os ?? '') ? (os as Platform) : null
}

const CLASS_BY_KIND: Partial<Record<MethodKind, MethodClass>> = {
  passkey: 'passkey',
  fido2: 'passkey',
  windowsHelloForBusiness: 'windowsHello',
  microsoftAuthenticator: 'authenticator',
  softwareOath: 'oath',
  phone: 'phone',
}

/** The class of a method row (/users/{id}/authentication/methods); null for one readiness does not weigh (a password, an email, a Temporary Access Pass). */
export function classOfKind(kind: MethodKind): MethodClass | null {
  return CLASS_BY_KIND[kind] ?? null
}

/** The class of a registration report method name (userRegistrationDetails.methodsRegistered). */
export function classOfRegistered(name: string): MethodClass | null {
  if (name.startsWith('passKey') || name === 'fido2SecurityKey') return 'passkey'
  if (name === 'windowsHelloForBusiness') return 'windowsHello'
  if (name === 'x509Certificate') return 'certificate'
  if (name.startsWith('microsoftAuthenticator')) return 'authenticator'
  if (name === 'softwareOneTimePasscode' || name === 'hardwareOneTimePasscode') return 'oath'
  if (name === 'mobilePhone' || name === 'alternateMobilePhone' || name === 'officePhone') return 'phone'
  return null
}

/**
 * The class a sign-in record's method string names. Microsoft documents only
 * some of these strings, so an unrecognised one names no class: it is never
 * promoted to proof of anything.
 */
export function classOfProofMethod(method: string): MethodClass | null {
  const m = method.trim()
  if (!m || /^(password|previously satisfied|satisfied by token|mfa|multifactor authentication)$/i.test(m)) return null
  if (/passkey|fido|security key/i.test(m)) return 'passkey'
  if (/windows hello/i.test(m)) return 'windowsHello'
  if (/certificate|x\.?509/i.test(m)) return 'certificate'
  if (/authenticator|notification|phone ?app|mobile app|passwordless phone/i.test(m)) return 'authenticator'
  if (/oath|verification code|one-?time|hardware token|software token/i.test(m)) return 'oath'
  if (/text message|\bsms\b|voice|phone call/i.test(m)) return 'phone'
  return null
}

// ------------------------------------------------------------------- evidence

/** A method seen succeeding in a sign-in: the class, the platform family (null where the record carried none), when, and the record's own words for it. */
export type ProofRecord = { cls: MethodClass; os: Platform | null; at: string; method: string }
/** A platform family a person was seen signing in from successfully, and when last. */
export type PlatformSeen = { os: Platform; at: string }

/** The sign-in fields proof is read from (graph/collect/types.ts StoredSignIn). */
export type SignInForProof = {
  createdDateTime: string
  status?: { errorCode?: number } | null
  authenticationRequirement?: string
  mfaDetail?: { authMethod?: string } | null
  authenticationDetails?: { succeeded?: boolean; authenticationMethod?: string }[] | null
  os?: string
}

/** What one record tells readiness. */
export type SignInReading = {
  /** A successful sign-in's platform family; null on a failed sign-in or one that carried none. */
  platform: Platform | null
  /** Proof of the method the sign-in itself used; null where it proves none. */
  proof: ProofRecord | null
  /** The MFA success this record is, as the method it names, `GENERIC_MFA` where it names none; null where it is not one. */
  mfa: string | null
}

/** A record that says MFA happened and names no method. */
export const GENERIC_MFA = 'MFA'

const NOT_A_FACTOR = /^(password|previously satisfied|satisfied by token)$/i

/**
 * One sign-in, read for readiness.
 *
 * Only a successful sign-in is evidence. A passkey or Windows Hello step that
 * succeeded is proof of that credential whatever the tenant required: the
 * credential alone is a combination the phishing-resistant strength accepts. A
 * certificate is proof only where the record says multifactor was required and
 * the certificate was the only factor named — a certificate can be single-factor.
 * Any other method is proof of itself (never phishing-resistant) only where
 * multifactor was required. A single-factor sign-in with a named step is not an
 * MFA success, and a step that was "previously satisfied" proves nothing today.
 */
export function readSignIn(row: SignInForProof): SignInReading {
  if (row.status?.errorCode !== 0) return { platform: null, proof: null, mfa: null }
  const platform = platformOf(row.os)
  const at = row.createdDateTime
  const steps = (row.authenticationDetails ?? [])
    .filter((d) => d?.succeeded === true && typeof d.authenticationMethod === 'string')
    .map((d) => (d.authenticationMethod as string).trim())
    .filter((m) => m && !NOT_A_FACTOR.test(m))
  const detail = (row.mfaDetail?.authMethod ?? '').trim()
  const named = detail && !NOT_A_FACTOR.test(detail) ? [...steps, detail] : steps
  const factors = named.map((m) => ({ m, c: classOfProofMethod(m) })).filter((x): x is { m: string; c: MethodClass } => x.c !== null)
  const mfaRequired = row.authenticationRequirement === 'multiFactorAuthentication'
  const credential = factors.find((x) => x.c === 'passkey' || x.c === 'windowsHello')
  let proof: ProofRecord | null = null
  if (credential) proof = { cls: credential.c, os: platform, at, method: credential.m }
  else if (mfaRequired && factors.length > 0) {
    const cert = factors.every((x) => x.c === 'certificate')
    const f = cert ? factors[0] : (factors.find((x) => x.c !== 'certificate') ?? factors[0])
    proof = { cls: f.c, os: platform, at, method: f.m }
  }
  const mfa = mfaRequired ? (detail || steps[0] || GENERIC_MFA) : credential ? credential.m : null
  return { platform, proof, mfa }
}

// -------------------------------------------------------------------- history

/** A qualifying method as a past scan saw it (scoring/mfaHistory.ts). `key` is the method's id where Graph gave one. */
export type HistoryMethod = { key: string; cls: MethodClass; firstSeen: string; lastSeen: string; present: boolean }
/** What IAMAI kept about one person from earlier scans: qualifying methods, qualifying proof, platforms. No raw record. */
export type PersonHistory = { methods: HistoryMethod[]; proofs: ProofRecord[]; platforms: PlatformSeen[] }
/** The retained evidence across scans, per person, as of the scan that last merged it. */
export type MfaHistory = { schema: 1; asOf: string; people: Record<string, PersonHistory> }

// ------------------------------------------------------------------ readiness

export type ReadinessState = 'ready' | 'needsProof' | 'needsSetup' | 'unknown'
export const READINESS_STATES: readonly ReadinessState[] = ['ready', 'needsProof', 'needsSetup', 'unknown']

/** A proof as a row states it; `retained` where it is older than the records this scan read and came from an earlier scan. */
export type ProofLine = { cls: MethodClass; os: Platform | null; at: string; retained: boolean }

/**
 * What the person needs next, and nothing about how the page words it.
 *
 *   none      Ready; nothing the baseline asks for
 *   test      a qualifying method, and a platform they use with no proof of it
 *   prove     a qualifying method nobody has seen succeed yet
 *   setUp     no qualifying method; a passkey is the portable path
 *   restore   no qualifying method, and one an earlier scan saw has gone
 *   rescan    the evidence could not be read
 */
export type NextAction =
  | { kind: 'none' }
  | { kind: 'test'; platform: Platform }
  | { kind: 'prove'; cls: MethodClass }
  | { kind: 'setUp' }
  | { kind: 'restore'; cls: MethodClass }
  | { kind: 'rescan' }

export type PersonReadiness = {
  state: ReadinessState
  /** Which read was missing, for Unknown. */
  unknown: 'methods' | 'signIns' | null
  /** The current method classes, in CLASS_ORDER; null where the inventory could not be read. */
  methods: MethodClass[] | null
  /** The current classes that satisfy the phishing-resistant strength. */
  qualifying: MethodClass[]
  /** A passkey is registered now; null where the inventory could not be read. */
  hasPasskey: boolean | null
  /** Qualifying proof that stands for a method held now, latest per class and platform. */
  proof: ProofLine[]
  /** Every platform family IAMAI has seen the person sign in from. */
  platforms: Platform[]
  /** Platforms among them with no qualifying proof. */
  missing: Platform[]
  /** The latest MFA proof that is not phishing-resistant, where there is one. */
  other: ProofLine | null
  /** Qualifying methods an earlier scan saw that no current method of the same class replaces. */
  lost: { cls: MethodClass; lastSeen: string }[]
  /** The baseline's next action. */
  next: NextAction
  /** Non-blocking: a passkey for someone Ready without one. It never changes `state`. */
  recommended: 'addPasskey' | null
}

export type ReadinessInput = {
  /** The method rows, or 'unknown' where they could not be read. */
  methods: readonly AuthMethodSummary[] | 'unknown'
  /** The registration report's method names; null where it has no row or could not be read. */
  registered: readonly string[] | null
  /**
   * The sign-in records: whether they could be read, the proof and platforms in
   * them, and `proofs` null where the snapshot predates proof being recorded —
   * a record read before Step 7 carries no platform and cannot stand as proof.
   */
  signIns: { read: boolean; proofs: readonly ProofRecord[] | null; platforms: readonly PlatformSeen[] }
  history: PersonHistory | null
}

const byClass = (a: MethodClass, b: MethodClass): number => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b)
const byPlatform = (a: Platform | null, b: Platform | null): number => (a === null ? 1 : b === null ? -1 : PLATFORMS.indexOf(a) - PLATFORMS.indexOf(b))

/** The method classes held now: the method rows where they were read, else the registration report; null where neither was. */
function inventory(input: ReadinessInput): { classes: Set<MethodClass>; created: Map<MethodClass, (string | null)[]> } | null {
  const created = new Map<MethodClass, (string | null)[]>()
  const classes = new Set<MethodClass>()
  if (Array.isArray(input.methods)) {
    for (const m of input.methods) {
      const c = classOfKind(m.kind)
      if (!c) continue
      classes.add(c)
      created.set(c, [...(created.get(c) ?? []), m.createdDateTime ?? null])
    }
    // The method rows do not list certificates; the registration report does.
    if (input.registered?.includes('x509Certificate')) {
      classes.add('certificate')
      created.set('certificate', [null])
    }
    return { classes, created }
  }
  if (input.registered === null) return null
  for (const name of input.registered) {
    const c = classOfRegistered(name)
    if (!c) continue
    classes.add(c)
    created.set(c, [null])
  }
  return { classes, created }
}

/** The latest proof per class and platform. */
export function latestProofs(proofs: readonly ProofRecord[]): ProofRecord[] {
  const out = new Map<string, ProofRecord>()
  for (const p of proofs) {
    const k = `${p.cls}|${p.os ?? ''}`
    const held = out.get(k)
    if (!held || p.at > held.at) out.set(k, p)
  }
  return [...out.values()]
}

export function personReadiness(input: ReadinessInput): PersonReadiness {
  const inv = inventory(input)
  const base = { unknown: null, qualifying: [], proof: [], platforms: [], missing: [], other: null, lost: [], recommended: null } as const
  if (inv === null) {
    return { ...base, state: 'unknown', unknown: 'methods', methods: null, hasPasskey: null, qualifying: [], proof: [], platforms: [], missing: [], lost: [], next: { kind: 'rescan' } }
  }
  const methods = [...inv.classes].sort(byClass)
  const qualifying = methods.filter(isQualifying)
  const history = input.history
  // A qualifying method an earlier scan saw, of a class nothing held now replaces.
  const lostBy = new Map<MethodClass, string>()
  for (const h of history?.methods ?? []) {
    if (!isQualifying(h.cls) || inv.classes.has(h.cls)) continue
    const at = lostBy.get(h.cls)
    if (at === undefined || h.lastSeen > at) lostBy.set(h.cls, h.lastSeen)
  }
  const lost = [...lostBy.entries()].sort((a, b) => byClass(a[0], b[0])).map(([cls, lastSeen]) => ({ cls, lastSeen }))
  const hasPasskey = inv.classes.has('passkey')
  const current = input.signIns.proofs ?? []
  const other = latestProofs(current.filter((p) => !isQualifying(p.cls))).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  const otherLine: ProofLine | null = other ? { cls: other.cls, os: other.os, at: other.at, retained: false } : null
  if (qualifying.length === 0) {
    return { ...base, state: 'needsSetup', methods, qualifying, hasPasskey, proof: [], platforms: [], missing: [], other: otherLine, lost, next: lost.length > 0 ? { kind: 'restore', cls: lost[0].cls } : { kind: 'setUp' } }
  }
  if (!input.signIns.read || input.signIns.proofs === null) {
    return { ...base, state: 'unknown', unknown: 'signIns', methods, qualifying, hasPasskey, proof: [], platforms: [], missing: [], lost, next: { kind: 'rescan' } }
  }
  // Proof stands for a method held now: its class is held, and a method of that
  // class existed when the proof was made. A passkey registered after the last
  // passkey sign-in has not been seen working, whatever its predecessor did.
  const stands = (p: ProofRecord): boolean => {
    if (!qualifying.includes(p.cls)) return false
    const dates = inv.created.get(p.cls) ?? []
    return dates.some((d) => d === null || d <= p.at)
  }
  const inWindow = new Set(current.map((p) => `${p.cls}|${p.os ?? ''}|${p.at}`))
  const proofs = latestProofs([...current, ...(history?.proofs ?? [])].filter(stands))
    .sort((a, b) => byClass(a.cls, b.cls) || byPlatform(a.os, b.os))
    .map((p) => ({ cls: p.cls, os: p.os, at: p.at, retained: !inWindow.has(`${p.cls}|${p.os ?? ''}|${p.at}`) }))
  const seen = new Set<Platform>([...input.signIns.platforms.map((p) => p.os), ...(history?.platforms ?? []).map((p) => p.os)])
  const platforms = [...seen].sort(byPlatform)
  const proven = new Set(proofs.map((p) => p.os))
  const missing = platforms.filter((os) => !proven.has(os))
  if (proofs.length > 0 && missing.length === 0) {
    return { ...base, state: 'ready', methods, qualifying, hasPasskey, proof: proofs, platforms, missing, other: otherLine, lost, next: { kind: 'none' }, recommended: hasPasskey ? null : 'addPasskey' }
  }
  const next: NextAction = missing.length > 0 ? { kind: 'test', platform: missing[0] } : { kind: 'prove', cls: qualifying[0] }
  return { ...base, state: 'needsProof', methods, qualifying, hasPasskey, proof: proofs, platforms, missing, other: otherLine, lost, next }
}
