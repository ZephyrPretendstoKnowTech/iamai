// The exclusions-group step's four states on screen (stepVars, content
// s-prereq-exclusion-group). A group in use names itself and its checks; a
// tenant with two qualifying groups is asked which, and is not offered a third;
// a group nobody chose is never presumed; and only a tenant where nothing
// qualifies gets the create instructions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer, withBreakGlassCarveOut } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'
import { exclusionsGroupChoice, operatorExclusionsDecision } from '../../mapping/safetyChoice.ts'
import { stepBodyOf } from './stepBody.ts'
import type { SafetyStatus } from '../../mapping/safetyChoice.ts'
import type { ConfigurationFinding } from '../../roadmap/types.ts'

const linesOn = (name: 'demo' | 'small'): { lines: string[]; ex: Record<string, unknown>; findings: ConfigurationFinding[]; status: SafetyStatus; stored: string | null } => {
  // The demo answers the question like any other tenant, so the unanswered case
  // is the same tenant with the answer taken out.
  // The small tenant whose policies carve out its break-glass group, so the chosen group has checks to fail.
  const f = name === 'demo' ? noExclusionsAnswer(fixture(name)) : withBreakGlassCarveOut(fixture(name))
  const r = runFixture(f, { mapping: f.mapping })
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.exclusionsGroup)!
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups })
  return { lines: stepLines(step, ctx), ex: stepVars(step, ctx) as Record<string, unknown>, findings: step.configurationFindings ?? [], status: choice.status, stored: operatorExclusionsDecision(f.mapping)?.id ?? null }
}

test('the exclusions group is never presumed: with two qualifying groups and no answer the step asks which and offers to create nothing; a confirmed group names itself and its three topics', () => {
  {
    const { lines, ex, status, stored } = linesOn('demo')
    assert.equal(stored, null, 'the demo has no operator answer')
    assert.equal(status, 'ambiguous', 'the demo has a break-glass group and an exclusions group, and both qualify')
    assert.equal(ex.needsCreate, false, 'a tenant with two qualifying groups is not told to make a third')
    assert.equal(ex.exclusionsGroup, undefined, 'no group is named as the one in use')
    assert.equal(ex.total, undefined, 'no group in use: no checks ran, so no count')
    assert.ok(!lines.some((l) => /^Name it .+. .+ (?:follows the convention|do not agree on one shape)/.test(l)), 'the create instructions do not render')
    assert.ok(!lines.some((l) => /0 checks|All 0 checks|checks pass on the next scan|checks fail today/.test(l)), `no check count: ${JSON.stringify(lines.filter((l) => /checks/.test(l)))}`)
    assert.ok(!lines.some((l) => /No exclusions group recognised/.test(l)), 'not "none recognised": two were')
    assert.ok(lines.some((l) => /More than one group in .+ could be this one/.test(l)), `the step names them and asks: ${JSON.stringify(lines)}`)
    assert.ok(Array.isArray(ex.candidateGroups) && (ex.candidateGroups as string[]).length === 2)
  }
  {
    const { lines, ex, findings, status } = linesOn('small')
    assert.equal(status, 'confirmed')
    assert.ok(typeof ex.total === 'number' && ex.total > 0)
    assert.deepEqual(findings.map(f => f.label), ['Exclusions group', 'Emergency account membership', 'Policy exclusions'])
    assert.ok(lines.some((l) => l === `The one group every policy excludes. IAMAI recognised ${ex.exclusionsGroup} from the exclusions already in place.`), 'the help names the recognised group')
  }
})

// Taking a member out of the exclusions group is the one instruction on this step
// that changes who a policy reaches. It carried one clause about that — no count,
// no policy named, nothing about doing it in stages — on a tenant where following
// it puts a hundred and fourteen people inside four enforced policies at once.
test('removing extra members from the exclusions group states how many, which live policies cover them again, and to do it in stages', () => {
  const f = fixture('messy')
  const r = runFixture(f, { mapping: f.mapping })
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.exclusionsGroup)!
  const text = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'portal')!.text()
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups })
  const members = choice.actionableId ? f.groups.get(choice.actionableId)?.memberIds ?? [] : []
  const extra = members.filter((id) => !f.mapping.breakGlassUserIds.includes(id))
  assert.ok(extra.length > 1, `the premise: this group holds members outside the selection (${extra.length})`)
  assert.ok(text.includes(`Review the ${extra.length} members listed below`), text.slice(0, 1200))
  assert.match(text, /are On today: /, 'the policies that cover them again are not named')
  assert.ok(text.includes('Remove a few at a time and check their next sign-in before the next few.'))
  assert.ok(text.includes('**Members outside the saved emergency selection**'))
})

// F-002: on the demo's day one, Configure Emergency Exclusions said "Exclude
// Core - Exclusions from 4 policies" and listed four, while its row's Impact
// said 5 and "Core - Grant - MFA for all users" sat under Completed checks:
// that policy's row carried no excludeGroups array (Graph always returns one),
// and it leaves Break-glass 1 out by name, not through the group. The step
// counts and lists the same five its row does, and the name-exclusion cleanup
// no longer claims the group is already there.
test('on the demo, Configure Emergency Exclusions lists and counts the same five policies its row does', async () => {
  const { stepSnapshotsOf } = await import('../../testing/stepSnapshots.ts')
  const { rowWho } = await import('./rowWho.ts')
  const { content } = await import('../../content/content.ts')
  const snap = stepSnapshotsOf('demo')['s-prereq-exclusion-group']
  assert.equal(snap.rail, 'Add Core - Exclusions to the exclusions of 5 policies.')
  const step = runFixture(fixture('demo')).steps.find((s) => s.id === 's-prereq-exclusion-group')!
  assert.equal(rowWho(step), '5 policies', 'the row says the same number')
  const cleanup = JSON.stringify(content).match(/"why":"These policies leave an emergency account out by name[^"]*"/)?.[0] ?? ''
  assert.ok(cleanup.length > 0, 'the premise: the name-exclusion cleanup row')
  assert.doesNotMatch(cleanup, /as well as through the exclusions group/)
})

test('a policy still missing its exclusion is never listed under Completed checks by its mode (owner, 2026-10-05)', async () => {
  const { emergencySubjectTileOf } = await import('./emergencyReadiness.ts')
  const tile = {
    key: 'group-policies', label: 'Policy exclusions', tone: 'warn' as const, value: '', note: null,
    items: [
      { label: 'Mode', factLabel: 'Mode', subjectId: 'p1', subjectLabel: 'Old MFA', value: 'On', outcome: 'pass' as const },
      { label: 'Group exclusion', factLabel: 'Group exclusion', subjectId: 'p1', subjectLabel: 'Old MFA', value: 'Missing', outcome: 'fail' as const },
      { label: 'Mode', factLabel: 'Mode', subjectId: 'p2', subjectLabel: 'Done policy', value: 'On', outcome: 'pass' as const },
      { label: 'Group exclusion', factLabel: 'Group exclusion', subjectId: 'p2', subjectLabel: 'Done policy', value: 'Present', outcome: 'pass' as const },
    ],
  }
  const t = emergencySubjectTileOf(tile as never, null)
  assert.ok(!t.completed.some((c) => c.startsWith('Old MFA')), `a policy still to edit reads as completed: ${t.completed.join(' | ')}`)
  assert.ok(t.completed.includes('Done policy · Mode: On') && t.completed.includes('Done policy · Group exclusion: Present'), t.completed.join(' | '))
})
