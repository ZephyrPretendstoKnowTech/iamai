// Emergency-access detection (prompt 46 item 20): five signals nominate and
// the explicit name recommends. Nothing here classifies — taking an account out
// of the people population is the operator's decision and only theirs
// (mapping/emergencyChoice.ts), so this file also holds the proof that a
// detection cannot become one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectEmergencyAccess, emergencySignals, isEmergencyName, recommendedEmergencyAccess } from './emergencyAccess.ts'
import { emergencySelection, migrateEmergencySelection, operatorConfirmedEmergency } from './emergencyChoice.ts'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { emptyMappingState } from './types.ts'
import type { MappingState } from './types.ts'
import { applyDetectedDefaults } from './wizard.ts'
import { appliedMapping, defaultDecisions, pickerVars } from '../ui/surfaces/pickerRows.ts'
import { DECISION_STEPS, applyStepDecisions } from '../roadmap/decisions.ts'
import { facts } from '../derive/facts.ts'
import { BREAK_GLASS_STEP_ID } from '../roadmap/generate.ts'
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const user = (over: Partial<UserRow>): UserRow => ({
  id: 'u',
  displayName: 'Alex Morgan',
  userPrincipalName: 'alex@contoso.com',
  userType: 'member',
  usageLocation: 'AU',
  createdDateTime: null,
  lastSuccessfulSignIn: null,
  accountEnabled: true,
  mail: null,
  assignedPlans: [{ servicePlanId: 'p', capabilityStatus: 'Enabled' }],
  onPremisesSyncEnabled: false,
  externalUserState: null,
  department: null,
  jobTitle: null,
  officeLocation: null,
  ...over,
})

// The name signal recommends on its own, so it reads a purpose phrase the
// tenant wrote, never a word that happens to appear in somebody's name.
test('the recommending name is a purpose phrase: every way a tenant writes one', () => {
  for (const name of [
    'Breakglass',
    'Break Glass',
    'Break-Glass',
    'break_glass',
    'Break Glass 2',
    'Break-glass 01',
    'breakglass@contoso.com',
    'BreakGlass Admin',
    'Emergency Access',
    'Emergency-Access',
    'EmergencyAccess',
    'emergency access 1',
    'emergency admin',
    'Emergency Account',
    'Emergency Admin',
    'Emergency Administrator',
    'svc-breakglass',
    'BG-Admin',
    'bg_admin',
    'BG Admin',
    'contoso bg',
  ]) {
    assert.equal(isEmergencyName(name), true, `${name} names the account for the job`)
  }
})

// The phrase has to be the whole token, at both ends: it starts the text or
// follows a non-alphanumeric, and it ends the text or is followed by one —
// account numbering aside. Without both boundaries a word that merely contains
// the phrase would classify, and an account so named would leave the people
// population with nobody deciding.
test('the phrase must start at a boundary: a longer word that begins with something else is not a name', () => {
  for (const name of ['Unbreakglass', 'NonEmergencyAccess', 'Xbreakglass', 'unbg', 'prebreak glass']) {
    assert.equal(isEmergencyName(name), false, `${name} does not start the phrase at a boundary`)
  }
  for (const name of ['svc-breakglass', 'svc_emergency-access', 'contoso bg', 'IT.breakglass']) {
    assert.equal(isEmergencyName(name), true, `${name} carries the phrase as its own token`)
  }
})

test('the phrase must end at a boundary: a longer word that continues past it is not a name', () => {
  for (const name of ['Breakglassman', 'Breakglassware', 'Emergency Accessory', 'Emergency Administratorial', 'Emergency AdminAssistant', 'Emergency Accountancy', 'bgood', 'BGuard']) {
    assert.equal(isEmergencyName(name), false, `${name} runs past the end of the phrase`)
  }
  for (const name of ['Breakglass Admin', 'breakglass@contoso.com', 'Emergency Access (do not disable)', 'bg-admin']) {
    assert.equal(isEmergencyName(name), true, `${name} ends the phrase at a boundary`)
  }
})

test('digits straight after the phrase are account numbering, not another word', () => {
  for (const name of ['Break Glass 2', 'Break-glass 01', 'breakglass2', 'Emergency Access 1', 'emergencyaccess01', 'bg1', 'bg01']) {
    assert.equal(isEmergencyName(name), true, `${name} is the phrase, numbered`)
  }
  assert.equal(isEmergencyName('breakglass2man'), false, 'numbering ends the name; letters after it do not')
})

test('the automatic name never fires on an ordinary name that contains the words', () => {
  for (const name of [
    'Alice Glass',
    'John Glassman',
    'Glass, Alice',
    'Breakwater',
    'Breakfast Club',
    'Kim Breakwell',
    'Glasscock Holdings',
    'Unbreakglass',
    'Breakglassman',
    'Breakglassware',
    'NonEmergencyAccess',
    'Emergency Accessory',
    'Emergency Administratorial',
    'Emergency AdminAssistant',
    'Emergency Services Liaison',
    'Emergency Contact Mailbox',
    'Bigby Wolf',
    'bgood@contoso.com',
    'Bridget Gallagher',
    'Sam Lee',
  ]) {
    assert.equal(isEmergencyName(name), false, `${name} is a name, not a purpose`)
  }
})

test('a person whose surname is Glass keeps every weak signal and is still not recommended', () => {
  const s = fixtureSnapshot()
  s.config.caPolicies!.rows = []
  s.roles = { active: { alice: [GA] }, eligible: {} }
  s.users = [
    user({ id: 'alice', displayName: 'Alice Glass', userPrincipalName: 'alice.glass@contoso.onmicrosoft.com', assignedPlans: [] }),
    user({ id: 'bg', displayName: 'Breakglass', userPrincipalName: 'breakglass@contoso.onmicrosoft.com', assignedPlans: [] }),
  ]
  assert.deepEqual(emergencySignals(s.users[0], s, []), ['onmicrosoft', 'globalAdmin', 'noLicence'], 'no name signal')
  assert.deepEqual(emergencySignals(s.users[1], s, []), ['name', 'onmicrosoft', 'noLicence'])
  assert.deepEqual(detectEmergencyAccess(s, []).map((c) => c.id), ['bg', 'alice'], 'both nominated, the named one first')
  assert.deepEqual(recommendedEmergencyAccess(s, []).map((c) => c.id), ['bg'], 'only the account named for the job is recommended')
})

test('each signal is read from the tenant, and "bg" only as its own token', () => {
  const s = fixtureSnapshot()
  s.roles = { active: { ga1: [GA] }, eligible: {} }
  const policies = [{ state: 'enabled', conditions: { users: { excludeUsers: ['x1'] } } }, { state: 'enabled', conditions: { users: { excludeUsers: ['x1', 'other'] } } }]
  assert.deepEqual(emergencySignals(user({ id: 'n1', displayName: 'Break Glass 1' }), s, policies), ['name'])
  assert.deepEqual(emergencySignals(user({ id: 'n2', userPrincipalName: 'bg-admin@contoso.com' }), s, policies), ['name'])
  assert.deepEqual(emergencySignals(user({ id: 'n3', displayName: 'Bigby Wolf', userPrincipalName: 'bigby@contoso.com' }), s, policies), [], '"bg" inside a word is not a signal')
  assert.deepEqual(emergencySignals(user({ id: 'o1', userPrincipalName: 'ops@contoso.onmicrosoft.com' }), s, policies), ['onmicrosoft'])
  assert.deepEqual(emergencySignals(user({ id: 'ga1' }), s, policies), ['globalAdmin'])
  assert.deepEqual(emergencySignals(user({ id: 'x1' }), s, policies), ['excludedEverywhere'])
  assert.deepEqual(emergencySignals(user({ id: 'other' }), s, policies), [], 'excluded from one policy of two is not everywhere')
  assert.deepEqual(emergencySignals(user({ id: 'l1', assignedPlans: [] }), s, policies), ['noLicence'])
  assert.deepEqual(emergencySignals(user({ id: 'l2', assignedPlans: [{ servicePlanId: 'p', capabilityStatus: 'Deleted' }] }), s, policies), ['noLicence'])
})

test('the name nominates on its own, two weak signals nominate together; guests and disabled accounts never do', () => {
  const s = fixtureSnapshot()
  s.roles = { active: {}, eligible: {} }
  s.users = [
    user({ id: 'a', displayName: 'Emergency Access 1', userPrincipalName: 'emergency1@contoso.onmicrosoft.com', assignedPlans: [] }), // name + onmicrosoft + noLicence
    user({ id: 'b', displayName: 'Break Glass 2', userPrincipalName: 'breakglass2@contoso.com' }), // name only
    user({ id: 'c', displayName: 'Guest Glass', userPrincipalName: 'glass@partner.onmicrosoft.com', userType: 'guest' }),
    user({ id: 'd', displayName: 'Old Glass', userPrincipalName: 'glass@contoso.onmicrosoft.com', accountEnabled: false }),
    user({ id: 'e', displayName: 'Ops Console', userPrincipalName: 'ops@contoso.onmicrosoft.com', assignedPlans: [] }), // onmicrosoft + noLicence, no name
    user({ id: 'f', displayName: 'Sam Lee' }),
  ]
  const found = detectEmergencyAccess(s, [])
  assert.deepEqual(found.map((c) => c.id), ['a', 'b', 'e'], 'the named ones first, then the circumstantial one')
  assert.deepEqual(found[0].signals, ['name', 'onmicrosoft', 'noLicence'])
  assert.deepEqual(found.map((c) => c.recommended), [true, true, false])
  assert.deepEqual(recommendedEmergencyAccess(s, []).map((c) => c.id), ['a', 'b'], 'only the tenant’s own naming recommends')
})

test('weak signals never recommend: a Global Administrator that is unlicensed and .onmicrosoft.com stays a person', () => {
  const s = fixtureSnapshot()
  s.config.caPolicies!.rows = []
  s.roles = { active: { ga: [GA] }, eligible: {} }
  s.users = [
    // Every circumstantial signal at once, and no name: the first admin of a small tenant.
    user({ id: 'ga', displayName: 'Admin', userPrincipalName: 'admin@contoso.onmicrosoft.com', assignedPlans: [] }),
    user({ id: 'p', displayName: 'Sam Lee', userPrincipalName: 'sam@contoso.com' }),
  ]
  const signals = emergencySignals(s.users[0], s, [])
  assert.deepEqual(signals, ['onmicrosoft', 'globalAdmin', 'noLicence'], 'three weak signals')
  assert.deepEqual(detectEmergencyAccess(s, []).map((c) => c.id), ['ga'], 'still offered in the picker')
  assert.equal(detectEmergencyAccess(s, [])[0].recommended, false)
  assert.deepEqual(recommendedEmergencyAccess(s, []), [], 'and recommended by nothing')
  const state = applyDetectedDefaults(emptyMappingState(s.tenantId), s, { knownGroups: [] })
  assert.deepEqual(state.breakGlassUserIds, [], 'the detected pass leaves the administrator in the people population')
  assert.equal(state.assumed?.breakGlass, 'noneFound')
})

test('none found is an empty list, not an error', () => {
  const s = fixtureSnapshot()
  s.roles = { active: {}, eligible: {} }
  s.users = [user({ id: 'a' }), user({ id: 'b', displayName: 'Sam Lee' })]
  assert.deepEqual(detectEmergencyAccess(s, []), [])
})
// ---- The account ledger of a small tenant, end to end ----

/**
 * Four accounts, the shape a small tenant actually has: an ordinary
 * administrator whose address is the tenant's initial domain, a licensed
 * person, one account the tenant named for emergencies, and a mailbox with
 * sign-in blocked. The administrator carries three circumstantial signals and
 * the named account carries the strong one; neither is an emergency account
 * until somebody says so.
 */
function smallTenant(operatorId: string): TenantSnapshot {
  const s = fixtureSnapshot()
  const daysAgo = (d: number): string => new Date(Date.parse(s.asOf) - d * 86_400_000).toISOString()
  const licensed = [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', capabilityStatus: 'Enabled' }]
  s.config.caPolicies!.rows = []
  s.users = [
    user({ id: 'admin', displayName: 'Admin', userPrincipalName: 'admin@contoso.onmicrosoft.com', assignedPlans: [], lastSuccessfulSignIn: daysAgo(1) }),
    user({ id: 'person', displayName: 'Robin Fielding', userPrincipalName: 'robin@contoso.com', assignedPlans: licensed, lastSuccessfulSignIn: daysAgo(3) }),
    user({ id: 'bg', displayName: 'Breakglass', userPrincipalName: 'breakglass@contoso.onmicrosoft.com', assignedPlans: [], lastSuccessfulSignIn: daysAgo(30) }),
    user({ id: 'mailbox', displayName: 'Feedback Mailbox', userPrincipalName: 'feedback@contoso.com', assignedPlans: licensed, accountEnabled: false, lastSuccessfulSignIn: null }),
  ]
  s.roles = { active: { admin: [GA], bg: [GA] }, eligible: {} }
  s.registrationDetails = s.users.map((u) => ({
    id: u.id,
    userPrincipalName: u.userPrincipalName,
    isMfaCapable: u.id !== 'mailbox',
    isMfaRegistered: u.id !== 'mailbox',
    isPasswordlessCapable: u.id === 'bg',
    methodsRegistered: u.id === 'mailbox' ? [] : u.id === 'bg' ? ['fido2SecurityKey'] : ['microsoftAuthenticatorPush'],
    defaultMfaMethod: null,
    userPreferredMethodForSecondaryAuthentication: null,
    isAdmin: u.id === 'admin' || u.id === 'bg',
    userType: 'member' as const,
  }))
  s.authMethods = {
    admin: [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }],
    person: [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }],
    bg: [{ kind: 'fido2' }],
    mailbox: [],
  }
  s.signInEvidence = {
    admin: { signInCount: 40, lastSignIn: daysAgo(1), lastMfaSuccess: { at: daysAgo(1), method: 'Mobile app notification' } },
    person: { signInCount: 12, lastSignIn: daysAgo(3), lastMfaSuccess: { at: daysAgo(3), method: 'Mobile app notification' } },
  }
  s.devices = []
  s.blockedToday = []
  s.evidencePolicyResults = []
  const me = s.users.find((u) => u.id === operatorId)!
  s.config.me!.rows = [{ id: me.id, displayName: me.displayName, userPrincipalName: me.userPrincipalName }]
  return s
}

const applied = (s: TenantSnapshot, stored = emptyMappingState(s.tenantId), saved: Record<string, { picked: string[]; at: string }> | null = null) =>
  appliedMapping({ snapshot: s, mapping: stored, nameOf: (id) => id, now: s.asOf }, saved)

const ticked = (s: TenantSnapshot, m = emptyMappingState(s.tenantId)): string[] =>
  (pickerVars(BREAK_GLASS_STEP_ID, '{name}', { snapshot: s, mapping: m, nameOf: (id) => id })?.emergencyCandidatesTicked ?? []) as string[]
const offered = (s: TenantSnapshot, m = emptyMappingState(s.tenantId)): string[] =>
  (pickerVars(BREAK_GLASS_STEP_ID, '{name}', { snapshot: s, mapping: m, nameOf: (id) => id })?.emergencyCandidatesIds ?? []) as string[]

// 1. Detected is not confirmed.
test('a fresh scan of a four-account tenant confirms nothing: 3 active people, 0 emergency access, 1 sign-in disabled', () => {
  const s = smallTenant('admin')
  const m = applied(s)
  assert.deepEqual(m.breakGlassUserIds, [], 'a scan nominates and recommends; it does not choose')
  const sel = emergencySelection({ snapshot: s, mapping: m })
  assert.deepEqual(sel.candidates.map((c) => c.id), ['bg', 'admin'], 'both are candidates, the named one first')
  assert.deepEqual(sel.recommendedIds, ['bg'], 'and the named one is what IAMAI recommends')
  assert.equal(sel.unresolved, true)
  const F = facts(s, m)
  assert.deepEqual(
    { accounts: F.accounts, active: F.active, emergency: F.kinds.emergency, disabled: F.kinds.disabled, service: F.kinds.service, notActive: F.notActive },
    { accounts: 4, active: 3, emergency: 0, disabled: 1, service: 0, notActive: 0 },
    'the administrator and the nominated account are both still people',
  )
})

// 2. The obvious Breakglass candidate is recommended on every scan and confirmed on none.
test('an obvious Breakglass account is recommended on every scan and silently confirmed on none of them', () => {
  const s = smallTenant('admin')
  for (let scan = 0; scan < 3; scan++) {
    const rescan = smallTenant('admin')
    rescan.asOf = new Date(Date.parse(s.asOf) + scan * 86_400_000).toISOString()
    assert.deepEqual(recommendedEmergencyAccess(rescan, []).map((c) => c.id), ['bg'], `scan ${scan}: still recommended`)
    assert.ok(offered(rescan).includes('bg'), `scan ${scan}: still offered in the picker`)
    assert.deepEqual(ticked(rescan), [], `scan ${scan}: and ticked by nobody`)
    assert.deepEqual(applied(rescan).breakGlassUserIds, [], `scan ${scan}: and authoritative nowhere`)
  }
  // The default-decision pass is the door this used to come through; it is shut.
  for (const id of DECISION_STEPS.emergency) {
    assert.equal(defaultDecisions({ snapshot: s, mapping: emptyMappingState(s.tenantId), nameOf: (x) => x, now: s.asOf })[id], undefined, `${id} has a pre-ticked default`)
  }
  // And a detected pass holding a decision in hand still refuses to write it.
  const forced = applyStepDecisions(emptyMappingState(s.tenantId), { [BREAK_GLASS_STEP_ID]: { picked: ['bg'], at: s.asOf } }, 'detected')
  assert.deepEqual(forced.breakGlassUserIds, [], 'a detected pass wrote the emergency accounts')
  assert.notEqual(forced.assumed?.breakGlass, 'confirmed', 'and did not claim a person answered')
})

// 3 (unit half). Explicit confirmation, through the decision path a Save uses.
test('a saved decision is the authority: the accounts a person picked are the emergency accounts', () => {
  const s = smallTenant('admin')
  const saved = { [BREAK_GLASS_STEP_ID]: { picked: ['bg', 'admin'], at: s.asOf } }
  const m = applied(s, emptyMappingState(s.tenantId), saved)
  assert.deepEqual(m.breakGlassUserIds, ['bg', 'admin'], 'the decision, and only the decision')
  assert.equal(m.assumed?.breakGlass, 'confirmed', 'the record says a person answered')
  assert.equal(operatorConfirmedEmergency(m), true)
  assert.deepEqual(ticked(s, m), ['bg', 'admin'], 'and the picker shows it back ticked')
  const F = facts(s, m)
  assert.deepEqual({ active: F.active, emergency: F.kinds.emergency }, { active: 1, emergency: 2 }, 'now they leave the people population')
  // A person may confirm an account no signal recommended.
  const odd = applied(s, emptyMappingState(s.tenantId), { [BREAK_GLASS_STEP_ID]: { picked: ['person'], at: s.asOf } })
  assert.deepEqual(odd.breakGlassUserIds, ['person'], 'the operator is not limited to the nominations')
})

// 4. The signed-in identity changes nothing.
test('the ledger is the same whoever is signed in: the operator changes no classification', () => {
  const saved = { [BREAK_GLASS_STEP_ID]: { picked: ['bg'], at: smallTenant('admin').asOf } }
  const base = facts(smallTenant('admin'), applied(smallTenant('admin')))
  const baseConfirmed = facts(smallTenant('admin'), applied(smallTenant('admin'), emptyMappingState('t'), saved))
  for (const operator of ['admin', 'person', 'bg', 'mailbox']) {
    const s = smallTenant(operator)
    assert.deepEqual(applied(s).breakGlassUserIds, [], `signed in as ${operator}: still nobody's decision`)
    assert.deepEqual(emergencySelection({ snapshot: s, mapping: applied(s) }).recommendedIds, ['bg'], `signed in as ${operator}: the same recommendation`)
    assert.deepEqual(facts(s, applied(s)), base, `signed in as ${operator}: the same facts`)
    const m = applied(s, emptyMappingState(s.tenantId), saved)
    assert.deepEqual(m.breakGlassUserIds, ['bg'], `signed in as ${operator}: the same confirmed set`)
    assert.deepEqual(facts(s, m), baseConfirmed, `signed in as ${operator}: the same facts once confirmed`)
  }
  // The one rule in words: no path anywhere says the signed-in account cannot be one.
  const sources = ['src/mapping/emergencyAccess.ts', 'src/mapping/emergencyChoice.ts', 'src/ui/surfaces/pickerRows.ts', 'src/roadmap/decisions.ts']
  for (const file of sources) assert.doesNotMatch(readFileSync(file, 'utf8'), /operatorId|currentUser|config\.me/, `${file} reads who is signed in`)
})

// 5. Enumeration order cannot decide safety.
test('two plausible candidates: whatever order they enumerate in, nothing is chosen', () => {
  const s = smallTenant('admin')
  // A second plainly-named account, so the recommended list has two of them.
  s.users.push(user({ id: 'bg2', displayName: 'Emergency Access 2', userPrincipalName: 'ea2@contoso.onmicrosoft.com', assignedPlans: [] }))
  const forward = applied(s)
  const reversed = structuredClone(s)
  reversed.users.reverse()
  const back = applied(reversed)
  assert.deepEqual(forward.breakGlassUserIds, [], 'forward order chooses nobody')
  assert.deepEqual(back.breakGlassUserIds, [], 'reversed order chooses nobody')
  assert.deepEqual(ticked(s), [], 'and neither ticks anything')
  assert.deepEqual(ticked(reversed), [])
  assert.deepEqual([...emergencySelection({ snapshot: s, mapping: forward }).recommendedIds].sort(), ['bg', 'bg2'], 'both are recommended')
  assert.deepEqual(facts(s, forward).kinds.emergency, 0, 'and neither leaves the population')
})

// 6. A re-scan neither loses a confirmation nor adds to it.
test('a re-scan keeps the operator’s choice exactly: nothing added, nothing dropped', () => {
  const s = smallTenant('admin')
  const saved = { [BREAK_GLASS_STEP_ID]: { picked: ['bg'], at: s.asOf } }
  const first = applied(s, emptyMappingState(s.tenantId), saved)
  assert.deepEqual(first.breakGlassUserIds, ['bg'])
  // The same tenant a day later, with a second obvious candidate appearing.
  const rescan = smallTenant('person')
  rescan.asOf = new Date(Date.parse(s.asOf) + 86_400_000).toISOString()
  rescan.users.push(user({ id: 'bg2', displayName: 'Break Glass 2', userPrincipalName: 'bg2@contoso.onmicrosoft.com', assignedPlans: [] }))
  const second = applied(rescan, emptyMappingState(s.tenantId), saved)
  assert.deepEqual(second.breakGlassUserIds, ['bg'], 'the newly detected account is not silently added')
  assert.ok(offered(rescan, second).includes('bg2'), 'it is offered as a candidate')
  assert.deepEqual(ticked(rescan, second), ['bg'], 'and only the confirmed one is ticked')
  assert.equal(facts(rescan, second).kinds.emergency, 1, 'the emergency kind survives the re-scan and does not grow')
})

// 8. A legacy record with no proof of authorship.
test('a legacy record’s emergency ids are kept as prior context and re-asked, never inherited as a confirmation', () => {
  const s = smallTenant('admin')
  // The shape the old auto-application produced: ids in the field, the wizard
  // marked answered, and nothing saying a person chose them.
  const legacy: MappingState = { ...emptyMappingState(s.tenantId), breakGlassUserIds: ['admin', 'bg'], wizardAnswered: { breakGlass: true } }
  const migrated = migrateEmergencySelection(legacy)
  assert.deepEqual(migrated.breakGlassUserIds, [], 'not authoritative')
  assert.deepEqual(migrated.breakGlassPriorIds, ['admin', 'bg'], 'and not thrown away either')
  assert.equal(operatorConfirmedEmergency(migrated), false)
  assert.deepEqual(offered(s, migrated), ['bg', 'admin'], 'both are still offered to choose')
  assert.deepEqual(ticked(s, migrated), [], 'and neither is ticked')
  assert.deepEqual(applied(s, migrated).breakGlassUserIds, [], 'nothing downstream inherits them')
  assert.equal(facts(s, applied(s, migrated)).kinds.emergency, 0)
  // Idempotent: migrating the migrated record moves nothing further.
  assert.deepEqual(migrateEmergencySelection(migrated), migrated)
  // A record that does carry the operator's own provenance keeps its decision.
  const confirmed: MappingState = { ...legacy, assumed: { breakGlass: 'confirmed' } }
  assert.deepEqual(migrateEmergencySelection(confirmed), confirmed, 'an operator-authored record is untouched')
  assert.deepEqual(ticked(s, confirmed), ['bg', 'admin'], 'and comes back ticked')
  // The migration runs where a record is read, not somewhere a caller may forget.
  assert.match(readFileSync('src/mapping/store.ts', 'utf8'), /migrateEmergencySelection\(\{ \.\.\.emptyMappingState/, 'loadMappingState migrates the record it reads')
})

// A plan file carries the mapping without provenance and the decisions with it.
test('a plan file round-trip: the mapping’s ids are prior context, the saved decision is the authority', () => {
  const s = smallTenant('admin')
  const confirmedMapping = applied(s, emptyMappingState(s.tenantId), { [BREAK_GLASS_STEP_ID]: { picked: ['bg'], at: s.asOf } })
  // roadmap/plan.ts strips `assumed` from the file's mappings block.
  const fromFile = { ...confirmedMapping, assumed: undefined }
  const reloaded = migrateEmergencySelection({ ...fromFile } as MappingState)
  assert.deepEqual(reloaded.breakGlassUserIds, [], 'the file’s mapping alone proves nothing')
  assert.deepEqual(reloaded.breakGlassPriorIds, ['bg'], 'the ids survive as context')
  // The file's decisions block is restored alongside it, and that is exact authorship.
  const withDecision = applied(s, reloaded, { [BREAK_GLASS_STEP_ID]: { picked: ['bg'], at: s.asOf } })
  assert.deepEqual(withDecision.breakGlassUserIds, ['bg'], 'the operator’s own decision comes back')
})
