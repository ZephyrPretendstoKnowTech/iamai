import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { LADDER_ITEMS, GLOBAL_ADMIN_ROLE_ID, ladderFacts, ladderStepId, ladderSteps } from './ladder.ts'
import { OPERATOR_PASSKEY_STEP_ID } from './passkeySettings.ts'
import { SEPARATE_ADMIN_ACCOUNTS_STEP_ID } from './stepIds.ts'
import { stepById } from '../content/content.ts'
import { readFileSync } from 'node:fs'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { populationLine } from '../derive/whoLine.ts'

// A free tenant reduced to what the ladder actually reads.
function freeSnapshot(over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return { ...fixture('micro').snapshot, ...over }
}

function withConfig(base: TenantSnapshot, key: string, rows: unknown[], status: 'ok' | 'disabled' = 'ok'): TenantSnapshot {
  return { ...base, config: { ...base.config, [key]: { status, reason: null, rows } } }
}

const mapping = (over: Partial<MappingState> = {}): MappingState => ({ ...emptyMappingState('tenant-under-test'), ...over })

test('every ladder step carries the data file\'s name as its title, in phase 0', () => {
  const { steps } = ladderSteps(freeSnapshot(), mapping(), [])
  assert.equal(steps.length, LADDER_ITEMS.length)
  for (const s of steps) {
    assert.ok(s.title.length > 0, `${s.id}: a title`)
    assert.equal(s.plainTitle, s.title)
    assert.equal(s.phase, 0)
  }
})

test('a done ladder step always names the evidence that satisfied it', () => {
  const { steps } = ladderSteps(freeSnapshot(), mapping({ breakGlassUserIds: [] }), [])
  for (const s of steps) {
    if (s.status === 'done') assert.ok(s.deliveredBy.length > 0, `${s.id}: done names its evidence`)
    else if (s.id === ladderStepId('per-user-mfa-cleanup')) { assert.equal(s.state.satisfied, false); assert.match(s.deliveredBy.join(' '), /migration.*Check legacy per-user MFA separately/, 'migration evidence alone does not prove per-user cleanup') }
    else assert.equal(s.deliveredBy.length, 0, `${s.id}: only a done step cites evidence`)
  }
})

test('security defaults: on is done, off is a step, unreadable is neither claimed nor denied', () => {
  const base = freeSnapshot()
  const on = ladderSteps(withConfig(base, 'securityDefaults', [{ isEnabled: true }]), mapping(), []).steps
  const off = ladderSteps(withConfig(base, 'securityDefaults', [{ isEnabled: false }]), mapping(), []).steps
  const unknown = ladderSteps(withConfig(base, 'securityDefaults', [], 'disabled'), mapping(), []).steps
  const find = (list: typeof on) => list.find((s) => s.id === ladderStepId('security-defaults'))
  assert.equal(find(on)?.status, 'done')
  assert.equal(find(off)?.status, 'ready')
  assert.equal(find(unknown)?.status, 'ready')
})

test('Global Administrator count: Microsoft\'s two to four is the verdict, and the holders are named', () => {
  const base = freeSnapshot()
  const roles = (n: number) => ({ active: Object.fromEntries(base.users.slice(0, n).map((u) => [u.id, [GLOBAL_ADMIN_ROLE_ID]])), eligible: {} })
  const at = (n: number) => ladderSteps({ ...base, roles: roles(n) }, mapping(), []).steps.find((s) => s.id === ladderStepId('global-admin-count'))
  assert.equal(at(3)?.status, 'done')
  assert.equal(at(1)?.status, 'ready')
  assert.equal(at(9)?.status, 'ready')
})

test('guests: none is done, some are named', () => {
  const base = freeSnapshot()
  const noGuests = { ...base, users: base.users.filter((u) => u.userType !== 'guest') }
  const step = (snap: TenantSnapshot) => ladderSteps(snap, mapping(), []).steps.find((s) => s.id === ladderStepId('guest-review'))
  assert.equal(step(noGuests)?.status, 'done')
  const some = step(base)
  assert.equal(some?.status, 'ready')
})

test('what Graph does not expose is said plainly, never guessed', () => {
  const { steps } = ladderSteps(freeSnapshot(), mapping(), [])
  const appPasswords = steps.find((s) => s.id === ladderStepId('app-passwords'))
  assert.equal(appPasswords?.status, 'ready')
  const legacy = steps.find((s) => s.id === ladderStepId('legacy-auth-inventory'))
})

test('a phase 0 step that already covers a ladder item takes its place, and its position', () => {
  const withPerUserStep = ladderSteps(freeSnapshot(), mapping(), ['s-prereq-per-user-mfa'])
  assert.equal(withPerUserStep.steps.some((s) => s.id === ladderStepId('per-user-mfa-cleanup')), false)
  assert.equal(withPerUserStep.order.get('s-prereq-per-user-mfa'), LADDER_ITEMS.findIndex((i) => i.id === 'per-user-mfa-cleanup'))
  assert.equal(withPerUserStep.steps.length, LADDER_ITEMS.length - 1)
})

test('facts come from the directory, not from anything the operator types', () => {
  const base = freeSnapshot()
  const f = ladderFacts(base)
  assert.equal(f.enabledUsers, base.users.filter((u) => u.userType === 'member' && u.accountEnabled !== false).length)
  assert.equal(f.guests, base.users.filter((u) => u.userType === 'guest').length)
})

// ---- through the whole engine ----

test('a tenant that cannot use Conditional Access gets no plan at all', () => {
  // Owner, 2026-09-20: Entra ID P1 is the real minimum, and no opinion beats a
  // half-baked one. `micro` has no Conditional Access licence, so the whole plan
  // is withheld — not the Conditional Access steps only, which would leave three
  // identity checks standing and read as "the plan".
  const { steps } = runFixture(fixture('micro'))
  assert.equal(steps.length, 0, 'no licence, no plan')
  // The free-tier ladder that used to be that plan is still in the tree, dormant
  // behind one flag the owner asked to keep for a later comparison. It is off,
  // and turning it on is a visible one-line change rather than a drift.
  assert.match(readFileSync('src/roadmap/generate.ts', 'utf8'), /const FREE_TIER_LADDER = false/)
  // Dormant, not dead: the rungs above still build, so the words and the evidence
  // stay under test while the flag is off.
  assert.equal(ladderSteps(freeSnapshot(), mapping(), []).steps.length, LADDER_ITEMS.length)
})

test('a licensed tenant gets no ladder steps', () => {
  for (const name of ['small', 'mid', 'messy'] as const) {
    const { steps } = runFixture(fixture(name))
    // The operator's own passkey rung (A5 task 5) is not a free-tier ladder item: it is asked of a licensed tenant's operator.
    assert.equal(steps.some((s) => s.id.startsWith('s-ladder-') && s.id !== OPERATOR_PASSKEY_STEP_ID), false, `${name}: no ladder without a free licence`)
  }
})


test('Authenticator replacement requires registration plus effective method targeting', () => {
  const snapshot = freeSnapshot()
  snapshot.users = snapshot.users.filter(u => u.userType === 'member').slice(0, 2)
  snapshot.sources.users.status = 'ok'
  snapshot.sources.registrationDetails.status = 'ok'
  snapshot.registrationDetails = snapshot.users.map(u => ({ id: u.id, userPrincipalName: u.userPrincipalName, isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: false, methodsRegistered: ['microsoftAuthenticatorPush'], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: false, userType: u.userType }))
  const authenticator = { id: 'MicrosoftAuthenticator', state: 'enabled', includeTargets: [{ id: 'all_users', authenticationMode: 'any' }], excludeTargets: [] as { id: string; targetType: string }[] }
  snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ policyMigrationState: 'migrationComplete', authenticationMethodConfigurations: [authenticator, { id: 'Sms', state: 'disabled' }, { id: 'Voice', state: 'disabled' }] }] }
  const read = () => ladderSteps(snapshot, mapping(), []).steps.find(s => s.id === ladderStepId('authenticator-over-sms'))!
  assert.equal(read().state.satisfied, true, 'observed readiness passes; scoped manual proof is applied later')
  authenticator.excludeTargets = [{ id: snapshot.users[0].id, targetType: 'user' }]
  assert.equal(read().state.satisfied, false)
  assert.deepEqual(read().preparation?.missingIds, [snapshot.users[0].id])
  authenticator.excludeTargets = [{ id: 'unread-group', targetType: 'group' }]
  assert.deepEqual(read().preparation?.unknownIds, snapshot.users.map(u => u.id))
})

// R4-57: the rung carried its review list as a population with no active ids,
// so its Affected people line read "No user impact" over two accounts to
// review. It counts them through the one builder (derive/population.ts
// namedAccounts): accounts, since the ladder on its own knows no active people.
test('a rung that names accounts to review counts them as accounts', () => {
  const snapshot = freeSnapshot()
  snapshot.users = snapshot.users.filter(u => u.userType === 'member').slice(0, 2)
  const step = ladderSteps(snapshot, mapping(), []).steps.find(s => s.id === ladderStepId('authenticator-over-sms'))!
  assert.equal(step.population.ids.length, 2, 'the premise: the rung reviews two accounts')
  const line = populationLine(step.population)
  assert.doesNotMatch(line, /No user impact/, line)
  assert.match(line, /^2 accounts( · |$)/, line)
})

test('separation review includes eligible role holders but excludes emergency accounts', () => {
  // On the one step that does the review, whatever the licence: the ladder's
  // second id for it is gone (finding 9), and the population is applyManualReviews'
  // (roadmap/manualWork.ts ADMIN_SEPARATION), not a rung's own list.
  // A licensed tenant, because since 2026-09-20 an unlicensed one has no plan to
  // find the step on. The population rule under test is the same either way.
  const base = fixture('small')
  const snapshot = { ...base.snapshot }
  const [ordinary, emergency] = snapshot.users.slice(0, 2)
  snapshot.roles = { active: { [emergency.id]: [GLOBAL_ADMIN_ROLE_ID] }, eligible: { [ordinary.id]: [GLOBAL_ADMIN_ROLE_ID] } }
  const m = mapping({ breakGlassUserIds: [emergency.id] })
  const step = runFixture({ ...base, snapshot, mapping: m }, { mapping: m }).steps.find(s => s.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID)
  assert.ok(step, 'the review is on the plan')
  assert.deepEqual(step.population.ids, [ordinary.id])
  assert.equal(ladderSteps(snapshot, m, [SEPARATE_ADMIN_ACCOUNTS_STEP_ID, 's-check-dormant-accounts']).steps.some(s => s.id === ladderStepId('admin-accounts-separate')), false)
})

test('the two steps the ladder carried a second id for are one step with one set of words', () => {
  // docs/plans/step-redundancy-analysis.md finding 9: the ladder's
  // admin-accounts-separate and stale-accounts rungs had the SAME Completion
  // Criteria as the phase 0 steps, word for word, and manualWork.ts treated each
  // pair as one. They never appeared together, so the only symptom was that a
  // change to the words or the evidence had to be made twice.
  for (const id of ['s-ladder-admin-accounts-separate', 's-ladder-stale-accounts']) {
    assert.equal(stepById[id], undefined, `${id}: a second set of words for one step`)
  }
  // The steps that absorbed them are on every plan that builds, which is what
  // lets the ladder defer to them. `micro` is not in the list: since 2026-09-20 a
  // tenant with no Conditional Access licence builds no steps at all.
  for (const name of ['small', 'mid', 'demo'] as const) {
    const ids = runFixture(fixture(name)).steps.map((x) => x.id)
    for (const id of [SEPARATE_ADMIN_ACCOUNTS_STEP_ID, 's-check-dormant-accounts']) assert.ok(ids.includes(id), `${name}: ${id} is missing`)
    for (const id of ['s-ladder-admin-accounts-separate', 's-ladder-stale-accounts']) assert.equal(ids.includes(id), false, `${name}: ${id} came back`)
  }
  // One set of words, and it is the surviving step's.
  const separate = stepById[SEPARATE_ADMIN_ACCOUNTS_STEP_ID] as unknown as { doneWhen?: string[] }
  assert.ok((separate.doneWhen ?? []).some((l) => /dedicated to administrator/.test(l)))
  // A record saved under the ladder's id before the merge still counts.
  assert.match(readFileSync('src/roadmap/manualWork.ts', 'utf8'), /step\.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID \? 's-ladder-admin-accounts-separate'/)
  assert.match(readFileSync('src/roadmap/manualWork.ts', 'utf8'), /step\.id === 's-check-dormant-accounts' \? 's-ladder-stale-accounts'/)
})
