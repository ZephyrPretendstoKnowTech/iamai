// Section 8 after its audit (owner, 2026-09-25 and 2026-09-26): Alert on
// Emergency Account Sign-ins stays 8.1, on the step template, completed by one
// Mark as done; Align Policy Names lists each policy to rename to the
// baseline's own name, with no form, and a scan completes it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { groupOf, membersOf } from '../../roadmap/stepGroups.ts'
import { FOUNDATION_STEP_IDS } from '../../roadmap/foundations.ts'
import { cleanupBasis } from '../../roadmap/cleanupDone.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { alertingAiInfo, alertingSteps, alertingSubjects } from './alertingTasks.ts'
import { cleanupRowWho } from './rowWho.ts'
import { cleanupExportView } from './cleanupExport.ts'
import { boardReadingsOf } from './planBoard.ts'
import { cleanupPhaseFor, renamesOf } from '../../roadmap/cleanupPhase.ts'
import type { Step } from '../../roadmap/types.ts'
import { namingSteps, namingSubjects } from './namingTasks.ts'

const demo = () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const phase = r.schedule.cleanup!
  const row = phase.rows.find((x) => x.kind === 'alerting')!
  assert.ok(row, 'the premise: the demo has emergency accounts, so it has the alerting row')
  return { f, r, phase, row }
}

test('8.1 stays Ongoing Checks and Cleanup’s first step, after the security rollout, and holds nothing', () => {
  // Owner, 2026-09-26: never moved into Establish Emergency Access.
  assert.equal(groupOf('cleanup-alerting')?.key, 'ongoing')
  assert.equal(membersOf('ongoing')[0], 'cleanup-alerting')
  assert.equal(FOUNDATION_STEP_IDS.includes('cleanup-alerting'), false, 'it holds no policy step')
  const { r, phase, row } = demo()
  assert.ok(row.day > r.schedule.targetEnd, `${row.day}: after the security rollout`)
  assert.equal(cleanupRowWho(phase, row), '2 accounts')
})

test('8.1 gives the real procedure: the query over the saved accounts’ object IDs and the account to test with, no hole', () => {
  const { f, phase } = demo()
  const steps = alertingSteps(phase)
  const text = steps.join('\n')
  for (const id of f.mapping.breakGlassUserIds) assert.ok(text.includes(`UserId == "${id}"`), `the query names ${id}`)
  assert.match(text, /Threshold value\*\* 0/)
  assert.match(text, /Severity\*\* 0 - Critical/)
  assert.match(text, new RegExp(`Sign in once as ${phase.accountUpnsById![f.mapping.breakGlassUserIds[0]].replace('.', '\\.')}`))
  assert.doesNotMatch(text, /\{\w+\}/, 'a hole in the procedure')
  assert.doesNotMatch(text, /Review ingestion|name who answers it|Agree what the responder/, 'no lectures')
  const ai = alertingAiInfo(phase)
  for (const id of f.mapping.breakGlassUserIds) assert.ok(ai.includes(id), 'AI Info names each object ID')
  assert.doesNotMatch(ai, /could not|cannot confirm|unknown/i)
})

test('8.1 completes on one Mark as done, with no test result or recipient, and its card says when', () => {
  setDisplayTimeZone('UTC')
  try {
    const { f } = demo()
    const at = f.snapshot.asOf
    const bg = f.mapping.breakGlassUserIds
    const marked = runFixture({ ...f, checkpoints: [...(f.checkpoints ?? []), { at, date: at.slice(0, 10), cleanup: 'alerting', accountIds: bg, basis: cleanupBasis('alerting', {}, bg) }] })
    const row = marked.schedule.cleanup!.rows.find((x) => x.kind === 'alerting')!
    assert.equal(row.done, at.slice(0, 10))
    const [card] = alertingSubjects(row)
    assert.equal(card.satisfied, true)
    assert.match(card.title, /^Marked done [A-Z][a-z]{2} \d{1,2}, \d{4}$/)
    const open = alertingSubjects(demo().row)[0]
    assert.deepEqual([open.satisfied, open.title, open.instruction], [false, 'Create the alert rule', 'Follow Create the alert rule in Implementation Tasks.'])
  } finally {
    setDisplayTimeZone(null)
  }
  const body = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.doesNotMatch(body, /Test Result|Alert Recipient|Save Test Result/, 'no workflow form')
})

test('8.1 exports the same procedure the step draws, and one completion line', () => {
  const { phase, row } = demo()
  const view = cleanupExportView(phase, row)!
  assert.deepEqual(view.whatToDo, alertingSteps(phase).map((l) => l.replace(/\*\*/g, '')))
  assert.deepEqual(view.doneWhen, ['You mark this step done once a test sign-in by an emergency account raised the alert.'])
})

test('8.2 lists each policy the plan tracks under a name other than the baseline’s, with its ID, before Review Overlapping Policies', () => {
  // Owner, 2026-09-26 (Jon's names): the baseline author's own name, verbatim.
  const { phase } = demo()
  const naming = phase.rows.find((x) => x.kind === 'naming')!
  assert.ok(naming, 'the demo tenant has policies under its own names')
  assert.deepEqual(naming.lists.renames.map((l) => l.replace(/ \(ID: [^)]+\)$/, '')), [
    'Core - Block - Legacy authentication → IAC - GLOBAL – BLOCK - Legacy Authentication',
    'Core - Block - Device code flow → IAC - GLOBAL - BLOCK - Device Code Auth Flow',
    'Core - Grant - MFA for all users → IAC - GLOBAL - GRANT - MFA - AllUsers',
    'Core - Grant - Admins phishing-resistant → IAC - GLOBAL - GRANT - MFA - AllAdmins',
  ])
  assert.ok(naming.lists.renames.every((l) => / \(ID: [0-9a-f-]{36}\)$/.test(l)), 'each with its ID')
  assert.equal(naming.done, null)
  const consolidation = phase.rows.find((x) => x.kind === 'consolidation')
  if (consolidation) assert.ok(consolidation.day > naming.day, 'consolidation follows it, as cleanup.ts orders them')
})

test('8.2 skips a difference in capitals, and never gives two policies one name', () => {
  const member = (policyId: string, policyName: string, plannedName: string) => ({ key: policyId, sourceName: '', policyId, policyName, plannedName })
  const step = (id: string, members: ReturnType<typeof member>[]) => ({ id, status: 'active', doesntApply: false, state: { setAside: false }, tracking: { members } }) as unknown as Step
  const renames = renamesOf([
    step('a', [member('p1', 'iac - global - block - x', 'IAC - GLOBAL - BLOCK - X')]),
    step('b', [member('p2', 'Staff MFA', 'IAC - GLOBAL - GRANT - MFA')]),
    step('c', [member('p3', 'Guest MFA', 'IAC - GLOBAL - GRANT - MFA'), member('p2', 'Staff MFA', 'IAC - OTHER')]),
    step('d', [member('p4', 'Old', 'Staff MFA')]),
  ])
  assert.deepEqual(renames, [{ id: 'p2', from: 'Staff MFA', to: 'IAC - GLOBAL - GRANT - MFA' }])
})

test('8.2 is drawn on the step template with no fields and no Save, and exports the procedure it draws', () => {
  const { phase } = demo()
  const row = phase.rows.find((x) => x.kind === 'naming')!
  const cards = namingSubjects(phase)
  assert.equal(cards.length, 1, 'one card for the renames')
  assert.equal(cards[0].detail?.split('\n').length, 4)
  const steps = namingSteps(phase)
  for (const p of phase.namingProposals ?? []) assert.ok(steps.some((l) => l.includes(`**${p.from}** (ID: ${p.id})`) && l.includes(`**${p.to}**`)), p.id)
  assert.deepEqual(cleanupExportView(phase, row)!.whatToDo, steps.map((l) => l.replace(/\*\*/g, '')))
  assert.deepEqual(cleanupExportView(phase, row)!.doneWhen, ['A scan finds each of these policies under its baseline name.'])
  const source = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.doesNotMatch(source, /Save Naming Review|setNameDrafts|setToolingVerified/)
})

test('8.2 leaves the plan once a scan finds every baseline name', () => {
  const f = fixture('demo')
  const renames = runFixture(f).schedule.cleanup!.namingProposals!
  const snapshot = structuredClone(f.snapshot)
  for (const row of snapshot.config.caPolicies.rows as { id: string; displayName: string }[]) {
    const rename = renames.find((x) => x.id === row.id)
    if (rename) row.displayName = rename.to
  }
  const phase = runFixture({ ...f, snapshot }).schedule.cleanup!
  assert.equal(phase.rows.some((x) => x.kind === 'naming'), false)
})

test('8.1: a saved Failed test does not complete it, and a marked-done 8.1 exports no Workflow Check', () => {
  const { f } = demo()
  const at = f.snapshot.asOf
  const bg = f.mapping.breakGlassUserIds
  const record = (outcome?: 'failed') => ({ at, date: at.slice(0, 10), cleanup: 'alerting' as const, accountIds: bg, basis: cleanupBasis('alerting', {}, bg), ...(outcome ? { outcome } : {}) })
  const failed = runFixture({ ...f, checkpoints: [...(f.checkpoints ?? []), record('failed')] }).schedule.cleanup!
  assert.equal(failed.rows.find((x) => x.kind === 'alerting')!.done, null)
  const marked = runFixture({ ...f, checkpoints: [...(f.checkpoints ?? []), record()] }).schedule.cleanup!
  const row = marked.rows.find((x) => x.kind === 'alerting')!
  assert.ok(row.done)
  assert.deepEqual(cleanupExportView(marked, row)!.manualEvidence, [])
})

test('8.1 reads Ready · Create once the rollout is done, and the drill takes no Ongoing day slot', () => {
  const { f, r } = demo()
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const alerting = board.readings.get('cleanup-alerting')!
  if (alerting.lane === 'Ready') assert.equal(alerting.substatus, 'Create', 'its work is a rule to create, not a review')
  else assert.equal(alerting.reason?.id, 'after-security-rollout', 'held, it waits for the security rollout as before')
  // The Ongoing rows fall on the same days with or without the drill's early row.
  const at = f.snapshot.asOf
  const base = { after: at, rhythm: null, organisation: r.coverage.organisation, policies: [], now: at, records: [], early: at, hardeningTracked: true }
  const without = cleanupPhaseFor({ ...base, emergencyAccountIds: [], emergencyAccounts: [], emergencyAccountUpns: [] })!
  const withEa = cleanupPhaseFor({ ...base, emergencyAccountIds: ['a'], emergencyAccounts: ['A'], emergencyAccountUpns: ['a@contoso.onmicrosoft.com'] })!
  // 8.1 is the first Ongoing row, on the day the first Ongoing row falls on without the accounts.
  const first = (c: typeof withEa) => c.rows.filter((x) => x.kind !== 'drill').sort((x, y) => x.day.localeCompare(y.day))[0]
  assert.ok(without.rows.length > 0, 'the premise: an Ongoing row')
  assert.deepEqual([first(withEa).kind, first(withEa).day], ['alerting', first(without).day])
})

test('held 8.1: its rail names what it waits for, it offers no Mark as done until Ready, and it keeps the Scan note', () => {
  // Owner, 2026-09-26. The body is JSX, which Node does not run here, so this
  // reads the source for the three conditions and the board for the wait.
  const { f, r } = demo()
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const reading = board.readings.get('cleanup-alerting')!
  assert.notEqual(reading.lane, 'Ready', 'the premise: the demo rollout is not finished, so 8.1 is held')
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const held = lane\.lane === 'Ready' \|\| lane\.lane === 'Completed' \? null : lane\.waitingFor \?\? lane\.label/)
  const cleanup = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(cleanup, /headline: row\.done \? status\.word : status\.held \?\? alertingMilestone\(\)/)
  assert.match(cleanup, /onDone && !row\.done && !status\.held && <Button/)
  assert.doesNotMatch(cleanup, /alertingSubjects\(row\)\}[^>]*scanNote=\{false\}/)
})
