// Cleanup in the exports (E4): each Cleanup row is a calendar entry on its day;
// the print cover's step count is the Plan header's, Cleanup included; the
// prompt pack and the grounding bundle list Cleanup under cleanup; the bundle
// carries none of the v2 field names (rings, events).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { groundingBundle, promptPack } from '../../roadmap/prompts.ts'
import { planCounts } from '../../derive/planHeader.ts'
import { doneSteps, trackableSteps } from '../../derive/sets.ts'
import { stepExportView } from './stepExport.ts'
import { cleanupExportViews } from './cleanupExport.ts'
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
  const ics = buildIcs(r.steps, 'Contoso', f.planId, view, cleanup)
  for (const c of cleanup) {
    const uid = `UID:${f.planId}-cleanup-${c.kind}@iamai`
    assert.ok(ics.includes(uid), `${c.kind} has an entry`)
    const block = ics.slice(ics.indexOf(uid), ics.indexOf('END:VEVENT', ics.indexOf(uid)))
    assert.ok(block.includes(`DTSTART;VALUE=DATE:${c.day.slice(0, 10).replace(/-/g, '')}`), `${c.kind} sits on its day`)
    assert.ok(block.replace(/\r\n /g, '').includes(`SUMMARY:${c.title}`), `${c.kind} carries its title`)
  }
  assert.ok(!buildIcs(r.steps, 'Contoso', f.planId, view).includes('-cleanup-'), 'no rows given, no entries')
  const done = cleanup.map((c, i) => (i === 0 ? { ...c, done: '2026-09-03T12:00:00.000Z' } : c))
  assert.ok(!buildIcs(r.steps, 'Contoso', f.planId, view, done).includes(`-cleanup-${cleanup[0].kind}@`), 'a row marked done is finished, like a done step')
})

test("the print cover's step count is the Plan header's: the steps and the Cleanup rows", () => {
  const { r } = setUp()
  const counts = planCounts(r.steps, r.schedule.cleanup)
  const rows = r.schedule.cleanup!.rows.length
  assert.ok(rows > 0)
  assert.equal(counts.steps, trackableSteps(r.steps.filter((s) => !s.doesntApply)).length + rows, 'Cleanup rows count')
  assert.equal(counts.inPlace, doneSteps(r.steps).length, 'no Cleanup row is done yet')
  const withDone = { ...r.schedule.cleanup!, rows: r.schedule.cleanup!.rows.map((x, i) => (i === 0 ? { ...x, done: '2026-09-03T12:00:00.000Z' } : x)) }
  assert.equal(planCounts(r.steps, withDone).inPlace, counts.inPlace + 1, 'a Cleanup row marked done is in place')
})

test('the prompt pack and the bundle list Cleanup under cleanup; the bundle drops the v2 field names', () => {
  const { f, r, view, cleanup } = setUp()
  const pack = promptPack({ view, tenant: 'Contoso', steps: r.steps, schedule: r.schedule, changeRecord: '', planSummary: r.schedule.derivation.criticalPath, announcement: null, cleanup })
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
