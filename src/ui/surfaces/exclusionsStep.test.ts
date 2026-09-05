// The exclusions-group step (stepVars, content s-prereq-exclusion-group), in
// its three readings: a group the operator confirmed, a tenant with groups that
// could be it and nobody having said which, and a tenant with none at all.
//
// The middle one is the Foundation C case and the one that used to be missing:
// the demo has two carve-out groups, IAMAI picks neither, and the step says so
// instead of naming one and telling the operator to make another.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'

const linesOn = (f: Fixture): { lines: string[]; ex: Record<string, unknown>; status: string } => {
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.exclusionsGroup)!
  return { lines: stepLines(step, ctx), ex: stepVars(step, ctx) as Record<string, unknown>, status: exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups }).status }
}

/** The demo with nothing that could be the exclusions group: no policy carves a group out, and no emergency account names one. */
function withNoCandidate(): Fixture {
  const f = fixture('demo')
  const snapshot = structuredClone(f.snapshot)
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { conditions?: { users?: { excludeGroups?: string[] } } }
    if (p.conditions?.users?.excludeGroups) p.conditions.users.excludeGroups = []
  }
  return { ...f, snapshot, groups: new Map(), mapping: { ...f.mapping, breakGlassUserIds: [] } }
}

test('with nothing that could be the exclusions group: the create instructions, no "0 checks" Done-when, no "recognised this one" help', () => {
  const { lines, ex, status } = linesOn(withNoCandidate())
  assert.equal(status, 'none-found')
  assert.equal(ex.needsCreate, true)
  assert.equal(ex.total, undefined, 'no checks ran: no count')
  assert.ok(lines.some((l) => /^Name it .+, which follows the convention/.test(l)), 'the create instructions render')
  assert.ok(!lines.some((l) => /0 checks|All 0 checks|checks pass on the next scan|checks fail today/.test(l)), `no check count: ${JSON.stringify(lines.filter((l) => /checks/.test(l)))}`)
  assert.ok(!lines.some((l) => /recognised (this one|.+) from the exclusions already in place/.test(l)), 'no recognised-group help')
  assert.ok(lines.some((l) => /No exclusions group recognised/.test(l)), 'the none line says so')
})

test('with groups that could be it and nobody having said which: both named, nothing recognised, no create instructions', () => {
  const { lines, ex, status } = linesOn(fixture('demo'))
  assert.equal(status, 'ambiguous', 'the demo has two groups that could be the exclusions group')
  assert.equal(ex.needsCreate, false, 'a tenant with two is not asked to make a third')
  assert.equal(ex.exclusionsGroup, undefined, 'and nothing reads as though the plan were using one')
  assert.deepEqual(ex.candidateGroups, ['Core - Break glass', 'Core - Exclusions'])
  assert.deepEqual(ex.ambiguousGroups, ['Core - Break glass', 'Core - Exclusions'])
  assert.ok(lines.some((l) => l === 'Nothing confirmed yet. Core - Break glass, Core - Exclusions could be it.'), `the who line names them instead of "none recognised": ${JSON.stringify(lines)}`)
  assert.ok(!lines.some((l) => /No exclusions group recognised/.test(l)), 'and does not read as though the tenant had none')
  assert.ok(!lines.some((l) => /^Name it .+, which follows the convention/.test(l)), 'no create instructions')
  assert.ok(!lines.some((l) => /recognised (this one|.+) from the exclusions already in place/.test(l)), 'no recognised-group help')
})

test('with a group the operator confirmed: the checks count and the help name the group', () => {
  const { lines, ex, status } = linesOn(fixture('small'))
  assert.equal(status, 'confirmed')
  assert.ok(typeof ex.total === 'number' && ex.total > 0)
  assert.ok(lines.some((l) => new RegExp(`All ${ex.total} checks pass on the next scan`).test(l)))
  assert.ok(lines.some((l) => l === `The one group every policy excludes. IAMAI recognised ${ex.exclusionsGroup} from the exclusions already in place.`), 'the help names the recognised group')
})
