// The shared-devices step (content s-shared-devices) renders its own
// instructions on a baseline with no shared-device policy: the translator has
// no policy to render, so the content's What to do steps carry the portal
// path, the proposed name, the accounts, the trusted network, the block, and
// the people policies the accounts leave.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepExportView, stepLines } from './stepExport.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'

const HOLE = /\{[a-zA-Z:]+\}/
const f = fixture('demo')
const r = runFixture(f)
const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
const step = r.steps.find((s) => s.id === 's-shared-devices')!

test('on a baseline with no shared-device policy, the step renders its instructions, whole', () => {
  assert.ok(step, 'the demo has shared devices')
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(stepPortalLines(step, portalNamesFor(ctx, ex, step.title)), null, 'the pinned baseline holds no shared-device policy')
  const view = stepExportView(step, ctx)
  assert.equal(view.whatToDo.length, 8, JSON.stringify(view.whatToDo))
  for (const l of view.whatToDo) assert.ok(!HOLE.test(l), `no hole: ${l}`)
  const shared = ex.sharedDevices as string[]
  assert.ok(shared.length > 0)
  assert.ok(view.whatToDo.some((l) => l === `Name: ${step.naming?.proposed}`), 'the proposed policy name')
  assert.ok(view.whatToDo.some((l) => l.startsWith('Users → Include: ') && shared.every((n) => l.includes(n))), 'the shared-device accounts')
  const trusted = r.steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)!.naming?.proposed
  assert.equal(f.mapping.trustedLocationIds?.length ?? 0, 0, 'the demo names no trusted location yet, so the plan proposes one')
  assert.ok(view.whatToDo.includes(`Conditions → Locations → Include: Any location; Exclude: ${trusted}`), 'the same trusted network the prerequisite step names')
  assert.ok(view.whatToDo.includes('Grant → Block access'))
  const people = ex.peoplePolicies as string[]
  assert.ok(people.length >= 2 && people.includes('Require MFA for Everyone'), JSON.stringify(people))
  assert.ok(view.whatToDo.some((l) => l.startsWith('Then exclude the same accounts from every policy that prompts a person: ') && people.every((p) => l.includes(p))))
  // The rendered lines carry the same instructions.
  const lines = stepLines(step, ctx)
  for (const l of view.whatToDo) assert.ok(lines.includes(l), `rendered: ${l}`)
})
