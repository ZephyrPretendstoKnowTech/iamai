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
import { runFixture, withFoundationSettled, withRecoveryTested } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'
import type { LaneView } from './stepContract.ts'
import { pinnedPackage } from '../../baseline/pinned.ts'
import { stepExportView } from './stepExport.ts'
import { implementationIsCurrent } from './stepContract.ts'
import { implementationOffered } from './stepJson.ts'
import { plannedOperationsOf } from './stepPackage.ts'
import { submitsEnforcement } from '../../roadmap/operations.ts'
import { shared } from '../../content/content.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

type Opened = { step: Step; ctx: StepVarContext; lane: LaneView }
const plans = new Map<string, { steps: Step[]; open: (s: Step) => Opened }>()
/**
 * `settled` settles the plan's foundation (fixtures/run.ts withFoundationSettled):
 * until Emergency Access and Direction are settled a policy step hands nothing over, so a
 * case about what its artifacts say starts there (roadmap/foundations.ts).
 */
function planOf(name: FixtureName, settled = false): { steps: Step[]; open: (s: Step) => Opened } {
  const key = settled ? `${name}+settled` : name
  const hit = plans.get(key)
  if (hit) return hit
  setDisplayTimeZone('UTC')
  const f = settled ? withFoundationSettled(fixture(name)) : fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const open = (step: Step): Opened => {
    const reading = readings.get(step.id)
    const lane = laneViewFor(step, { readings, titleOf })
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
    return { step, ctx, lane }
  }
  const out = { steps: r.steps, open }
  plans.set(key, out)
  return out
}
function opened(name: FixtureName, id: string): Opened {
  const p = planOf(name)
  const step = p.steps.find((s) => s.id === id)
  assert.ok(step, `${name}: ${id} is not on the plan`)
  return p.open(step)
}

test("Medium user risk on mid: the export states the guest exclusion and no session control, and names the pin's grant pair", () => {
  const o = opened('mid', 's-goal-user-risk-medium')
  // The resolved operation is the pin's own pair with no session control (q-pin). On
  // this stand-in baseline it used to be the goal's template — a session control and
  // no strength — which is the case the export used to read.
  const resolved = o.step.action.resolution!.policies[0].body as { sessionControls?: unknown; grantControls?: { builtInControls?: string[]; authenticationStrength?: unknown } }
  assert.equal(resolved.sessionControls ?? null, null, 'the premise: the resolved operation carries no session control')
  assert.deepEqual(resolved.grantControls?.builtInControls, ['passwordChange'])
  assert.ok(resolved.grantControls?.authenticationStrength, 'the premise: the resolved operation carries the resolved strength')

  // Offered now (no unmapped group holds it, Phase 2a), the export is the create procedure itself.
  const lines = stepExportView(o.step, o.ctx, o.lane).whatToDo
  const text = lines.join('\n')
  assert.match(text, /Under Users, include All users and exclude Guest or external users/)
  assert.doesNotMatch(text, /Session|sign-in frequency|persistent browser/i, 'no session control')
  // Respond to Risk and Limit Sessions (docs/plans/risk-and-sessions-spec.md §6): the pin
  // pairs Require password change with the baseline's authentication strength, while
  // conditionalAccessGrantControls v1.0 (ms.date 2026-04-06, checked 2026-09-20) says
  // "passwordChange must be accompanied by mfa using an AND operator" — the pair the JSON
  // and PowerShell used to write, under a caveat saying so. The pinned baseline wins
  // (CLAUDE.md, owner 2026-09-20): every channel builds the pin's pair, the procedure and
  // the settings block name that one pair, and the caveat is gone.
  assert.match(text, /Under Grant, select Require authentication strength → .+ and Require password change, then Require all the selected controls\./)
  assert.doesNotMatch(text, /Require multifactor authentication|built-in `mfa`|JSON and PowerShell outputs/)
})

type Briefing = { heading: string; previewValues: string }
const BRIEFING = CONTRACT.implementation.aiFacts as unknown as Briefing
const aiOf = (o: Opened): string => {
  const a = stepBodyOf(o.step, o.ctx, { lane: o.lane }).artifacts.find((x) => x.id === 'ai')
  assert.ok(a && !a.unavailable, 'AI Info is drawn')
  return a.text()
}

test('a held step whose reference is unresolved: AI Info names what the scan could not settle', () => {
  setDisplayTimeZone('UTC')
  const f = { ...fixture('mid'), baseline: pinnedPackage() }
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  // High-Risk Users carves out the author's EAM population, which nobody has mapped
  // (Medium-Risk Users waited on a group now left out as a second break-glass group).
  const step = r.steps.find((s) => s.id === 's-goal-user-risk')
  assert.ok(step)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const lane = laneViewFor(step, { readings: laneReadings(r.steps), titleOf })
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming, reportOnlyAt: null } as StepVarContext
  assert.equal(implementationOffered(step), false, 'the premise: the step waits on a baseline mapping')
  const ai = aiOf({ step, ctx, lane })
  const facts = ai.slice(ai.indexOf(BRIEFING.heading))
  assert.match(facts, /^Not available in this scan: conditions\.users$/m)
  // "Values shown as ‹…› are not resolved yet" only beside a ‹…› value (walk list 4.x item 31).
  assert.equal(facts.includes(BRIEFING.previewValues), /‹[^›]+›/.test(facts.replace(BRIEFING.previewValues, '')), 'the unresolved-values line shows exactly where a ‹…› value does')
})

// The briefing's Intended result stated "Enable policy: On → Save — only when all
// of this is true now", then "The step cannot hand them over yet": the turn-on the
// Portal, JSON and PowerShell channels had just withheld, with a warning after it.
// On a held admin policy its checklist did not name the readiness gate holding it,
// and "no failures in the sign-in records" was vacuously true on a tenant with none
// (Priya D6). A withheld turn-on is not stated as the intended result either.
test('a step that withholds its implementation states no turn-on as its intended result; one that offers it does', () => {
  const ENABLE = String(shared.enableLine).split(' — ')[0]
  let held = 0
  for (const name of ['demo-week2', 'hostile', 'mid', 'large', 'midflight'] as FixtureName[]) {
    for (const settled of [false, true]) {
      const p = planOf(name, settled)
      for (const step of p.steps) {
        if ((step.kind !== 'create' && step.kind !== 'adjust') || implementationOffered(step)) continue
        if (!plannedOperationsOf(step).some(submitsEnforcement)) continue
        held++
        const ai = aiOf(p.open(step))
        const facts = ai.slice(ai.indexOf(BRIEFING.heading))
        assert.equal(facts.includes(ENABLE), false, `${name}${settled ? '+settled' : ''}/${step.id}: a withheld turn-on is the intended result:\n${facts}`)
      }
    }
  }
  assert.ok(held > 0, 'no fixture withholds a turn-on, so this proves nothing')

  // The control: the recovery test recorded, nothing holds the token policy's turn-on.
  setDisplayTimeZone('UTC')
  const g = withRecoveryTested(withFoundationSettled(fixture('demo-week2')))
  const r = runFixture(g, {}, null, g.snapshot.asOf)
  const step = r.steps.find((s) => s.id === 's-goal-token-protection')
  assert.ok(step)
  assert.equal(implementationOffered(step), true, 'the premise: the turn-on is offered')
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const lane = laneViewFor(step, { readings: laneReadings(r.steps), titleOf })
  const ctx = { snapshot: g.snapshot, mapping: g.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: g.operatorId, now: g.snapshot.asOf, groups: g.groups, directory: r.input.directory, naming: r.coverage.organisation.naming, reportOnlyAt: null } as StepVarContext
  const ai = aiOf({ step, ctx, lane })
  assert.ok(ai.slice(ai.indexOf(BRIEFING.heading)).includes(ENABLE), 'an offered turn-on is not stated')
})

test('every policy step whose lines are handed over: the export carries the task its screen opens on, word for word', () => {
  // One producer writes a policy step's procedures (roadmap/policyProcedure.ts),
  // and the export's What to do is the first of them still to do, as the rail
  // names it (walk list section 4 item 18).
  let compared = 0
  for (const name of ['demo', 'demo-week2', 'small', 'mid', 'large', 'midflight', 'hostile'] as FixtureName[]) {
    // With the foundation settled: a policy step waiting on it hands nothing over
    // in any channel, so there would be no pair of renderings to compare.
    const p = planOf(name, true)
    for (const step of p.steps) {
      if (!implementationOffered(step) || !implementationIsCurrent(step)) continue
      const o = p.open(step)
      const next = stepBodyOf(step, o.ctx, { lane: o.lane }).emergencyAccountTasks?.tasks.find((t) => t.required)
      if (!next) continue
      const expected = next.steps.map((line, i) => `${i + 1}. ${line.replace(/\*\*/g, '')}`)
      const lines = stepExportView(step, o.ctx, o.lane).whatToDo
      for (const line of expected) assert.ok(lines.includes(line), step.id + ': export differs from the task on screen: ' + line + '\nExport: ' + lines.join(' | '))
      compared += 1
    }
  }
  assert.ok(compared >= 10, `only ${compared} steps compared`)
})
