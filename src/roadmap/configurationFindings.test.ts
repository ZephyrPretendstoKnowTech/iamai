import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachConfigurationFindings, canonicalBlockerStepId, blockerSteps } from './blockerSteps.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { SubjectReport } from '../validation/report.ts'
import { stepFromPlanHash } from '../ui/shell/routes.ts'

test('invalid office configuration stays on its canonical task and old repair links reach it', () => {
  const r = runFixture(fixture('demo'))
  const step = r.steps.find(s => s.id === 's-prereq-trusted-location')!
  assert.ok(step)
  const finding = { id: 'loc.notWholeInternet', subject: 'trustedLocation' as const, target: 'office-id', severity: 'blocker' as const, outcome: 'fail' as const, finding: 'Office includes 0.0.0.0/0.' }
  const report: SubjectReport = { subject: 'trustedLocation', targets: [{ target: {}, label: 'Office', results: [finding] }], blocking: [finding], warnings: [], notRun: [] }
  attachConfigurationFindings(r.steps, [report])
  assert.equal(blockerSteps([report]).length, 0)
  assert.equal(step.state.satisfied, false)
  assert.equal(step.configurationFindings?.at(-1)?.detail, finding.finding)
  assert.equal(stepFromPlanHash('#/plan/s-blocker-trusted-location'), step.id)
  assert.equal(canonicalBlockerStepId('allowedCountries'), 's-prereq-allowed-countries')
})

test('method enrollment does not invalidate an existing strength object or create a duplicate repair task', () => {
  const r = runFixture(fixture('demo'))
  const step = r.steps.find(s => s.id === 's-prereq-auth-strength')!
  assert.ok(step)
  const satisfied = step.state.satisfied
  const finding = { id: 'str.achievable', subject: 'authStrength' as const, target: 'strength-id', severity: 'blocker' as const, outcome: 'fail' as const, finding: 'People need an accepted method.' }
  const report: SubjectReport = { subject: 'authStrength', targets: [{ target: {}, label: 'Strength', results: [finding] }], blocking: [finding], warnings: [], notRun: [] }
  attachConfigurationFindings(r.steps, [report])
  assert.equal(step.state.satisfied, satisfied)
  assert.ok(!step.configurationFindings?.some(f => f.key.startsWith('str.achievable')))
  assert.equal(blockerSteps([report]).length, 0)
})

test('a broadened saved office network reopens its original task without a duplicate row', () => {
  const f = fixture('demo')
  const location = f.snapshot.config.namedLocations.rows[0] as { id: string; ipRanges: { cidrAddress: string }[] }
  location.ipRanges = [{ cidrAddress: '0.0.0.0/0' }]
  f.mapping.trustedLocationIds = [location.id]
  f.mapping.wizardAnswered.trustedLocations = true
  if (f.mapping.assumed) delete f.mapping.assumed.trustedLocations
  const r = runFixture(f, { snapshot: f.snapshot, mapping: f.mapping })
  const step = r.steps.find(s => s.id === 's-prereq-trusted-location')!
  assert.ok(step)
  assert.equal(step.state.satisfied, false)
  assert.ok(step.configurationFindings?.some(f => f.key.startsWith('loc.notWholeInternet') && f.outcome === 'fail'))
  assert.equal(r.steps.some(s => s.id === 's-blocker-trusted-location'), false)
})
