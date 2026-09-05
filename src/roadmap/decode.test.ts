// The bounded decoder (Foundation A): what IAMAI puts on the wire, and what it
// can say about the policy that comes back. Two questions, one authority. A
// request is valid only in the shapes the pinned baseline and the generators
// actually use, nested values included; a meaning is either decoded exactly from
// the operation's own final target or held unknown. Nothing here reads the goal
// a step is filed under, its population, or the floor.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountApplicability, effectOf, isCompletePolicy, isSubmittablePatch, isValidOperation, strengthLookupOf } from './operations.ts'
import { policyVerdict, stepAccountVerdict } from './strand.ts'
import { nobodyAffected } from './timing.ts'
import { batchClassOf, buildSchedule, observationDaysFor } from './schedule.ts'
import { lockoutCount } from './lockout.ts'
import type { PolicyOperation, Step, StepPopulation } from './types.ts'

const SCOPE = { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }
const policy = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  displayName: 'p',
  state: 'enabledForReportingButNotEnforced',
  conditions: SCOPE,
  grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  ...over,
})
const grantOf = (over: Record<string, unknown>): Record<string, unknown> => policy({ grantControls: { operator: 'OR', ...over } })

/** A tenant scan holding exactly the evidence each case is about. */
function scan(over: Record<string, unknown> = {}): never {
  return {
    registrationDetails: [],
    sources: { registrationDetails: { status: 'ok' }, devices: { status: 'ok' } },
    devices: [],
    users: [],
    roles: { active: {}, eligible: {} },
    config: { authStrengths: { status: 'ok', reason: null, rows: [] } },
    evidenceUsage: { legacyAuth: { userIds: [] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] } },
    ...over,
  } as never
}
/** One person, with the methods the registration report holds for them. */
const registered = (id: string, methods: string[]): Record<string, unknown> => ({ id, isMfaCapable: methods.length > 0, methodsRegistered: methods })

const population = (ids: string[]): StepPopulation => ({ total: ids.length, active: ids.length, admins: 0, guests: 0, ids, activeIds: ids, inScope: ids.length }) as StepPopulation

/** A step that writes exactly these policies, and claims nothing else. */
function stepFor(bodies: Record<string, unknown>[], over: Record<string, unknown> = {}): Step {
  const operations: PolicyOperation[] = bodies.map((body, i) => ({ sourceName: `p${i}`, mode: 'create', policyId: null, body }))
  return {
    id: 's-x',
    goalId: 'g-x',
    phase: 1,
    kind: 'create',
    title: 's-x',
    why: '',
    status: 'ready',
    blockedBy: [],
    blockers: [],
    unblockNotes: [],
    rings: [],
    population: population(['u1']),
    readiness: { family: 'other', percent: 100, lines: [] },
    evidence: { status: 'ok', lines: [], affectedUserIds: [] },
    action: {
      kind: 'create',
      summary: [],
      json: '{}',
      portalSteps: [],
      missing: [],
      resolution: { policies: operations, tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null } },
    },
    ...over,
  } as unknown as Step
}

// ---- A. the bounded submission decoder ----

test('a submitted body is checked to its nested values, not only its keys', () => {
  // A control nobody has invented is not a control IAMAI will put on the wire.
  assert.equal(isCompletePolicy(grantOf({ builtInControls: ['soundTheAlarm'] })), false, 'soundTheAlarm')
  // The ones Conditional Access does have, including the one IAMAI cannot read.
  for (const c of ['block', 'mfa', 'compliantDevice', 'domainJoinedDevice', 'approvedApplication', 'compliantApplication', 'passwordChange', 'riskRemediation'])
    assert.equal(isCompletePolicy(grantOf({ builtInControls: [c] })), true, c)
  // A grant that grants something says how its controls combine.
  assert.equal(isCompletePolicy(policy({ grantControls: { builtInControls: ['mfa'] } })), false, 'no operator')
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'or', builtInControls: ['mfa'] } })), false, 'not an operator Graph takes')
  // Nested values, not just nested keys.
  assert.equal(isCompletePolicy(policy({ conditions: { ...SCOPE, users: { includeUsers: 'All' } } })), false, 'a scope that is a string')
  assert.equal(isCompletePolicy(policy({ conditions: { ...SCOPE, signInRiskLevels: ['catastrophic'] } })), false, 'a risk level Conditional Access has no idea about')
  assert.equal(isCompletePolicy(policy({ conditions: { ...SCOPE, clientAppTypes: ['carrierPigeon'] } })), false, 'a client app type nobody has')
  assert.equal(isCompletePolicy(policy({ conditions: { ...SCOPE, ofTheMoon: true } })), false, 'a condition IAMAI does not write')
  assert.equal(isCompletePolicy(policy({ sessionControls: { signInFrequency: 'always' } })), false, 'a session payload that is a word')
  assert.equal(isCompletePolicy(policy({ sessionControls: { signInFrequency: { isEnabled: true, frequencyInterval: 'sometimes' } } })), false, 'an interval that is not one')
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'OR', builtInControls: ['mfa'], surprise: 1 } })), false, 'a grant setting IAMAI does not write')
})

test('a scope has to scope somebody, and a filter has to filter', () => {
  const users = (v: unknown): Record<string, unknown> => policy({ conditions: { users: v, applications: { includeApplications: ['All'] } } })
  assert.equal(isCompletePolicy(users({ includeGuestsOrExternalUsers: {} })), false, 'an empty guest scope reaches nobody')
  assert.equal(isCompletePolicy(users({ includeGuestsOrExternalUsers: { guestOrExternalUserTypes: '', externalTenants: { membershipKind: 'all' } } })), false, 'and neither does an empty type list')
  assert.equal(
    isCompletePolicy(users({ includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } } })),
    true,
    'a guest scope that names its types is one',
  )
  const workload = (v: unknown): Record<string, unknown> => ({
    displayName: 'w',
    state: 'enabled',
    conditions: { clientApplications: v },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  })
  assert.equal(isCompletePolicy(workload({ includeServicePrincipals: [], excludeServicePrincipals: [] })), false, 'a workload policy that names no service principal')
  assert.equal(isCompletePolicy(workload({ servicePrincipalFilter: {} })), false, 'an empty filter filters nothing')
  assert.equal(isCompletePolicy(workload({ servicePrincipalFilter: { mode: 'include', rule: '' } })), false, 'and neither does an empty rule')
  assert.equal(isCompletePolicy(workload({ includeServicePrincipals: ['sp-1'] })), true)
  assert.equal(isCompletePolicy(workload({ servicePrincipalFilter: { mode: 'include', rule: 'servicePrincipal.tags -contains "x"' } })), true)
})

test('the strength IAMAI submits is a reference, and nothing it cannot vouch for travels with it', () => {
  assert.equal(isCompletePolicy(grantOf({ authenticationStrength: { id: 's-1' } })), true)
  assert.equal(
    isCompletePolicy(grantOf({ authenticationStrength: { id: 's-1', displayName: 'Modern MFA + TAP', allowedCombinations: ['fido2'] } })),
    false,
    "the author's name and combinations describe an object, not a request",
  )
  // And the effect reads the reference, never a description carried beside it.
  assert.deepEqual(effectOf(grantOf({ authenticationStrength: { id: 's-1' } })).strength, { id: 's-1' })
})

test('an update still validates only what it submits', () => {
  const target = {
    id: 'p-1',
    displayName: 'the tenant one',
    state: 'enabled',
    templateId: 'abc',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, insiderRiskLevels: 'elevated' },
    grantControls: { operator: 'OR', builtInControls: ['mfa'], termsOfUse: ['t-1'] },
  }
  const op = { sourceName: 'a', mode: 'update', policyId: 'p-1', body: { state: 'enabled' }, target } as unknown as PolicyOperation
  assert.equal(isValidOperation(op), true, 'the tenant may carry anything IAMAI is not changing')
  assert.equal(isSubmittablePatch({ conditions: { users: { includeUsers: 'All' } } }), false, 'what it does change is checked to its values')
  assert.equal(isSubmittablePatch({ grantControls: { builtInControls: ['mfa'] } }), false, 'including the operator')
})

// ---- B. exact-or-unknown semantics ----

test('a strength is measured against its own allowed combinations, not a tier it resembles', () => {
  const FIDO_ONLY = 'a1000000-0000-4000-8000-00000000f1d0'
  const snapshot = scan({
    registrationDetails: [registered('hello', ['windowsHelloForBusiness']), registered('key', ['fido2SecurityKey']), registered('push', ['microsoftAuthenticatorPush'])],
    config: { authStrengths: { status: 'ok', reason: null, rows: [{ id: FIDO_ONLY, displayName: 'Security key only', allowedCombinations: ['fido2'] }] } },
  })
  const effect = effectOf(grantOf({ authenticationStrength: { id: FIDO_ONLY } }))
  // Windows Hello is phishing-resistant and is still not a security key.
  const hello = policyVerdict(effect, 'hello', snapshot, {})
  assert.equal(hello.stranded, true, 'phishing-resistant is not the same as the combination the policy allows')
  assert.equal(policyVerdict(effect, 'key', snapshot, {}).stranded, false)
  assert.equal(policyVerdict(effect, 'push', snapshot, {}).stranded, true)
  // A strength the tenant does not describe is not judged at all.
  const blind = policyVerdict(effectOf(grantOf({ authenticationStrength: { id: 'not-in-this-tenant' } })), 'key', snapshot, {})
  assert.equal(blind.unknown, true)
  assert.equal(blind.stranded, false)
})

test('OR means either: a person who can do one branch is not stranded by the other', () => {
  const FIDO_ONLY = 'a1000000-0000-4000-8000-00000000f1d0'
  const rows = [{ id: FIDO_ONLY, displayName: 'Security key only', allowedCombinations: ['fido2'] }]
  const snapshot = scan({
    registrationDetails: [registered('push', ['microsoftAuthenticatorPush'])],
    config: { authStrengths: { status: 'ok', reason: null, rows } },
  })
  const either = effectOf(grantOf({ operator: 'OR', builtInControls: ['mfa'], authenticationStrength: { id: FIDO_ONLY } }))
  assert.equal(policyVerdict(either, 'push', snapshot, {}).stranded, false, 'multifactor is one of the two ways through')
  const both = effectOf(grantOf({ operator: 'AND', builtInControls: ['mfa'], authenticationStrength: { id: FIDO_ONLY } }))
  assert.equal(policyVerdict(both, 'push', snapshot, {}).stranded, true, 'AND asks for both')
  // The lockout list follows the same reading.
  const viability = [{ userId: 'push', activity: 'active', registered: ['microsoftAuthenticatorPush'], kinds: [], methodTiers: ['push'], mfaCapable: true }] as never[]
  const lookup = strengthLookupOf(snapshot)
  assert.equal(lockoutCount([either], ['push'], viability, snapshot, lookup), 0, 'nobody is locked out of a door with two keys')
  assert.equal(lockoutCount([both], ['push'], viability, snapshot, lookup), 1)
})

test('a device requirement and an app requirement are two different requirements', () => {
  const snapshot = scan({
    registrationDetails: [registered('u1', ['microsoftAuthenticatorPush'])],
    devices: [{ ownerIds: ['u1'], isCompliant: false, trustType: 'ServerAd' }],
  })
  const compliant = policyVerdict(effectOf(grantOf({ builtInControls: ['compliantDevice'] })), 'u1', snapshot, {})
  assert.equal(compliant.stranded, true, 'a hybrid-joined machine is not a compliant one')
  const joined = policyVerdict(effectOf(grantOf({ builtInControls: ['domainJoinedDevice'] })), 'u1', snapshot, {})
  assert.equal(joined.stranded, false, 'and it is a domain-joined one')
  const app = policyVerdict(effectOf(grantOf({ builtInControls: ['approvedApplication'] })), 'u1', snapshot, {})
  assert.equal(app.unknown, true, 'the scan does not say which apps this account signs in with')
})

test('a place is judged by the place the policy names, never by a list of countries beside it', () => {
  const snapshot = scan({ users: [{ id: 'u1', usageLocation: 'NZ' }] })
  const effect = effectOf(policy({ conditions: { ...SCOPE, locations: { includeLocations: ['All'], excludeLocations: ['loc-allowed'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }))
  // Without a resolved named location, the countries the operator picked say
  // nothing about what this policy blocks.
  assert.equal(policyVerdict(effect, 'u1', snapshot, { allowedCountries: ['AU'] }).unknown, true)
  // With the named location resolved to the countries it holds, it does.
  const resolved = { allowedCountries: ['AU'], countryLocations: { 'loc-allowed': ['AU'] } }
  const v = policyVerdict(effect, 'u1', snapshot, resolved)
  assert.equal(v.stranded, true)
  assert.match(v.reason, /NZ/)
  assert.equal(policyVerdict(effect, 'u1', scan({ users: [{ id: 'u1', usageLocation: 'AU' }] }), resolved).stranded, false)
  // A named location the plan cannot resolve is still unknown, whatever else is resolved.
  const other = effectOf(policy({ conditions: { ...SCOPE, locations: { includeLocations: ['loc-somewhere-else'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }))
  assert.equal(policyVerdict(other, 'u1', snapshot, resolved).unknown, true)
})

test('token protection is a requirement the scan cannot prove, and it says so', () => {
  const snapshot = scan({ registrationDetails: [registered('u1', ['fido2SecurityKey'])] })
  const tokenProtection = effectOf(policy({ grantControls: null, sessionControls: { secureSignInSession: { isEnabled: true } } }))
  const v = policyVerdict(tokenProtection, 'u1', snapshot, {})
  assert.equal(v.unknown, true, 'nothing in the scan says this account signs in from a client that supports it')
  assert.equal(v.stranded, false)
  // A session control that only changes how long a session lives is not that.
  const shorter = effectOf(policy({ grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, type: 'hours', value: 4 } } }))
  const s = policyVerdict(shorter, 'u1', snapshot, {})
  assert.equal(s.unknown, false)
  assert.equal(s.stranded, false)
})

test('a control IAMAI has no reading for is submitted and never interpreted', () => {
  const snapshot = scan({ registrationDetails: [registered('u1', ['fido2SecurityKey'])] })
  const effect = effectOf(grantOf({ builtInControls: ['riskRemediation'] }))
  assert.equal(effect.unknown.length, 1)
  assert.equal(policyVerdict(effect, 'u1', snapshot, {}).unknown, true)
})

// ---- C. applicability, per operation ----

test('who an operation reaches is read from the operation, not from the step it sits in', () => {
  const ADMIN_ROLE = '62e90394-69f5-4237-9190-012177145e10'
  const snapshot = scan({
    registrationDetails: [registered('admin', ['microsoftAuthenticatorPush']), registered('everyone-else', [])],
    roles: { active: { admin: [ADMIN_ROLE] }, eligible: {} },
  })
  const roleScoped = effectOf(policy({ conditions: { users: { includeRoles: [ADMIN_ROLE] }, applications: { includeApplications: ['All'] } } }))
  assert.equal(accountApplicability(roleScoped.scope, 'admin', snapshot, {}), 'in')
  assert.equal(accountApplicability(roleScoped.scope, 'everyone-else', snapshot, {}), 'out')
  // A step whose population is wider than its policy strands only the people
  // the policy actually reaches.
  const step = stepFor([policy({ conditions: { users: { includeRoles: [ADMIN_ROLE] }, applications: { includeApplications: ['All'] } } })], {
    population: population(['admin', 'everyone-else']),
  })
  assert.equal(stepAccountVerdict(step, 'everyone-else', snapshot, {}).stranded, false, 'the policy never reaches them')
  assert.match(stepAccountVerdict(step, 'everyone-else', snapshot, {}).reason, /out of scope/)
  assert.equal(stepAccountVerdict(step, 'admin', snapshot, {}).stranded, false, 'and this one can approve a sign-in')
  // Exclusions are read too, and only where membership is knowable.
  const excluded = effectOf(policy({ conditions: { users: { includeUsers: ['All'], excludeUsers: ['admin'] }, applications: { includeApplications: ['All'] } } }))
  assert.equal(accountApplicability(excluded.scope, 'admin', snapshot, {}), 'out')
  const byGroup = effectOf(policy({ conditions: { users: { includeUsers: ['All'], excludeGroups: ['g-1'] }, applications: { includeApplications: ['All'] } } }))
  assert.equal(accountApplicability(byGroup.scope, 'admin', snapshot, {}), 'unknown', 'nothing in the scan says who is in that group')
  assert.equal(accountApplicability(byGroup.scope, 'admin', snapshot, { groupMembers: { 'g-1': ['someone'] } }), 'in', 'and when something does, it is read')
  assert.equal(accountApplicability(byGroup.scope, 'admin', snapshot, { groupMembers: { 'g-1': ['admin'] } }), 'out')
  // A workload policy reaches no person at all.
  const workload = effectOf({
    displayName: 'w',
    state: 'enabled',
    conditions: { clientApplications: { includeServicePrincipals: ['sp-1'] } },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  })
  assert.equal(accountApplicability(workload.scope, 'admin', snapshot, {}), 'out')
})

test('the lockout number is offered only when the answer is known, one operation at a time', () => {
  const FIDO_ONLY = 'a1000000-0000-4000-8000-00000000f1d0'
  const ADMIN_ROLE = '62e90394-69f5-4237-9190-012177145e10'
  const rows = [{ id: FIDO_ONLY, displayName: 'Security key only', allowedCombinations: ['fido2'] }]
  const snapshot = scan({
    registrationDetails: [registered('admin', ['microsoftAuthenticatorPush']), registered('other', [])],
    roles: { active: { admin: [ADMIN_ROLE] }, eligible: {} },
    config: { authStrengths: { status: 'ok', reason: null, rows } },
  })
  const viability = [
    { userId: 'admin', activity: 'active', registered: ['microsoftAuthenticatorPush'], kinds: [], methodTiers: ['push'], mfaCapable: true },
    { userId: 'other', activity: 'active', registered: [], kinds: [], methodTiers: [], mfaCapable: false },
  ] as never[]
  const lookup = strengthLookupOf(snapshot)
  const scoped = effectOf({
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeRoles: [ADMIN_ROLE] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', authenticationStrength: { id: FIDO_ONLY } },
  })
  assert.equal(lockoutCount([scoped], ['admin', 'other'], viability, snapshot, lookup), 1, 'only the person the policy reaches')
  // A scope nothing in the scan settles offers no number at all.
  const byGroup = effectOf({
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeGroups: ['g-1'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', authenticationStrength: { id: FIDO_ONLY } },
  })
  assert.equal(lockoutCount([byGroup], ['admin', 'other'], viability, snapshot, lookup), null)
  // And neither does a strength nothing describes.
  const blind = effectOf({
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeRoles: [ADMIN_ROLE] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', authenticationStrength: { id: 'not-in-this-tenant' } },
  })
  assert.equal(lockoutCount([blind], ['admin', 'other'], viability, snapshot, lookup), null)
})

test('an open policy with nothing to read falls back on nothing at all', () => {
  const snapshot = scan({ registrationDetails: [registered('u1', ['fido2SecurityKey'])] })
  // A step whose one operation is not a policy: the plan can write nothing, and
  // it invents neither a zero nor a verdict from the goal it is filed under.
  const broken = stepFor([{ displayName: 'half a policy' }], { readiness: { family: 'block', percent: 100, lines: [] }, population: population([]) })
  assert.equal(nobodyAffected(broken), false, 'an empty population is not proof about a policy nobody can read')
  const v = stepAccountVerdict(broken, 'u1', snapshot, {})
  assert.equal(v.unknown, true)
  assert.equal(v.stranded, false)
})

// ---- D. what the schedule does with all of it ----

const MON = '2026-03-02'
const scheduleStep = (id: string, bodies: Record<string, unknown>[], over: Record<string, unknown> = {}): Step =>
  ({ ...stepFor(bodies, over), id, goalId: id, title: id }) as Step

test('the schedule places work by what each operation does, and stays conservative where it cannot tell', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `u${i}`)
  // A block plus a population-wide MFA requirement, with no evidence read: not
  // zero, so neither the notice nor the watch is shortened.
  const mixed = scheduleStep('s-mixed', [policy({ grantControls: { operator: 'OR', builtInControls: ['block'] } }), policy()], {
    population: population(ids),
    evidence: { status: 'partial', lines: [], affectedUserIds: [] },
  })
  assert.equal(nobodyAffected(mixed), false, 'records that could not be read are not proof of zero')
  assert.notEqual(batchClassOf(mixed), 'zero')
  assert.equal(observationDaysFor(mixed) > observationDaysFor({ ...mixed, evidence: { status: 'ok', lines: [], affectedUserIds: [] } } as Step), false)

  // A policy IAMAI cannot read: conservative everywhere, and still placed.
  const unreadable = scheduleStep('s-unreadable', [policy({ grantControls: { operator: 'OR', builtInControls: ['riskRemediation'] } })], { population: population(ids) })
  assert.equal(nobodyAffected(unreadable), false)
  assert.notEqual(batchClassOf(unreadable), 'zero')

  // Token protection: no optimistic quiet from evidence that does not exist.
  const token = scheduleStep('s-token', [policy({ grantControls: null, sessionControls: { secureSignInSession: { isEnabled: true } } })], { population: population(ids) })
  assert.equal(nobodyAffected(token), false)
  assert.equal(batchClassOf(token), 'deviceSession')

  const s = buildSchedule([mixed, unreadable, token], MON, 100)
  for (const step of [mixed, unreadable, token]) {
    assert.ok(
      s.waves.some((w) => w.stepIds.includes(step.id)),
      `${step.id} is placed`,
    )
    assert.equal(observationDaysFor(step), 7, `${step.id} takes the full watch, not the zero-impact one`)
  }
})

test('a step whose policy reaches fewer people than the step does is scheduled on the policy', () => {
  const ADMIN_ROLE = '62e90394-69f5-4237-9190-012177145e10'
  const ids = Array.from({ length: 20 }, (_, i) => `u${i}`)
  const narrow = scheduleStep(
    's-narrow',
    [
      {
        displayName: 'p',
        state: 'enabledForReportingButNotEnforced',
        conditions: { users: { includeRoles: [ADMIN_ROLE], excludeUsers: ids.slice(0, 5) }, applications: { includeApplications: ['All'] } },
        grantControls: { operator: 'OR', builtInControls: ['mfa'] },
      },
    ],
    { population: population(ids) },
  )
  const s = buildSchedule([narrow], MON, 100)
  assert.ok(s.waves.some((w) => w.stepIds.includes('s-narrow')))
  assert.equal(batchClassOf(narrow), 'mfa', 'what it asks for, not who the step lists')
  const snapshot = scan({ registrationDetails: [registered('u0', [])], roles: { active: {}, eligible: {} } })
  assert.match(stepAccountVerdict(narrow, 'u0', snapshot, {}).reason, /out of scope/, 'excluded by the policy, whatever the step says')
})
