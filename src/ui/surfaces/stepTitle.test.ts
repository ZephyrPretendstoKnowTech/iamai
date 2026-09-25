// Prompt 52, walk-51 item 1: the plan row rendered the engine's plain title while
// the opened step rendered the content title, so a row and its body disagreed.
// Now the one title comes from content.json — on the row, in the body, and in the
// communications (step.plainTitle, unified in the engine). This would have caught
// the walk: the row and body titles are the same string, and it is content's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { deferredRows, phaseRows, planPhases, stepListOf } from './planRows.ts'
import { stepContract } from './stepContract.ts'
import { boardOf } from './planBoard.ts'
import type { StepVarContext } from './stepVars.ts'

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
  // Curated: the device-registration step is written from the pinned policy
  // (q-pin), which names a group of the author's this baseline has not settled,
  // and a step held on that is deferred rather than phased.
  const f = curatedFixture('small')
  const r = runFixture(f)
  const deferred = new Set(deferredRows(r.steps, boardOf(r.steps, r.schedule.cleanup, null).laneOf).map((s) => s.id))
  const cells = planPhases(r.schedule).map((w) => stepListOf(phaseRows(r.steps, w).filter((s) => !deferred.has(s.id))))
  const printed = cells.join('; ')
  // The premise: the engine's goal statement and the content title differ here.
  const admins = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.notEqual(admins.title, contentTitle(admins), 'the premise: this step has a goal statement of its own')
  assert.ok(printed.includes('Require Phishing-Resistant MFA for Admins'), `the timeline does not name the admin policy by its title: ${printed}`)
  // Require MFA to Register a Device is no longer in a phase here: created On since
  // Phase 2e, its create waits undated for everyone it covers to be ready.
  assert.equal(printed.includes('Admins use phishing-resistant auth'), false, 'the timeline prints the engine\'s goal statement')
  assert.equal(printed.includes('Registering or joining a device requires MFA'), false, 'the timeline prints the engine\'s goal statement')
  // A second tenant, read as a list of names: every step whose goal statement
  // differs from its title is named by the title and never by the statement.
  // (This compared stepListOf with the same map it is made of, which could not
  // fail.)
  const other = runFixture(fixture('getiamai'))
  const off = new Set(deferredRows(other.steps, boardOf(other.steps, other.schedule.cleanup, null).laneOf).map((s) => s.id))
  const phased = planPhases(other.schedule).flatMap((w) => phaseRows(other.steps, w).filter((s) => !off.has(s.id)))
  const names = planPhases(other.schedule).flatMap((w) => stepListOf(phaseRows(other.steps, w).filter((s) => !off.has(s.id))).split('; '))
  const renamed = phased.filter((s) => s.title !== contentTitle(s))
  assert.ok(renamed.length > 0, 'the premise: the getiamai timeline carries steps whose goal statement is not their title')
  for (const s of renamed) {
    assert.ok(names.includes(contentTitle(s)), `getiamai: the timeline does not name ${s.id} by its title`)
    assert.equal(names.includes(s.title), false, `getiamai: the timeline names ${s.id} by its goal statement "${s.title}"`)
  }
})

// The opened step's contract resolved its title itself: the content title, else
// the engine's technical title — never the plain title contentTitle falls back
// to first. A step the content file has no entry for, with a plain title of its
// own (the free-tier ladder steps carry one), was titled one way on its row and
// another in its contract. It is one resolver now.
test('the opened step\'s contract names a step by the title its row shows', () => {
  const f = fixture('small')
  const r = runFixture(f)
  const base = r.steps.find((s) => s.id === 's-prereq-security-defaults')!
  const step = { ...base, id: 's-no-content-entry', goalId: 'no-content-entry', guidance: undefined, title: 'Technical title', plainTitle: 'Plain title' }
  assert.equal(contentStepFor(step), undefined, 'the premise: the content file has no entry for this step')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } as StepVarContext
  assert.equal(stepContract(step, ctx).title, contentTitle(step))
  assert.equal(stepContract(step, ctx).title, 'Plain title')
})
