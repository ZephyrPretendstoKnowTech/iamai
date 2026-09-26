// Section 8 after its audit (owner, 2026-09-25): Alert on Emergency Account
// Sign-ins closes Establish Emergency Access on the step template, completed by
// one Mark as done, and Align Policy Names is left out of the plan until it can
// propose the baseline's own names.
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

const demo = () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const phase = r.schedule.cleanup!
  const row = phase.rows.find((x) => x.kind === 'alerting')!
  assert.ok(row, 'the premise: the demo has emergency accounts, so it has the alerting row')
  return { f, r, phase, row }
}

test('8.1 closes Establish Emergency Access after the drill, holds nothing, and is dated early', () => {
  assert.equal(groupOf('cleanup-alerting')?.key, 'emergency-access')
  assert.deepEqual(membersOf('emergency-access').slice(-2), ['cleanup-drill', 'cleanup-alerting'])
  assert.equal(FOUNDATION_STEP_IDS.includes('cleanup-alerting'), false, 'it holds no policy step')
  const { r, phase, row } = demo()
  const drill = phase.rows.find((x) => x.kind === 'drill')!
  assert.ok(row.day > drill.day && row.day <= r.schedule.targetEnd, `${row.day}: after the drill, before the rollout ends`)
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

test('8.2 Align Policy Names is left out of the plan until it proposes the baseline’s own names', () => {
  for (const name of ['demo', 'large', 'messy'] as const) {
    const phase = runFixture(fixture(name)).schedule.cleanup
    assert.equal(phase?.rows.some((x) => x.kind === 'naming') ?? false, false, name)
  }
})
