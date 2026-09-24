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
// the line is left out everywhere until something does, and the test holds
// both cases on the helper itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wholeLines } from './stepInstructions.ts'

test('a content line whose list is empty is left out, and the same line with its list is filled', () => {
  const line = 'Addresses seen in sign-in records, to compare with the approved ranges (being seen does not approve them): {list:ranges}'
  assert.deepEqual(wholeLines([line, 'Save.'], { ranges: [] }), ['Save.'])
  assert.deepEqual(wholeLines([line, 'Save.'], {}), ['Save.'])
  assert.deepEqual(wholeLines([line], { ranges: ['203.0.113.0/24', '198.51.100.7'] }), ['Addresses seen in sign-in records, to compare with the approved ranges (being seen does not approve them): 203.0.113.0/24, 198.51.100.7'])
  // Only a line: an authored object is not a line the screen can draw.
  assert.deepEqual(wholeLines([{ sub: 'x' }, 'Save.'], {}), ['Save.'])
  assert.deepEqual(wholeLines(undefined, {}), [])
})
