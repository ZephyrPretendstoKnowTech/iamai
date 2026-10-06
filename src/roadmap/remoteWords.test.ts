// Where everyone works remotely there is no office and no trusted network, so a
// step whose words name one says them without it (owner, 2026-10-05 live check:
// a remote-only tenant read "Require a Managed Device Outside the Office" and a
// Lockdown Kit that blocks unmanaged devices "outside the trusted network").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { answerKey } from './answers.ts'
import { DIRECTION_LOCATIONS_STORAGE } from './directionAnswers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import type { Step } from './types.ts'

function answered(office: 'office' | 'remote'): Fixture {
  const f = withFoundationSettled(fixture('demo'))
  const at = f.snapshot.asOf
  const picked = office === 'office' ? [String(((f.snapshot.config.namedLocations?.rows ?? []) as { id?: string }[])[0]?.id ?? 'head-office')] : []
  const mapping = applyStepDecisions(f.mapping, { [PREREQ_STEP_ID.trustedLocation]: { picked, at, option: office === 'office' ? 'office-network' : 'remote' } })
  mapping.questionAnswers = { ...(mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: office }
  return { ...f, mapping }
}
const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}
const why = (s: Step): string => String(contentStepFor(s)?.why ?? '')

test('everyone remote: Require a Managed Device and the Lockdown Kit name no office and no trusted network', () => {
  const steps = runFixture(answered('remote')).steps
  const device = stepOf(steps, 's-goal-require-managed-device')
  assert.equal(device.plainTitle, 'Require a Managed Device')
  assert.doesNotMatch(why(device), /trusted network|office/i)
  assert.doesNotMatch(String((contentStepFor(device) as { brief?: { notice?: string } } | undefined)?.brief?.notice), /office/i, 'what people notice says no office either')
  const kit = stepOf(steps, 's-lockdown-kit')
  assert.equal(kit.plainTitle, 'Prepare the Lockdown Kit', 'a title with no office keeps its words')
  assert.doesNotMatch(why(kit), /trusted network/)
})

test('an office answered: both keep the words the content file gives them', () => {
  const steps = runFixture(answered('office')).steps
  const device = stepOf(steps, 's-goal-require-managed-device')
  assert.equal(device.plainTitle, 'Require a Managed Device Outside the Office')
  assert.match(why(device), /^Away from the trusted network/)
  assert.match(why(stepOf(steps, 's-lockdown-kit')), /outside the trusted network/)
})
