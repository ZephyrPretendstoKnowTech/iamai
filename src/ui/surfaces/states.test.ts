// Schedule and states on the Plan (prompt 48 Part 4). Every step across the
// fixtures carries one of the nine status words; a re-scan that tracked a
// policy moves the row's state (the midflight tenant has tagged, enforced and
// report-only policies); the print export and the ICS read the same finish
// and rows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { statusOf } from './statusWord.ts'
import { planFinish } from '../../derive/finish.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { stepExportView } from './stepExport.ts'

// 'Needs decision' is the ninth: the `needs-decision` condition projects to the
// `blocked` status and reads as its own word (statusWord.ts), because a step
// waiting on the operator's own answer is not a step held by work elsewhere.
const WORDS = new Set(['In place', 'Ready', 'Blocked', 'Needs decision', 'Scheduled', 'Report-only', 'Ready to enforce', 'Enforced', 'Skipped'])

test('every step on every fixture carries exactly one of the nine status words', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) assert.ok(WORDS.has(statusOf(s).word), `${f.name} ${s.id} → ${statusOf(s).word}`)
  }
})

test('a re-scan that tracked policies moves rows to Report-only and Enforced (midflight)', () => {
  const r = runFixture(fixture('midflight'))
  const words = new Set(r.steps.map((s) => statusOf(s).word))
  assert.ok(words.has('Enforced'), 'a tracked enforced policy reads Enforced')
  assert.ok(words.has('Report-only'), 'a tracked report-only policy reads Report-only')
  // Tracking comes from evidence, not from a manual status.
  assert.ok(r.steps.some((s) => s.tracking !== null), 'at least one step is tracked')
})

test('the print finish and the ICS read the same rings the plan does', () => {
  const r = runFixture(fixture('small'))
  const finish = planFinish(r.steps)
  // planFinish never dates a step past the schedule target.
  if (finish.finish) assert.ok(finish.finish <= r.schedule.targetEnd)
  // The ICS emits an entry per scheduled step, from its rings — the same rows the plan shows.
  const ics = buildIcs(r.steps, 'Tenant', r.input.planId, (s) => stepExportView(s, { snapshot: r.input.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names?.label(id) ?? id, signature: 'IT', operatorId: null, now: r.input.snapshot.asOf }))
  const scheduled = r.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && s.rings.length > 0).length
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, scheduled, 'one calendar entry per scheduled step')
})
