// The Accept panel (owner, 2026-09-26): each concrete difference on its own
// line, marked Weaker, Stricter or Differs; what a weaker one leaves out in one
// amber sentence; a real button; Defer set apart; and, once accepted, when, why
// and what it covers. The exclusions group missing is never accepted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { DEVIATION_KEY, applyStepDecisions } from '../../roadmap/decisions.ts'
import { acceptPanelOf } from './acceptPanel.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

type Row = Record<string, any>
const ADMINS = 's-goal-admins-phishing-resistant'

function open(f: ReturnType<typeof fixture>, id: string) {
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === id)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  return { step, ctx }
}

test('the Accept panel lists each difference on its own line, marked, and says in one sentence who a weaker one leaves out', () => {
  // Week two's admins policy holds Global Administrator alone, under the built-in phishing-resistant strength.
  const { step, ctx } = open(fixture('demo-week2'), ADMINS)
  const panel = acceptPanelOf(step, ctx)!
  assert.deepEqual(panel.lines.map((l) => [l.mark, l.text]), [
    ['Weaker', '45 admin roles not included: Agent ID Administrator, AI Reader, Application Administrator, Application Developer, Authentication Administrator and 40 more'],
    ['Stricter', "Grant: Phishing-resistant MFA, where the baseline's is Modern MFA + TAP"],
  ])
  assert.equal(panel.leaves, 'This leaves 45 admin roles without Modern MFA + TAP.')
  assert.equal(panel.required, null)
  assert.deepEqual(Object.keys(panel.acceptable).sort(), ['conditions.users', 'grantControls'])
  assert.equal(panel.accepted, null)
})

test('a session control the tenant adds is a Stricter line with its value', () => {
  const f = structuredClone(fixture('demo-week2'))
  const id = runFixture(f).steps.find((s) => s.id === ADMINS)!.tracking!.policyId
  const row = (f.snapshot.config.caPolicies.rows as Row[]).find((p) => p.id === id)!
  row.sessionControls = { signInFrequency: { isEnabled: true, type: 'days', value: 7, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication' } }
  const { step, ctx } = open(f, ADMINS)
  const lines = acceptPanelOf(step, ctx)!.lines
  assert.ok(lines.some((l) => l.tag === 'stricter' && l.text === 'Also sets sign-in frequency: 7 days'), JSON.stringify(lines))
})

test('the exclusions group missing is marked Required and is never offered for acceptance', () => {
  // Demo's admins policy excludes Core - Break glass and not Core - Exclusions.
  const { step, ctx } = open(fixture('demo'), ADMINS)
  const panel = acceptPanelOf(step, ctx)!
  assert.ok(panel.lines.some((l) => l.tag === 'required' && l.mark === 'Required' && l.text === '1 group not excluded: Core - Exclusions'), JSON.stringify(panel.lines))
  assert.ok(panel.lines.some((l) => l.tag === 'weaker' && l.text === '1 group also excluded: Core - Break glass'))
  assert.equal(panel.required, "Excluding Core - Exclusions is required, so it can't be accepted.")
  assert.equal('conditions.users' in panel.acceptable, false, 'who it applies to holds the required piece')
  assert.match(panel.leaves ?? '', /^This leaves 45 admin roles and anyone in Core - Break glass without Modern MFA \+ TAP\.$/)
})

test('once accepted, the panel says when, why and what the acceptance covers, and an accepted weaker difference is marked but stays under Satisfied', () => {
  const f = fixture('demo-week2')
  const first = open(f, ADMINS)
  const acceptable = acceptPanelOf(first.step, first.ctx)!.acceptable
  const mapping = applyStepDecisions(f.mapping, { [`${DEVIATION_KEY}${ADMINS}`]: { answers: { reason: 'Only Global Administrators sign in here', fields: JSON.stringify(acceptable) }, at: '2026-09-26T12:00:00Z' } } as never)
  const { step, ctx } = open({ ...f, mapping }, ADMINS)
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [], 'nothing left to correct')
  const panel = acceptPanelOf(step, ctx)!
  assert.deepEqual(panel.lines, [])
  assert.deepEqual(panel.accepted, { date: 'Sep 26, 2026', reason: 'Only Global Administrators sign in here', covers: 'Covers 45 admin roles not included and the grant.' })
  const readiness = stepBodyOf(step, ctx).readiness
  const tile = readiness.satisfied.find((t) => t.key.startsWith('accepted:'))
  assert.equal(tile?.caution, true, 'a weaker acceptance is marked')
  assert.equal(readiness.tiles.some((t) => t.key.startsWith('accepted:')), false, 'and is no task')
})

test('Accept is a bordered button that asks for a reason, and Defer sits apart below a rule drawn only beside the panel', () => {
  const source = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  const panel = source.slice(source.indexOf('function AcceptDeviation'), source.indexOf('function AcceptDeviation') + 4000)
  assert.match(panel, /<Button variant="secondary" className="accept-button" onClick=\{save\}>\{W\.accept\}<\/Button>/)
  assert.doesNotMatch(panel, /disabled=\{reason/, 'the button never looks dead')
  assert.match(panel, /W\.reasonFirst/)
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.step-action-column \.accept-deviation ~ \.rail-exceptions \{[^}]*border-top: 1px solid var\(--line\);/)
})
