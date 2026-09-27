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
import type { Step } from '../../roadmap/types.ts'
import { cardLineOf } from './policyTasks.ts'
import { correctionSettings } from '../../roadmap/policyProcedure.ts'

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
  assert.equal(panel.accepted, false)
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

test('once accepted, the panel only says so and offers Remove acceptance; the Satisfied tile holds the policy, date and reason, and an accepted weaker difference is marked there', () => {
  const f = fixture('demo-week2')
  const first = open(f, ADMINS)
  const acceptable = acceptPanelOf(first.step, first.ctx)!.acceptable
  const mapping = applyStepDecisions(f.mapping, { [`${DEVIATION_KEY}${ADMINS}`]: { answers: { reason: 'Only Global Administrators sign in here', fields: JSON.stringify(acceptable) }, at: '2026-09-26T12:00:00Z' } } as never)
  const { step, ctx } = open({ ...f, mapping }, ADMINS)
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [], 'nothing left to correct')
  const panel = acceptPanelOf(step, ctx)!
  assert.deepEqual(panel.lines, [])
  assert.equal(panel.accepted, true)
  const readiness = stepBodyOf(step, ctx).readiness
  const tile = readiness.satisfied.find((t) => t.key.startsWith('accepted:'))
  assert.equal(tile?.caution, true, 'a weaker acceptance is marked')
  // The date and the reason are said once, in the tile (owner, 2026-09-27, OWN-ACCEPT).
  assert.match(tile?.note ?? '', /Accepted Sep 26, 2026: Only Global Administrators sign in here$/)
  // The rail's accepted block draws the heading and Remove acceptance, and nothing that repeats the tile.
  const source = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  const block = source.slice(source.indexOf('{panel.accepted && <div className="accepted-deviation">'), source.indexOf('</div>}', source.indexOf('{panel.accepted && <div className="accepted-deviation">')))
  assert.ok(block.length > 0, 'the accepted block is drawn')
  assert.deepEqual([...block.matchAll(/\{(W\.\w+|panel\.[\w.]+)\}/g)].map((m) => m[1]), ['W.acceptedHead', 'W.remove'])
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

test('an extra exclusion reads by what it names: anyone in a group, anyone holding a role, an account by its own name', () => {
  const f = fixture('demo-week2')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => ({ u1: 'Jane Doe', g1: 'Old VIP exclusions' } as Record<string, string>)[id] ?? id }
  const stepWith = (kind: 'user' | 'group'): Step => ({ id: 'x', tracking: { members: [{ key: 'm', sourceName: 's', policyId: null, policyName: null, differsFields: { 'conditions.users': 'g2-a' }, differences: [{ dimension: 'conditions.users', part: 'exclude', kind, change: 'extra', ids: [kind === 'user' ? 'u1' : 'g1'], direction: 'weaker' }] }] }, action: {} } as unknown as Step)
  assert.equal(acceptPanelOf(stepWith('user'), ctx)!.leaves, 'This leaves Jane Doe outside this policy.')
  assert.equal(acceptPanelOf(stepWith('group'), ctx)!.leaves, 'This leaves anyone in Old VIP exclusions outside this policy.')
})

test('a later acceptance starts from the saved reason, and the printed Satisfied tile carries the Weaker mark too', () => {
  const source = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(source, /const \[reason, setReason\] = useState\(saved\?\.reason \?\? ''\)/)
  const sections = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  assert.match(sections, /\{t\.caution && <Status tone="wait">\{ACCEPT_WORDS\(\)\.tags\.weaker\}<\/Status>\}/)
})

test('a change from All users to the plan’s roles names the count on its card, never a list "below" it', () => {
  const roles = Array.from({ length: 20 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
  const ctx = { nameOf: (id: string) => id, exclusionsGroupId: 'ex' }
  const [line] = correctionSettings({ conditions: { users: { includeUsers: ['All'], excludeGroups: ['ex'] } } }, { conditions: { users: { includeRoles: roles, excludeGroups: ['ex'] } } }, ctx, new Set(['users']))
  assert.match(line, /listed below/, 'the premise: the Implementation Task lists them')
  const card = cardLineOf(line)
  assert.match(card, /^Under Users → Include, select only Directory roles: Select \(20\)\. Yours is stricter/, card)
  assert.doesNotMatch(card, /listed below/)
})
