// The Tasks Remaining tile standard: Steps 2–4 render the Step 1 account tile's
// anatomy — subject label, the subject(s) of the next check, the remaining
// count, the one next check and what is wrong, one action, then Completed
// checks — and nothing else: no list of every finding, no heading or sentence
// twice, no list the same screen already shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { passkeyReadiness } from './passkeyPresentation.ts'
import { consolidateEmergencyReadiness, emergencySubjectsOf, recoverySubjectsOf } from './emergencyReadiness.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import type { PrerequisiteBlocker } from './stepContract.ts'
import { emergencyVerificationAiInfo, emergencyVerificationJson, emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'
import { RECOVERY_PREPARATION_WORKFLOW } from '../../roadmap/cleanupDone.ts'
import type { CleanupCheckpoint } from '../../roadmap/cleanupDone.ts'

type Fixture = ReturnType<typeof fixture>

const FIXTURES = ['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const

/** The owner's screen (2026-09-23): the first account verified, and the second
 * changed after its last passkey sign-in, so that sign-in predates the change. */
function oneAccountWaiting(): Fixture {
  const value = structuredClone(fixture('demo-week2'))
  const [, second] = value.mapping.breakGlassUserIds
  const checkpoints = (value.checkpoints ?? []) as CleanupCheckpoint[]
  const preparation = checkpoints.find(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW)!
  const changed = '2026-08-20T17:25:00.000Z'
  value.checkpoints = [
    ...checkpoints.filter(record => !(record.outcome === 'passed' && record.accountIds?.includes(second))),
    { ...preparation, at: changed, date: changed, configurationObservedAt: changed, configurationCheckedThrough: changed, accountIds: [second] },
  ]
  return value
}

/** Steps 2–3 as ContentStep composes them for the interactive view. */
function subjectsOf(value: Fixture, stepId: string, blockers: PrerequisiteBlocker[] = []): EmergencySubjectTile[] {
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === stepId)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const body = stepBodyOf(step, ctx, { blockers, prerequisiteLabel: () => 'Prerequisite · To do' })
  const upns = new Map(ctx.mapping.breakGlassUserIds.map(id => [id, ctx.snapshot.users.find(user => user.id === id)?.userPrincipalName ?? id]))
  return emergencySubjectsOf(consolidateEmergencyReadiness(passkeyReadiness(step, body.readiness), body.emergencyAccountTasks, upns, true), body.emergencyAccountTasks)
}

/** Step 4 as CleanupStep composes it for the interactive view. */
function recoveryOf(value: Fixture) {
  const phase = runFixture(value).schedule.cleanup!
  const tasks = emergencyVerificationTasksOf(phase)
  return { phase, tasks, tiles: recoverySubjectsOf(phase.recoveryFindings ?? [], tasks, new Map(Object.entries(phase.accountUpnsById ?? {}))) }
}

/** Every line a remaining tile draws above its Completed checks, in order. */
const linesOf = (tile: EmergencySubjectTile): string[] => [tile.heading, ...(tile.upn ?? '').split('\n'), tile.title, tile.detail ?? '', tile.instruction, tile.link?.label ?? ''].filter(Boolean)

test('Step 2: an unanswered exclusions group states its heading and sentence once', () => {
  const tiles = subjectsOf(noExclusionsAnswer(fixture('small')), 's-prereq-exclusion-group').filter(tile => !tile.satisfied)
  assert.equal(tiles.length, 1)
  const [tile] = tiles
  assert.equal(tile.title, 'Choose an exclusions group')
  assert.match(tile.instruction, /^Select a group under Exclusions group, then Save\./)
  const lines = linesOf(tile)
  for (const line of lines) assert.equal(lines.filter(other => other === line).length, 1, `"${line}" is drawn more than once`)
})

test('Step 2: a satisfied subject collapses under Satisfied with its checks completed, not remaining', () => {
  const tiles = subjectsOf(structuredClone(fixture('small')), 's-prereq-exclusion-group')
  assert.ok(tiles.length > 0 && tiles.every(tile => tile.satisfied))
  for (const tile of tiles) {
    assert.equal(tile.remainingCount, null)
    assert.equal(tile.detail, undefined)
    assert.ok(tile.completed.length > 0, `${tile.heading} lists its completed checks`)
  }
})

test('Step 3: a prerequisite is the next check, stated once', () => {
  const blocker: PrerequisiteBlocker = { kind: 'step', id: 's-prereq-break-glass', abnormal: false, label: 'Prerequisite', title: 'Prepare Emergency Access Accounts' }
  const registration = subjectsOf(structuredClone(fixture('demo')), 's-prereq-passkey-settings', [blocker]).find(tile => tile.key === 'configuration:registration')!
  assert.equal(registration.title, 'Finish Prepare Emergency Access Accounts first.')
  assert.ok(linesOf(registration).every(line => !/Prepare Emergency Access Accounts\. Finish/.test(line)))
})

test('Step 3: the protection tile shows the next check only, under its profile', () => {
  const tile = subjectsOf(structuredClone(fixture('small')), 's-prereq-passkey-settings').find(row => row.key === 'configuration:protection')!
  assert.equal(tile.upn, 'Passkey (FIDO2) policy')
  assert.equal(tile.title, 'Current attestation')
  assert.equal(tile.detail, 'Disabled')
  assert.equal(tile.instruction, 'Follow Configure passkey protections in Implementation Tasks.')
  assert.ok((tile.remainingCount ?? 0) > 1, 'the other checks wait behind the count')
  assert.ok(linesOf(tile).every(line => !/→|AAGUID|Approved models/.test(line)), 'no change list and no model list in the tile')
})

test('Step 4: the sign-in list renders once, in the Sign-in Evidence tile, as one check for both accounts', () => {
  const { phase, tasks, tiles } = recoveryOf(structuredClone(fixture('demo')))
  const verify = tasks.tasks.find(task => task.id === 'verify-emergency-sign-in')!
  assert.equal(verify.facts, undefined, 'the Implementation Task draws no account list')
  const signIn = tiles.find(tile => tile.key === 'recovery-sign-ins')!
  assert.equal(signIn.title, 'Sign-in required')
  assert.deepEqual(signIn.upn?.split('\n'), phase.accountIds.map(id => phase.accountUpnsById?.[id] ?? id))
  assert.equal(signIn.remainingCount, phase.accountIds.length)
})

test('Step 4: Configuration shows one next check, a confirmed failure, with its owning step', () => {
  const { tiles } = recoveryOf(structuredClone(fixture('demo')))
  const configuration = tiles.find(tile => tile.key === 'recovery-configuration')!
  assert.equal(configuration.title, 'Enabled policy exclusions')
  assert.equal(configuration.upn, 'bg2@demo-fixture.onmicrosoft.com')
  assert.equal(configuration.detail, 'Missing from Core - Grant - MFA for all users')
  assert.equal(configuration.link?.label, 'Review emergency exclusions')
  assert.equal(configuration.instruction, '')
  assert.ok((configuration.remainingCount ?? 0) > 1)
  assert.ok(linesOf(configuration).length <= 6, 'one check, not every finding')
})

test('a check that passes keeps the qualifier that made the pass honest (S4-6)', () => {
  // The note was blanked the moment the check passed, and what went with it was
  // the caveat: "No office network is selected; location-based exceptions are
  // not applied." The card read a subject, a check and nothing else.
  const value = structuredClone(fixture('demo-week2'))
  const tile = subjectsOf(value, 's-prereq-trusted-location').find(row => row.key === 'configuration:trusted-network-choice')!
  assert.equal(tile.satisfied, true, 'the premise: the check passes')
  assert.equal(tile.title, 'Everyone is remote')
  // And the evidence the answer leaves out, where the scan read any: "no office
  // network is selected" is a reading of the answer, and on a tenant that holds a
  // trusted named location it sounded like a reading of the tenant.
  assert.equal(tile.detail, 'No office network is selected; location-based exceptions are not applied. The scan read a trusted named location this answer leaves out: Head office.')
  // The sentence, not the action: a check that has passed has nothing to do.
  assert.equal(tile.instruction, '')
  // And the other caveat the audit named, on the admin review.
  const review = subjectsOf(structuredClone(fixture('mid')), 's-check-separate-admin-accounts').find(row => row.key === 'configuration:administrator-review-scope')!
  assert.equal(review.satisfied, true)
  assert.match(review.detail ?? '', /clues, not proof of dedicated use/)
  // An open check still reads its direction first, then the note.
  const open = emergencySubjectsOf({ tiles: [{ key: 'k', label: 'Subject', tone: 'warn', value: 'Not done', note: 'The note.' }], satisfied: [], bar: { key: 'x', main: '' } }, null)[0]
  assert.equal(open.instruction, 'The note.')
  assert.equal(open.detail, undefined)
})

test('the frozen Emergency Access runs are unchanged by it: no passing check of theirs hid a note', () => {
  // emergencyReadiness.ts is shared with the four Establish Emergency Access
  // steps, which are frozen (owner, 2026-09-19). Step 1 draws its own accounts;
  // Steps 2 and 3 and the drill draw these cards, and not one of their passing
  // checks carries a note, so restoring the note adds no line to any of them.
  for (const name of ['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    const value = structuredClone(fixture(name))
    for (const id of ['s-prereq-exclusion-group', 's-prereq-passkey-settings']) {
      for (const tile of subjectsOf(value, id).filter(row => row.satisfied)) {
        assert.equal(tile.detail, undefined, `${name}/${id}/${tile.key} gained a sentence`)
      }
    }
    for (const tile of recoveryOf(value).tiles.filter(row => row.satisfied)) {
      assert.equal(tile.detail, undefined, `${name}/cleanup-drill/${tile.key} gained a sentence`)
    }
  }
})

test('a finding that already states the action is not followed by the same action again', () => {
  const tile = emergencySubjectsOf({ tiles: [{ key: 'recovery-sign-ins', label: 'Sign-in evidence', tone: 'warn', value: 'Evidence needed', note: null, items: [
    { label: 'Sign in with the prepared passkey', factLabel: 'Sign in with the prepared passkey', value: 'Follow Verify emergency sign-in in Implementation Tasks. Then wait 5–10 minutes and scan to update the plan.', subjectLabel: 'a@contoso.onmicrosoft.com', accountId: 'a', outcome: 'fail' },
  ] }], satisfied: [], bar: { key: 'x', main: '' } }, { tasks: [{ id: 'verify-emergency-sign-in', accountId: null, title: 'Verify emergency sign-in', targetUpn: null, required: true, readinessKey: 'recovery-sign-ins', evidence: null, actionLabel: '', steps: [] }] })[0]
  assert.equal(tile.title, 'Sign in with the prepared passkey')
  assert.equal(tile.instruction, '')
  const lines = linesOf(tile)
  assert.equal(lines.filter(line => line.includes('Follow Verify emergency sign-in')).length, 1)
})

// Verification results said "Verification needed" beside cards that already
// said which account needed what, and "Passed" beside a Sign-in evidence card
// that already read Verified (owner, 2026-09-23: "completely eclipsed in person
// by the Sign-in evidence tasks"). It carried no fact of its own: its value was
// the Sign-in evidence verdict, and its failure was the Configuration card's.
// Every state it had is drawn here: failed configuration (demo), every account
// verified (demo-week2) and configuration verified with one account waiting.
test('Step 4 draws no Verification results card in any state, on screen, in print or in an export', () => {
  const runs: [string, Fixture][] = [...FIXTURES.map((name): [string, Fixture] => [name, structuredClone(fixture(name))]), ['one account waiting', oneAccountWaiting()]]
  for (const [name, value] of runs) {
    const { phase, tiles } = recoveryOf(value)
    // The print and the exports draw these findings as they are.
    assert.deepEqual((phase.recoveryFindings ?? []).map(finding => finding.label), ['Configuration', 'Sign-in evidence'], `${name}: the findings`)
    assert.equal(tiles.some(tile => tile.heading === 'Verification results'), false, `${name}: the screen draws it`)
    for (const text of [emergencyVerificationJson(phase), emergencyVerificationAiInfo(phase)]) assert.doesNotMatch(text, /Verification results|recovery-confirmation|Verification needed/, `${name}: an export carries it`)
  }
  // What it said is still said, by the cards that own it.
  const verdict = (value: Fixture) => Object.fromEntries(recoveryOf(value).tiles.map(tile => [tile.heading, tile.satisfied]))
  assert.deepEqual(verdict(structuredClone(fixture('demo'))), { Configuration: false, 'Sign-in evidence': false })
  assert.deepEqual(verdict(structuredClone(fixture('demo-week2'))), { Configuration: true, 'Sign-in evidence': true })
  assert.deepEqual(verdict(oneAccountWaiting()), { Configuration: true, 'Sign-in evidence': false })
})
