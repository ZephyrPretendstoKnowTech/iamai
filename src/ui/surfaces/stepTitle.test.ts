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
import { readFileSync } from 'node:fs'
import { deferredRows, phaseRows, planPhases, stepListOf } from './planRows.ts'

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

// R4-40 / R4-47: the printed plan's timeline listed each phase's steps by
// `Step.title` — the engine's goal statement — while the same document's step
// sections, the board and the opened step all name them by the content title.
// A change board read "Admins use phishing-resistant auth" in the table and
// "Require Phishing-Resistant MFA for Admins" two pages on, one step under two
// names. The cell is `stepListOf` (planRows.ts), and it reads the one title.
test('the printed timeline names each phase step by the title the board and the opened step show', () => {
  const f = allFixtures().find((x) => x.name === 'small')!
  const r = runFixture(f)
  const deferred = new Set(deferredRows(r.steps).map((s) => s.id))
  const cells = planPhases(r.schedule).map((w) => stepListOf(phaseRows(r.steps, w).filter((s) => !deferred.has(s.id))))
  const printed = cells.join('; ')
  // The premise: the engine's goal statement and the content title differ here.
  const admins = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.notEqual(admins.title, contentTitle(admins), 'the premise: this step has a goal statement of its own')
  assert.ok(printed.includes('Require Phishing-Resistant MFA for Admins'), `the timeline does not name the admin policy by its title: ${printed}`)
  assert.ok(printed.includes('Require MFA to Register a Device'), 'the timeline does not name the device-registration policy by its title')
  assert.equal(printed.includes('Admins use phishing-resistant auth'), false, 'the timeline prints the engine\'s goal statement')
  assert.equal(printed.includes('Registering or joining a device requires MFA'), false, 'the timeline prints the engine\'s goal statement')
  // Every fixture: each name in each cell is a content title.
  for (const fx of allFixtures()) {
    const run = runFixture(fx)
    const off = new Set(deferredRows(run.steps).map((s) => s.id))
    for (const w of planPhases(run.schedule)) {
      const rows = phaseRows(run.steps, w).filter((s) => !off.has(s.id))
      assert.equal(stepListOf(rows), rows.map((s) => contentTitle(s)).join('; '), `${fx.name} phase ${w.wave}`)
    }
  }
})

test('the printed plan names a step only through the content title', () => {
  // Every other name the document prints — the cover's lists, the constraint,
  // the Completed and Deferred lists, the lane tails — went through
  // `plainTitle || title` or `.title`: a second resolver beside contentTitle,
  // which is the fact with two sources the timeline showed can drift.
  const src = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.ok(src.includes('stepListOf(phaseSteps(w))'), 'the timeline cell does not read stepListOf')
  for (const own of ['.plainTitle', 's.title', '?.title', 'goal.shortName ||']) {
    const at = src.indexOf(own)
    const inContentTitle = at >= 0 && src.slice(Math.max(0, at - 80), at).includes('contentTitle(')
    assert.ok(at < 0 || inContentTitle, `PrintPlan.tsx names a step through ${own}, not contentTitle`)
  }
})
