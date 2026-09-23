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
// Proof is read at the strongest grain the records support — method class ×
// platform family (deviceDetail.operatingSystem) — and required per device type
// (a computer, a phone; owner, 2026-09-19): a joined Windows laptop and a Linux
// box need proof once, for "computer". It is never a physical device: a
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
export type MethodClass = 'passkey' | 'windowsHello' | 'platformCredential' | 'certificate' | 'authenticator' | 'oath' | 'phone'

/**
 * The classes that satisfy the Phishing-resistant MFA strength alone: a passkey
 * or FIDO2 security key (fido2), Windows Hello for Business, a Mac's Platform SSO
 * credential (Platform Credential for macOS, which the strength represents as
 * Windows Hello for Business), and a certificate used as multifactor. The Windows
 * Hello PIN or biometric is the local gesture that unlocks the credential, not
 * the credential.
 */
export const QUALIFYING_CLASSES: readonly MethodClass[] = ['passkey', 'windowsHello', 'platformCredential', 'certificate']

/** The order methods are listed in: the qualifying classes first, the portable one first. */
export const CLASS_ORDER: readonly MethodClass[] = ['passkey', 'windowsHello', 'platformCredential', 'certificate', 'authenticator', 'oath', 'phone']

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
  platformCredential: 'platformCredential',
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
  if (name === 'platformCredential' || name === 'macOsSecureEnclaveKey') return 'platformCredential'
  if (name === 'x509Certificate') return 'certificate'
  if (name.startsWith('microsoftAuthenticator')) return 'authenticator'
  if (name === 'softwareOneTimePasscode' || name === 'hardwareOneTimePasscode') return 'oath'
  if (name === 'mobilePhone' || name === 'alternateMobilePhone' || name === 'officePhone') return 'phone'
  return null
}

/**
 * The one phishing-resistant method set, for every reader that holds a method
 * name rather than a readiness (the strand simulation, the tier a row shows, the
 * emergency-access rule, the collector's targeted reads): the qualifying classes
 * above. A synced passkey counts; Microsoft Authenticator's phone sign-in does
 * not, because the Phishing-resistant MFA strength does not accept it.
 */
export function isPhishingResistantRegistered(name: string): boolean {
  const c = classOfRegistered(name)
  return c !== null && isQualifying(c)
}

/** The same set, for a method row's kind (/users/{id}/authentication/methods). */
export function isPhishingResistantKind(kind: string): boolean {
  const c = classOfKind(kind as MethodKind)
  return c !== null && isQualifying(c)
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
  if (/platform credential|platform sso|secure enclave/i.test(m)) return 'platformCredential'
  if (/windows hello/i.test(m)) return 'windowsHello'
  if (/certificate|x\.?509/i.test(m)) return 'certificate'
  if (/authenticator|notification|phone ?app|mobile app|passwordless phone/i.test(m)) return 'authenticator'
  if (/oath|verification code|one-?time|hardware token|software token/i.test(m)) return 'oath'
  if (/text message|\bsms\b|voice|phone call/i.test(m)) return 'phone'
  return null
}

/**
 * The class a proof stands for on the platform it was made on. Microsoft Learn
 * (Platform Credential for macOS, 2026-03-27): the Mac's Platform SSO credential
 * is "represented in authentication strength under Windows Hello For Business",
 * so a macOS sign-in whose method reads as Windows Hello for Business is that
 * Mac's built-in credential, never a Windows Hello for Business one.
 */
export function proofClassOn(cls: MethodClass, os: Platform | null): MethodClass {
  return cls === 'windowsHello' && os === 'macOS' ? 'platformCredential' : cls
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
  const credential = factors.find((x) => x.c === 'passkey' || x.c === 'windowsHello' || x.c === 'platformCredential')
  let proof: ProofRecord | null = null
  if (credential) proof = { cls: proofClassOn(credential.c, platform), os: platform, at, method: credential.m }
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
//             credential. A device with nothing built in (a personal PC, Linux)
//             or whose built-in option is impossible tops out at Ready (owner,
//             2026-09-18: "it isn't technically seamless. It's just ready")
//   ready     phishing-resistant sign-in confirmed in the window on every device
//             type (computer, phone) they used in it
//   confirm   a usable phishing-resistant method, not confirmed in the window
//   device    confirmed on one device type, but a device of another type signs
//             in without it
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
/** A passkey not used for this long is flagged "registered but not used, may be gone" (owner item 2). */
export const UNUSED_PASSKEY_DAYS = 90
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
  whyNot: 'notJoined' | 'otherAccount' | 'attestation' | 'osTooOld' | 'notAllowed' | null
  /**
   * The option to set up here: the best, unless Emergency Access Step 3's settings,
   * not yet applied, would refuse it (a synced passkey, or a passkey in Windows Hello
   * whose models its list leaves out). Nobody is set up with a credential the plan's
   * own step switches off; what they already sign in with is judged by `best`.
   */
  offer: SignInOption
  /** The latest phishing-resistant sign-in on this device family inside the window. */
  proof: { cls: MethodClass; at: string } | null
  /** Its device type is proven: this device, or another of the same type (a computer, a phone), has a phishing-resistant sign-in in the window. */
  covered: boolean
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
  /**
   * The AAGUID of an approved model (Emergency Access Step 3's list) with this
   * credential's model name and another AAGUID: the same name on other firmware,
   * which the list does not allow. Null where no approved model shares the name.
   */
  approvedTwin: string | null
  /** Registered inside the readiness window: new, so no sign-in with it yet says it is unused, not that it may be gone. */
  createdInWindow: boolean
  created: string | null
  /** Usable under the tenant's current passkey settings; an observed sign-in settles it. */
  allowedNow: Verdict
  /** Allowed by Emergency Access Step 3's intended models; null where Step 3's settings are already the tenant's, or the class has no model. */
  afterStep3: Verdict | null
  /** The latest confirmed sign-in with this class of method, in the window or kept from earlier scans. */
  lastConfirmed: { at: string; os: Platform | null; retained: boolean } | null
  /** A passkey's last use as Microsoft reports it: supporting evidence only, it never makes anybody Ready (owner item 2). */
  lastUsed: string | null
  /** A passkey registered but never used, or not used for UNUSED_PASSKEY_DAYS: it may be gone. Null where the date was not read, or its use is seen. */
  unused: 'never' | 'stale' | null
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
 *   updateOs    confirmed elsewhere: this phone is too old for a passkey in Authenticator
 *   replaceKey  the only usable key stops working under Step 3's settings
 *   waitSetup   blocked: the admin change it waits on
 *   rescan      unknown: the read that was missing
 */
export type NextAction =
  | { kind: 'none' }
  | { kind: 'seamless'; os: Platform; option: SignInOption }
  | { kind: 'setUp'; option: SignInOption; os: Platform | null }
  | { kind: 'updateOs'; os: Platform }
  | { kind: 'restore'; cls: MethodClass; lastSeen: string }
  | { kind: 'confirm'; cls: MethodClass; os: Platform | null }
  | { kind: 'returnConfirm' }
  | { kind: 'addDevice'; os: Platform; option: SignInOption }
  | { kind: 'replaceKey'; model: string | null; aaguid: string | null }
  | { kind: 'waitSetup'; reason: BlockReason }
  | { kind: 'rescan'; reason: UnknownReason | 'unavailable' | 'methodsUnavailable' }

export type PersonReadiness = {
  state: ReadinessState
  unknown: UnknownReason | null
  blocked: BlockReason | null
  /** The current method classes, in CLASS_ORDER; null where the inventory could not be read. */
  methods: MethodClass[] | null
  /** The usable phishing-resistant classes held now. */
  qualifying: MethodClass[]
  hasPasskey: boolean | null
  /**
   * Whether the sign-in records this person's devices come from were read. Where
   * they were not, an empty `devices` means nothing was read, never that nobody
   * signed in, whatever else the person is unknown for.
   */
  signInsRead: boolean
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
  /** Signs in only to scripting clients: probably a service account, and not counted (derive/population.ts isActivePerson). */
  automated: boolean
  /**
   * Confirm it only: the latest date inside the window Microsoft reports a usable
   * passkey was used, where no sign-in with it shows. Supporting evidence: the
   * page says "used recently", and the state stays Confirm it (owner item 2).
   */
  usedRecently: string | null
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
  /** Whether passkeys are targeted at all users; false where only some groups; null where not read. */
  targetsAll?: boolean | null
  /** One person's reading (owner item 9): whether the passkey method reaches them is unknown (a group's membership was not read). */
  reach?: 'in' | 'unknown'
  /** One person's reading: a profile whose target membership was not read might allow what these profiles don't. */
  partial?: boolean
}

/** What readiness reads once per tenant: the window, the settings and the device facts (derive/readinessContext.ts). */
export type ReadinessContext = {
  now: string
  /** The start of the readiness window: 30 days before the scan. */
  windowStart: string
  /** Where the sign-in records read begin; later than windowStart when the read was partial. */
  coveredFrom: string | null
  signInsRead: boolean
  /** Sign-in records can't be read in this tenant at all (a licence or permission), so a rescan won't help. */
  signInsUnavailable?: boolean
  /**
   * The registration report, which stands in for a method list the per-person
   * read missed, was refused in this tenant (a permission or a licence): a rescan
   * with the same sign-in reads no more, so an unread method list is not retried.
   */
  methodsUnavailable?: boolean
  passkey: PasskeyPolicy
  /** Emergency Access Step 3's intended models; `applied` where the tenant's allow list already equals them. */
  step3: { models: readonly { name: string; aaguid: string }[]; applied: boolean }
  modelNames: ReadonlyMap<string, string>
  /** Whether security-info registration is limited to trusted locations or managed devices. */
  registration: 'open' | 'trustedOnly' | 'unknown'
  /** Entra device id → its registered owners' object ids. */
  deviceOwners: ReadonlyMap<string, readonly string[]>
  /**
   * The Windows computers in the tenant's device directory: none at all, some but
   * none joined, some joined, or unknown (the directory was not read in full). A
   * sign-in reports a computer's join state only when the computer identifies
   * itself; the directory settles the rest, because a joined computer is always in it.
   */
  windowsDirectory: 'none' | 'notJoined' | 'joined' | 'unknown'
  /** The latest change to the authentication methods policy the audit log shows; a sign-in before it no longer settles compatibility. */
  policyChangedAt: string | null
  /**
   * One person's passkey settings: the targets and passkey profiles scoped to
   * them, never the tenant's profiles merged (owner item 9). Absent, every person
   * reads `passkey`.
   */
  passkeyFor?: (userId: string) => PasskeyPolicy
}

/** Microsoft Authenticator's passkey models (iOS, Android): a phone passkey needs one of them allowed. */
export const AUTHENTICATOR_AAGUIDS: readonly string[] = ['90a3ccdf-635c-4729-a248-9b709135078f', 'de1e552d-db1d-4423-a619-566b625cdc84']
/**
 * Microsoft Entra passkey on Windows (a passkey in Windows Hello, not Windows Hello
 * for Business): hardware, VBS hardware and software. Microsoft Learn (2026-09-03):
 * they must be explicitly allowed in a passkey profile, the profile can't enforce
 * attestation, and the computer need not be joined or registered.
 */
export const WINDOWS_HELLO_AAGUIDS: readonly string[] = ['08987058-cadc-4b81-b6e1-30de50dcbe96', '9ddd1817-af5a-4672-a2b9-3e3dd95000a9', '6028b017-b1d4-4c02-b4b3-afcdafc96bb2']
export const WINDOWS_HELLO_AAGUID = WINDOWS_HELLO_AAGUIDS[0]
/**
 * Platform Credential for macOS (the Mac's Platform SSO credential). Microsoft
 * Learn: a tenant with passkey key restrictions must allow it, as it allows the
 * Windows Hello models above.
 */
export const PLATFORM_CREDENTIAL_AAGUID = '7fd635b3-2ef9-4542-8d9d-164f2c771efc'

/** Whether the tenant's passkey key restrictions let a Mac's Platform SSO credential sign in: its model must be allowed. */
export function platformCredentialAllowed(p: PasskeyPolicy): Verdict {
  // Only the model restriction weighs here; the credential is the Mac's, not a passkey the passkey method registers.
  return passkeyAllowed({ ...p, enabled: p.enabled === false ? true : p.enabled, reach: undefined }, PLATFORM_CREDENTIAL_AAGUID, null, 'use')
}

/**
 * Whether the tenant's current passkey settings let this model and storage sign in
 * (`use`, a credential already held) or register (`register`, one to set up).
 * Attestation is enforced only at registration (Microsoft Learn: users who
 * registered without it aren't blocked from sign-in when it is turned on later);
 * key restrictions apply to both. A Windows Hello passkey registers only where
 * an allow list names it, and never under enforced attestation.
 */
export function passkeyAllowed(p: PasskeyPolicy, aaguid: string | null, passkeyType: string | null = null, purpose: 'use' | 'register' = 'use'): Verdict {
  const v = allowedBySettings(p, aaguid, passkeyType, purpose)
  // One person's reading: a method whose reach is unknown settles no yes, and a profile that might apply settles no no.
  if (v === 'yes' && p.reach === 'unknown') return 'unknown'
  if (v === 'no' && p.partial === true && p.enabled !== false) return 'unknown'
  return v
}

function allowedBySettings(p: PasskeyPolicy, aaguid: string | null, passkeyType: string | null, purpose: 'use' | 'register'): Verdict {
  if (!p.read) return 'unknown'
  if (p.enabled === false) return 'no'
  const hello = aaguid !== null && WINDOWS_HELLO_AAGUIDS.includes(aaguid.toLowerCase())
  if (purpose === 'register' && p.attestation === true && (hello || /synced/i.test(passkeyType ?? ''))) return 'no'
  if (purpose === 'register' && hello && p.restriction !== 'allow') return p.restriction === null ? 'unknown' : 'no'
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

/**
 * The devices a person's own sign-in records show them on: the device records
 * where the scan kept them, or one bare device per platform family on a
 * snapshot from before it did. The one reading of where a person signs in:
 * MFA Readiness draws each person's devices from it (personReadiness below),
 * and whoever signed in from a phone is counted from it (derive/sets.ts
 * phoneSignInIds), so the device question cannot say "no phone sign-ins were
 * seen" beside a phone MFA Readiness shows (NEW-Nadia-D4).
 */
export function devicesSeen(signIns: { platforms?: readonly PlatformSeen[] | null; devices?: readonly DeviceSeen[] | null }): DeviceSeen[] {
  return signIns.devices && signIns.devices.length > 0
    ? [...signIns.devices]
    : (signIns.platforms ?? []).map((p) => ({ os: p.os, at: p.at, trust: null, managed: null, deviceIds: [], version: null }))
}

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
    registration: 'unknown',
    deviceOwners: new Map(),
    windowsDirectory: 'unknown',
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

/** What a device with nothing built in signs in with: the phone passkey where the settings allow one, else a security key. */
function fallbackOf(pk: PasskeyPolicy): SignInOption {
  const phonePasskey = passkeyAllowed(pk, AUTHENTICATOR_AAGUIDS[0], null, 'register') === 'yes' || passkeyAllowed(pk, AUTHENTICATOR_AAGUIDS[1], null, 'register') === 'yes'
  return phonePasskey ? 'phonePasskey' : 'securityKey'
}

/**
 * Whether a passkey option survives Emergency Access Step 3's settings once they
 * are applied: its model is on Step 3's list. A synced passkey is on no model
 * list. Settings already applied are today's, which `eligibility` has read.
 */
function step3Keeps(option: SignInOption, ctx: ReadinessContext): boolean {
  if (ctx.step3.applied || ctx.step3.models.length === 0) return true
  const form = FORM_OF[option]
  if (form === undefined) return true
  const listed = new Set(ctx.step3.models.map((m) => m.aaguid.toLowerCase()))
  const models = form === 'authenticator' ? AUTHENTICATOR_AAGUIDS : form === 'windowsHelloPasskey' ? WINDOWS_HELLO_AAGUIDS : []
  return models.some((a) => listed.has(a))
}

/**
 * Whether IAMAI offers anybody a synced passkey in this tenant: today's passkey
 * settings let one register (no attestation, no model restriction) and Emergency
 * Access Step 3's settings, once applied, keep it. The words that name a Mac's
 * built-in option read this, so they never name one no row would offer.
 */
export function syncedPasskeyOffered(ctx: ReadinessContext): boolean {
  return ctx.passkey.attestation === false && ctx.passkey.restriction === 'unrestricted' && step3Keeps('syncedPasskey', ctx)
}

/** The best way to sign in on one device family, and whether it is possible (the eligibility table in prompt 62). */
function eligibility(d: DeviceSeen, ctx: ReadinessContext, userId: string | undefined, pk: PasskeyPolicy, holdsPlatformCredential = false): Pick<DeviceReading, 'best' | 'builtIn' | 'possible' | 'whyNot'> {
  const fallback = fallbackOf(pk)
  if (d.os === 'iOS' || d.os === 'Android') {
    const major = versionMajor(d.version)
    const floor = d.os === 'iOS' ? 17 : 14
    if (major !== null && major < floor) return { best: 'authenticatorPasskey', builtIn: true, possible: 'no', whyNot: 'osTooOld' }
    const aaguid = d.os === 'iOS' ? AUTHENTICATOR_AAGUIDS[0] : AUTHENTICATOR_AAGUIDS[1]
    const allowed = passkeyAllowed(pk, aaguid, null, 'register')
    return { best: 'authenticatorPasskey', builtIn: true, possible: allowed, whyNot: allowed === 'no' ? 'notAllowed' : null }
  }
  if (d.os === 'Windows') {
    if (d.trust === 'joined' || d.trust === 'hybrid') {
      const owners = d.deviceIds.flatMap((id) => ctx.deviceOwners.get(id.toLowerCase()) ?? [])
      if (userId && owners.length > 0 && !owners.some((o) => o.toLowerCase() === userId.toLowerCase())) return { best: fallback, builtIn: false, possible: 'yes', whyNot: 'otherAccount' }
      // IAMAI reads no Intune settings (owner, 2026-09-18), so whether Windows Hello for Business is provisioned
      // on a joined computer is unknown until a Windows Hello sign-in shows it.
      return { best: 'windowsHello', builtIn: true, possible: 'unknown', whyNot: null }
    }
    // Join state unreported: unknown, unless the directory holds no joined Windows computer.
    if (d.trust === null && ctx.windowsDirectory !== 'none' && ctx.windowsDirectory !== 'notJoined') return { best: 'windowsHello', builtIn: true, possible: 'unknown', whyNot: null }
    // Not joined: a passkey in Windows Hello, where an allow list names one of its models.
    if (WINDOWS_HELLO_AAGUIDS.some((a) => passkeyAllowed(pk, a, null, 'register') === 'yes')) return { best: 'windowsHelloPasskey', builtIn: true, possible: 'yes', whyNot: null }
    return { best: fallback, builtIn: false, possible: 'yes', whyNot: 'notJoined' }
  }
  if (d.os === 'macOS') {
    // A Platform SSO credential held: the Mac's own built-in credential, where the key restrictions allow its model.
    if (holdsPlatformCredential) {
      const allowed = platformCredentialAllowed(pk)
      return { best: 'platformSso', builtIn: true, possible: allowed, whyNot: allowed === 'no' ? 'notAllowed' : null }
    }
    if (pk.attestation === false && pk.restriction === 'unrestricted' && pk.reach !== 'unknown') return { best: 'syncedPasskey', builtIn: true, possible: 'yes', whyNot: null }
    return { best: fallback, builtIn: false, possible: 'yes', whyNot: pk.attestation === true ? 'attestation' : null }
  }
  // Linux and ChromeOS: nothing is built in; the best available is a key, and Ready is the top.
  return { best: 'securityKey', builtIn: false, possible: 'yes', whyNot: null }
}

/**
 * The kind of passkey a credential is, from its model or storage: in Microsoft
 * Authenticator, in Windows Hello, synced, a security key, or unknown (no AAGUID).
 */
type PasskeyForm = 'authenticator' | 'windowsHelloPasskey' | 'synced' | 'key' | 'unknown'
function passkeyForm(m: AuthMethodSummary | null, registered: string | null): PasskeyForm {
  const aaguid = m?.aaGuid?.toLowerCase() ?? null
  if (aaguid && AUTHENTICATOR_AAGUIDS.includes(aaguid)) return 'authenticator'
  if (aaguid && WINDOWS_HELLO_AAGUIDS.includes(aaguid)) return 'windowsHelloPasskey'
  if (/synced/i.test(m?.passkeyType ?? '')) return 'synced'
  if (aaguid) return 'key'
  if (registered) {
    if (/authenticator/i.test(registered)) return 'authenticator'
    if (/windowshello/i.test(registered)) return 'windowsHelloPasskey'
    if (/synced/i.test(registered)) return 'synced'
    return 'key'
  }
  return 'unknown'
}
/** The passkey form a built-in option signs in with. */
const FORM_OF: Partial<Record<SignInOption, PasskeyForm>> = { authenticatorPasskey: 'authenticator', windowsHelloPasskey: 'windowsHelloPasskey', syncedPasskey: 'synced' }

/**
 * Whether a proof on this device is its seamless option: the class its best
 * option signs in with, and, for a passkey, a credential of that built-in form
 * held (a security key carried to an iPhone or a Mac is Ready, not Seamless).
 * Where a credential's form can't be told (no AAGUID), it is not held against them.
 */
function seamlessProof(best: SignInOption, builtIn: boolean, possible: Verdict, cls: MethodClass, forms: ReadonlySet<PasskeyForm> = new Set(['unknown'])): boolean {
  // Windows Hello, and a Mac's Platform SSO credential, are built into the device they signed in on, whatever join state the record reported.
  if (cls === 'windowsHello' || cls === 'platformCredential') return true
  // Nothing built in, or the built-in option is impossible here: Ready is as far as this device goes.
  if (!builtIn || possible === 'no') return false
  if (best === 'windowsHello') return false
  if (cls !== 'passkey') return false
  const need = FORM_OF[best]
  return need !== undefined && (forms.has(need) || forms.has('unknown'))
}

/** The method classes held now, with each credential: the method rows where read, else the registration report; null where neither was. */
type InventoryRow = { cls: MethodClass; m: AuthMethodSummary | null; reg?: string }
function inventory(input: ReadinessInput): { classes: Set<MethodClass>; rows: InventoryRow[] } | null {
  const classes = new Set<MethodClass>()
  const rows: InventoryRow[] = []
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
    if (isQualifying(c) && !rows.some((r) => r.cls === c && r.reg === name)) rows.push({ cls: c, m: null, reg: name })
  }
  return { classes, rows }
}

export function personReadiness(input: ReadinessInput): PersonReadiness {
  const ctx = input.context ?? emptyReadinessContext(new Date().toISOString())
  // This person's passkey settings: the targets and profiles scoped to them (owner item 9).
  const pk = input.userId && ctx.passkeyFor ? ctx.passkeyFor(input.userId) : ctx.passkey
  const inv = inventory(input)
  const base: Omit<PersonReadiness, 'state' | 'methods' | 'qualifying' | 'hasPasskey' | 'next' | 'automated'> = { unknown: null, blocked: null, signInsRead: input.signIns.read, devices: [], credentials: [], onLeave: false, readyUntil: null, lastConfirmed: null, lost: [], other: null, recommended: null, usedRecently: null }
  const apps = input.signIns.apps ?? []
  const automated = apps.length > 0 && apps.every((a) => SCRIPTING.test(a))
  const inWindow = (at: string): boolean => at >= ctx.windowStart
  // A proof recorded before macOS Windows Hello sign-ins were read as Platform SSO reads as one now (proofClassOn).
  const onPlatform = (p: ProofRecord): ProofRecord => (proofClassOn(p.cls, p.os) === p.cls ? p : { ...p, cls: proofClassOn(p.cls, p.os) })
  const current = (input.signIns.proofs ?? []).map(onPlatform)

  // The devices used inside the window, before any method is weighed: an unreadable
  // method list still shows where the person signs in, never "no sign-in".
  const fromRecords = !!input.signIns.devices && input.signIns.devices.length > 0
  const seenDevices: DeviceSeen[] = devicesSeen(input.signIns)
  // Join state. Microsoft reports a sign-in's deviceId only for a device registered
  // in Entra ID, so a device whose records never named one is neither joined nor
  // registered; and with no Windows computer in the directory, none of them is.
  const settled = (d: DeviceSeen): DeviceSeen =>
    d.trust !== null ? d
    : fromRecords && d.deviceIds.length === 0 ? { ...d, trust: 'none' }
    : d.os === 'Windows' && ctx.windowsDirectory === 'none' ? { ...d, trust: 'none' }
    : d
  const inWindowDevices = seenDevices.filter((d) => inWindow(d.at)).sort((a, b) => byPlatform(a.os, b.os)).map(settled)
  const bare = (d: DeviceSeen): DeviceReading => {
    const e = eligibility(d, ctx, input.userId, pk, inv?.classes.has('platformCredential') === true)
    return { os: d.os, type: deviceTypeOf(d.os), lastSeen: d.at, trust: d.trust, version: d.version, ...e, offer: step3Keeps(e.best, ctx) ? e.best : fallbackOf(pk), proof: null, covered: false, seamless: false }
  }

  if (inv === null) return { ...base, automated, devices: inWindowDevices.map(bare), state: 'unknown', unknown: 'methods', methods: null, qualifying: [], hasPasskey: null, next: { kind: 'rescan', reason: ctx.methodsUnavailable ? 'methodsUnavailable' : 'methods' } }
  // The method rows never list certificates; where the registration report has no
  // row either, a certificate sign-in in the window shows one is held.
  if (input.registered === null && !inv.classes.has('certificate') && current.some((p) => p.cls === 'certificate' && inWindow(p.at))) {
    inv.classes.add('certificate')
    inv.rows.push({ cls: 'certificate', m: null })
  }
  const methods = [...inv.classes].sort(byClass)
  const history = input.history
  // Proof stands for a method held now: its class is held, and a method of that
  // class existed when the proof was made (a passkey registered after the last
  // passkey sign-in has not been seen working).
  const stands = (p: ProofRecord): boolean => {
    if (!inv.classes.has(p.cls) || !isQualifying(p.cls)) return false
    const rows = inv.rows.filter((r) => r.cls === p.cls)
    return rows.length === 0 || rows.some((r) => !r.m?.createdDateTime || r.m.createdDateTime <= p.at)
  }
  const windowProofs = latestProofs(current.filter((p) => inWindow(p.at) && stands(p)))
  // Kept proof is shown only for a credential that existed when it was made (the same chronology as the window's proof).
  const retained = latestProofs((history?.proofs ?? []).map(onPlatform).filter((p) => isQualifying(p.cls) && stands(p)))
  const latestOf = (cls: MethodClass): ProofLine | null => {
    const w = windowProofs.filter((p) => p.cls === cls).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
    if (w) return { cls, os: w.os, at: w.at, retained: false }
    const h = retained.filter((p) => p.cls === cls).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
    return h ? { cls, os: h.os, at: h.at, retained: true } : null
  }
  const seenWorking = (cls: MethodClass): boolean => windowProofs.some((p) => p.cls === cls && (ctx.policyChangedAt === null || p.at >= ctx.policyChangedAt))
  const step3 = new Set(ctx.step3.models.map((m) => m.aaguid.toLowerCase()))
  // Microsoft's last-use date (owner item 2): a passkey never used, or unused for 90 days, may be gone. One passkey
  // whose class is seen working in the window is in use whatever the date says.
  const staleBefore = new Date(Date.parse(ctx.now) - UNUSED_PASSKEY_DAYS * DAY).toISOString()
  const onlyPasskeySeen = inv.rows.filter((r) => r.cls === 'passkey').length === 1 && windowProofs.some((p) => p.cls === 'passkey')
  const unusedOf = (m: AuthMethodSummary | null): CredentialReading['unused'] => {
    if (!m || onlyPasskeySeen) return null
    if (m.lastUsedDateTime) return m.lastUsedDateTime < staleBefore ? 'stale' : null
    return m.lastUsedSourceVersion === 'beta' ? 'never' : null
  }
  // The passkey forms held, and those usable now: whether a passkey proof can be a device's built-in one.
  const forms = new Set<PasskeyForm>()
  const usableForms = new Set<PasskeyForm>()
  const credentials: CredentialReading[] = inv.rows.map(({ cls, m, reg }) => {
    const aaguid = m?.aaGuid ? m.aaGuid.toLowerCase() : null
    const seen = seenWorking(cls)
    // A passkey, and a Mac's Platform SSO credential, are usable only where the tenant's key restrictions allow their model.
    const allowedNow: Verdict = seen ? 'yes' : cls === 'passkey' ? passkeyAllowed(pk, aaguid, m?.passkeyType ?? null, 'use') : cls === 'platformCredential' ? platformCredentialAllowed(pk) : 'yes'
    if (cls === 'passkey') {
      forms.add(passkeyForm(m, reg ?? null))
      if (allowedNow !== 'no') usableForms.add(passkeyForm(m, reg ?? null))
    }
    const afterStep3: Verdict | null = cls !== 'passkey' || ctx.step3.applied || step3.size === 0 ? null : aaguid === null ? 'unknown' : step3.has(aaguid) ? 'yes' : 'no'
    const last = latestOf(cls)
    const model = cls === 'platformCredential' ? (ctx.modelNames.get(PLATFORM_CREDENTIAL_AAGUID) ?? null) : aaguid ? (ctx.modelNames.get(aaguid) ?? m?.model ?? null) : (m?.model ?? null)
    // The same model name on another AAGUID (other firmware): the approved list names this model, and still does not allow this key.
    const twin = cls === 'passkey' && aaguid && model ? ctx.step3.models.find((x) => x.name.toLowerCase() === model.toLowerCase() && x.aaguid.toLowerCase() !== aaguid) : undefined
    return {
      cls,
      key: m?.id ?? null,
      name: m?.displayName ?? null,
      aaguid: cls === 'platformCredential' ? PLATFORM_CREDENTIAL_AAGUID : aaguid,
      model,
      approvedTwin: twin ? twin.aaguid.toLowerCase() : null,
      createdInWindow: !!m?.createdDateTime && inWindow(m.createdDateTime),
      created: m?.createdDateTime ?? null,
      allowedNow,
      afterStep3,
      lastConfirmed: last ? { at: last.at, os: last.os, retained: last.retained } : null,
      lastUsed: cls === 'passkey' ? (m?.lastUsedDateTime ?? null) : null,
      unused: cls === 'passkey' ? unusedOf(m) : null,
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
  // Supporting evidence for Confirm it only: a usable passkey Microsoft says was used inside the window.
  const usedRecently = credentials.filter((c) => c.cls === 'passkey' && c.allowedNow !== 'no' && c.lastUsed !== null && inWindow(c.lastUsed)).map((c) => c.lastUsed as string).sort().pop() ?? null

  // What each device can do, and its latest phishing-resistant sign-in (the seamless one first).
  const read: DeviceReading[] = inWindowDevices.map((d) => {
    const e = bare(d)
    const seamlessOf = (cls: MethodClass): boolean => seamlessProof(e.best, e.builtIn, e.possible, cls, forms)
    const p = windowProofs.filter((x) => x.os === d.os && qualifying.includes(x.cls)).sort((a, b) => (seamlessOf(b.cls) ? 1 : 0) - (seamlessOf(a.cls) ? 1 : 0) || (a.at < b.at ? 1 : -1))[0]
    return { ...e, proof: p ? { cls: p.cls, at: p.at } : null, seamless: !!p && seamlessOf(p.cls) }
  })
  // Proof is required once per device type (owner, 2026-09-19): a Linux box beside a proven Windows laptop is covered.
  const provenTypes = new Set(read.filter((d) => d.proof !== null).map((d) => d.type))
  const devices: DeviceReading[] = read.map((d) => ({ ...d, covered: provenTypes.has(d.type) }))

  // The best thing to set up first: the phone passkey where a phone is used
  // (it also signs them in from any computer), Windows Hello on their own joined
  // computer otherwise, a security key where nothing else is possible.
  const firstSetUp = (): { option: SignInOption; os: Platform | null } => {
    const phone = devices.find((d) => d.type === 'phone' && d.possible !== 'no')
    // Each device's offer, never a best option Step 3 will refuse once it is applied.
    if (phone) return { option: phone.offer, os: phone.os }
    const own = devices.find((d) => d.best === 'windowsHello' && d.possible !== 'no')
    if (own) return { option: 'windowsHello', os: own.os }
    const any = devices.find((d) => d.possible !== 'no')
    // No device seen in the window: the phone passkey is the portable start.
    return any ? { option: any.offer, os: any.os } : { option: 'authenticatorPasskey', os: null }
  }

  if (usable.length === 0) {
    if (!input.signIns.read && devices.length === 0 && qualifying.length > 0) return { ...base, ...common, devices, state: 'unknown', unknown: 'signIns', next: { kind: 'rescan', reason: ctx.signInsUnavailable ? 'unavailable' : 'signIns' } }
    const phoneOnly = devices.length > 0 && !devices.some((d) => d.best === 'windowsHello' && d.possible !== 'no')
    const blocked: BlockReason | null =
      ctx.registration === 'trustedOnly' && input.signIns.trustedLocationSeen === false ? 'registrationLocation'
      : pk.enabled === false && phoneOnly ? 'passkeyOff'
      : devices.some((d) => d.type === 'phone') && devices.filter((d) => d.type === 'phone').every((d) => d.whyNot === 'notAllowed') && phoneOnly ? 'authenticatorNotAllowed'
      : null
    if (blocked) return { ...base, ...common, devices, state: 'blocked', blocked, next: { kind: 'waitSetup', reason: blocked } }
    const onlyOffList = credentials.some((c) => c.cls === 'passkey' && c.allowedNow === 'no')
    const next: NextAction = lost.length > 0 && !onlyOffList ? { kind: 'restore', cls: lost[0].cls, lastSeen: lost[0].lastSeen } : { kind: 'setUp', ...firstSetUp() }
    return { ...base, ...common, devices, state: 'method', next }
  }

  if (!input.signIns.read || input.signIns.proofs === null) return { ...base, ...common, devices, state: 'unknown', unknown: 'signIns', next: { kind: 'rescan', reason: ctx.signInsUnavailable ? 'unavailable' : 'signIns' } }

  if (devices.length === 0 && windowProofs.some((p) => qualifying.includes(p.cls))) {
    // A phishing-resistant sign-in in the window whose record named no platform:
    // confirmed, though IAMAI cannot say on which device (never "on leave").
    const latest = windowProofs.filter((p) => qualifying.includes(p.cls)).map((p) => p.at).sort().pop() as string
    return { ...base, ...common, devices, readyUntil: new Date(Date.parse(latest) + READINESS_WINDOW_DAYS * DAY).toISOString(), state: 'ready', next: { kind: 'none' } }
  }
  if (devices.length === 0) {
    // No interactive sign-in inside the window. Where the records read began
    // after the window did, and the directory says they signed in inside it, the
    // missing records are IAMAI's gap, not the person's.
    const last = input.lastSuccessfulSignIn ?? null
    const gap = input.signIns.individuallyRead !== true && ctx.coveredFrom !== null && ctx.coveredFrom > ctx.windowStart && last !== null && last >= ctx.windowStart && last < ctx.coveredFrom
    if (gap) return { ...base, ...common, devices, state: 'unknown', unknown: 'notCovered', next: { kind: 'rescan', reason: 'notCovered' } }
    return { ...base, ...common, devices, state: 'confirm', onLeave: true, usedRecently, next: { kind: 'returnConfirm' } }
  }

  // A key that stops working under Step 3's settings, where it is the only usable method.
  const onlyKey = usable.length === 1 && usable[0].cls === 'passkey' && usable[0].afterStep3 === 'no' ? usable[0] : null
  const proven = devices.filter((d) => d.proof !== null)
  if (proven.length === 0) {
    // Until Step 3 is in place any passkey counts (owner decision): the key is confirmed
    // like any other, and the off-list model is flagged on the credential and, once Ready, as a recommendation.
    const cls = qualifying[0]
    const os = (cls === 'windowsHello' ? devices.find((d) => d.os === 'Windows') : cls === 'platformCredential' ? devices.find((d) => d.os === 'macOS') : devices[0])?.os ?? null
    return { ...base, ...common, devices, state: 'confirm', usedRecently, next: { kind: 'confirm', cls, os } }
  }
  const missing = devices.filter((d) => !d.covered)
  if (missing.length > 0) {
    // The one action that closes the gap on a device type, in order: sign in once with a
    // credential they already hold that works there; set up the best option; update
    // a phone too old for it; and only where every gap waits on a tenant setting, Blocked.
    const holdsFor = (d: DeviceReading): MethodClass | null => {
      if (d.type === 'phone') return usableForms.has('authenticator') || (usableForms.has('synced') && d.best === 'syncedPasskey') ? 'passkey' : null
      // A Mac with Platform SSO set up: sign in once with it there.
      if (d.os === 'macOS' && qualifying.includes('platformCredential')) return 'platformCredential'
      if (d.builtIn && d.possible !== 'no') return null
      return qualifying.includes('passkey') ? 'passkey' : qualifying.includes('certificate') ? 'certificate' : null
    }
    const confirmable = missing.find((d) => holdsFor(d) !== null)
    if (confirmable) return { ...base, ...common, devices, state: 'device', next: { kind: 'confirm', cls: holdsFor(confirmable) as MethodClass, os: confirmable.os } }
    const settable = missing.find((d) => d.possible !== 'no')
    if (settable) return { ...base, ...common, devices, state: 'device', next: { kind: 'addDevice', os: settable.os, option: settable.offer } }
    const old = missing.find((d) => d.whyNot === 'osTooOld')
    if (old) return { ...base, ...common, devices, state: 'device', next: { kind: 'updateOs', os: old.os } }
    const reason: BlockReason = pk.enabled === false ? 'passkeyOff' : 'authenticatorNotAllowed'
    return { ...base, ...common, devices, state: 'blocked', blocked: reason, next: { kind: 'waitSetup', reason } }
  }
  // Ready until the oldest device type's latest phishing-resistant sign-in leaves the window
  // (its latest, not its seamless one: a later key sign-in keeps the device Ready).
  const typeOf = new Map(devices.map((d) => [d.os, d.type]))
  const latestOn = (t: DeviceType): string => windowProofs.filter((x) => x.os !== null && typeOf.get(x.os) === t && qualifying.includes(x.cls)).map((x) => x.at).sort().pop() as string
  const readyUntil = [...provenTypes].map((t) => new Date(Date.parse(latestOn(t)) + READINESS_WINDOW_DAYS * DAY).toISOString()).sort()[0] ?? null
  // Recommend only what the device can have: a built-in option that is not ruled out, now or by Step 3.
  const upgrade = devices.find((d) => !d.seamless && d.builtIn && d.possible !== 'no' && d.offer === d.best)
  const seamless = devices.length > 0 && devices.every((d) => d.seamless)
  // The only usable key stopping under Step 3 comes first: an upgrade is a convenience, and the
  // replacement is what keeps them Ready once the plan's own step lands.
  const recommended: NextAction | null = onlyKey ? { kind: 'replaceKey', model: onlyKey.model, aaguid: onlyKey.aaguid } : upgrade ? { kind: 'seamless', os: upgrade.os, option: upgrade.best } : null
  return { ...base, ...common, devices, readyUntil, state: seamless ? 'seamless' : 'ready', next: { kind: 'none' }, recommended }
}
