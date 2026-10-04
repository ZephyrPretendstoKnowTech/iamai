// What leaves as a file (prompt 31 §1.4): every export path run over a
// fixture that holds sign-in names, display names, a tenant id, IP ranges
// and device names, asserting what each output contains. The redacted
// grounding bundle must contain none of them; the others say what they carry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './roadmap/fixtures/index.ts'
import { runFixture } from './roadmap/fixtures/run.ts'
import { groundingBundle } from './roadmap/prompts.ts'
import { redactIdentifiers } from './redact.ts'
import { buildIcs } from './roadmap/ics.ts'
import { exportHoldOf, exportViewsOf, stepExportView } from './ui/surfaces/stepExport.ts'
import { boardOf, boardWhenOf, laneViewFor, waveStartOf } from './ui/surfaces/planBoard.ts'
import { planDates } from './ui/surfaces/stepVars.ts'
import type { StepVarContext } from './ui/surfaces/stepVars.ts'
import { planFinish, statedEstimate } from './derive/finish.ts'
import { exportText, runbookRedaction } from './ui/exportGuard.ts'

const f = fixture('small')
const run = runFixture(f)
const snapshot = f.snapshot
const users = snapshot.users.slice(0, 5)
const upns = users.map((u) => u.userPrincipalName!)
const names = users.map((u) => u.displayName!)
const tenantId = snapshot.tenantId
const ip = '203.0.113.0/24'
const deviceNames = snapshot.devices.slice(0, 3).map((d) => d.displayName!)
const nameOf = (id: string) => snapshot.users.find((u) => u.id === id)?.displayName ?? id

// The one reading of a step for an artifact: the Export page's own view
// (ui/surfaces/stepExport.ts), which is the frozen Step Contract's answers.
const bundleView = (s: Parameters<typeof stepExportView>[0]) => stepExportView(s, { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: null, now: snapshot.asOf })

function contains(text: string, needles: string[]): string[] {
  return needles.filter((n) => text.includes(n))
}

test('the redacted grounding bundle holds none of the identifiers the fixture carries, and the unredacted one says in its header what it contains', () => {
  // the fixture really carries the identifiers the exports are checked against
  {
    const raw = JSON.stringify(snapshot)
    assert.equal(contains(raw, upns).length, upns.length)
    assert.equal(contains(raw, names).length, names.length)
    assert.ok(raw.includes(tenantId) && raw.includes(ip) && deviceNames.length > 0 && contains(raw, deviceNames).length === deviceNames.length)
  }
  // the redacted grounding bundle holds no sign-in names, display names, tenant id, device names or IP ranges
  {
    const bundle = JSON.stringify(groundingBundle({ view: bundleView, tenant: 'Fixture small', snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: true, generated: '2026-08-28' }))
    assert.deepEqual(contains(bundle, upns), [])
    assert.deepEqual(contains(bundle, names), [])
    assert.ok(!bundle.includes(tenantId))
    assert.deepEqual(contains(bundle, deviceNames), [])
    assert.ok(!bundle.includes(ip))
    assert.match(bundle, /Redacted: no user names/)
  }
  // the unredacted grounding bundle names what it contains in its header
  {
    const bundle = JSON.stringify(groundingBundle({ view: bundleView, tenant: 'Fixture small', snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: false, generated: '2026-08-28' }))
    assert.match(bundle, /Unredacted: contains user names and sign-in names/)
    assert.ok(bundle.includes(tenantId))
  }
})

test('diagnostics: redactIdentifiers removes every sign-in name and every id, keeping correlations', () => {
  const out = redactIdentifiers(JSON.stringify(snapshot))
  assert.deepEqual(contains(out, upns), [])
  assert.ok(!out.includes(tenantId))
  assert.ok(!out.includes(users[0].id))
  assert.match(out, /upn-1@redacted/)
  assert.match(out, /guid-0001/)
})

test('the calendar export carries titles, dates and the runbook, never a sign-in name or the tenant id', () => {
  const ics = buildIcs(run.steps, 'Fixture small', f.planId, (s) => stepExportView(s, { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: null, now: snapshot.asOf }))
  // The runbook names the accounts a step asks about; the file a person
  // downloads is the guarded text (Export.tsx exportDownload), which masks them.
  // Read raw, the check passed only while a line fold split the one address.
  const delivered = exportText('plan.ics', ics, runbookRedaction(f.mapping)).replace(/\r\n[ \t]/g, '')
  assert.deepEqual(contains(delivered, upns), [])
  assert.ok(!ics.includes(tenantId))
})

// Security audit, 2026-09-29: names shorter than four letters were never masked,
// the organisation's own included, so a tenant named with an acronym stayed in
// the masked bundle wherever step prose names the tenant ("…names an object QXZ
// does not have yet", nine times on the messy fixture).
test('the redacted grounding bundle masks the organisation\'s name however short it is', () => {
  const m = structuredClone(fixture('messy'))
  const org = (m.snapshot.config.organization?.rows ?? [])[0] as { displayName?: string } | undefined
  assert.ok(org, 'the fixture names its organisation')
  org.displayName = 'QXZ'
  const r = runFixture(m)
  const mNameOf = (id: string) => m.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const view = (s: Parameters<typeof stepExportView>[0]) => stepExportView(s, { snapshot: m.snapshot, mapping: m.mapping, nameOf: mNameOf, signature: 'IT', operatorId: null, now: m.snapshot.asOf })
  const unmasked = JSON.stringify(groundingBundle({ view, tenant: 'QXZ', snapshot: m.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: false, generated: '2026-08-28' }))
  assert.ok(/\bQXZ\b/.test(unmasked), 'the step prose names the organisation')
  const bundle = JSON.stringify(groundingBundle({ view, tenant: 'QXZ', snapshot: m.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: true, generated: '2026-08-28' }))
  assert.deepEqual(bundle.match(/.{0,40}\bQXZ\b.{0,20}/g) ?? [], [])
})

test('F-130: the grounding bundle carries the dates its readme promises: each row\'s When as the Plan draws it, and the Estimated finish, on a plan that holds its policies', () => {
  const d = fixture('demo')
  const r = runFixture(d, {}, null, d.snapshot.asOf)
  const board = boardOf(r.steps, r.schedule.cleanup, d.mapping.breakGlassAnswers ?? null)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, d.snapshot, exportHoldOf(board))
  const ctxOf = (s: Parameters<typeof stepExportView>[0]): StepVarContext => ({ snapshot: d.snapshot, mapping: d.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: d.operatorId, now: d.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: d.groups, naming: r.coverage.organisation.naming })
  const bundle = groundingBundle({ view: exportViewsOf(board, ctxOf), tenant: 'Contoso Pty Ltd', snapshot: d.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: false, generated: 'Oct 3, 2026', forecast: board.forecast }) as { _readme: string[]; plan: { finish: string | null; estimatedFinish: string | null; steps: { id: string; lane: string; when: string | null; dates: string | null }[] } }
  assert.match(bundle._readme.join(' '), /dates/, 'the readme promises dates')
  const plan = bundle.plan
  assert.equal(plan.finish, null, 'the premise: the plan holds work, so it has no committed finish')
  const finish = planFinish(r.steps, r.schedule.cleanup?.end ?? null)
  assert.equal(plan.estimatedFinish, statedEstimate(r.steps, finish, r.schedule, board.forecast), 'the Estimated finish the Plan tile states')
  const open = plan.steps.filter((s) => ['Ready', 'Up Next', 'On Hold'].includes(s.lane))
  assert.ok(open.some((s) => s.lane === 'On Hold' && s.dates === null), 'the premise: held rows carry no Dates line')
  for (const s of open) {
    const step = r.steps.find((x) => x.id === s.id)!
    assert.equal(s.when, boardWhenOf(step, waveStartOf(step), laneViewFor(step, board)), `${s.id}: the row's When, word for word`)
    assert.match(s.when ?? '', /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/, `${s.id}: a plain date`)
  }
  assert.doesNotMatch(JSON.stringify(bundle), /\bEst\./, 'no "Est." anywhere')
})
