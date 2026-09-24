// Golden digests of the sign-in derivations, captured on the code before the
// streaming read (c09b9db7). Each derivation's output, over a frozen synthetic
// set of rows in three orders, is hashed; a change to a derivation's output
// moves its digest.
//
// Regenerate only when a derivation's output is meant to change, and say so in
// the commit: GOLDEN_PRINT=1 node --test src/graph/collect/laneBDerive.golden.test.ts
//
// The generator lives here and nowhere else, so a change to a shared test
// helper cannot move the digests.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import firstParty from '../../../data/first-party-apps.json' with { type: 'json' }
import { aggregate, deriveAggregates, deriveBlockedToday, derivePolicyResults, deriveReportOnlyPolicyIds, deriveUsageSignals } from './laneBCore.ts'
import { deriveScenarioEvidence } from '../../derive/evidence.ts'
import type { StoredSignIn } from './types.ts'

const NOW = Date.parse('2026-09-01T00:00:00Z')
const SEEDS = [11, 2027, 90210] as const
const ROWS = 2_000
const PEOPLE = 150
const POLICIES = 12
/** The records crafted below the random ones: twelve apps, seven for policy 07, four for policy 11, two blocked, twelve ties, two passkeys. */
const CRAFTED = 39

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const whole = (ms: number): string => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z')
const person = (n: number): string => `person-${String(n).padStart(3, '0')}`
const policy = (n: number): string => `policy-${String(n).padStart(2, '0')}`
const guid = (rnd: () => number): string => {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}

type App = { appId: string; displayName: string; role?: string }
const APPS = (firstParty as { apps: App[] }).apps
const byRole = (role: string) => APPS.filter((a) => a.role === role)
const TECHNICIAN = byRole('technician tool')
const SERVER = byRole('server sign-in')
const DEVICE = byRole('device sign-in')
const OTHER_FIRST_PARTY = APPS.filter((a) => !a.role)
const CUSTOM = [
  { appId: 'c0ffee00-0000-4000-a000-000000000001', displayName: 'FortiClient VPN' },
  { appId: 'c0ffee00-0000-4000-a000-000000000002', displayName: 'Contoso HR' },
  { appId: 'c0ffee00-0000-4000-a000-000000000003', displayName: 'Payroll Portal' },
  { appId: 'c0ffee00-0000-4000-a000-000000000004', displayName: '' },
]
const AZURE = [
  { appId: 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c', displayName: 'Azure Portal' },
  { appId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', displayName: 'Windows Azure Service Management API' },
]
const RESOURCES = ['Office 365 Exchange Online', 'Microsoft Graph', 'Windows Azure Service Management API', 'Microsoft Teams', 'Office 365 SharePoint Online', undefined]
const RESULTS = ['success', 'failure', 'notApplied', 'notEnabled', 'reportOnlySuccess', 'reportOnlyFailure', 'reportOnlyInterrupted', 'reportOnlyNotApplied', 'unknownFutureValue']
const CLIENTS = ['Browser', 'Mobile Apps and Desktop clients', 'Exchange ActiveSync', 'IMAP4', 'Authenticated SMTP', 'Other clients', 'POP3', 'Exchange Web Services', undefined]
const PROTOCOLS = ['none', 'deviceCode', 'ropc', undefined]
const TRANSFERS = ['none', 'deviceCodeFlow', 'authenticationTransfer', undefined]
const RISK = ['none', 'low', 'medium', 'high', 'hidden', undefined]
const OS: StoredSignIn['os'][] = ['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS', '', undefined]
const BROWSERS = ['Chrome', 'Edge', 'Safari', 'Rich Client', '']
const TRUST: StoredSignIn['trustType'][] = ['joined', 'hybrid', 'registered', 'none', undefined]
const CROSS: StoredSignIn['crossTenantAccessType'][] = ['none', 'none', 'none', 'b2bCollaboration', 'b2bDirectConnect', 'serviceProvider', undefined]
const COUNTRIES = ['US', 'GB', 'DE', 'AU', undefined]
const LOCATIONS = [[], [], ['HQ'], ['Branch', 'HQ'], ['Remote']]
const STEPS = [
  { authenticationMethod: 'Password', succeeded: true },
  { authenticationMethod: 'Mobile app notification', succeeded: true },
  { authenticationMethod: 'Text message', succeeded: true },
  { authenticationMethod: 'Passkey (device-bound)', succeeded: true, authenticationStepResultDetail: 'MFA successfully completed' },
  { authenticationMethod: 'FIDO2 security key', succeeded: true, authenticationStepResultDetail: 'MFA requirement satisfied by claim in the token' },
  { authenticationMethod: 'Windows Hello for Business', succeeded: true },
  { authenticationMethod: 'X.509 Certificate', succeeded: true },
  { authenticationMethod: 'Previously satisfied', succeeded: true, authenticationStepResultDetail: 'First factor requirement satisfied by claim in the token' },
  { authenticationMethod: 'Mobile app notification', succeeded: false },
]
const MFA_DETAIL = [{ authMethod: 'Mobile app notification' }, { authMethod: 'Text message' }, { authMethod: 'Windows Hello for Business' }, { authMethod: '' }, { authMethod: 'Previously satisfied' }, null, undefined]

/** One seed's rows, newest first, ties in generation order. */
function generate(seed: number): StoredSignIn[] {
  const rnd = mulberry32(seed)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
  const rows: { row: StoredSignIn; n: number }[] = []
  let n = 0
  const add = (row: StoredSignIn) => rows.push({ row, n: n++ })
  const base = (at: string, userId: string): StoredSignIn => ({ id: guid(rnd), createdDateTime: at, userId, status: { errorCode: 0 } })

  // Random records, older than the last minute. Policies 07 and 11 are kept for the crafted records below.
  const randomPolicies = Array.from({ length: POLICIES }, (_, k) => k).filter((k) => k !== 7 && k !== 11)
  for (let i = 0; i < ROWS - CRAFTED; i++) {
    const at = whole(NOW - 60_000 - rnd() * 30 * 86_400_000)
    const userId = rnd() < 0.01 ? '' : person(Math.floor(rnd() * PEOPLE))
    const app = rnd() < 0.08 ? pick(TECHNICIAN) : rnd() < 0.05 ? pick(SERVER) : rnd() < 0.05 ? pick(DEVICE) : rnd() < 0.05 ? pick(AZURE) : rnd() < 0.2 ? pick(CUSTOM) : pick(OTHER_FIRST_PARTY)
    const cross = pick(CROSS)
    const applied = rnd() < 0.05 ? null : Array.from({ length: Math.floor(rnd() * 5) }, () => {
      const k = pick(randomPolicies)
      const entry: { id?: string; displayName?: string; result?: string } = { id: policy(k), displayName: rnd() < 0.8 ? `Policy ${k}` : undefined, result: pick(RESULTS) }
      if (rnd() < 0.03) delete entry.result
      if (rnd() < 0.02) delete entry.id
      return entry
    })
    const caFailure = applied?.some((p) => p.result === 'failure') ?? false
    add({
      ...base(at, userId),
      status: { errorCode: rnd() < 0.85 ? 0 : pick([50074, 53003, 50126]) },
      authenticationRequirement: rnd() < 0.5 ? 'multiFactorAuthentication' : 'singleFactorAuthentication',
      mfaDetail: pick(MFA_DETAIL),
      authenticationDetails: rnd() < 0.1 ? null : Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ ...pick(STEPS), authenticationStepDateTime: at })),
      conditionalAccessStatus: caFailure ? 'failure' : pick(['success', 'notApplied', 'success']),
      appliedConditionalAccessPolicies: applied,
      clientAppUsed: pick(CLIENTS),
      appId: app.appId,
      appDisplayName: app.displayName || undefined,
      resourceId: rnd() < 0.5 ? '00000003-0000-0000-c000-000000000000' : undefined,
      resourceDisplayName: pick(RESOURCES),
      resourceTenantId: rnd() < 0.5 ? 'resource-tenant' : undefined,
      isInteractive: pick([true, false, undefined]),
      authenticationProtocol: pick(PROTOCOLS),
      originalTransferMethod: pick(TRANSFERS),
      country: pick(COUNTRIES),
      riskLevelDuringSignIn: pick(RISK),
      riskLevelAggregated: pick(RISK),
      os: pick(OS),
      browser: pick(BROWSERS),
      isCompliant: pick([true, false, undefined]),
      isManaged: pick([true, false, undefined]),
      trustType: pick(TRUST),
      deviceId: rnd() < 0.4 ? `device-${Math.floor(rnd() * 40)}` : undefined,
      deviceName: rnd() < 0.3 ? `PC-${Math.floor(rnd() * 40)}` : undefined,
      osVersion: rnd() < 0.5 ? pick(['Windows 11', 'iOS 17.5', 'macOS 14.4', 'Android 14']) : undefined,
      crossTenantAccessType: cross,
      homeTenantId: cross === 'b2bCollaboration' || cross === 'serviceProvider' ? `home-tenant-${Math.floor(rnd() * 4)}` : undefined,
      namedLocations: pick(LOCATIONS),
      trustedLocation: rnd() < 0.3,
    })
  }

  // One person with more than eight successful apps and more than five devices on one platform.
  const busy = person(0)
  const apps = [...OTHER_FIRST_PARTY.slice(0, 9), ...CUSTOM.slice(0, 3)]
  apps.forEach((app, i) => add({ ...base(whole(NOW - 3_600_000 * (i + 2)), busy), appId: app.appId, appDisplayName: app.displayName, os: 'Windows', trustType: i % 2 ? 'hybrid' : 'registered', deviceId: `busy-device-${i}`, osVersion: `Windows 11 ${i}`, isManaged: i % 3 === 0 }))

  // Policy 07: report-only, then enforced, then report-only again, with an
  // enforced and a report-only record in the same second.
  const p7 = (at: string, userId: string, result: string) => add({ ...base(at, userId), appliedConditionalAccessPolicies: [{ id: policy(7), displayName: 'Policy 7', result }] })
  p7(whole(NOW - 25 * 86_400_000), person(10), 'reportOnlyFailure')
  p7(whole(NOW - 24 * 86_400_000), person(11), 'reportOnlySuccess')
  p7(whole(NOW - 15 * 86_400_000), person(12), 'success')
  const tie = whole(NOW - 10 * 86_400_000)
  p7(tie, person(13), 'failure')
  p7(tie, person(14), 'reportOnlySuccess')
  p7(whole(NOW - 5 * 86_400_000), person(15), 'reportOnlyFailure')
  p7(whole(NOW - 2 * 86_400_000), person(16), 'reportOnlyInterrupted')

  // Policy 11: only reportOnlyNotApplied records.
  for (let i = 0; i < 4; i++) add({ ...base(whole(NOW - (i + 1) * 86_400_000 - 777_000), person(20 + i)), appliedConditionalAccessPolicies: [{ id: policy(11), displayName: 'Policy 11', result: 'reportOnlyNotApplied' }] })

  // Blocked on their latest sign-in: one with failing entries, one with none (the 'unknown' target).
  add({ ...base(whole(NOW - 5_000), person(1)), conditionalAccessStatus: 'failure', status: { errorCode: 53003 }, appliedConditionalAccessPolicies: [{ id: policy(3), displayName: 'Policy 3', result: 'failure' }, { id: policy(4), result: 'success' }] })
  add({ ...base(whole(NOW - 6_000), person(2)), conditionalAccessStatus: 'failure', status: { errorCode: 53003 }, appliedConditionalAccessPolicies: [] })

  // Same person, same second: the tie rules.
  for (let i = 0; i < 6; i++) {
    const at = whole(NOW - 20_000 - i * 1_000)
    const who = person(30 + i)
    add({ ...base(at, who), conditionalAccessStatus: 'failure', status: { errorCode: 53003 }, appliedConditionalAccessPolicies: [{ id: policy(5), result: 'failure' }], os: 'iOS', osVersion: 'iOS 17.1', deviceId: `tie-${i}-a`, mfaDetail: { authMethod: 'Text message' }, authenticationRequirement: 'multiFactorAuthentication' })
    add({ ...base(at, who), conditionalAccessStatus: 'success', appliedConditionalAccessPolicies: [{ id: policy(5), result: 'success' }], os: 'iOS', osVersion: 'iOS 17.2', deviceId: `tie-${i}-b`, authenticationDetails: [{ authenticationMethod: 'Passkey (device-bound)', succeeded: true }], authenticationRequirement: 'multiFactorAuthentication' })
  }

  // A passkey sign-in with no authentication details, and one with a fresh step.
  add({ ...base(whole(NOW - 40_000), person(40)), mfaDetail: { authMethod: 'Passkey (device-bound)' }, authenticationDetails: null, authenticationRequirement: 'multiFactorAuthentication' })
  add({ ...base(whole(NOW - 41_000), person(41)), authenticationDetails: [{ authenticationMethod: 'FIDO2 security key', succeeded: true, authenticationStepDateTime: whole(NOW - 41_500), authenticationStepResultDetail: 'MFA successfully completed' }], authenticationRequirement: 'multiFactorAuthentication' })

  return rows.sort((a, b) => (a.row.createdDateTime < b.row.createdDateTime ? 1 : a.row.createdDateTime > b.row.createdDateTime ? -1 : a.n - b.n)).map((x) => x.row)
}

function orders(seed: number, rows: StoredSignIn[]): Record<string, StoredSignIn[]> {
  const rnd = mulberry32(seed ^ 0x5eed)
  const shuffled = [...rows]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return { newest: rows, oldest: [...rows].reverse(), shuffled }
}

function owners(seed: number): Set<string> {
  const rnd = mulberry32(seed ^ 0x0a11)
  const out = new Set<string>()
  while (out.size < 20) out.add(person(Math.floor(rnd() * PEOPLE)))
  return out
}

const DERIVATIONS: Record<string, (rows: StoredSignIn[], seed: number) => unknown> = {
  aggregate: (rows) => aggregate(rows),
  derivePolicyResults: (rows) => derivePolicyResults(rows),
  deriveReportOnlyPolicyIds: (rows) => deriveReportOnlyPolicyIds(rows),
  deriveBlockedToday: (rows) => deriveBlockedToday(rows),
  deriveUsageSignals: (rows) => deriveUsageSignals(rows),
  deriveAggregates: (rows) => deriveAggregates(rows),
  'deriveScenarioEvidence(null)': (rows) => deriveScenarioEvidence(rows, null),
  'deriveScenarioEvidence(owners)': (rows, seed) => deriveScenarioEvidence(rows, owners(seed)),
}

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function digests(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const seed of SEEDS) {
    const rows = generate(seed)
    for (const [order, ordered] of Object.entries(orders(seed, rows))) {
      for (const [name, derive] of Object.entries(DERIVATIONS)) out[`${name} · seed ${seed} · ${order}`] = digest(derive(ordered, seed))
    }
  }
  return out
}

// Captured at c09b9db7.
const GOLDEN: Record<string, string> = {
  'aggregate · seed 11 · newest': '82b070907162827bbc0f40b68adbdcb37a7eb713e91b308bb3a86772ee794437',
  'derivePolicyResults · seed 11 · newest': '585735cdfa27083d82ca505e4ad82071da73efeb543fde5bc773cece9584fb9f',
  'deriveReportOnlyPolicyIds · seed 11 · newest': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 11 · newest': 'ce7d47dde6152e5970030fb124a745fa03488df0511d751939570239b4b0a9ba',
  'deriveUsageSignals · seed 11 · newest': 'b6d52baef7814b1a13921903497af04085337f9efcf4813ffb2f598e844f0e9e',
  'deriveAggregates · seed 11 · newest': '2c8a140bef8705d1438498387348c117aed54fc8510d9c3cd2a28acd4ee88042',
  'deriveScenarioEvidence(null) · seed 11 · newest': '2d575e3a286e2e086fa7645290c2a130a912fd367b96dea1a1d9230a23ff118d',
  'deriveScenarioEvidence(owners) · seed 11 · newest': '6afabee3c3f8d3bedb2cb78cff2cb38f71daf27365149a669dd04fcf55804efd',
  'aggregate · seed 11 · oldest': 'c8fe871d2a522b3538abd6dae978fed26bcccff341bbaaae9fc8aabb01ae2b9a',
  'derivePolicyResults · seed 11 · oldest': '9e69e95069a97f0217132acbd24cd48e2ae4227924519e7978f8a479e651ad70',
  'deriveReportOnlyPolicyIds · seed 11 · oldest': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 11 · oldest': '16d6750cb439beec0c8147c0e94309d82264cab911cc6b73bb5c683c6f7f730a',
  'deriveUsageSignals · seed 11 · oldest': '5eae9a30f98fa222e8b90bd09aca2f75d6e98aa73d61a1ec252c2392a43ef64a',
  'deriveAggregates · seed 11 · oldest': '7b1514ee8d14c2a23b0d81ec8c7079da674e8f9b34cfef63e95b8969d7fa781c',
  'deriveScenarioEvidence(null) · seed 11 · oldest': 'bead3c91103979880b793059ee457cb70987b5cd197382149dd1b99159e4af49',
  'deriveScenarioEvidence(owners) · seed 11 · oldest': '8788cf870c1ceff8cb23571e64ca358d7329355ac2e13bc62ce19d6c8c0a6cfd',
  'aggregate · seed 11 · shuffled': 'd33c56f9070f4c83fdb3aae46529d65c1689b4e79c1eb2535abc7d14d7a8ea77',
  'derivePolicyResults · seed 11 · shuffled': 'c4266e584d521a490e5e97cd583e370850d46e97ccf93aae547a41e65898a38f',
  'deriveReportOnlyPolicyIds · seed 11 · shuffled': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 11 · shuffled': 'e65a5211ef297e9937d85ad6a1be8003508b83c865354aa7a39567664c0ed14c',
  'deriveUsageSignals · seed 11 · shuffled': '870e02ea25235f183c2e5b0d409e04ab4aeed22343ff48fb432ebb604f9f646c',
  'deriveAggregates · seed 11 · shuffled': 'fa1ee2dd60d07e0c57e5ce25cee80e42cd8ea9ec43bc831663cdbd00a550fe80',
  'deriveScenarioEvidence(null) · seed 11 · shuffled': '0400a5f5e5acb02d7fcaaab32554a761fa9064dde5d8aacfd6366dcd1049eb3e',
  'deriveScenarioEvidence(owners) · seed 11 · shuffled': '495f13023ddd37b8276ffb18bc5d50fc810b284133816779730ff0cf84e482ea',
  'aggregate · seed 2027 · newest': 'f607044496cb28799707857ceab673b6524667915a9d2eb31ca15b6a6645ecaa',
  'derivePolicyResults · seed 2027 · newest': '331c711b740dfd40aacb272463e27bd946ea57728a41c9f11a6da2d8c34f15b0',
  'deriveReportOnlyPolicyIds · seed 2027 · newest': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 2027 · newest': '5a60dd74795e6a00044fc9d99c7ab449229c0cd4c29f6a0f4b4715c020517fb4',
  'deriveUsageSignals · seed 2027 · newest': 'eee2c6776aa8294e5483dd3b4c02a2d2751d432460b6357f6605a97690239c04',
  'deriveAggregates · seed 2027 · newest': 'a3effdd114e5262c6deab7ce27886d31424bb3dd3ff2bc36c4c2a0ad3862f6e5',
  'deriveScenarioEvidence(null) · seed 2027 · newest': 'a8bde093071f71a11cdaacbe5942521ceec58ac939615ca1138f93ff0c60f555',
  'deriveScenarioEvidence(owners) · seed 2027 · newest': 'fa2d2b299d724a02c88e0f88797e02f0239106bc7cd5289faa4f03a9ce102100',
  'aggregate · seed 2027 · oldest': '10c51c3ec7b44e0f3ed50a1e2669f1e0aa1616e8ae4d143942a62ab62283b023',
  'derivePolicyResults · seed 2027 · oldest': '8fee9ccd1d71f501cc597cb95f2154d408d3a937910f07599a448fc9c0739a16',
  'deriveReportOnlyPolicyIds · seed 2027 · oldest': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 2027 · oldest': '5583b8de45965129d214c59e98c0539aaa371ed50eed680876c9a103438a145c',
  'deriveUsageSignals · seed 2027 · oldest': '60e1a493d191a70f3d92fdda349744d21ef5197a9e4b43064c7f0cf4899e70de',
  'deriveAggregates · seed 2027 · oldest': '4606a9a9d8565204ddd1d19b66ae339b5ea7ecdc0bfa1a38b3dfd0b9aae3baa4',
  'deriveScenarioEvidence(null) · seed 2027 · oldest': 'fb7e33a1729bb1b33995805c99da52386914e4ca932e1c0f4c28eeb4397852e8',
  'deriveScenarioEvidence(owners) · seed 2027 · oldest': 'd5a41ee2260c38a57050e2b5c71b02de80655fb7547e2684b5d0ce63616ec3f1',
  'aggregate · seed 2027 · shuffled': '700d61af67061c19f6f9255ddb9cd1d79c5feb9e13b65620ba7423c167e61657',
  'derivePolicyResults · seed 2027 · shuffled': '6683f093f5b05f87b2170eba33672138322b3fb758f9d2fbd75f140f9666f158',
  'deriveReportOnlyPolicyIds · seed 2027 · shuffled': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 2027 · shuffled': '7c8e9f57628c3cd17b5984dc7fd2c7db85d83bdb9f37336a1930b8c1d06fc252',
  'deriveUsageSignals · seed 2027 · shuffled': 'f4d1da1ac45d24cab1ee6167a2ca03e3785b2cd289b78cb311dd83c685714ea6',
  'deriveAggregates · seed 2027 · shuffled': 'db45eb7dc4867ac6f5ea4413dcc0441a1d420e46356d8e944fe68aaff88ce8d4',
  'deriveScenarioEvidence(null) · seed 2027 · shuffled': 'b1a3e66e8de6b1cd4b929edfa023a3aed2cec6393f3942562bd6d9682db36908',
  'deriveScenarioEvidence(owners) · seed 2027 · shuffled': 'd76009a97ced52f590276f0b42a0e856dfb0667265e615a5a06d2851aa27bd51',
  'aggregate · seed 90210 · newest': 'e619ed40517fcb866807c4cfc082df807843465d683ff6c3beb1d7668efcb2b7',
  'derivePolicyResults · seed 90210 · newest': '9200ea13c0d63f22ae6519104b8d5ca2894a42c617034f6d0a35c06bfadf3647',
  'deriveReportOnlyPolicyIds · seed 90210 · newest': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 90210 · newest': 'c68140c1801d13c47f0a44ebe7b6aac0cceb2894c7044a65efbef411afcec237',
  'deriveUsageSignals · seed 90210 · newest': '2195eef272602780b2dc090823827d204326582852bd8532c28da9781ca2e35d',
  'deriveAggregates · seed 90210 · newest': '5fa0592fd96df87b21ac954db14ec5821dfd23ee01e0746e5ff14fd03dd23a34',
  'deriveScenarioEvidence(null) · seed 90210 · newest': '72cc650e32d94be4813c90e2fcadaf7fb019970be35661afdf35251434225fa5',
  'deriveScenarioEvidence(owners) · seed 90210 · newest': 'c6424bc00094d8a967df40fc04ff9b4827ea26edfb57f936505b389719397c5e',
  'aggregate · seed 90210 · oldest': '71324aaaaa079d9b5aa9c8636aa2653415004faa956cdfea2106723e1a45b80d',
  'derivePolicyResults · seed 90210 · oldest': '4e833af559e2311a8bae79b56786f755830b0254242b4dcd9fb9f702cb06e3f1',
  'deriveReportOnlyPolicyIds · seed 90210 · oldest': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 90210 · oldest': 'f931ca794f84e9b2c74fb8514caa04072180ae7553cc02401b28a268c51ae233',
  'deriveUsageSignals · seed 90210 · oldest': '3bb94f5b452cab55758fa673443a22ffb94695c0b38722892a42c0b490194884',
  'deriveAggregates · seed 90210 · oldest': '264b6798695d1c198f6650c3a968e609ca221249c992f31e0217184c9150a6af',
  'deriveScenarioEvidence(null) · seed 90210 · oldest': 'b937e031ddf1909e6c4b30086237ef16cdd8a9048e8c335bea6065a5ced797ba',
  'deriveScenarioEvidence(owners) · seed 90210 · oldest': '2725f71e63dc236f8359017c900edfda0a958aca06330181da74b2230b058d3e',
  'aggregate · seed 90210 · shuffled': 'ff18ac0f94d43ed75330018fbd20f9c3e1eeaf39f0ceb83dcc3f7a50d1357bbd',
  'derivePolicyResults · seed 90210 · shuffled': '1df57b28de41989b6a9fe0f5d6661ed9e27db61c63a2227691580e79c2eaea35',
  'deriveReportOnlyPolicyIds · seed 90210 · shuffled': '8bb56877477c88f87883f05d7461733bb76ffdb76ae350f4e9d9191e7849e0d4',
  'deriveBlockedToday · seed 90210 · shuffled': '48dbeb227c4c30d21a9088a3558fb776a432ea87c69c8e58839b9e8ba87a8b65',
  'deriveUsageSignals · seed 90210 · shuffled': '3a879ae22025ad99a49e5ee81ede7e935bf38713dd7e0558b93a05816c4e197d',
  'deriveAggregates · seed 90210 · shuffled': '3075b083b69681e2598512456177241387e6c6de166f9d0072910203c65b2bab',
  'deriveScenarioEvidence(null) · seed 90210 · shuffled': '9047474cd0522e40fbb770f5fa2713bd54f3d246f2eca58c3bfee32543d7dcd6',
  'deriveScenarioEvidence(owners) · seed 90210 · shuffled': '7bbb2b85a5394372d814c2d29b51402e5df2ec89c70ef1e28ce6eadab958b8bf',
}

test('the synthetic rows reach every branch the digests pin, and the sign-in derivations give the outputs captured before the streaming read', () => {
  // the synthetic rows reach every branch the digests are meant to pin
  {
    const rows = generate(SEEDS[0])
    assert.equal(rows.length, ROWS)
    const perUser = aggregate(rows)
    assert.ok((perUser[person(0)].apps ?? []).length === 8, 'the busy person reaches the eight-app cap')
    assert.ok((perUser[person(0)].devices ?? []).some((d) => d.deviceIds.length === 5), 'and the five-device cap')
    const p7 = derivePolicyResults(rows).find((p) => p.policyId === policy(7))
    assert.ok(p7 && typeof p7.firstReportOnlyAt === 'string' && p7.firstReportOnlyAt > whole(NOW - 10 * 86_400_000), 'policy 07 counts only the report-only records since it came off')
    assert.ok(deriveReportOnlyPolicyIds(rows).includes(policy(11)))
    assert.equal(derivePolicyResults(rows).some((p) => p.policyId === policy(11)), false)
    const blocked = deriveBlockedToday(rows)
    assert.ok(blocked.some((b) => b.policyId === 'unknown' && b.userIds.includes(person(2))))
    assert.ok(blocked.some((b) => b.policyId === policy(3) && b.userIds.includes(person(1))))
    const scenarios = deriveScenarioEvidence(rows)
    for (const key of ['legacyClients', 'ropcAutomation', 'serverSignIns', 'technicianToolsOffCompliance', 'guestsSeen', 'serviceProviderSignIns', 'nonMicrosoftApps', 'emptyPlatform', 'azureSignIns'] as const) {
      assert.ok(scenarios[key]!.count > 0, `${key} fires on the synthetic rows`)
    }
    assert.ok(Object.values(perUser).some((u) => (u.recoveryCandidates ?? []).length > 0), 'passkey records give recovery candidates')
    const usage = deriveUsageSignals(rows)
    assert.ok(usage.deviceCode.count > 0 && usage.authTransfer.count > 0 && usage.riskHigh.count > 0 && usage.legacyAuth.count > 0)
  }
  // the sign-in derivations give the outputs captured before the streaming read
  {
    const now = digests()
    if (process.env.GOLDEN_PRINT === '1') {
      console.log(`const GOLDEN: Record<string, string> = {\n${Object.entries(now).map(([k, v]) => `  '${k}': '${v}',`).join('\n')}\n}`)
      return
    }
    assert.equal(Object.keys(now).length, 72)
    for (const [key, value] of Object.entries(now)) assert.equal(value, GOLDEN[key], `${key}: the output moved`)
  }
})
