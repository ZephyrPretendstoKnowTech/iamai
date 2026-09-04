// A goal the baseline implements with two policies (Policy A / Policy B, the
// guests policy): two policies, two names, on the step's lines and in the
// portal's two blocks (coverage/naming.ts policyPairNames; stepPortal).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { policyPairNames } from '../../coverage/naming.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { pairBaselineNames, portalNamesFor, stepPortalLines } from './stepPortal.ts'

// GetIAMAI: the guests policy is not in place there, so the plan proposes the pair's names.
const f = fixture('getiamai')
const r = runFixture(f)
const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
const guests = r.steps.find((s) => s.goalId === 'guests-mfa' && s.kind !== 'verify')!

test('guests Policy A and Policy B carry distinct names: the proposal, and the proposal with the baseline\'s words for the second policy', () => {
  const baseline = pairBaselineNames(guests.goalId)
  assert.equal(baseline.length, 2, 'the baseline implements the guests goal with two policies')
  const proposed = String(guests.naming?.proposed)
  const ex = stepVars(guests, ctx) as Record<string, unknown>
  assert.equal(ex.policyNameA, proposed, 'A is the plan\'s proposal')
  assert.equal(typeof ex.policyNameB, 'string')
  assert.notEqual(ex.policyNameA, ex.policyNameB)
  const bWords = baseline[1].split(/\s+[-–|]\s+/).pop()!
  assert.ok((ex.policyNameB as string).endsWith(bWords), `${ex.policyNameB} carries the baseline's words for B (${bWords})`)
})

// The two blocks come from the step's own resolved policies, so they render on a
// fixture whose baseline is the pinned one — the package the product ships.
test('a goal the baseline implements with two policies renders two labelled blocks', () => {
  const fd = fixture('demo-week2')
  const rd = runFixture(fd)
  const ctxd: StepVarContext = { snapshot: fd.snapshot, mapping: fd.mapping, nameOf: (id) => rd.input.names!.label(id), signature: 'IT', operatorId: fd.operatorId, now: fd.snapshot.asOf, groups: fd.groups, naming: rd.coverage.organisation.naming, ...planDates(rd.steps, rd.schedule.start, rd.coverage.organisation.naming) }
  const step = rd.steps.find((s) => s.goalId === 'guests-mfa' && s.kind !== 'verify')!
  assert.equal(step.action.resolution?.policies.length, 2, 'the step carries both of the baseline\'s policies')
  const exd = stepVars(step, ctxd) as Record<string, unknown>
  const lines = stepPortalLines(step, portalNamesFor(ctxd, exd, step.title))!
  const roots = lines.filter((l) => /^Policy [AB] — /.test(l))
  assert.equal(roots.length, 2, JSON.stringify(lines))
})

test('the pair names follow the tenant\'s separator, and never collapse to one name', () => {
  assert.deepEqual(policyPairNames('CA - Require - MFA for guests', 'IAC - GLOBAL - GRANT - Phishing resistant MFA for partners', null), { a: 'CA - Require - MFA for guests', b: 'CA - Require - Phishing resistant MFA for partners' })
  assert.deepEqual(policyPairNames('CA_Require_MFA for guests', 'IAC - GLOBAL - GRANT - Partners', { prefix: 'CA', separator: '_' }), { a: 'CA_Require_MFA for guests', b: 'CA_Require_Partners' })
  assert.deepEqual(policyPairNames('CA - Require - Same', 'X - Same', null), { a: 'CA - Require - Same', b: 'CA - Require - Same - B' })
})
