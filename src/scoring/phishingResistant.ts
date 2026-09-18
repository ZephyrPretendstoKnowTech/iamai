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
/** One scan's readiness state per counted person (prompt 62): what "since the last scan" compares with. */
export type ScanSummary = { asOf: string; states: Record<string, ReadinessState> }
/** The retained evidence across scans, per person, as of the scan that last merged it; `scans` holds the last few scans' states. */
export type MfaHistory = { schema: 1; asOf: string; people: Record<string, PersonHistory>; scans?: ScanSummary[] }

// ------------------------------------------------------------------ readiness
//
// Prompt 62: phishing-resistant for everyone, seamless on every device.
//
// The target is higher than any one policy's: phishing-resistant sign-in for
// every active person, and built into each device where the device allows it.
// Readiness is judged on what happened inside the sign-in window (at most 30
// days), never on a stored flag and never on history: a method with no
// confirmed use in the window "may no longer exist" and is confirmed, not
// assumed. Unknown is a last resort: it says which read was missing.
//
//   seamless  Ready, and each device used signs them in with its own built-in
//             credential (or the best one the device can have)
//   ready     phishing-resistant sign-in confirmed in the window on every kind
//             of device they used in it
//   confirm   a usable phishing-resistant method, not confirmed in the window
//   device    confirmed on one device, but another signs in without it
//   method    no usable phishing-resistant method
//   blocked   a tenant setting stops them from setting one up
//   unknown   IAMAI could not read what the answer depends on

export type ReadinessState = 'seamless' | 'ready' | 'confirm' | 'device' | 'method' | 'blocked' | 'unknown'
/** The states in the order the worklist works them, done states last. */
export const READINESS_STATES: readonly ReadinessState[] = ['blocked', 'method', 'confirm', 'device', 'unknown', 'ready', 'seamless']
/** Ready includes Seamless: both mean phishing-resistant sign-in is confirmed everywhere the person signs in. */
export function isReady(state: ReadinessState): boolean {
  return state === 'ready' || state === 'seamless'
}

/** The window readiness is judged over. */
export const READINESS_WINDOW_DAYS = 30
const DAY = 86_400_000

export type DeviceType = 'computer' | 'phone'
export function deviceTypeOf(os: Platform): DeviceType {
  return os === 'iOS' || os === 'Android' ? 'phone' : 'computer'
}

/** A way to sign in phishing-resistant on a device. The built-in ones need nothing carried. */
export type SignInOption = 'windowsHello' | 'windowsHelloPasskey' | 'platformSso' | 'syncedPasskey' | 'authenticatorPasskey' | 'phonePasskey' | 'securityKey'

/** A proof as a row states it; `retained` where it came from an earlier scan, older than the window. */
export type ProofLine = { cls: MethodClass; os: Platform | null; at: string; retained: boolean }

export type Verdict = 'yes' | 'no' | 'unknown'

/** One device family the person signed in from inside the window, and what it can do. */
export type DeviceReading = {
  os: Platform
  type: DeviceType
  lastSeen: string
  /** The join state seen at sign-in; null where the records did not say (a snapshot before schema 10). */
  trust: 'joined' | 'hybrid' | 'registered' | 'none' | null
  version: string | null
  /** The best way to sign in on this device. */
  best: SignInOption
  /** Whether the best option is built into the device (nothing to carry). */
  builtIn: boolean
  /** Whether the best option is possible here. */
  possible: Verdict
  /** Why a built-in option is not possible. */
  whyNot: 'notJoined' | 'otherAccount' | 'notProvisioned' | 'attestation' | 'osTooOld' | 'notAllowed' | null
  /** The latest phishing-resistant sign-in on this device family inside the window. */
  proof: { cls: MethodClass; at: string } | null
  /** Signed in here with the best option (or, where nothing is built in, with any phishing-resistant method). */
  seamless: boolean
}

/** One phishing-resistant credential the person holds, and whether it can be used. */
export type CredentialReading = {
  cls: MethodClass
  key: string | null
  /** The method's own name (a Windows Hello device name, a passkey's display name). */
  name: string | null
  aaguid: string | null
  /** The model's name where IAMAI knows the AAGUID. */
  model: string | null
  created: string | null
  /** Usable under the tenant's current passkey settings; an observed sign-in settles it. */
  allowedNow: Verdict
  /** Allowed by Emergency Access Step 3's intended models; null where Step 3's settings are already the tenant's, or the class has no model. */
  afterStep3: Verdict | null
  /** The latest confirmed sign-in with this class of method, in the window or kept from earlier scans. */
  lastConfirmed: { at: string; os: Platform | null; retained: boolean } | null
}

export type UnknownReason = 'methods' | 'signIns' | 'notCovered'
export type BlockReason = 'passkeyOff' | 'authenticatorNotAllowed' | 'registrationLocation'

/**
 * What the person needs next, and nothing about how the page words it.
 *
 *   none        Ready and seamless, or Ready with nothing better possible
 *   seamless    Ready: a built-in option would remove the extra device (a recommendation)
 *   setUp       no usable method: set up the best option for their devices
 *   restore     no usable method, and one an earlier scan saw has gone
 *   confirm     a usable method not confirmed in the window: sign in once with it
 *   returnConfirm  no sign-in in the window at all (on leave): confirm on return
 *   addDevice   confirmed elsewhere: set up the best option on this device
 *   replaceKey  the only usable key stops working under Step 3's settings
 *   waitSetup   blocked: the admin change it waits on
 *   rescan      unknown: the read that was missing
 */
export type NextAction =
  | { kind: 'none' }
  | { kind: 'seamless'; os: Platform; option: SignInOption }
  | { kind: 'setUp'; option: SignInOption; os: Platform | null }
  | { kind: 'restore'; cls: MethodClass }
  | { kind: 'confirm'; cls: MethodClass; os: Platform | null }
  | { kind: 'returnConfirm' }
  | { kind: 'addDevice'; os: Platform; option: SignInOption }
  | { kind: 'replaceKey'; model: string | null; aaguid: string | null }
  | { kind: 'waitSetup'; reason: BlockReason }
  | { kind: 'rescan'; reason: UnknownReason }

export type PersonReadiness = {
  state: ReadinessState
  unknown: UnknownReason | null
  blocked: BlockReason | null
  /** The current method classes, in CLASS_ORDER; null where the inventory could not be read. */
  methods: MethodClass[] | null
  /** The usable phishing-resistant classes held now. */
  qualifying: MethodClass[]
  hasPasskey: boolean | null
  devices: DeviceReading[]
  credentials: CredentialReading[]
  /** No sign-in in the window at all, though active: on leave, or signing in only silently. */
  onLeave: boolean
  /** The day readiness lapses unless the person signs in again: the oldest required proof leaving the window. */
  readyUntil: string | null
  /** The latest phishing-resistant sign-in IAMAI knows, in the window or kept from earlier scans. */
  lastConfirmed: ProofLine | null
  /** Qualifying methods an earlier scan saw that no current method of the same class replaces. */
  lost: { cls: MethodClass; lastSeen: string }[]
  /** The latest MFA sign-in in the window that was not phishing-resistant. */
  other: ProofLine | null
  /** Signs in only to scripting clients: probably a service account. A note, never a state. */
  automated: boolean
  next: NextAction
  /** Non-blocking: the Seamless upgrade for somebody Ready. It never changes `state`. */
  recommended: NextAction | null
}

/** The tenant's passkey settings as readiness reads them (roadmap/passkeySettings.ts's reading, reduced). */
export type PasskeyPolicy = {
  read: boolean
  enabled: boolean | null
  selfService: boolean | null
  attestation: boolean | null
  restriction: 'unrestricted' | 'allow' | 'block' | null
  aaguids: readonly string[]
}

/** What readiness reads once per tenant: the window, the settings and the device facts (derive/readinessContext.ts). */
export type ReadinessContext = {
  now: string
  /** The start of the readiness window: 30 days before the scan. */
  windowStart: string
  /** Where the sign-in records read begin; later than windowStart when the read was partial. */
  coveredFrom: string | null
  signInsRead: boolean
  passkey: PasskeyPolicy
  /** Emergency Access Step 3's intended models; `applied` where the tenant's allow list already equals them. */
  step3: { models: readonly { name: string; aaguid: string }[]; applied: boolean }
  modelNames: ReadonlyMap<string, string>
  /** Windows Hello for Business provisioning (Intune); unknown where Intune could not be read. */
  whfb: 'enabled' | 'disabled' | 'notConfigured' | 'unknown'
  platformSso: 'configured' | 'none' | 'unknown'
  /** Whether security-info registration is limited to trusted locations or managed devices. */
  registration: 'open' | 'trustedOnly' | 'unknown'
  /** Entra device id → its registered owners' object ids. */
  deviceOwners: ReadonlyMap<string, readonly string[]>
  /** The latest change to the authentication methods policy the audit log shows; a sign-in before it no longer settles compatibility. */
  policyChangedAt: string | null
}

/** Microsoft Authenticator's passkey models (iOS, Android): a phone passkey needs one of them allowed. */
export const AUTHENTICATOR_AAGUIDS: readonly string[] = ['90a3ccdf-635c-4729-a248-9b709135078f', 'de1e552d-db1d-4423-a619-566b625cdc84']
/** Windows Hello's passkey model (not Windows Hello for Business). */
export const WINDOWS_HELLO_AAGUID = '08987058-cadc-4b81-b6e1-30de50dcbe96'

/** Whether the tenant's current passkey settings let this model and storage register and sign in. */
export function passkeyAllowed(p: PasskeyPolicy, aaguid: string | null, passkeyType: string | null = null): Verdict {
  if (!p.read) return 'unknown'
  if (p.enabled === false) return 'no'
  if (p.attestation === true && /synced/i.test(passkeyType ?? '')) return 'no'
  if (p.restriction === 'unrestricted') return p.enabled === true ? 'yes' : 'unknown'
  if (p.restriction === null) return 'unknown'
  if (!aaguid) return 'unknown'
  const listed = p.aaguids.includes(aaguid.toLowerCase())
  return p.restriction === 'allow' ? (listed ? 'yes' : 'no') : listed ? 'no' : 'yes'
}

export type ReadinessInput = {
  /** The method rows, or 'unknown' where they could not be read. */
  methods: readonly AuthMethodSummary[] | 'unknown'
  /** The registration report's method names; null where it has no row or could not be read. */
  registered: readonly string[] | null
  /**
   * The sign-in records: whether they could be read, the proof, platforms and
   * devices in them; `proofs` null where the snapshot predates proof being recorded.
   */
  signIns: { read: boolean; proofs: readonly ProofRecord[] | null; platforms: readonly PlatformSeen[]; devices?: readonly DeviceSeen[] | null; apps?: readonly string[]; trustedLocationSeen?: boolean; individuallyRead?: boolean }
  /** The directory's last successful sign-in (signInActivity). */
  lastSuccessfulSignIn?: string | null
  history: PersonHistory | null
  /** The person's own id, for device ownership. */
  userId?: string
  context?: ReadinessContext | null
}

/** A device family as the sign-in fields describe it (graph/collect/types.ts DeviceSeen). */
export type DeviceSeen = { os: Platform; at: string; trust: 'joined' | 'hybrid' | 'registered' | 'none' | null; managed: boolean | null; deviceIds: readonly string[]; version: string | null }

const byClass = (a: MethodClass, b: MethodClass): number => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b)
const byPlatform = (a: Platform | null, b: Platform | null): number => (a === null ? 1 : b === null ? -1 : PLATFORMS.indexOf(a) - PLATFORMS.indexOf(b))

/** A context for callers that have none: nothing about the tenant is known, so nothing is settled by it. */
export function emptyReadinessContext(now: string): ReadinessContext {
  return {
    now,
    windowStart: new Date(Date.parse(now) - READINESS_WINDOW_DAYS * DAY).toISOString(),
    coveredFrom: null,
    signInsRead: true,
    passkey: { read: false, enabled: null, selfService: null, attestation: null, restriction: null, aaguids: [] },
    step3: { models: [], applied: true },
    modelNames: new Map(),
    whfb: 'unknown',
    platformSso: 'unknown',
    registration: 'unknown',
    deviceOwners: new Map(),
    policyChangedAt: null,
  }
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

const SCRIPTING = /powershell|graph (command line|explorer|sdk)|azure cli|microsoft graph command|command line tools|sdk/i
const versionMajor = (v: string | null): number | null => {
  const m = /(\d+)(?:\.\d+)?/.exec(v ?? '')
  return m ? Number(m[1]) : null
}

/** The best way to sign in on one device family, and whether it is possible (the eligibility table in prompt 62). */
function eligibility(d: DeviceSeen, ctx: ReadinessContext, userId: string | undefined): Pick<DeviceReading, 'best' | 'builtIn' | 'possible' | 'whyNot'> {
  const phonePasskey = passkeyAllowed(ctx.passkey, AUTHENTICATOR_AAGUIDS[0]) === 'yes' || passkeyAllowed(ctx.passkey, AUTHENTICATOR_AAGUIDS[1]) === 'yes'
  const fallback: SignInOption = phonePasskey ? 'phonePasskey' : 'securityKey'
  if (d.os === 'iOS' || d.os === 'Android') {
    const major = versionMajor(d.version)
    const floor = d.os === 'iOS' ? 17 : 14
    if (major !== null && major < floor) return { best: 'authenticatorPasskey', builtIn: true, possible: 'no', whyNot: 'osTooOld' }
    const aaguid = d.os === 'iOS' ? AUTHENTICATOR_AAGUIDS[0] : AUTHENTICATOR_AAGUIDS[1]
    const allowed = passkeyAllowed(ctx.passkey, aaguid)
    return { best: 'authenticatorPasskey', builtIn: true, possible: allowed, whyNot: allowed === 'no' ? 'notAllowed' : null }
  }
  if (d.os === 'Windows') {
    if (d.trust === 'joined' || d.trust === 'hybrid') {
      const owners = d.deviceIds.flatMap((id) => ctx.deviceOwners.get(id.toLowerCase()) ?? [])
      if (userId && owners.length > 0 && !owners.some((o) => o.toLowerCase() === userId.toLowerCase())) return { best: fallback, builtIn: false, possible: 'yes', whyNot: 'otherAccount' }
      if (ctx.whfb === 'disabled') return { best: 'windowsHello', builtIn: true, possible: 'no', whyNot: 'notProvisioned' }
      return { best: 'windowsHello', builtIn: true, possible: ctx.whfb === 'unknown' ? 'unknown' : 'yes', whyNot: null }
    }
    if (d.trust === null) return { best: 'windowsHello', builtIn: true, possible: 'unknown', whyNot: null }
    const hello = passkeyAllowed(ctx.passkey, WINDOWS_HELLO_AAGUID)
    if (ctx.passkey.attestation !== true && hello === 'yes') return { best: 'windowsHelloPasskey', builtIn: true, possible: 'yes', whyNot: null }
    return { best: fallback, builtIn: false, possible: 'yes', whyNot: 'notJoined' }
  }
  if (d.os === 'macOS') {
    if (d.managed && ctx.platformSso === 'configured') return { best: 'platformSso', builtIn: true, possible: 'yes', whyNot: null }
    if (ctx.passkey.attestation === false && ctx.passkey.restriction === 'unrestricted') return { best: 'syncedPasskey', builtIn: true, possible: 'yes', whyNot: null }
    return { best: fallback, builtIn: false, possible: 'yes', whyNot: ctx.passkey.attestation === true ? 'attestation' : null }
  }
  // Linux and ChromeOS: nothing is built in; the best available counts as seamless.
  return { best: 'securityKey', builtIn: false, possible: 'yes', whyNot: null }
}

/** Whether a proof on this device is its seamless option (the class its best option signs in with). */
function seamlessProof(best: SignInOption, builtIn: boolean, possible: Verdict, cls: MethodClass): boolean {
  // Windows Hello is built into the device it signed in on, whatever join state the record reported.
  if (cls === 'windowsHello') return true
  if (!builtIn || possible === 'no') return true
  if (best === 'windowsHello') return false
  if (best === 'platformSso') return true
  return cls === 'passkey'
}

/** The method classes held now, with each credential: the method rows where read, else the registration report; null where neither was. */
function inventory(input: ReadinessInput): { classes: Set<MethodClass>; rows: { cls: MethodClass; m: AuthMethodSummary | null }[] } | null {
  const classes = new Set<MethodClass>()
  const rows: { cls: MethodClass; m: AuthMethodSummary | null }[] = []
  if (Array.isArray(input.methods)) {
    for (const m of input.methods) {
      const c = classOfKind(m.kind)
      if (!c) continue
      classes.add(c)
      if (isQualifying(c)) rows.push({ cls: c, m })
    }
    // The method rows do not list certificates; the registration report does.
    if (input.registered?.includes('x509Certificate')) {
      classes.add('certificate')
      rows.push({ cls: 'certificate', m: null })
    }
    return { classes, rows }
  }
  if (input.registered === null) return null
  for (const name of input.registered) {
    const c = classOfRegistered(name)
    if (!c) continue
    classes.add(c)
    if (isQualifying(c) && !rows.some((r) => r.cls === c)) rows.push({ cls: c, m: null })
  }
  return { classes, rows }
}

export function personReadiness(input: ReadinessInput): PersonReadiness {
  const ctx = input.context ?? emptyReadinessContext(new Date().toISOString())
  const inv = inventory(input)
  const base: Omit<PersonReadiness, 'state' | 'methods' | 'qualifying' | 'hasPasskey' | 'next' | 'automated'> = { unknown: null, blocked: null, devices: [], credentials: [], onLeave: false, readyUntil: null, lastConfirmed: null, lost: [], other: null, recommended: null }
  const apps = input.signIns.apps ?? []
  const automated = apps.length > 0 && apps.every((a) => SCRIPTING.test(a))
  if (inv === null) return { ...base, automated, state: 'unknown', unknown: 'methods', methods: null, qualifying: [], hasPasskey: null, next: { kind: 'rescan', reason: 'methods' } }
  const methods = [...inv.classes].sort(byClass)
  const history = input.history
  const inWindow = (at: string): boolean => at >= ctx.windowStart
  const current = input.signIns.proofs ?? []
  // Proof stands for a method held now: its class is held, and a method of that
  // class existed when the proof was made (a passkey registered after the last
  // passkey sign-in has not been seen working).
  const stands = (p: ProofRecord): boolean => {
    if (!inv.classes.has(p.cls) || !isQualifying(p.cls)) return false
    const rows = inv.rows.filter((r) => r.cls === p.cls)
    return rows.length === 0 || rows.some((r) => !r.m?.createdDateTime || r.m.createdDateTime <= p.at)
  }
  const windowProofs = latestProofs(current.filter((p) => inWindow(p.at) && stands(p)))
  const retained = latestProofs((history?.proofs ?? []).filter((p) => isQualifying(p.cls) && inv.classes.has(p.cls)))
  const latestOf = (cls: MethodClass): ProofLine | null => {
    const w = windowProofs.filter((p) => p.cls === cls).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
    if (w) return { cls, os: w.os, at: w.at, retained: false }
    const h = retained.filter((p) => p.cls === cls).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
    return h ? { cls, os: h.os, at: h.at, retained: true } : null
  }
  const seenWorking = (cls: MethodClass): boolean => windowProofs.some((p) => p.cls === cls && (ctx.policyChangedAt === null || p.at >= ctx.policyChangedAt))
  const step3 = new Set(ctx.step3.models.map((m) => m.aaguid.toLowerCase()))
  const credentials: CredentialReading[] = inv.rows.map(({ cls, m }) => {
    const aaguid = m?.aaGuid ? m.aaGuid.toLowerCase() : null
    const settled = seenWorking(cls)
    const allowedNow: Verdict = cls !== 'passkey' ? 'yes' : settled ? 'yes' : passkeyAllowed(ctx.passkey, aaguid, m?.passkeyType ?? null)
    const afterStep3: Verdict | null = cls !== 'passkey' || ctx.step3.applied || step3.size === 0 ? null : aaguid === null ? 'unknown' : step3.has(aaguid) ? 'yes' : 'no'
    const last = latestOf(cls)
    return {
      cls,
      key: m?.id ?? null,
      name: m?.displayName ?? null,
      aaguid,
      model: aaguid ? (ctx.modelNames.get(aaguid) ?? m?.model ?? null) : (m?.model ?? null),
      created: m?.createdDateTime ?? null,
      allowedNow,
      afterStep3,
      lastConfirmed: last ? { at: last.at, os: last.os, retained: last.retained } : null,
    }
  }).sort((a, b) => byClass(a.cls, b.cls))
  const usable = credentials.filter((c) => c.allowedNow !== 'no')
  const qualifying = [...new Set(usable.map((c) => c.cls))].sort(byClass)
  const hasPasskey = inv.classes.has('passkey')
  // A qualifying method an earlier scan saw, of a class nothing held now replaces.
  const lostBy = new Map<MethodClass, string>()
  for (const h of history?.methods ?? []) {
    if (!isQualifying(h.cls) || inv.classes.has(h.cls)) continue
    const at = lostBy.get(h.cls)
    if (at === undefined || h.lastSeen > at) lostBy.set(h.cls, h.lastSeen)
  }
  const lost = [...lostBy.entries()].sort((a, b) => byClass(a[0], b[0])).map(([cls, lastSeen]) => ({ cls, lastSeen }))
  const otherRecord = latestProofs(current.filter((p) => !isQualifying(p.cls) && inWindow(p.at))).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  const other: ProofLine | null = otherRecord ? { cls: otherRecord.cls, os: otherRecord.os, at: otherRecord.at, retained: false } : null
  const lastConfirmed = qualifying.map(latestOf).filter((p): p is ProofLine => p !== null).sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null
  const common = { credentials, lost, other, automated, methods, qualifying, hasPasskey, lastConfirmed }

  // The devices used inside the window, and what each can do.
  const seenDevices: DeviceSeen[] = input.signIns.devices && input.signIns.devices.length > 0
    ? [...input.signIns.devices]
    : input.signIns.platforms.map((p) => ({ os: p.os, at: p.at, trust: null, managed: null, deviceIds: [], version: null }))
  const devices: DeviceReading[] = seenDevices.filter((d) => inWindow(d.at)).sort((a, b) => byPlatform(a.os, b.os)).map((d) => {
    const e = eligibility(d, ctx, input.userId)
    const p = windowProofs.filter((x) => x.os === d.os && qualifying.includes(x.cls)).sort((a, b) => (seamlessProof(e.best, e.builtIn, e.possible, b.cls) ? 1 : 0) - (seamlessProof(e.best, e.builtIn, e.possible, a.cls) ? 1 : 0) || (a.at < b.at ? 1 : -1))[0]
    return { os: d.os, type: deviceTypeOf(d.os), lastSeen: d.at, trust: d.trust, version: d.version, ...e, proof: p ? { cls: p.cls, at: p.at } : null, seamless: !!p && seamlessProof(e.best, e.builtIn, e.possible, p.cls) }
  })

  // The best thing to set up first: the phone passkey where a phone is used
  // (it also signs them in from any computer), Windows Hello on their own joined
  // computer otherwise, a security key where nothing else is possible.
  const firstSetUp = (): { option: SignInOption; os: Platform | null } => {
    const phone = devices.find((d) => d.type === 'phone' && d.possible !== 'no')
    if (phone) return { option: phone.best, os: phone.os }
    const own = devices.find((d) => d.best === 'windowsHello' && d.possible !== 'no')
    if (own) return { option: 'windowsHello', os: own.os }
    const any = devices.find((d) => d.possible !== 'no')
    // No device seen in the window: the phone passkey is the portable start.
    return any ? { option: any.best, os: any.os } : { option: 'authenticatorPasskey', os: null }
  }

  if (usable.length === 0) {
    if (!input.signIns.read && devices.length === 0 && qualifying.length > 0) return { ...base, ...common, devices, state: 'unknown', unknown: 'signIns', next: { kind: 'rescan', reason: 'signIns' } }
    const phoneOnly = devices.length > 0 && !devices.some((d) => d.best === 'windowsHello' && d.possible !== 'no')
    const blocked: BlockReason | null =
      ctx.registration === 'trustedOnly' && input.signIns.trustedLocationSeen === false ? 'registrationLocation'
      : ctx.passkey.enabled === false && phoneOnly ? 'passkeyOff'
      : devices.some((d) => d.type === 'phone') && devices.filter((d) => d.type === 'phone').every((d) => d.whyNot === 'notAllowed') && phoneOnly ? 'authenticatorNotAllowed'
      : null
    if (blocked) return { ...base, ...common, devices, state: 'blocked', blocked, next: { kind: 'waitSetup', reason: blocked } }
    const onlyOffList = credentials.some((c) => c.cls === 'passkey' && c.allowedNow === 'no')
    const next: NextAction = lost.length > 0 && !onlyOffList ? { kind: 'restore', cls: lost[0].cls } : { kind: 'setUp', ...firstSetUp() }
    return { ...base, ...common, devices, state: 'method', next }
  }

  if (!input.signIns.read || input.signIns.proofs === null) return { ...base, ...common, devices, state: 'unknown', unknown: 'signIns', next: { kind: 'rescan', reason: 'signIns' } }

  if (devices.length === 0) {
    // No interactive sign-in inside the window. Where the records read began
    // after the window did, and the directory says they signed in inside it, the
    // missing records are IAMAI's gap, not the person's.
    const last = input.lastSuccessfulSignIn ?? null
    const gap = input.signIns.individuallyRead !== true && ctx.coveredFrom !== null && ctx.coveredFrom > ctx.windowStart && last !== null && last >= ctx.windowStart && last < ctx.coveredFrom
    if (gap) return { ...base, ...common, devices, state: 'unknown', unknown: 'notCovered', next: { kind: 'rescan', reason: 'notCovered' } }
    return { ...base, ...common, devices, state: 'confirm', onLeave: true, next: { kind: 'returnConfirm' } }
  }

  // A key that stops working under Step 3's settings, where it is the only usable method.
  const onlyKey = usable.length === 1 && usable[0].cls === 'passkey' && usable[0].afterStep3 === 'no' ? usable[0] : null
  const proven = devices.filter((d) => d.proof !== null)
  if (proven.length === 0) {
    if (onlyKey) return { ...base, ...common, devices, state: 'confirm', next: { kind: 'replaceKey', model: onlyKey.model, aaguid: onlyKey.aaguid } }
    const cls = qualifying[0]
    const os = devices.find((d) => (cls === 'windowsHello' ? d.os === 'Windows' : cls === 'passkey' ? d.type === 'phone' || true : true))?.os ?? null
    return { ...base, ...common, devices, state: 'confirm', next: { kind: 'confirm', cls, os } }
  }
  const missing = devices.filter((d) => d.proof === null)
  if (missing.length > 0) {
    const d = missing.find((x) => x.possible !== 'no') ?? missing[0]
    return { ...base, ...common, devices, state: 'device', next: { kind: 'addDevice', os: d.os, option: d.best } }
  }
  const readyUntil = devices.map((d) => new Date(Date.parse((d.proof as { at: string }).at) + READINESS_WINDOW_DAYS * DAY).toISOString()).sort()[0] ?? null
  const upgrade = devices.find((d) => !d.seamless && d.possible !== 'no')
  const seamless = devices.every((d) => d.seamless)
  const recommended: NextAction | null = onlyKey ? { kind: 'replaceKey', model: onlyKey.model, aaguid: onlyKey.aaguid } : upgrade ? { kind: 'seamless', os: upgrade.os, option: upgrade.best } : null
  return { ...base, ...common, devices, readyUntil, state: seamless ? 'seamless' : 'ready', next: { kind: 'none' }, recommended }
}
