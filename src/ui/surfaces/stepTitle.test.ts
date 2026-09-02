// Prompt 52, walk-51 item 1: the plan row rendered the engine's plain title while
// the opened step rendered the content title, so a row and its body disagreed.
// Now the one title comes from content.json — on the row, in the body, and in the
// communications (step.plainTitle, unified in the engine). This would have caught
// the walk: the row and body titles are the same string, and it is content's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'

test('the row, the body and the communications use the one content title', () => {
  const fixtures = allFixtures().filter((f) => f.name === 'demo' || f.name === 'getiamai')
  let fromContent = 0
  for (const f of fixtures) {
    for (const step of runFixture(f).steps) {
      const rowAndBody = contentTitle(step) // the plan row and the opened step both call this
      // The engine unifies the communications title (step.plainTitle) on the same value.
      assert.equal(step.plainTitle, rowAndBody, `${f.name} ${step.id}: the communications title is the content title`)
      const cs = contentStepFor(step)
      if (cs) {
        assert.equal(rowAndBody, cs.title, `${f.name} ${step.id}: the title comes from content.json`)
        fromContent++
      }
    }
  }
  assert.ok(fromContent > 10, `most steps take their title from content.json (saw ${fromContent})`)
})
