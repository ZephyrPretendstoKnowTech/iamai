// Step 5: the Plan's user-facing truth. Each case is a defect found on the product
// as it stood at 7effb34 and proven on the fixtures and the app's demo:
//
//  1. a held step handed over the portal walk-through to create its policy;
//  2. the Impact column restated the state ("report-only, not enforced") or,
//     where the scope could not be settled, showed a coverage defect instead of
//     who the step reaches;
//  3. the header named steps a held row is only sequenced after as what the plan
//     waits on;
//  4. the campaign email — the work the plan says to do today — vanished while
//     nothing was dated.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { planIdFor } from '../../roadmap/generate.ts'
import type { Step } from '../../roadmap/types.ts'
import { REPORT_ONLY_GAP } from '../../coverage/verdict.ts'
import { reached } from '../../derive/population.ts'
import { planFinish } from '../../derive/finish.ts'
import { FINISH } from '../../copy/statements.ts'
import { content, engine } from '../../content/content.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { demoTenant } from '../demo.ts'
import { DEMO_TENANT_ID } from '../demoMode.ts'
import { stepContract } from './stepContract.ts'
import { commsFor, stepLines } from './stepExport.ts'
import { stepOperations } from './stepJson.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { rowWho } from './rowWho.ts'

type Plan = { label: string; f: Fixture; r: ReturnType<typeof runFixture>; ctx: (s: Step) => StepVarContext }

function planOf(label: string, f: Fixture): Plan {
  const r = runFixture(f)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, reportOnlyAt: r.schedule.reportOnlyAt[s.id] ?? null, ...dates })
  return { label, f, r, ctx }
}

const appDemo = (week2: boolean): Plan => {
  const d = demoTenant(week2)
  return planOf(week2 ? 'app demo week two' : 'app demo day one', { ...fixture(week2 ? 'demo-week2' : 'demo'), snapshot: d.snapshot, mapping: d.mapping, planId: planIdFor(DEMO_TENANT_ID) })
}
let PLANS: Plan[] | null = null
const plans = (): Plan[] => (PLANS ??= [appDemo(false), appDemo(true), planOf('getiamai (curated)', curatedFixture('getiamai')), planOf('small', fixture('small')), planOf('demo week two (curated)', curatedFixture('demo-week2'))])
const open = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped'
const CREATE_WALKTHROUGH = /Conditional Access → Policies → New policy|Enable policy: Report-only → Create/

// ---- 1. a held step's action agrees with what it hands over ----

test('Step 5: a held step still handing over its report-only create says to create it now and what turning it on waits for; one handing over nothing shows no walk-through', () => {
  let offering = 0
  let nothing = 0
  for (const p of plans()) {
    for (const s of p.r.steps.filter(open)) {
      if (!isHeld(s)) continue
      const where = `${p.label}/${s.id}`
      const ctx = p.ctx(s)
      const c = stepContract(s, ctx)
      const lines = stepLines(s, ctx)
      const ex = stepVars(s, ctx) as Record<string, unknown>
      const portal = stepPortalLines(s, portalNamesFor(ctx, ex, s.title))
      if (c.implementation.offered && s.state.lifecycle === 'not-deployed') {
        // Foundation A's safe preparation, kept (owner decision): the walk-through and the action agree.
        assert.ok(portal !== null && portal.some((l) => CREATE_WALKTHROUGH.test(l)), `${where}: the create it offers`)
        assert.notEqual(c.whatToDo.text, engine.milestone.resolve, `${where}: "Clear what this step is waiting on" above a create walk-through`)
        // Readiness gates enforcement, not creation (owner decision, 2026-09-11): where
        // the plan schedules the create, the action names that day.
        const scheduled = s.scheduled ? scheduleOf(s) : null
        if (scheduled?.class === 'scheduled') {
          assert.match(c.whatToDo.text, /^Create the policy in report-only on /, `${where}: "${c.whatToDo.text}"`)
          assert.equal(nextMilestone(s).at, scheduled.at, `${where}: the day it is created`)
        } else {
          assert.match(c.whatToDo.text, /^Create the policy in report-only now; /, `${where}: "${c.whatToDo.text}"`)
          assert.equal(nextMilestone(s).at, null, `${where}: still no date`)
        }
        offering += 1
      } else if (!c.implementation.offered) {
        assert.deepEqual(stepOperations(s), [], `${where}: operations for the JSON, PowerShell and Download tabs`)
        assert.ok(!lines.some((l) => CREATE_WALKTHROUGH.test(l)), `${where}: a create walk-through the step does not offer`)
        nothing += 1
      }
    }
  }
  assert.ok(offering > 3 && nothing > 10, `held steps checked: ${offering} offering a create, ${nothing} offering nothing`)
  // Where a readiness threshold is what waits, the line names it.
  const g = plans()[2]
  const mfa = g.r.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  const mfaDay = mfa.scheduled && scheduleOf(mfa).class === 'scheduled' ? scheduleOf(mfa).at : null
  const gate = { measure: mfa.action.readinessGate!.measure, threshold: mfa.action.readinessGate!.threshold }
  assert.equal(stepContract(mfa, g.ctx(mfa)).whatToDo.text, mfaDay ? fillText(engine.milestone.prepareScheduled, { ...gate, date: absoluteDate(mfaDay) }) : fillText(engine.milestone.prepareHeld, gate))
})

// ---- 2. Impact is who the step reaches ----

test('Step 5: the Impact column says who a step reaches, never the state, and nothing where the reach is unknown', () => {
  let unknown = 0
  for (const p of plans()) {
    const nameOf = (id: string) => p.r.input.names!.label(id)
    for (const s of p.r.steps) {
      const where = `${p.label}/${s.id}`
      const impact = rowWho(s, nameOf)
      assert.ok(!impact.includes(REPORT_ONLY_GAP), `${where}: "${impact}" restates the state`)
      if (reached(s) === null) {
        assert.equal(impact, 'Not established', `${where}: "${impact}" stands in for a reach nobody settled`)
        unknown += 1
      } else {
        assert.match(impact, /^(No user impact|Configuration only|\d+ (person|people)|[^·]+)( · .+)?$/, `${where}: "${impact}"`)
      }
    }
  }
  assert.ok(unknown > 5, `steps with an unsettled reach checked: ${unknown}`)
})

// ---- 3. the header names what the holds wait on ----

test('Step 5: the header says what holds the plan, and names no step a held row is only sequenced after', () => {
  const p = plans()[0]
  const finish = planFinish(p.r.steps, p.r.schedule.cleanup?.end ?? null)
  assert.equal(finish.held, true, 'the premise: day one holds work')
  const titleOf = (id: string) => p.r.steps.find((s) => s.id === id)?.title ?? id
  const clause = FINISH.waiting(finish.waiting) || FINISH.unwritable(finish.unwritable.count, finish.unwritable.waitsOn.map(titleOf), finish.unwritable.named)
  // Every held policy on the demo is sequenced after emergency access and some after the device
  // decision; neither is what holds them, so neither is named as what the plan waits on.
  assert.doesNotMatch(clause, /Emergency Access Accounts|Decide How Devices Are Managed/, clause)
  assert.ok(finish.unwritable.named < finish.unwritable.count, 'the premise: most holds name no step')
  assert.match(clause, /^\d+ held steps are cleared/, clause)
  // The three shapes, as the header fills them.
  assert.equal(FINISH.unwritable(3, ['Create or Correct Exclusions Group']), '3 steps wait on Create or Correct Exclusions Group')
  assert.equal(FINISH.unwritable(3, [], 0), '3 held steps are cleared')
  assert.equal(FINISH.unwritable(16, ['Create or Correct Allowed Countries Location'], 2), '16 held steps are cleared, 2 of them after Create or Correct Allowed Countries Location')
})

// ---- 4. the campaign email while nothing is dated ----

test('Step 5: while the plan dates nothing the campaign email is written without a day, and a dated plan keeps its day', () => {
  const comms = (content.steps.find((s) => s.id === 's-verify-mfa') as { comms: Record<string, string> }).comms
  const NO_DAY = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b|over the next|\d{4}/
  for (const [p, key] of [[plans()[0], 'bodyUndated'], [plans()[1], 'bodyMfaInPlaceUndated']] as [Plan, string][]) {
    const camp = p.r.steps.find((s) => s.id === 's-verify-mfa')!
    assert.equal(p.r.steps.some((s) => s.events !== null), false, `${p.label}: the premise, nothing is dated`)
    const ex = stepVars(camp, p.ctx(camp)) as Record<string, unknown>
    const email = commsFor(contentStepFor(camp) as Record<string, unknown>, ex, camp)
    assert.ok(email, `${p.label}: the campaign has an email to send today`)
    assert.equal(email!.body, fillText(comms[key], ex), `${p.label}: the undated form`)
    assert.doesNotMatch([email!.body, ...email!.extra].join(' '), NO_DAY, `${p.label}: the email names a day or a window`)
  }
  // A plan that dates the MFA enforcement keeps the email that states it.
  const g = plans()[2]
  const camp = g.r.steps.find((s) => s.id === 's-verify-mfa')!
  const dated = commsFor(contentStepFor(camp) as Record<string, unknown>, stepVars(camp, g.ctx(camp)) as Record<string, unknown>, camp)
  assert.match(dated?.body ?? '', /^From (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /)
})
