// Prompt 53 queue item 7: every export is vocabulary-clean. The calendar, the
// prompt pack, the grounding bundle and the plan file speak from the
// content-driven step (src/ui/surfaces/stepExport.ts) — what the screen says —
// and none of them carries a string the plan.step contract forbids, a
// forbidden-everywhere string, or the v2 engine's ring and soak vocabulary.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from './roadmap/fixtures/index.ts'
import { runFixture } from './roadmap/fixtures/run.ts'
import { buildIcs } from './roadmap/ics.ts'
import { groundingBundle, promptPack, promptPackMarkdown } from './roadmap/prompts.ts'
import { buildPlanFile, fileStep } from './roadmap/plan.ts'
import { stepExportView } from './ui/surfaces/stepExport.ts'
import type { StepVarContext } from './ui/surfaces/stepVars.ts'
import { todayView } from './derive/today.ts'

const contracts = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')) as { forbidEverywhere: string[]; surfaces: { id: string; forbid?: string[] }[] }
const STEP_FORBID = contracts.surfaces.find((s) => s.id === 'plan.step')?.forbid ?? []
const FORBID_EVERY = contracts.forbidEverywhere
// The v2 vocabulary the reviewer's walk named; the contract lists most of it.
const V2 = ['soak', "the ring's", 'this ring', 'Ring plan', 'Exit criteria', 'Do it', 'created by the step above', 'Readiness table', 'Nothing changes for anyone', 'This is groundwork']

// Week two: its policies name nothing the tenant lacks, so they carry dates and
// calendar entries (a policy the plan cannot write yet carries neither).
const f = fixture('demo-week2')
const run = runFixture(f)
const nameOf = (id: string): string => run.input.names!.label(id)
const firstEnforce = run.steps.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
const ctx = (s: (typeof run.steps)[number]): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, firstEnforce, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null })
const view = (s: (typeof run.steps)[number]) => stepExportView(s, ctx(s))

/**
 * Every forbidden string the export carries. A JSON export is checked on its
 * string values (a field name like soakDays is data, not prose); urn:user: is
 * allowed inside a policy body (item 7).
 */
function hits(text: string, { json = false } = {}): string[] {
  const all = [...new Set([...STEP_FORBID, ...FORBID_EVERY, ...V2])]
  if (!json) return all.filter((w) => text.includes(w))
  const values: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') values.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk)
  }
  walk(JSON.parse(text))
  const joined = values.join(String.fromCharCode(10))
  return all.filter((w) => (w === 'urn:user:' ? false : joined.includes(w)))
}

test('the calendar speaks from the content-driven step and carries no forbidden vocabulary', () => {
  const ics = buildIcs(run.steps, 'Contoso Pty Ltd', f.planId, view)
  assert.deepEqual(hits(ics), [], 'no forbidden string in the calendar')
  assert.match(ics, /SUMMARY:Require MFA for Everyone|SUMMARY:Block Legacy Authentication|SUMMARY:Shorten Admin Sessions/, 'entries carry the content titles')
  assert.match(ics, /Done when:/, 'entries carry the done-when lines')
  assert.match(ics, /What to do:/, 'entries carry the portal lines')
})

test('the prompt pack speaks from the content-driven step and carries no forbidden vocabulary', () => {
  const pack = promptPack({ view, tenant: 'Contoso Pty Ltd', steps: run.steps, schedule: run.schedule, changeRecord: '', planSummary: run.schedule.derivation.criticalPath, announcement: null })
  const md = promptPackMarkdown(pack, 'Contoso Pty Ltd')
  assert.deepEqual(hits(md), [], 'no forbidden string in the prompt pack')
  assert.match(md, /What to do:/, 'the step prompt carries the portal lines')
})

test('the grounding bundle speaks from the content-driven step and carries no forbidden vocabulary', () => {
  const bundle = groundingBundle({ view, tenant: 'Contoso Pty Ltd', snapshot: f.snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: false, generated: 'Sep 2, 2026' })
  const text = JSON.stringify(bundle, null, 2)
  assert.deepEqual(hits(text, { json: true }), [], 'no forbidden string in the bundle')
  const steps = (bundle as { plan: { steps: { title: string; whatToDo?: string[]; doneWhen?: string[]; whatChanges?: string }[] } }).plan.steps
  assert.ok(steps.length > 0)
  for (const s of steps) {
    assert.ok(typeof s.title === 'string' && s.title.length > 0)
    assert.ok(Array.isArray(s.whatToDo) && Array.isArray(s.doneWhen), `${s.title}: what to do and done when travel`)
    assert.equal(s.whatChanges, undefined, 'the v2 what-changes line does not travel')
  }
})

test('the plan file keeps every number, date and body and none of the v2 prose', () => {
  const file = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { kind: 'github', owner: 'o', repo: 'r', commit: 'c' },
    mapping: f.mapping,
    steps: run.steps,
    checkpoints: [],
  })
  const text = JSON.stringify(file)
  assert.deepEqual(hits(text, { json: true }), [], 'no forbidden string in the plan file')
  for (const [i, s] of file.steps.entries()) {
    const live = run.steps[i]
    assert.equal(s.id, live.id)
    assert.equal(s.status, live.status)
    assert.deepEqual(s.population, live.population, `${s.id}: the population travels`)
    assert.deepEqual(s.rings.map((r) => [r.plannedStart, r.plannedEnd]), live.rings.map((r) => [r.plannedStart, r.plannedEnd]), `${s.id}: the ring dates travel`)
    assert.equal(s.action.json, live.action.json, `${s.id}: the policy body travels`)
    assert.deepEqual(s.action.portalSteps, [])
  }
  // fileStep is idempotent: a step already filed files the same.
  assert.deepEqual(fileStep(file.steps[0]), file.steps[0])
})
