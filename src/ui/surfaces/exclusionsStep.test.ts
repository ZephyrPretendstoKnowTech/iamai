// The exclusions-group step with no group recognised (stepVars, content
// s-prereq-exclusion-group): the create instructions, and nothing that
// presumes a group: no "0 checks" Done-when, no "recognised this one" help.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'

const linesOn = (name: 'demo' | 'small'): { lines: string[]; ex: Record<string, unknown>; recognised: boolean } => {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.exclusionsGroup)!
  return { lines: stepLines(step, ctx), ex: stepVars(step, ctx) as Record<string, unknown>, recognised: (f.mapping.records['__globalExclusion']?.resolvedId ?? null) !== null }
}

test('with no exclusions group recognised: the create instructions, no "0 checks" Done-when, no "recognised this one" help', () => {
  const { lines, ex, recognised } = linesOn('demo')
  assert.equal(recognised, false, 'the demo recognises no exclusions group')
  assert.equal(ex.needsCreate, true)
  assert.equal(ex.total, undefined, 'no checks ran: no count')
  assert.ok(lines.some((l) => /^Name it .+, which follows the convention/.test(l)), 'the create instructions render')
  assert.ok(!lines.some((l) => /0 checks|All 0 checks|checks pass on the next scan|checks fail today/.test(l)), `no check count: ${JSON.stringify(lines.filter((l) => /checks/.test(l)))}`)
  assert.ok(!lines.some((l) => /recognised (this one|.+) from the exclusions already in place/.test(l)), 'no recognised-group help')
  assert.ok(lines.some((l) => /No exclusions group recognised/.test(l)), 'the none line says so')
})

test('with a group recognised: the checks count and the help name the group', () => {
  const { lines, ex, recognised } = linesOn('small')
  assert.equal(recognised, true)
  assert.ok(typeof ex.total === 'number' && ex.total > 0)
  assert.ok(lines.some((l) => new RegExp(`All ${ex.total} checks pass on the next scan`).test(l)))
  assert.ok(lines.some((l) => l === `The one group every policy excludes. IAMAI recognised ${ex.exclusionsGroup} from the exclusions already in place.`), 'the help names the recognised group')
})
