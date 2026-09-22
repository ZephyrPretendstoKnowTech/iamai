// R4-39 (Priya D9), the first site: the screen and the export judged a step's
// own content lines with two different gates. The export kept a line only where
// every value it names is there (render.ts `whole`); the screen filled first and
// then dropped only a line with a brace left in it. Filling turns an empty list
// into nothing, so the trusted-network step's "Addresses seen in sign-in records,
// to compare with the approved ranges (being seen does not approve them):
// {list:ranges}" rendered on the screen, and in the task list that reads it, as
// a line ending in a colon that listed nothing, while the export left it out.
// One gate now (stepInstructions.ts wholeLines), read by both.
//
// Nothing fills `ranges` today: no scan reading produces it, on any tenant. So
// the line is left out everywhere until something does, and the first test
// holds the filled case on the helper itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { wholeLines } from './stepInstructions.ts'

const TRUSTED = 's-prereq-trusted-location'
const ADDRESSES = /Addresses seen in sign-in records/

function opened(name: FixtureName, stepId: string) {
  const f = fixture(name)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === stepId)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const body = stepBodyOf(step, ctx)
  const portal = body.artifacts.find((a) => a.id === 'portal')!
  const lines = [...portal.text().split('\n'), ...(body.emergencyAccountTasks?.tasks ?? []).flatMap((t) => t.steps)]
  return { step, lines }
}

test('a content line whose list is empty is left out, and the same line with its list is filled', () => {
  const line = 'Addresses seen in sign-in records, to compare with the approved ranges (being seen does not approve them): {list:ranges}'
  assert.deepEqual(wholeLines([line, 'Save.'], { ranges: [] }), ['Save.'])
  assert.deepEqual(wholeLines([line, 'Save.'], {}), ['Save.'])
  assert.deepEqual(wholeLines([line], { ranges: ['203.0.113.0/24', '198.51.100.7'] }), ['Addresses seen in sign-in records, to compare with the approved ranges (being seen does not approve them): 203.0.113.0/24, 198.51.100.7'])
  // Only a line: an authored object is not a line the screen can draw.
  assert.deepEqual(wholeLines([{ sub: 'x' }, 'Save.'], {}), ['Save.'])
  assert.deepEqual(wholeLines(undefined, {}), [])
})

test('the trusted-network step draws no line that introduces a list and lists nothing, on the screen or in its tasks', () => {
  for (const name of ['hostile', 'demo'] as FixtureName[]) {
    const { lines } = opened(name, TRUSTED)
    assert.ok(lines.length > 1, `${name}: the premise, the step draws its procedure`)
    for (const line of lines) {
      assert.doesNotMatch(line, /:\s*$/, `${name}: ${line}`)
      assert.doesNotMatch(line, ADDRESSES, `${name}: a line with no addresses behind it`)
    }
  }
})

