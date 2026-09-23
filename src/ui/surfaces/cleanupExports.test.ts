// Cleanup in the exports (E4): each Cleanup row is a calendar entry on its day;
// the print cover's step count is the Plan header's, Cleanup included; the
// prompt pack and the grounding bundle list Cleanup under cleanup; the bundle
// carries none of the v2 field names (rings, events).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { cleanupArtifactLines } from '../../roadmap/artifactLines.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { groundingBundle, promptPack } from '../../roadmap/prompts.ts'
import { stepFacts } from '../../derive/facts.ts'
import { doneSteps, trackableSteps } from '../../derive/sets.ts'
import { exportCleanupViewsOf, stepExportView } from './stepExport.ts'
import { boardReadingsOf } from './planBoard.ts'
import { cleanupExportView, cleanupExportViews } from './cleanupExport.ts'
import type { StepVarContext } from './stepVars.ts'

const setUp = () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const ctx = (s: (typeof r.steps)[number]): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[s.id] ?? null, naming: r.coverage.organisation.naming })
  const view = (s: (typeof r.steps)[number]) => stepExportView(s, ctx(s))
  const cleanup = cleanupExportViews(r.schedule.cleanup)
  return { f, r, view, cleanup }
}

test('every Cleanup row is a calendar entry on its day, with what the row says', () => {
  const { f, r, view, cleanup } = setUp()
  assert.ok(cleanup.length >= 2, 'the demo has Cleanup rows')
  // Cleanup follows the last enforcement. While the plan holds work it requires,
  // that end has no date, and neither has anything after it (roadmap/holds.ts).
  assert.ok(r.steps.some((s) => !s.floor && isHeld(s)), 'the premise: the demo holds work')
  // The Export page's views say so (stepExport.ts exportCleanupViewsOf, off the board).
  const onBoard = exportCleanupViewsOf(boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null), r.steps, r.schedule.cleanup)
  assert.ok(!buildIcs(r.steps, 'Contoso', f.planId, view, onBoard).includes('-cleanup-'), 'a plan that cannot finish books no Cleanup')
  // The same plan with nothing held books each row on its day (a view with no board reading dates its row).
  const ics = buildIcs(r.steps.filter((s) => !isHeld(s)), 'Contoso', f.planId, view, cleanup)
  for (const c of cleanup) {
    const uid = `UID:${f.planId}-cleanup-${c.kind}@iamai`
    assert.ok(ics.includes(uid), `${c.kind} has an entry`)
    const block = ics.slice(ics.indexOf(uid), ics.indexOf('END:VEVENT', ics.indexOf(uid)))
    assert.ok(block.includes(`DTSTART;VALUE=DATE:${c.day.slice(0, 10).replace(/-/g, '')}`), `${c.kind} sits on its day`)
    assert.ok(block.replace(/\r\n /g, '').includes(`SUMMARY:${c.title}`), `${c.kind} carries its title`)
  }
  const open = r.steps.filter((s) => !isHeld(s))
  assert.ok(!buildIcs(open, 'Contoso', f.planId, view).includes('-cleanup-'), 'no rows given, no entries')
  const done = cleanup.map((c, i) => (i === 0 ? { ...c, done: '2026-09-03T12:00:00.000Z' } : c))
  assert.ok(!buildIcs(open, 'Contoso', f.planId, view, done).includes(`-cleanup-${cleanup[0].kind}@`), 'a row marked done is finished, like a done step')
})

test("the print cover's step count is the Plan header's: the steps and the Cleanup rows", () => {
  const { r } = setUp()
  // The answers are the Cleanup rows' second completion (roadmap/cleanupDone.ts);
  // this fixture's rows are counted against nothing recorded unless stated.
  const silent = { credentialStorage: null, signInMonitoring: null }
  const counts = stepFacts(r.steps, r.schedule.cleanup, silent)
  const rows = r.schedule.cleanup!.rows.length
  assert.ok(rows > 0)
  assert.equal(counts.steps, trackableSteps(r.steps.filter((s) => !s.doesntApply)).length + rows, 'Cleanup rows count')
  assert.equal(counts.done, doneSteps(r.steps).length, 'no Cleanup row is done yet')
  const withDone = { ...r.schedule.cleanup!, rows: r.schedule.cleanup!.rows.map((x, i) => (i === 0 ? { ...x, done: '2026-09-03T12:00:00.000Z' } : x)) }
  assert.equal(stepFacts(r.steps, withDone, silent).done, counts.done + 1, 'a Cleanup row marked done is in place')
  // A legacy checkbox is retained, but completion requires a scoped alert test.
  const alerting = r.schedule.cleanup!.rows.find((x) => x.kind === 'alerting')
  assert.ok(alerting && alerting.done === null, 'the fixture no longer has an undone alerting row')
  const attested = { credentialStorage: true, signInMonitoring: true }
  const denied = { credentialStorage: true, signInMonitoring: false }
  assert.equal(stepFacts(r.steps, r.schedule.cleanup, attested).done, counts.done, 'a legacy monitoring checkbox does not establish a received test alert')
  assert.equal(stepFacts(r.steps, r.schedule.cleanup, denied).done, counts.done, 'a declined attestation completed a row')
})

test('the prompt pack and the bundle list Cleanup under cleanup; the bundle drops the v2 field names', () => {
  const { f, r, view, cleanup } = setUp()
  const pack = promptPack({ view, tenant: 'Contoso', steps: r.steps, schedule: r.schedule, changeRecord: '', announcement: null, cleanup })
  const summarise = pack.find((p) => /Summarise/i.test(p.title))!
  assert.ok(summarise, 'the pack has the summarise prompt')
  assert.ok(summarise.prompt.includes('Cleanup (data from'), 'the Cleanup block is labelled')
  for (const c of cleanup) assert.ok(summarise.prompt.includes(c.title), `the block names ${c.title}`)
  const bundle = groundingBundle({ view, tenant: 'Contoso', snapshot: f.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: true, generated: 'Sep 3, 2026', cleanup }) as { plan: { cleanup: { kind: string; title: string; day: string }[]; steps: Record<string, unknown>[] } }
  assert.equal(bundle.plan.cleanup.length, cleanup.length, 'every row is under cleanup')
  assert.deepEqual(bundle.plan.cleanup.map((c) => c.kind), cleanup.map((c) => c.kind))
  for (const s of bundle.plan.steps) {
    assert.ok(!('rings' in s), `${String(s.id)}: no rings`)
    assert.ok(!('events' in s), `${String(s.id)}: no events`)
    assert.ok('dates' in s && 'whatToDo' in s, `${String(s.id)}: what the screen says`)
  }
})


test('cleanup export retains scoped historical evidence and policy names without claiming completion', () => {
  const { r } = setUp()
  const phase = r.schedule.cleanup!
  const row = {
    kind: 'consolidation' as const, day: '2026-09-04', done: null, lists: { overlaps: ['Earlier policy'] },
    verification: 'changed' as const, verificationReason: 'The retained policy changed.',
    record: { cleanup: 'consolidation' as const, at: '2026-09-03T12:00:00Z', date: '2026-09-03', outcome: 'passed' as const, replacementPolicyId: 'keep', retiredPolicyIds: ['old'], coverageVerified: true, reference: 'CHG-42', policyNames: { keep: 'Baseline MFA', old: 'Earlier MFA' } },
  }
  const view = cleanupExportView(phase, row)!
  assert.equal(view.done, null)
  assert.ok(view.manualEvidence?.includes('Evidence status: changed'))
  assert.ok(view.manualEvidence?.includes('Retained policy: Baseline MFA (keep)'))
  assert.ok(view.manualEvidence?.includes('Retired policies: Earlier MFA (old)'))
  assert.ok(view.manualEvidence?.includes('Change record: CHG-42'))
  assert.ok(cleanupArtifactLines(view).some(line => line.includes('Workflow Check:') && line.includes('Evidence status: changed')))
})

test('cleanup export names the tested account and preserves a failed alert outcome', () => {
  const { r } = setUp()
  const phase = { ...r.schedule.cleanup!, accountIds: ['ea-1'] }
  const row = { kind: 'alerting' as const, day: '2026-09-04', done: null, lists: { emergencyAccountUpns: ['recovery@example.test'] }, verification: 'incomplete' as const,
    record: { cleanup: 'alerting' as const, at: '2026-09-03T12:00:00Z', date: '2026-09-03', accountIds: ['ea-1'], outcome: 'failed' as const, recipient: 'Operations' } }
  const lines = cleanupExportView(phase, row)!.manualEvidence!
  assert.ok(lines.includes('Accounts: recovery@example.test (ea-1)'))
  assert.ok(lines.includes('Recorded outcome: Failed'))
  assert.ok(lines.includes('Alert recipient: Operations'))
})
