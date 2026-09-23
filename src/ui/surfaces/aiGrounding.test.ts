// Consolidated batch item 3 (release review R03): AI Info is a briefing a customer gives
// their own assistant, which cannot see the IAMAI screen. Every AI Info now carries IAMAI's
// facts for the step after the package's words (aiGrounding.ts). These read the drawn AI
// Info on contrasting sample tenants and in the missing, correction, blocked, observation
// and in-place states, and test facts and contradictions rather than an opening sentence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepContext } from '../../roadmap/prompts.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepBodyOf } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const F = CONTRACT.implementation.aiFacts
type Opened = { f: Fixture; run: ReturnType<typeof runFixture>; ctx: StepVarContext; step: Step; ai: string; unavailable: boolean }
const runs = new Map<string, { f: Fixture; run: ReturnType<typeof runFixture> }>()
function opened(name: 'demo' | 'demo-week2' | 'messy' | 'hostile', id: string): Opened {
  if (!runs.has(name)) {
    const f = fixture(name)
    runs.set(name, { f, run: runFixture(f, {}, null, f.snapshot.asOf) })
  }
  const { f, run } = runs.get(name)!
  const step = run.steps.find((s) => s.id === id)
  assert.ok(step, `${name}: ${id} is not on the plan`)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (i: string) => run.input.names!.label(i), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as unknown as StepVarContext
  const artifact = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')!
  return { f, run, ctx, step, ai: artifact.text(), unavailable: artifact.unavailable === true }
}
/** The facts section alone, and the package's own words before it. */
const split = (ai: string): { own: string; facts: string } => {
  const at = ai.indexOf(F.heading)
  return at < 0 ? { own: ai, facts: '' } : { own: ai.slice(0, at), facts: ai.slice(at) }
}

test('Dormant Accounts: the briefing carries every account IAMAI observed, with its last sign-in and id, on two contrasting tenants', () => {
  const seen: string[][] = []
  for (const name of ['demo', 'messy'] as const) {
    const o = opened(name, 's-check-dormant-accounts')
    assert.equal(o.unavailable, false, `${name}: AI Info is not drawn`)
    const { own, facts } = split(o.ai)
    // The package's own words lead; "successful" is the reading corrected in
    // docs/plans/ongoing-spec.md §2 (IAMAI reads lastSuccessfulSignInDateTime).
    assert.match(own, /IAMAI lists enabled accounts with no successful sign-in recorded/, `${name}: the package's own words lead`)
    assert.ok(facts.startsWith(`${F.heading}\n\n${F.boundary}`), `${name}: no facts heading and boundary`)
    const ex = stepVars(o.step, o.ctx) as Record<string, unknown>
    const words = ex.accountsWithState as string[]
    const ids = ex.accountsWithStateIds as string[]
    assert.ok(words.length > 0 && words.length === ids.length, `${name}: the premise`)
    // The receiving assistant is handed the list "IAMAI lists" refers to: each account, its last sign-in, and its id.
    words.forEach((w, n) => assert.ok(facts.includes(`- ${w} (id ${ids[n]})`), `${name}: ${w} (${ids[n]}) is not in the briefing`))
    // A check has no policy target and no tenant policy to correct.
    assert.doesNotMatch(facts, new RegExp(`^${F.target}:|^${F.current}:`, 'm'), `${name}: a check carries policy facts`)
    seen.push(words)
  }
  assert.notDeepEqual(seen[0], seen[1], 'the two tenants give the same accounts: the facts are not the tenant’s')
  // Activity is the later of the directory date and the sign-in records (7d914ba5): one demo account the directory called dormant signed in.
  assert.equal(seen[0].length, 2)
  assert.equal(seen[1].length, 14)
})

test('an enforced policy held for correction: the briefing names the tenant policy, its state, the fields that differ and the exclusion the correction removes', () => {
  const o = opened('demo', 's-goal-block-legacy-auth')
  const { own, facts } = split(o.ai)
  assert.ok(own.length > 0 && facts.length > 0)
  assert.equal(o.step.state.lifecycle, 'enforced', 'the premise: the policy is On')
  assert.match(facts, new RegExp(`^${F.current}: Core - Block - Legacy authentication \\([0-9a-f-]{36}\\)$`, 'm'))
  assert.match(facts, new RegExp(`^${F.currentState}: ${CONTRACT.lifecycle.enforced}$`, 'm'))
  assert.match(facts, new RegExp(`^${F.changedFields}: conditions\\.users\\.excludeGroups$`, 'm'))
  assert.doesNotMatch(facts, new RegExp(`^${F.removedExclusions}: Core - Break glass$`, 'm'), 'approved optional-source omission preserves existing tenant exclusions')
  assert.doesNotMatch(facts, /Map the baseline's reference under Plan settings, Baseline mappings/)
  // The package's own words are not repeated in the facts.
  assert.equal(facts.split('\n').filter((l) => l.trim().length > 20 && own.includes(l.replace(/^- /, '').trim())).length, 0)
})

test('an observation step: the briefing carries its report-only window, the evidence so far, its state and the resolved exclusions, and invents no findings', () => {
  const o = opened('demo-week2', 's-goal-intune-enrollment-reauth')
  const { facts } = split(o.ai)
  assert.match(facts, /On Hold|Up Next|Ready/, 'briefing retains the current plan state')
  assert.match(facts, /Report-only, watched since/, 'the briefing names the current observation start')
  const scanDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(o.f.snapshot.asOf))
  assert.ok(facts.includes(scanDate), 'the briefing dates its evidence from the actual scan')
  assert.match(facts, new RegExp(`^${F.currentState}: ${CONTRACT.lifecycle['report-only']}$`, 'm'))
  assert.match(facts, new RegExp(`^- ${F.excludeUsers}: ${CONTRACT.implementation.excludeUsersNone}$`, 'm'))
  assert.match(facts, new RegExp(`^- ${F.excludeGroups}: Core - Exclusions \\([0-9a-f-]{36}\\)$`, 'm'))
  // The scan found nothing to report as a finding: there is no Observed section to fill.
  assert.doesNotMatch(facts, new RegExp(`^${F.observed}:`, 'm'))
})

test('in place: AI Info explains the delivered step without offering another change', () => {
  // An object the scan found delivered in week two: the tenant's own strength matches the baseline's.
  // (The trusted network was this case; with everyone remote it does not apply since Stage 3.)
  const o = opened('demo-week2', 's-prereq-auth-strength')
  assert.equal(o.step.status, 'done', 'the premise: delivered')
  assert.equal(Boolean(o.unavailable), false)
  assert.equal(o.ai.includes(F.heading), true)
  assert.match(o.ai, /Completed|already|in place/i)
})

test('the prompt pack and the AI Info share one reading of the step, and the copied text is the drawn text', () => {
  for (const [name, id] of [['demo', 's-check-dormant-accounts'], ['demo-week2', 's-goal-intune-enrollment-reauth']] as const) {
    const o = opened(name, id)
    const context = stepContext(o.step, (s) => stepExportView(s, o.ctx))
    // Compared as the grounding compares them: a line the package already says (in its own
    // markdown) is carried once, by the package's words.
    const normal = (s: string): string => s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
    const { own, facts } = split(o.ai)
    for (const line of context.split('\n').filter((l) => l.trim() !== '')) {
      assert.ok(normal(facts).includes(normal(line)) || normal(own).includes(normal(line)), `${name}/${id}: the prompt pack's "${line.slice(0, 60)}" is not in the AI Info`)
    }
    // Copy reads the artifact's text; a second opening draws the same bytes.
    assert.equal(opened(name, id).ai, o.ai)
  }
})

// The evidence line — "This check reads the sign-in records, which IAMAI could
// not read in this tenant… Time in report-only cannot complete it until they can
// be read." — is a reason an enforcement cannot yet be earned. The briefing
// carried it on every step, a policy already enforced and in place included,
// under "Who this touches", while the screen showed it only while an observation
// was open (Priya D13).
test('the unread-records line rides only on a briefing with an enforcement still to come', () => {
  const done = opened('hostile', 's-goal-mfa-all-users')
  assert.equal(done.step.status, 'done', 'the premise: an existing policy delivers this goal')
  assert.ok(done.step.evidence.lines.length > 0, 'the premise: the step carries the unread-records line')
  for (const line of done.step.evidence.lines) assert.equal(split(done.ai).facts.includes(line), false, `a finished policy's briefing says: ${line}`)
  // An open policy on the same tenant still carries it, beside its preconditions.
  const { run } = runs.get('hostile')!
  const open = run.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && s.status !== 'skipped' && !s.state.satisfied && s.evidence.lines.length > 0)
  assert.ok(open, 'the premise: an open policy on hostile carries the line')
  const o = opened('hostile', open.id)
  assert.ok(split(o.ai).facts.includes(open.evidence.lines[0]), `${open.id}: the open policy lost the line`)
})
