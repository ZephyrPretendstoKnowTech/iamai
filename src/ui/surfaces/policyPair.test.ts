// A goal the baseline implements with two policies (Policy A / Policy B, the
// guests policy): two policies, two names, on the step's lines and in the
// portal's two blocks (coverage/naming.ts policyPairNames; stepPortal).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { RoadmapInput } from '../../roadmap/generate.ts'
import { policyPairNames } from '../../coverage/naming.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'

// The two blocks come from the step's own resolved policies, so they render on a
// fixture whose baseline is the pinned one — the package the product ships.
test('a goal the baseline implements with two policies renders two labelled blocks', () => {
  const fd = fixture('demo-week2')
  // The demo already holds the guests policy, and a goal in place has nothing to
  // create; the same tenant with none of its policies yet has the pair to write.
  const ca = fd.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const snapshot = { ...fd.snapshot, config: { ...fd.snapshot.config, caPolicies: { ...ca, rows: [] } } }
  const rd = runFixture({ ...fd, snapshot }, { snapshot } as Partial<RoadmapInput>)
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
