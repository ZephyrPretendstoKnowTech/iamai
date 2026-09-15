// Editorial batch A: the step's artifacts describe the operation its package selects.
//
// On the mid tenant, Medium user risk's JSON excludes every guest type and sets no
// session control, while the export and AI Info read the resolved operation of a
// stand-in baseline: "Include: All users, Guest or external users → all types" and
// "Session → Sign-in frequency → Every time". The export's portal lines, and the AI
// Info that carries them, now translate the body the package's JSON sends
// (stepPackage.ts selectedPolicyBodiesOf), and the translator no longer drops an
// all-guest-types exclusion from an All users policy (portalLines.ts usersLine).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, laneViewOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepContract } from './stepContract.ts'
import type { LaneView } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { implementationIsCurrent } from './stepContract.ts'
import { implementationOffered } from './stepJson.ts'
import { selectedPolicyBodiesOf } from './stepPackage.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

type Opened = { step: Step; ctx: StepVarContext; lane: LaneView }
const plans = new Map<string, { steps: Step[]; open: (s: Step) => Opened }>()
function planOf(name: FixtureName): { steps: Step[]; open: (s: Step) => Opened } {
  const hit = plans.get(name)
  if (hit) return hit
  setDisplayTimeZone('UTC')
  const f = fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const open = (step: Step): Opened => {
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
    return { step, ctx, lane }
  }
  const out = { steps: r.steps, open }
  plans.set(name, out)
  return out
}
function opened(name: FixtureName, id: string): Opened {
  const p = planOf(name)
  const step = p.steps.find((s) => s.id === id)
  assert.ok(step, `${name}: ${id} is not on the plan`)
  return p.open(step)
}
const jsonOf = (o: Opened): Record<string, unknown> => {
  const a = stepBodyOf(o.step, o.ctx, { lane: o.lane }).artifacts.find((x) => x.id === 'json')
  assert.ok(a && !a.unavailable, 'the JSON channel is drawn')
  return JSON.parse(a.text()) as Record<string, unknown>
}

test('Medium user risk on mid: the export states the guest exclusion and no session control, as the JSON sends', () => {
  const o = opened('mid', 's-goal-user-risk-medium')
  const body = jsonOf(o) as { conditions: { users: { excludeGuestsOrExternalUsers?: unknown } }; sessionControls: unknown }
  assert.ok(body.conditions.users.excludeGuestsOrExternalUsers, 'the premise: the JSON excludes guest and external users')
  assert.equal(body.sessionControls, null, 'the premise: the JSON sets no session control')
  // The resolved operation of this stand-in baseline says otherwise: the case the export used to read.
  const resolved = o.step.action.resolution!.policies[0].body as { sessionControls?: unknown }
  assert.ok(resolved.sessionControls, 'the premise: the resolved operation carries a session control')

  const lines = stepExportView(o.step, o.ctx, o.lane).whatToDo
  const users = lines.find((l) => l.startsWith('Users → Include:'))
  assert.ok(users, JSON.stringify(lines))
  assert.match(users, /^Users → Include: All users\. /)
  assert.match(users, /Also exclude Guest or external users \(all types\)\.$/)
  assert.equal(lines.some((l) => l.startsWith('Session →')), false, 'no session control is instructed')
  assert.ok(lines.includes('Grant → Require multifactor authentication, Require password change; Require all the selected controls'))
})

test('Medium sign-in risk on mid: the export grants built-in MFA with no session control, as the JSON sends', () => {
  const o = opened('mid', 's-goal-sign-in-risk-medium')
  const body = jsonOf(o) as { grantControls: { builtInControls: string[] }; sessionControls: unknown }
  assert.deepEqual(body.grantControls.builtInControls, ['mfa'])
  const lines = stepExportView(o.step, o.ctx, o.lane).whatToDo
  assert.ok(lines.includes('Grant → Require multifactor authentication'), JSON.stringify(lines))
  assert.equal(lines.some((l) => l.startsWith('Session →') || /authentication strength/.test(l)), false)
})

test('every packaged policy step whose lines are handed over: the export lines are the translation of the body its JSON sends', () => {
  let compared = 0
  for (const name of ['demo', 'demo-week2', 'small', 'mid', 'large', 'midflight', 'hostile'] as FixtureName[]) {
    const p = planOf(name)
    for (const step of p.steps) {
      if (!implementationOffered(step) || !implementationIsCurrent(step)) continue
      const o = p.open(step)
      const contract = stepContract(step, o.ctx, undefined, o.lane)
      const selected = selectedPolicyBodiesOf(step, o.ctx, contract)
      if (selected === null || selected.some((s) => s.preview)) continue
      const names = portalNamesFor(o.ctx, stepVars(step, o.ctx) as Record<string, unknown>, step.title)
      const expected = stepPortalLines(step, names, selected)
      assert.ok(expected, `${name}/${step.id}: lines`)
      const lines = stepExportView(step, o.ctx, o.lane).whatToDo
      for (const l of expected) assert.ok(lines.includes(l), `${name}/${step.id}: the export lacks "${l}"`)
      for (const s of selected) {
        const b = s.body as { sessionControls?: unknown; grantControls?: { builtInControls?: string[] } | null }
        const lone = selected.length === 1
        if (lone && s.method === 'POST' && b.sessionControls === null) assert.equal(lines.some((l) => l.startsWith('Session →')), false, `${name}/${step.id}: a session control the JSON does not send`)
        if (lone && b.grantControls?.builtInControls?.includes('block')) assert.ok(lines.includes('Grant → Block access'), `${name}/${step.id}: the block grant`)
      }
      compared += 1
    }
  }
  assert.ok(compared >= 10, `only ${compared} steps compared`)
})
