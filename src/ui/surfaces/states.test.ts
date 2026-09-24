// Schedule and states on the Plan (prompt 48 Part 4). Every step across the
// fixtures carries one of the nine status words; a re-scan that tracked a
// policy moves the row's state (the midflight tenant has tagged, enforced and
// report-only policies); the print export and the ICS read the same finish
// and rows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { statusOf } from './statusWord.ts'
import { stepContract } from './stepContract.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import type { StepVarContext } from './stepVars.ts'
import { planFinish } from '../../derive/finish.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { stepExportView } from './stepExport.ts'

// 'Needs decision' is the ninth: the `needs-decision` condition projects to the
// `blocked` status and reads as its own word (statusWord.ts), because a step
// waiting on the operator's own answer is not a step held by work elsewhere.
// 'Needs attention' is the tenth (owner, 2026-09-11): a ready step whose own
// checks fail is work on this row, and Ready beside failing checks contradicted it.
// 'Needs correction' and 'Minimum in place' are the eleventh and twelfth
// (correction batch 1, planState.ts): an enforced policy the plan must change and
// cannot yet, and emergency access whose hardening an owner deferred to Cleanup.
const WORDS = new Set(['In place', 'Ready', 'Blocked', 'Needs decision', 'Needs attention', 'Needs correction', 'Minimum in place', 'Scheduled', 'Report-only', 'Ready to enforce', 'Enforced', 'Skipped'])

test('every step on every fixture carries exactly one of the status words', () => {
  for (const f of allFixtures()) {
    // A held report-only policy reads its stage and its condition (correction batch 1.1): "Report-only · Blocked".
    for (const s of runFixture(f).steps) assert.ok(WORDS.has(statusOf(s).word) || /^Report-only · \S/.test(statusOf(s).word), `${f.name} ${s.id} → ${statusOf(s).word}`)
  }
  // A re-scan that tracked policies moves rows to Report-only and Enforced (midflight).
  const r = runFixture(fixture('midflight'))
  const words = new Set(r.steps.map((s) => statusOf(s).word))
  assert.ok(words.has('Enforced'), 'a tracked enforced policy reads Enforced')
  assert.ok([...words].some((w) => w.split(' · ')[0] === 'Report-only'), 'a tracked report-only policy reads Report-only')
  // Tracking comes from evidence, not from a manual status.
  assert.ok(r.steps.some((s) => s.tracking !== null), 'at least one step is tracked')
})

test('the print finish and the ICS read the same rings the plan does', () => {
  const r = runFixture(fixture('small'))
  const finish = planFinish(r.steps)
  // planFinish never dates a step past the schedule target.
  if (finish.finish) assert.ok(finish.finish <= r.schedule.targetEnd)
  // The ICS emits an entry per step the plan dates, from its one scheduling result
  // (roadmap/stepSchedule.ts scheduledEventOf) — the same day the row and the rail read.
  const ics = buildIcs(r.steps, 'Tenant', r.input.planId, (s) => stepExportView(s, { snapshot: r.input.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names?.label(id) ?? id, signature: 'IT', operatorId: null, now: r.input.snapshot.asOf }))
  const scheduled = r.steps.filter((s) => scheduledEventOf(s) !== null)
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, scheduled.length, 'one calendar entry per scheduled step')
  for (const s of scheduled) assert.ok(ics.includes(`DTSTART;VALUE=DATE:${scheduledEventOf(s)!.start.slice(0, 10).replace(/-/g, '')}`), `${s.id}: booked on another day`)
})

test('a step whose policy exists and is switched off says so, instead of asking for a scan that changes nothing', () => {
  // "This step has no policy for IAMAI to write in this plan. Scan <tenant>
  // again to rebuild it." — said over a step whose policy EXISTS in the tenant
  // and is disabled. The step tracks that row: `state.members` carries it with
  // `latest.state === 'disabled'`, on this scan and the one before. So the
  // sentence was false and its remedy did nothing. A reader scanned three
  // times, got byte-identical output, and stopped — which is where a beta
  // tester uninstalls.
  const f = fixture('midflight')
  const run = runFixture(f)
  const ctx: StepVarContext = {
    snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups,
  }
  // A real step that already resolves to no-operation, so only the members move.
  const base = run.steps.find((s) => unavailableReason(s) === 'no-operation' && (s.state.members ?? []).length > 0)
  assert.ok(base, 'midflight no longer carries a step with no operation to offer')
  const because = (x: typeof base): string => { const impl = stepContract(x, ctx).implementation; return impl.offered ? '' : (impl.because ?? '') }
  // The control: whatever else it says, it says IAMAI is writing nothing here
  // and does not claim the policy is switched off. There are two wordings for
  // that now — the plain one, and the one for a goal the tenant's own policy
  // already delivers, which names it ("{policy} found. IAMAI writes no policy
  // here.") — and the shape this test pins is the same under both.
  const control = because(base)
  assert.match(control, /no policy for IAMAI to write|IAMAI writes no policy here/, 'the unchanged case stopped saying it writes nothing')
  assert.doesNotMatch(control, /switched off/, 'the unchanged case claims the policy is off')

  // The same step, with every policy it tracks switched off.
  const off = structuredClone(base)
  for (const m of off.state.members ?? []) if (m.change?.latest) m.change.latest.state = 'disabled'
  assert.equal(unavailableReason(off), 'no-operation', 'the premise: still nothing to submit')
  const line = because(off)
  assert.match(line, /already exists in .* and is switched off/, line)
  assert.equal(line.includes('rebuild it'), false, 'still asks for a scan that cannot change the answer')
  // The report-only discipline survives: it does not simply say "turn it on".
  assert.match(line, /Report-only/, 'the way out skips the observation the rest of the plan insists on')
})

test('the step that owns the security-defaults rule reports it broken, and says nothing where it is not', () => {
  // The plan states the invariant in its own voice: "security defaults must be
  // off before the policies replacing them can take over, and once these
  // policies exist you cannot turn security defaults back on... That is why
  // nothing in this plan enforces before this step."
  //
  // A reader then enforced eight policies with security defaults still on,
  // swept all thirty-three steps, and found no warning anywhere. The board read
  // Completed and the tile said "IAMAI watched it get there." It watched. It
  // did not say anything.
  const withDefaultsOn = () => {
    const f = structuredClone(fixture('large')) as ReturnType<typeof fixture>
    f.snapshot.config.securityDefaults = { status: 'ok', rows: [{ isEnabled: true }] } as never
    return f
  }
  const foundOn = (f: ReturnType<typeof fixture>): string[] => {
    const run = runFixture(f)
    const step = run.steps.find((s) => s.id === 's-prereq-security-defaults')
    assert.ok(step, 'the security-defaults step left the plan')
    const ctx: StepVarContext = {
      snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id),
      signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups,
    }
    return stepContract(step, ctx).found.map((x) => x.text)
  }

  const broken = foundOn(withDefaultsOn())
  const warning = broken.find((t) => /which Microsoft does not support/.test(t))
  assert.ok(warning, `nothing on the step reports the coexistence: ${JSON.stringify(broken)}`)
  assert.match(warning, /[0-9]+ Conditional Access policies are enforced/, 'the warning does not count what is already enforced')
  // It said "and this is the step that turns them off", which reads as the way
  // out. On the tenant where it fired the plan's own MFA policy was still held
  // below its threshold, and turning security defaults off then removes the MFA
  // they require from everybody (Sam D2). It says not to, and when this step does.
  assert.doesNotMatch(warning, /this is the step that turns them off/, 'the warning points at turning security defaults off')
  assert.match(warning, /Do not turn security defaults off to settle it/, warning)
  assert.match(warning, /same change window/, 'the warning does not say when this step turns them off')

  // Silent where the rule is not broken — every shipped fixture has security
  // defaults off, and a warning on all of them would be noise, not a warning.
  assert.equal(foundOn(fixture('large')).some((t) => /which Microsoft does not support/.test(t)), false, 'a tenant with defaults already off is warned anyway')
})
