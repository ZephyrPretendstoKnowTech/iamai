// Content review S5 (docs/content-review/SEGMENTS.md, risk, device and campaign
// steps). The reviewed words are pinned by docs/qa/step-snapshots; what stays
// here is the safety instruction every create procedure carries, and the owner's
// decisions about what the held device step draws.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDevicesReady } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { authoredParts } from './authoredText.ts'

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
// R3: the create procedure refuses On at the line where the lifecycle is picked,
// because the guard the script hard-codes was in the one channel a portal-fluent
// administrator never opens. Every create procedure in the library carries it.
const REFUSE_ON = 'Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.'

/** One step's body on a fixture, as the Plan composes it (sessionAdminContentSpecs.test.ts), after `adjust` where one is given. */
function bodyOf(name: FixtureName, stepId: string, adjust: (f: Fixture) => Fixture = (f) => f): StepBody {
  const f = adjust(fixture(name))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const step = r.steps.find((s) => s.id === stepId)
  assert.ok(step, `the ${name} plan has ${stepId}`)
  const reading = readings.get(step.id)
  const lane = laneViewFor(step, { readings, titleOf })
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  return stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
}
/** The text one channel tab draws. */
const drawn = (b: StepBody, id: string): string => b.artifacts.find((a) => a.id === id)!.text()

test('every create procedure is created in Report-only, refuses On, and excludes the exclusions group', () => {
  for (const id of ['s-goal-sign-in-risk-medium', 's-goal-sign-in-risk', 's-goal-require-managed-device', 's-goal-intune-enrollment-reauth']) {
    const create = packageOf(id).blocks['entra.create'].text
    assert.ok(create.includes('Enable policy: Report-only.'), `${id}: the create is not Report-only`)
    assert.ok(create.includes(REFUSE_ON), `${id}: the create does not refuse On`)
    assert.match(create, /Exclude → Groups: add the exclusions group/, `${id}: the create does not exclude the exclusions group`)
  }
  // A risk condition left at No is no condition: the grant would apply to every sign-in.
  for (const id of ['s-goal-sign-in-risk-medium', 's-goal-sign-in-risk']) {
    assert.match(packageOf(id).blocks['entra.create'].text, /set \*\*Configure\*\* to \*\*Yes\*\*.+Left at \*\*No\*\* the policy carries no risk condition, and its grant applies to every sign-in\./, id)
  }
})

test('s-goal-require-managed-device: the held create draws the Intune preparation and its whole create procedure, and the same procedure once devices are ready', () => {
  const DEVICE = 's-goal-require-managed-device'
  // On the demo the step is On Hold with nothing deployed, and its create waits
  // on device readiness (owner decision D, 2026-09-23; roadmap/compliantDeviceCreate.test.ts):
  // Entra draws the Intune preparation that readiness depends on, and the create
  // stands whole beside the hold (owner, 2026-09-25: never hide implementation
  // instructions), offered only once readiness is met.
  const b = bodyOf('demo', DEVICE)
  assert.match(drawn(b, 'portal'), /Mark devices with no compliance policy assigned as: Not compliant/)
  assert.match(drawn(b, 'portal'), /New policy/)
  // Require Healthy Devices D8: the gate counts people on a compliant device, not devices.
  assert.match(String(b.readiness.tiles.find((t) => t.key === 'gate')?.value), /% of people on a compliant device$/)
  const prerequisites = b.readiness.tiles.filter((t) => t.key.includes('step:'))
  // One label, and one sentence per card: the 'Before enforcement' relabelling
  // and its composed caveat are gone (owner, 2026-09-19). The card is headed by
  // what is being waited on, and checked by its state (owner, 2026-09-20; quality audit 2.4).
  for (const t of prerequisites) assert.ok(['Prerequisite · To do', 'Prerequisite · Waiting'].includes(t.value), `${t.label}: ${t.value}`)
  for (const t of prerequisites) assert.doesNotMatch(t.note ?? '', /does not enforce access restrictions/, t.key)
  // With every person on a compliant device it draws the create procedure, the Intune prerequisite its first line.
  const ready = bodyOf('demo', DEVICE, withDevicesReady)
  const create = authoredParts(drawn(ready, 'portal')).find((p) => p.kind === 'list')
  assert.ok(create && create.kind === 'list', 'the create procedure is drawn')
  assert.match(create.items[0][0], /Mark devices with no compliance policy assigned/)
  assert.equal(create.items[2][0], 'Name: **IAC - INTUNE - GRANT - RequireCompliantDevice**.', 'the create procedure names the baseline policy by its own name')
})
