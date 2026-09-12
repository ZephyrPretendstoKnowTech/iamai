// The Plan usability pass (owner, 2026-09-11): the toolbar is one control family;
// the opened step's prose uses its main column; the schedule starts today and
// deploys from the next eligible workday; every row reads When and Impact; the
// header is progress tiles.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { effectiveFirstDeployment, proposedFirstDeployment, proposedStart } from '../../derive/planStart.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { dateSpan } from '../../copy/dates.ts'
import { boardWhenOf } from './planBoard.ts'
import { rowWho } from './rowWho.ts'
import { reached } from '../../derive/population.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { holdWaitsOn } from '../../roadmap/stateReason.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { CONTRACT, nextCaption, railOf, readinessOf, stepContract } from './stepContract.ts'
import { cleanupWhen } from './cleanupExport.ts'
import { planDates, type StepVarContext } from './stepVars.ts'
import { implementationPackageFor, packageBindings, packageRuntime, packageStateOf, plannedPackageStateOf, planningPreview } from './stepPackage.ts'
import { projectSafely } from '../../content/implementation/project.ts'
import { pilotStepAt } from '../../testing/pilotFixture.ts'
import { statusOf } from './statusWord.ts'
import { stepById } from '../../content/content.ts'
import { currentAnswerText, parseAnswer } from '../../roadmap/answers.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { decisionsOf } from '../../roadmap/progress.ts'
import { HARDENING_DEFERRAL_ID } from '../../validation/emergencyTiers.ts'

const CSS = readFileSync('src/ui/app.css', 'utf8')

/** The declarations of the first top-level rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {`)
  assert.ok(at >= 0, `no rule ${selector}`)
  return CSS.slice(CSS.indexOf('{', at) + 1, CSS.indexOf('}', at))
}

// ------------------------------------------------------------ toolbar and width

test('the Group by segments are one control: no gap, no inline padding, no margin, the control height, equal widths', () => {
  const group = rule('.plan-controls .tabs.view-tabs')
  for (const d of ['gap: 0', 'padding: 0', 'margin: 0', 'height: var(--control)', 'grid-auto-columns: minmax(0, 1fr)', 'border-radius: var(--radius-control)']) assert.ok(group.includes(d), `the segmented group lacks ${d}`)
  const segment = rule('.plan-controls .tabs.view-tabs .tab')
  for (const d of ['justify-content: center', 'align-items: center', 'text-align: center', 'height: 100%', 'font-size: var(--t-2)']) assert.ok(segment.includes(d), `a segment lacks ${d}`)
  // The selected segment is filled, and nothing inside the group leaves a strip before the first cell.
  assert.match(rule(".plan-controls .tabs.view-tabs .tab[aria-selected='true']"), /background: var\(--brand-soft\)/)
  // Search and the focus toggles share the height and the radius.
  for (const sel of ['.plan-search input', '.plan-controls .focus']) {
    const r = rule(sel)
    assert.ok(r.includes('height: var(--control)') && r.includes('border-radius: var(--radius-control)'), `${sel} is not the same control`)
  }
  // The clipped group draws the focus indicator inside the segment, so it is never cut off.
  assert.match(rule('.plan-controls .tabs.view-tabs .tab:focus-visible'), /outline-offset: -2px/)
})

test('Why, Done when and the Implementation copy are not held to the 72ch prose cap inside the opened step', () => {
  assert.match(CSS, /\.step \.step-main p,\n\.step \.step-main ul,\n\.step \.step-main ol \{\n\s*max-width: none;/)
  // The site-wide measure still governs every other surface.
  assert.match(CSS, /\.surface p,\n\.surface ul,\n\.surface ol \{[^}]*max-width: var\(--measure\)/)
})

// ------------------------------------------------------------ scheduling

test('a first plan starts today, and its first deployment is the next eligible workday; a saved day stands', () => {
  assert.equal(proposedStart(null, new Date('2026-09-11T09:00:00Z')), '2026-09-11T12:00:00.000Z')
  // Friday → Monday; Tuesday → Wednesday; a weekend start is its Monday, and deployment the Tuesday after.
  assert.equal(proposedFirstDeployment('2026-09-11T12:00:00.000Z'), '2026-09-14T12:00:00.000Z')
  assert.equal(proposedFirstDeployment('2026-09-15T12:00:00.000Z'), '2026-09-16T12:00:00.000Z')
  assert.equal(proposedFirstDeployment('2026-09-12T12:00:00.000Z'), '2026-09-15T12:00:00.000Z')
  // A day the operator saved stands while it is not before the start; one before it is refused.
  assert.equal(effectiveFirstDeployment('2026-09-14T12:00:00.000Z', { firstDeployment: '2026-09-21T12:00:00.000Z' }), '2026-09-21T12:00:00.000Z')
  assert.equal(effectiveFirstDeployment('2026-09-14T12:00:00.000Z', { firstDeployment: '2026-09-01T12:00:00.000Z' }), '2026-09-15T12:00:00.000Z')
  // A plan started before the setting existed keeps deploying from its start.
  assert.equal(effectiveFirstDeployment('2026-09-14T12:00:00.000Z', { startedAt: '2026-09-14T08:00:00.000Z' }), '2026-09-14T12:00:00.000Z')
  // The hook never writes over a saved start, and Start anchors the first deployment with it.
  const hook = readFileSync('src/ui/surfaces/planData.ts', 'utf8')
  assert.match(hook, /const startDate = saved\?\.startDate \?\? \(snapshot \? proposedStart\(/)
  assert.match(hook, /startDate: effectiveStart, firstDeployment: effectiveFirstDeployment\(effectiveStart, p\)/)
})

test('moving the first deployment or the start moves report-only creation, the phases and every date downstream', () => {
  const f = fixture('small')
  const base = runFixture(f)
  const later = runFixture(f, { firstDeployment: '2026-09-15T12:00:00.000Z' })
  const first = (r: typeof base): string => Object.values(r.schedule.reportOnlyAt ?? {}).sort()[0]
  assert.equal(first(base).slice(0, 10), '2026-08-31', 'the fixture creates on its start without a first deployment')
  assert.equal(first(later).slice(0, 10), '2026-09-15', 'report-only creation did not follow the first deployment')
  assert.equal(later.schedule.waves[0].start, base.schedule.waves[0].start, 'preparation moved with the first deployment; it begins on the start')
  const wave1 = (r: typeof base): string => r.schedule.waves.find((w) => w.wave >= 1)!.start
  assert.ok(wave1(later) > wave1(base), 'the first enforcement phase did not move downstream')
  assert.ok(later.schedule.verification.start.slice(0, 10) >= '2026-09-15', 'the registration window opened before the first deployment')
  const moved = runFixture(f, { startDate: '2026-10-05T12:00:00.000Z' })
  assert.equal(moved.schedule.waves[0].start.slice(0, 10), '2026-10-05')
  assert.ok(wave1(moved) > wave1(base), 'a later start did not move the phases')
})

test('a phase reads its span compactly: one day, within a month, across months, across years', () => {
  assert.equal(dateSpan('2026-09-11T12:00:00.000Z', '2026-09-11T12:00:00.000Z'), 'Sep 11')
  assert.equal(dateSpan('2026-09-11T12:00:00.000Z', '2026-09-16T12:00:00.000Z'), 'Sep 11–16')
  assert.equal(dateSpan('2026-09-29T12:00:00.000Z', '2026-10-03T12:00:00.000Z'), 'Sep 29–Oct 3')
  assert.equal(dateSpan('2026-12-29T12:00:00.000Z', '2027-01-04T12:00:00.000Z'), 'Dec 29, 2026–Jan 4, 2027')
  // The numbered phases are the printed document's (S3: the Plan draws lanes, and a lane has no span).
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.equal(plan.includes('dateSpan('), false, 'the Plan dates a lane as though it were a phase')
  assert.equal(plan.includes('plan-group-date'), false, 'a lane group carries a date range')
})

// ------------------------------------------------------------ WHEN and Impact

const RUNS = (['small', 'demo', 'demo-week2', 'messy'] as const).map((name) => ({ name, r: runFixture(fixture(name)) }))

test('every row reads a When value: a date, a reason, what it waits on, Complete or Not scheduled — never blank', () => {
  let complete = 0
  let waits = 0
  let dated = 0
  for (const { name, r } of RUNS) {
    const byId = new Map(r.steps.map((s) => [s.id, s]))
    const titleOf = (id: string): string | null => {
      const s = byId.get(id)
      return s ? s.plainTitle || s.title : null
    }
    for (const s of r.steps as Step[]) {
      const wi = r.schedule.waveOf?.[s.id]
      const when = boardWhenOf(s, wi !== undefined ? (r.schedule.waves[wi]?.start ?? null) : null, titleOf)
      assert.notEqual(when.trim(), '', `${name}/${s.id}: a blank When`)
      if (s.status === 'done') {
        assert.equal(when, 'Complete', `${name}/${s.id}`)
        complete += 1
      }
      if (isHeld(s) && holdWaitsOn(s).length > 0 && !/reaches|held until/.test(when)) {
        assert.match(when, /^After /, `${name}/${s.id}: a hold that names the step it waits on reads "${when}"`)
        waits += 1
      }
      if (/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(when)) dated += 1
    }
  }
  assert.ok(complete > 0 && waits > 0 && dated > 0, `complete ${complete}, waits ${waits}, dated ${dated}`)
})

test('every row reads an Impact value: people, No user impact, Configuration only, or Not established — never blank, never zero for unknown', () => {
  const seen = new Set<string>()
  for (const { name, r } of RUNS) {
    const nameOf = (id: string): string => r.input.names!.label(id)
    for (const s of r.steps as Step[]) {
      const impact = rowWho(s, nameOf)
      assert.notEqual(impact.trim(), '', `${name}/${s.id}: a blank Impact`)
      const pop = reached(s)
      if (pop === null) {
        assert.equal(impact, 'Not established', `${name}/${s.id}`)
        seen.add('unknown')
      } else if ((pop.activeIds ?? pop.ids).length === 0) {
        assert.match(impact, effectsOf(s) === null ? /^Configuration only/ : /^No user impact/, `${name}/${s.id}`)
        seen.add(effectsOf(s) === null ? 'configuration' : 'none')
      } else {
        assert.doesNotMatch(impact, /^(No user impact|Configuration only|Not established)/, `${name}/${s.id}`)
        seen.add('known')
      }
    }
  }
  for (const k of ['unknown', 'configuration', 'known']) assert.ok(seen.has(k), `no fixture row shows the ${k} impact case`)
  assert.equal(readFileSync('src/derive/whoLine.ts', 'utf8').includes("'nobody affected'"), false, 'the awkward "nobody affected" is still a row word')
})

// ------------------------------------------------------------ header

test('the Plan header is four progress tiles and a how-to link, not a generated sentence', () => {
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.equal(plan.includes('headerLine1('), false, 'the Plan still composes the status sentence')
  assert.match(plan, /<dl className="plan-progress-tiles" aria-label=\{PP\.progress\.label\}>/)
  for (const key of ['steps', 'inPlace', 'waiting', 'remaining']) assert.match(plan, new RegExp(`key: '${key}', label: PP\\.progress\\.${key}`))
  assert.match(plan, /aria-expanded=\{showHow\} aria-controls=\{PLAN_HOW_ID\}/)
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8')) as { pages: { plan: { howTo: { items: string[] }; progress: Record<string, string> } } }
  assert.equal(content.pages.plan.howTo.items.length, 5)
  assert.deepEqual([content.pages.plan.progress.steps, content.pages.plan.progress.inPlace, content.pages.plan.progress.waiting, content.pages.plan.progress.remaining], ['Steps', 'In place', 'Waiting', 'Remaining'])
})

// ------------------------------------------------------------ the opened step

const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')

function opened(name: 'demo' | 'small', id: string, move?: Parameters<typeof pilotStepAt>[1]) {
  const f: Fixture = fixture(name)
  const r = runFixture(f)
  const found = r.steps.find((s) => s.id === id)
  assert.ok(found, `${name} carries no ${id}`)
  const step = move ? pilotStepAt(found, move) : found
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
  return { f, r, step, ctx, c: stepContract(step, ctx) }
}

test('a blocked policy with authored implementation shows its planning preview with stand-ins and no Copy; resolved, the same work is executable', () => {
  const { f, step, ctx, c } = opened('demo', 's-goal-device-registration-mfa')
  const pkg = implementationPackageFor(step)!
  const state = packageStateOf(step, c, f.snapshot)!
  assert.equal(state, 'blocked', 'the premise: nothing to execute now')
  const bindings = packageBindings(step, ctx, c)
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  const executed = projectSafely(pkg, state, bindings, runtime)
  assert.deepEqual(executed.channels, [], 'a blocked step offered something executable')
  const preview = planningPreview(pkg, step, c, f.snapshot, bindings, runtime, executed)
  assert.ok(preview?.preview, 'a blocked policy with authored implementation shows no planned work')
  assert.deepEqual(preview.channels.map((x) => x.channel), ['entra', 'powershell', 'json', 'aiInfo'])
  assert.ok(preview.hold!.missingBindings.includes('policy.target.excludeGroups'), 'the preview does not name what is unresolved')
  for (const ch of preview.channels) assert.equal(/\{\{|\{policy\.|\[omit /.test(ch.text), false, `${ch.channel}: raw binding syntax reached the preview`)
  assert.match(preview.channels.find((x) => x.channel === 'json')!.text, /‹exclusions group›/, 'an unknown value was filled silently')
  // The copy control is not offered on a preview.
  assert.match(CONTENT_STEP, /\{preview === null && \(\n\s*<button type="button" className="icon-btn" aria-label=\{W\.copy\}/)
  // Resolved: the same package, the same state's blocks, executable and no longer a preview.
  const done = opened('small', 's-goal-device-registration-mfa', 'missing')
  const mstate = packageStateOf(done.step, done.c, done.f.snapshot)!
  assert.equal(mstate, 'missing')
  const mb = packageBindings(done.step, done.ctx, done.c)
  const mrt = packageRuntime(pkg, mstate, mb, {}).runtime
  const run = projectSafely(pkg, mstate, mb, mrt)
  assert.equal(run.hold, null)
  assert.equal(run.preview, undefined)
  assert.deepEqual(run.channels.map((x) => x.blocks), preview.channels.map((x) => x.blocks), 'the executable work is not the work the preview showed')
  assert.equal(planningPreview(pkg, done.step, done.c, done.f.snapshot, mb, mrt, run), null, 'an executable step was shown as a preview')
})

test('a decision or check with nothing to implement by design draws no Implementation region; a policy step keeps one', () => {
  const { f, step, c } = opened('demo', 's-prereq-device-plan')
  assert.equal(plannedPackageStateOf(step, c, f.snapshot), null)
  assert.equal(c.policy, false, 'a decision step is read as a policy')
  assert.equal(opened('demo', 's-goal-device-registration-mfa').c.policy, true)
  assert.match(CONTENT_STEP, /const showImplementation = artifacts\.length > 0 \|\| contract\.policy/)
  assert.match(CONTENT_STEP, /\{showImplementation && \(\n\s*<Implementation/)
})

test('one blocker, one place: no caption, a concise rail, Prerequisites in Readiness, and the end state as Done when', () => {
  const { step, c } = opened('demo', 's-goal-device-registration-mfa')
  assert.equal(statusOf(step).word, 'Blocked')
  assert.equal(nextCaption(c), null, 'the head restates the hold')
  assert.deepEqual(railOf(c), { metric: 'Held', sub: 'Resolve prerequisites' })
  assert.equal(c.doneWhen.length, 1)
  assert.match(c.doneWhen[0], /^The policy is enforced in /, 'Done when restates what clears the hold')
  // One tile per prerequisite (A1 §16.1): each fix is its own tile, and a fix that names a step links to it.
  const r = readinessOf(step, c)
  assert.deepEqual(r.tiles.filter((t) => c.fix.some((f) => f.key === t.key)).map((t) => t.key), c.fix.map((f) => f.key), 'the Readiness tiles are not the fixes, one each')
  for (const t of r.tiles) if (t.key.startsWith('step:') || t.key.startsWith('missing:')) assert.ok(t.link && 'href' in t.link && t.link.href.startsWith('#/plan/'), `${t.key} does not link to its step`)
  assert.equal(r.tiles.some((t) => t.key === 'blockers'), false, 'a count tile stands in for the prerequisites')
  // Work the Plan schedules in a phase reads the phase's day on the rail, as the row's When does.
  const prep = opened('demo', 's-prereq-allowed-countries')
  const scheduled = stepContract(prep.step, { ...prep.ctx, scheduledOn: '2026-08-31T12:00:00.000Z' })
  assert.notEqual(railOf(scheduled).metric, 'Not scheduled')
})

test('Decide How Devices Are Managed: Needs decision until answered, one structure per part, US spelling, and saved answers still count', () => {
  const { step, c } = opened('demo', 's-prereq-device-plan')
  assert.equal(statusOf(step).word, 'Needs decision', 'an unanswered decision reads as ready')
  assert.deepEqual(railOf(c), { metric: 'Needs decision', sub: 'Make the decision' })
  assert.equal(c.fix.length, 0, 'the decision is listed as something to fix')
  const d = (stepById['s-prereq-device-plan'] as unknown as { decision: { text: string; options: string[]; question: { text: string; options: string[] }; strict: { heading: string; text: string; help: string } } }).decision
  assert.equal(d.text, 'How should phones be managed?')
  assert.deepEqual(d.options, ['Enroll phones in Intune', 'Protect company apps only', 'Keep company data off phones'])
  assert.equal(d.question.text, 'How should computers be managed?')
  assert.deepEqual(d.question.options, ['Enroll in Intune', 'Hybrid join is sufficient', 'Not managed'])
  assert.equal(d.strict.heading, 'Unmanaged phones')
  assert.equal(d.strict.text, "Should phones that aren't enrolled be blocked?")
  assert.doesNotMatch(d.strict.help, /Off:|On:/, 'the control explains its own implementation states')
  assert.match(CONTENT_STEP, /typeof d\.text === 'string' && <p className="reason"><T s=\{d\.text\} ex=\{ex\} \/><\/p>/)
  assert.match(CONTENT_STEP, /\{strict\.heading \?\? strict\.label\}/)
  // An answer saved in the old words still answers its option.
  assert.deepEqual(parseAnswer('Protect the apps only', d.options), { index: 1, picked: [] })
  assert.equal(currentAnswerText('Hybrid-joined is enough'), 'Hybrid join is sufficient')
})

// ------------------------------------------------------------ emergency access

const EMERGENCY = 's-prereq-break-glass'
const waitingOnEmergency = (r: ReturnType<typeof runFixture>): number => r.steps.filter((s) => s.blockers.some((b) => b.kind === 'step' && b.stepId === EMERGENCY)).length

test('a minimum safety blocker holds the rollout, and no deferral can release it', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const bg = r.steps.find((s) => s.id === EMERGENCY)!
  assert.ok((bg.emergency?.minimum ?? 0) > 0, 'the premise: demo has a minimum safety failure')
  assert.notEqual(bg.status, 'done')
  assert.ok(waitingOnEmergency(r) > 0, 'a missing way back in released the deny-capable steps')
  const c = stepContract(bg, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })
  assert.equal(c.hardening?.canDefer, false, 'deferral is offered while the minimum is not met')
  assert.ok(c.fix.length > 0, 'the minimum blocker is not under Fix before continuing')
  // Even a deferral recorded against every hardening finding releases nothing.
  const deferred = runFixture(f, { hardeningDeferral: { at: '2026-09-11T10:00:00.000Z', basis: bg.emergency!.basis } })
  assert.notEqual(deferred.steps.find((s) => s.id === EMERGENCY)!.status, 'done')
  assert.ok(waitingOnEmergency(deferred) > 0)
})

test('resilience hardening holds until fixed or deferred; a deferral releases the rollout, keeps it in Cleanup, and claims no full resilience', () => {
  const f = fixture('small')
  const r = runFixture(f)
  const bg = r.steps.find((s) => s.id === EMERGENCY)!
  assert.equal(bg.emergency?.minimum, 0, 'the premise: minimum emergency access is available')
  assert.ok((bg.emergency?.hardening ?? 0) > 0, 'the premise: hardening is outstanding')
  assert.equal(statusOf(bg).word, 'Needs attention', 'a step with failing checks reads Ready')
  assert.ok(waitingOnEmergency(r) > 0, 'undeferred hardening released the rollout without anyone acknowledging it')
  const at = '2026-09-11T10:00:00.000Z'
  const d = runFixture(f, { hardeningDeferral: { at, basis: bg.emergency!.basis } })
  const dbg = d.steps.find((s) => s.id === EMERGENCY)!
  assert.equal(dbg.status, 'done')
  assert.equal(dbg.emergency?.deferredAt, at)
  assert.equal(waitingOnEmergency(d), 0, 'the deferral did not release the rollout')
  const row = d.schedule.cleanup!.rows.find((x) => x.kind === 'hardening')
  assert.ok(row && row.lists.hardening.length === bg.emergency!.hardening, 'the deferred hardening left the plan instead of moving to Cleanup')
  assert.equal(r.schedule.cleanup!.rows.some((x) => x.kind === 'hardening'), false, 'hardening reached Cleanup without a deferral')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => d.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(dbg, ctx)
  const rd = readinessOf(dbg, c)
  const tiles = [...rd.tiles, ...rd.satisfied].map((t) => `${t.label}: ${t.value}`)
  assert.ok(tiles.includes('Emergency access: Available') && tiles.includes('Resilience: Deferred to Cleanup'), tiles.join(' | '))
  assert.equal(rd.tiles.at(-1)?.key, 'resilience', 'the hardening is not the last, secondary tile')
  assert.equal(c.doneWhen.length, 1)
  assert.doesNotMatch(c.doneWhen[0], /Already satisfied/, 'a deferral is read as full resilience')
  assert.equal(c.hardening?.deferredAt, at)
  // A new finding is not covered by an earlier deferral: the rollout waits again.
  const partial = runFixture(f, { hardeningDeferral: { at, basis: bg.emergency!.basis.split(',').slice(1).join(',') } })
  assert.notEqual(partial.steps.find((s) => s.id === EMERGENCY)!.status, 'done')
  // The deferral is an owner confirmation, carried by the one persistence path.
  const kept = decisionsOf({ planId: 'p', skips: {}, checkpoints: [], confirmations: { [EMERGENCY]: { [HARDENING_DEFERRAL_ID]: { at, basis: bg.emergency!.basis } } } }, 'p')
  assert.deepEqual(kept.confirmations?.[EMERGENCY]?.[HARDENING_DEFERRAL_ID], { at, basis: bg.emergency!.basis })
  assert.match(readFileSync('src/ui/surfaces/planData.ts', 'utf8'), /hardeningDeferral: saved\?\.confirmations\?\.\[BREAK_GLASS_STEP_ID\]\?\.\[HARDENING_DEFERRAL_ID\] \?\? null/)
  assert.match(CONTENT_STEP, /onConfirm\(\{ \[HARDENING_DEFERRAL_ID\]: \{ basis: contract\.hardening!\.basis \} \}\)/)
})

test('the opened emergency step agrees with its row: no Ready now with fixes outstanding, set-wide hardening under every account, and an undated Cleanup row says Not scheduled', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const bg = r.steps.find((s) => s.id === EMERGENCY)!
  const c = stepContract(bg, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })
  assert.ok(c.fix.length > 0, 'the premise: a fix is outstanding')
  const bar = readinessOf(bg, c).bar.main
  assert.notEqual(bar, CONTRACT.readiness.bar.deploy, 'the Readiness bar says Ready now beside Fix before continuing')
  assert.equal(bar, statusOf(bg).word, 'the bar and the badge disagree')
  // A recommendation about the set of accounts is not filed under the first account's name.
  const groups = c.hardening!.groups
  const every = groups.find((g) => g.title === CONTRACT.hardening.everyAccount)
  assert.ok(every && every.items.some((i) => /offline/.test(i)), groups.map((g) => g.title).join(' | '))
  for (const g of groups.filter((x) => x !== every)) assert.equal(g.items.some((i) => /offline/.test(i)), false, `${g.title} carries a set-wide recommendation`)
  // Cleanup while the plan cannot finish: a word, not a blank.
  const row = { ...runFixture(fixture('small'), { hardeningDeferral: { at: '2026-09-11T10:00:00.000Z', basis: runFixture(fixture('small')).steps.find((s) => s.id === EMERGENCY)!.emergency!.basis } }).schedule.cleanup!.rows[0], done: null }
  assert.equal(cleanupWhen(row, true), 'Not scheduled')
  assert.notEqual(cleanupWhen(row, false).trim(), '')
})

test('a day-0 row borrowing its phase day is not an enforcement date: the campaign window waits for one, and the walk reads it that way', () => {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  assert.equal(planDates(r.steps, r.schedule.start).enrolWindowDays, null, 'the premise: nothing enforces on a date')
  const day0 = r.schedule.waves.find((w) => w.wave === 0)!
  const DAY_ONLY = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/
  assert.ok(r.steps.some((s) => DAY_ONLY.test(boardWhenOf(s, day0.start))), 'the premise: a day-0 row reads the phase day')
  // The walk asks the email for its window only where a row outside day 0 is dated.
  // The row carries its phase as data (StepSections.tsx PlanRow `data-wave`): the
  // lanes replaced the phase groups (S3), and the phase stays a secondary projection.
  assert.match(readFileSync('scripts/walk.mjs', 'utf8'), /e\.dataset\.wave === '0'/)
  assert.match(readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8'), /data-wave=\{wave \?\? undefined\}/)
})

test('user-facing content spells enrollment the US way', () => {
  const text = readFileSync('docs/design/content.json', 'utf8')
  const values = [...text.matchAll(/"((?:[^"\\]|\\.)*)"(\s*:)?/g)].filter((m) => !m[2]).map((m) => m[1])
  assert.deepEqual(values.filter((v) => /\b(enrol|Enrol|enrols|enrolment|Enrolment)\b/.test(v)), [])
  for (const f of ['src/copy/plain.ts', 'src/copy/definitions.ts']) assert.doesNotMatch(readFileSync(f, 'utf8'), /\benrol\b|\benrols\b|\benrolment\b/)
})
