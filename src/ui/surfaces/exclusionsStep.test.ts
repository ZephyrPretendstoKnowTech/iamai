// The exclusions-group step's four states on screen (stepVars, content
// s-prereq-exclusion-group). A group in use names itself and its checks; a
// tenant with two qualifying groups is asked which, and is not offered a third;
// a group nobody chose is never presumed; and only a tenant where nothing
// qualifies gets the create instructions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'
import { exclusionsGroupChoice, storedExclusionsGroupId } from '../../mapping/safetyChoice.ts'
import type { SafetyStatus } from '../../mapping/safetyChoice.ts'

const linesOn = (name: 'demo' | 'small'): { lines: string[]; ex: Record<string, unknown>; status: SafetyStatus; stored: string | null } => {
  // The demo answers the question like any other tenant, so the unanswered case
  // is the same tenant with the answer taken out.
  const f = name === 'demo' ? noExclusionsAnswer(fixture(name)) : fixture(name)
  const r = runFixture(f, { mapping: f.mapping })
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.exclusionsGroup)!
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups })
  return { lines: stepLines(step, ctx), ex: stepVars(step, ctx) as Record<string, unknown>, status: choice.status, stored: storedExclusionsGroupId(f.mapping) }
}

test('two groups qualify and nobody has chosen: the step asks which, and offers to create nothing', () => {
  const { lines, ex, status, stored } = linesOn('demo')
  assert.equal(stored, null, 'the demo has no operator answer')
  assert.equal(status, 'ambiguous', 'the demo has a break-glass group and an exclusions group, and both qualify')
  assert.equal(ex.needsCreate, false, 'a tenant with two qualifying groups is not told to make a third')
  assert.equal(ex.exclusionsGroup, undefined, 'no group is named as the one in use')
  assert.equal(ex.total, undefined, 'no group in use: no checks ran, so no count')
  assert.ok(!lines.some((l) => /^Name it .+, which follows the convention/.test(l)), 'the create instructions do not render')
  assert.ok(!lines.some((l) => /0 checks|All 0 checks|checks pass on the next scan|checks fail today/.test(l)), `no check count: ${JSON.stringify(lines.filter((l) => /checks/.test(l)))}`)
  assert.ok(!lines.some((l) => /No exclusions group recognised/.test(l)), 'not "none recognised": two were')
  assert.ok(lines.some((l) => /More than one group in .+ could be this one/.test(l)), `the step names them and asks: ${JSON.stringify(lines)}`)
  assert.ok(Array.isArray(ex.candidateGroups) && (ex.candidateGroups as string[]).length === 2)
})

test('a group the operator confirmed and the scan read: the checks count and the help name it', () => {
  const { lines, ex, status } = linesOn('small')
  assert.equal(status, 'confirmed')
  assert.ok(typeof ex.total === 'number' && ex.total > 0)
  assert.ok(lines.some((l) => new RegExp(`All ${ex.total} checks pass on the next scan`).test(l)))
  assert.ok(lines.some((l) => l === `The one group every policy excludes. IAMAI recognised ${ex.exclusionsGroup} from the exclusions already in place.`), 'the help names the recognised group')
})
