// The Tasks Remaining tile standard (prompt 60 Part 2): Steps 2–4 render the
// Step 1 account tile's anatomy — subject label, identity, one action with its
// instruction, the finding per subject with the rest behind a disclosure, then
// Completed checks — and no tile repeats its heading, its sentence or a list
// the same screen already shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { passkeyReadiness } from './passkeyPresentation.ts'
import { consolidateEmergencyReadiness, emergencySubjectsOf, recoverySubjectsOf, VISIBLE_SUBJECTS } from './emergencyReadiness.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import type { PrerequisiteBlocker } from './stepContract.ts'
import { emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'

type Fixture = ReturnType<typeof fixture>

/** Steps 2–3 as ContentStep composes them for the interactive view. */
function subjectsOf(value: Fixture, stepId: string, blockers: PrerequisiteBlocker[] = []): EmergencySubjectTile[] {
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === stepId)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const body = stepBodyOf(step, ctx, { blockers, prerequisiteLabel: () => 'Prerequisite · To do' })
  const upns = new Map(ctx.mapping.breakGlassUserIds.map(id => [id, ctx.snapshot.users.find(user => user.id === id)?.userPrincipalName ?? id]))
  return emergencySubjectsOf(consolidateEmergencyReadiness(passkeyReadiness(step, body.readiness), body.emergencyAccountTasks, upns, true), body.emergencyAccountTasks)
}

/** Every line a subject tile draws, in order. */
const linesOf = (tile: EmergencySubjectTile): string[] => [tile.heading, tile.upn ?? '', tile.title, tile.instruction, ...[...(tile.facts ?? []), ...(tile.moreFacts ?? [])].flatMap(fact => [fact.label, fact.value]), ...tile.completed].filter(Boolean)

test('Step 2: an unanswered exclusions group states its heading and sentence once', () => {
  const tiles = subjectsOf(noExclusionsAnswer(fixture('small')), 's-prereq-exclusion-group').filter(tile => !tile.satisfied)
  assert.equal(tiles.length, 1)
  const [tile] = tiles
  assert.equal(tile.title, 'Choose an exclusions group')
  assert.match(tile.instruction, /^Select a group under Exclusions group, then Save\./)
  const lines = linesOf(tile)
  for (const line of lines) assert.equal(lines.filter(other => other === line).length, 1, `"${line}" is drawn more than once`)
  assert.equal(lines.filter(line => line.includes('Select a group under Exclusions group')).length, 1)
})

test('Step 2: a satisfied subject collapses under Satisfied with its checks completed, not remaining', () => {
  const tiles = subjectsOf(structuredClone(fixture('small')), 's-prereq-exclusion-group')
  assert.ok(tiles.length > 0 && tiles.every(tile => tile.satisfied))
  for (const tile of tiles) {
    assert.equal(tile.remainingCount, null)
    assert.deepEqual(tile.facts, [])
    assert.ok(tile.completed.length > 0, `${tile.heading} lists its completed checks`)
  }
})

test('Step 3: a prerequisite is stated once, not "X. Finish X first."', () => {
  const blocker: PrerequisiteBlocker = { kind: 'step', id: 's-prereq-break-glass', abnormal: false, label: 'Prerequisite', title: 'Prepare Emergency Access Accounts' }
  const tiles = subjectsOf(structuredClone(fixture('demo')), 's-prereq-passkey-settings', [blocker])
  const values = tiles.flatMap(tile => [...(tile.facts ?? []), ...(tile.moreFacts ?? [])]).map(fact => fact.value)
  assert.ok(values.includes('Finish Prepare Emergency Access Accounts first.'), JSON.stringify(values))
  assert.ok(values.every(value => !/Prepare Emergency Access Accounts\. Finish/.test(value)))
})

test('Step 3: the protection tile names its subject once and shows one finding per subject before the disclosure', () => {
  const tile = subjectsOf(structuredClone(fixture('small')), 's-prereq-passkey-settings').find(row => row.key === 'configuration:protection')!
  assert.equal(tile.upn, 'Passkey (FIDO2) policy')
  assert.equal(tile.title, 'Configure passkey protections')
  assert.ok((tile.facts ?? []).length <= VISIBLE_SUBJECTS)
  assert.ok((tile.moreFacts ?? []).length > 0)
})

test('Step 4: the sign-in list renders once, in the Sign-in Evidence tile', () => {
  const value = structuredClone(fixture('demo'))
  const phase = runFixture(value).schedule.cleanup!
  const tasks = emergencyVerificationTasksOf(phase)
  const verify = tasks.tasks.find(task => task.id === 'verify-emergency-sign-in')!
  assert.equal(verify.facts, undefined, 'the Implementation Task draws no account list')
  const upns = new Map(Object.entries(phase.accountUpnsById ?? {}))
  const signIn = recoverySubjectsOf(phase.recoveryFindings ?? [], tasks, upns).find(tile => tile.key === 'recovery-sign-ins')!
  assert.deepEqual((signIn.facts ?? []).map(fact => fact.label), phase.accountIds.map(id => phase.accountUpnsById?.[id] ?? id))
})

test('Step 4: Configuration shows the highest-priority finding per account, the rest behind a disclosure', () => {
  const value = structuredClone(fixture('demo'))
  const phase = runFixture(value).schedule.cleanup!
  const tasks = emergencyVerificationTasksOf(phase)
  const upns = new Map(Object.entries(phase.accountUpnsById ?? {}))
  const configuration = recoverySubjectsOf(phase.recoveryFindings ?? [], tasks, upns).find(tile => !tile.satisfied && tile.key !== 'recovery-sign-ins' && (tile.moreFacts ?? []).length > 0)!
  assert.ok(configuration, 'the demo has a Configuration tile with more findings than subjects')
  const shown = configuration.facts ?? []
  assert.ok(shown.length <= VISIBLE_SUBJECTS)
  // Each account with a pending finding is visible before the disclosure.
  for (const id of phase.accountIds) {
    const upn = phase.accountUpnsById?.[id] ?? id
    const pending = [...shown, ...(configuration.moreFacts ?? [])].some(fact => fact.label.startsWith(`${upn} · `))
    if (pending) assert.ok(shown.some(fact => fact.label.startsWith(`${upn} · `)), `${upn} has a visible finding`)
  }
  // The highest-priority finding leads: a confirmed failure before an unverified one.
  assert.doesNotMatch(shown[0].value, /Could not verify/)
})
