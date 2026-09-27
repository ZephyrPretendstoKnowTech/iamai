// The Phase 4 audit of the surfaces (2026-09-26, the owner's tenant): MFA
// Readiness, Inventory and the Export (print, prompt pack), plus the dash-only
// rename on Align Policy Names. One test per finding.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { isReady } from '../../scoring/phishingResistant.ts'
import { FACET_APPS } from '../../coverage/facetApps.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import { stepCreatedOn } from '../../roadmap/evidenceStrategy.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import { supersededBy, supersededPolicies } from '../../roadmap/generate.ts'
import { renamesOf } from '../../roadmap/cleanupPhase.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import type { Step } from '../../roadmap/types.ts'
import { FINDING } from '../../copy/validation.ts'
import { monthDay } from '../../copy/dates.ts'
import { app, content, pages, stepById } from '../../content/content.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { completedChecks, nextCell, whyLine } from './readinessCells.ts'
import { appsModel, workloadsModel } from './inventoryTables.ts'
import { copyBoxes, datesLineFor, exportAnnouncementOf, whoEvidenceLines } from './stepExport.ts'
import { phasesByFirstDay } from './printPlan.ts'
import { createsNewPolicy } from './stepJson.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const DAY = 86_400_000
const R = pages.readiness as unknown as { next: Record<string, string>; methodsInline: Record<string, string>; panel: { why: Record<string, string> }; setup: Record<string, unknown> }
const text = JSON.stringify(content)

function ctxOf(f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming, planSteps: r.steps, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
}

test('a Ready person whose Ready ends within seven days is asked to sign in again before it does, on the row and in the details', () => {
  let seen = 0
  for (const f of allFixtures()) {
    const today = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const ready of today.rows.filter((r) => r.state !== null && isReady(r.state) && !r.guest && r.readiness?.readyUntil && r.readiness.lastConfirmed && r.readiness.next.kind === 'none').slice(0, 3)) {
      // Three days before this person's Ready ends.
      const view = readinessView(f.snapshot, new Date(Date.parse(ready.readiness!.readyUntil!) - 3 * DAY).toISOString(), f.mapping)
      const row = view.rows.find((r) => r.user.id === ready.user.id)!
      if (!row.lapsing || row.readiness?.next.kind !== 'none') continue
      seen++
      assert.ok(view.lapsing.includes(row.user.id), `${f.name}/${row.user.id}: the lapsing list is the rows' own`)
      const rd = row.readiness
      assert.equal(nextCell(row), fillText(R.next.renewBy, { method: R.methodsInline[rd.lastConfirmed!.cls], date: monthDay(rd.readyUntil!) }), `${f.name}/${row.user.id}`)
      assert.notEqual(nextCell(row), R.next.none)
    }
    // Nobody else is lapsing: the list and the flag are one reading.
    assert.deepEqual(today.lapsing, today.rows.filter((r) => r.lapsing).map((r) => r.user.id), f.name)
  }
  assert.ok(seen > 0, 'the premise: a Ready person three days before Ready ends')
})

test('Ready’s reason names no kind of device the person was not seen on', () => {
  assert.doesNotMatch(R.panel.why.ready, /computer, phone/)
  for (const f of allFixtures()) {
    for (const r of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
      if (r.state === null || !isReady(r.state) || (r.readiness?.devices ?? []).some((d) => d.type === 'phone')) continue
      assert.doesNotMatch(whyLine(r), /\bphone\b/, `${f.name}/${r.user.id}: seen on no phone`)
    }
  }
})

test('MFA Readiness names the passkey settings by the Plan’s step, never "Emergency Access Step 3"', () => {
  const words = JSON.stringify(pages.readiness)
  assert.doesNotMatch(words, /Emergency Access Step/)
  assert.ok(words.includes(String((stepById['s-prereq-passkey-settings'] as { title: string }).title)), 'the passkey settings step, by its title')
})

test('the completed-checks count counts checks, never the notes listed with them', () => {
  assert.equal(completedChecks([{ key: 'passkeyOn', outcome: 'pass', affects: 0, reason: null }, { key: 'windowsHello', outcome: 'note', affects: 0, reason: 'targeted' }, { key: 'registration', outcome: 'pass', affects: 0, reason: null }] as never), 2)
})

test('an app with no name the scan read is an unknown app by its ID, never "an unnamed account"', () => {
  const f = fixture('mid')
  const r = runFixture(f)
  const appId = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0'
  const snapshot = { ...f.snapshot, appSignInSummary: [...(f.snapshot.appSignInSummary ?? []), { appId, signInCount: 3 }] }
  const row = appsModel(snapshot, r.input.names!).rows.find((x) => x.id === appId)
  assert.ok(row, 'the premise: the app sign-in summary is read in this fixture')
  assert.equal(row.app, fillText(app.inventory.unknownApp, { id: appId }))
  assert.doesNotMatch(row.app, /unnamed account/)
})

test('net-new 12: no app is an agent identity by its name, and Inventory has no Agent identities row', () => {
  assert.equal('agents' in FACET_APPS, false)
  const f = fixture('mid')
  const snapshot = { ...f.snapshot, appSignInSummary: [...(f.snapshot.appSignInSummary ?? []), { appId: 'a1b2c3d4-0000-4000-8000-000000000001', appDisplayName: 'Microsoft Intune Management Agent', signInCount: 9 }] }
  assert.equal('agents' in detectFacets(snapshot), false)
  assert.ok(!workloadsModel(snapshot).rows.some((row) => row.facet === 'agents'))
})

test('a printed policy step draws the task cards its screen draws, with no Scan line', () => {
  const src = readFileSync(new URL('./ContentStep.tsx', import.meta.url), 'utf8')
  const branch = src.slice(src.indexOf('isTaskStep && emergencyAccountTasks'), src.indexOf('<ReadinessSection', src.indexOf('isTaskStep && emergencyAccountTasks')))
  assert.match(branch, /^isTaskStep && emergencyAccountTasks && \(!printing \|\| isOwnTaskStep\) \? <EmergencySubjectReadiness/, 'printing a policy step takes the screen’s cards')
  assert.match(branch, /scanNote=\{!printing\}/)
  assert.match(branch, /onWhy=\{hasEvidence && !printing \?/)
})

test('net-new 15: the empty readiness says "No tasks remaining", never "No unresolved checks"', () => {
  assert.doesNotMatch(text, /No unresolved checks/)
  assert.ok(text.includes('"clear":"No tasks remaining"'), 'the empty readiness line')
})

test('a claim that cannot be finished leaves its slot empty: no line about what IAMAI could not finish', () => {
  assert.doesNotMatch(text, /could not finish this line/)
  const who = (stepById['s-prereq-auth-strength'] as { who: Record<string, unknown> }).who
  const ex = { tenant: 'Contoso Pty Ltd', strengthName: 'Modern MFA + TAP', strengths: ['Passwordless MFA'], strengthMethods: 'Passkeys (FIDO2) and Temporary Access Pass (one-time use)' }
  const read = whoEvidenceLines(who, ex)
  const unread = whoEvidenceLines(who, { ...ex, evidenceNotRead: true })
  assert.deepEqual(unread, read.filter((l) => !/None matches the baseline/.test(l)), 'the negation goes, and nothing takes its place')
})

test('the print says nothing about what IAMAI does not read (7.4, 5.5, 5.7)', () => {
  assert.doesNotMatch(text, /Nothing here is read from Intune/)
  assert.doesNotMatch(text, /risk reports are a separate surface/)
  assert.doesNotMatch(text, /risky users report is a separate surface/)
})

test('the coverage line and the overlap review are a create’s: a step correcting a policy never says it creates the baseline’s version', () => {
  assert.doesNotMatch(String(content.shared.existingCoverage), /Consolidate Overlapping Policies/)
  const f = curatedFixture('demo-week2')
  const r = runFixture(f)
  const ctx = ctxOf(f, r)
  // A create beside the tenant's own policy keeps the line.
  const create = r.steps.find((s) => s.deliveredBy.length > 0 && s.status !== 'done' && !operationsOf(s).some((o) => o.mode === 'update'))
  assert.ok(create && supersededBy(create).length > 0, 'the premise: a create beside a policy delivering its goal')
  // 4.3's case: the step edits the tenant's policy that delivers its goal.
  const corrects = r.steps.find((s) => s.status !== 'done' && (s.kind === 'create' || s.kind === 'adjust') && operationsOf(s).some((o) => o.mode === 'update'))
  assert.ok(corrects, 'the premise: a step that corrects a tenant policy')
  const correction = { ...corrects, deliveredBy: ['Core - Allow - MFA for Admins'] } as Step
  assert.deepEqual(stepVars(correction, ctx).existingPolicies, [], 'no line saying the step creates the baseline’s version')
  assert.deepEqual(supersededPolicies([correction]), [], 'the policy it corrects is not one to retire')
  for (const g of allFixtures()) {
    const rg = runFixture(g)
    const cg = ctxOf(g, rg)
    for (const step of rg.steps) {
      if (((stepVars(step, cg).existingPolicies ?? []) as string[]).length > 0) assert.ok(!operationsOf(step).some((o) => o.mode === 'update'), `${g.name}/${step.id}`)
    }
  }
})

test('no step asks for workflow tests any more', () => {
  assert.doesNotMatch(text, /workflow tests/)
})

test('the printed phases run in the order of their days: Phase 2 never starts before Phase 1', () => {
  const r = runFixture(withFoundationSettled(curatedFixture('demo-week2')))
  const dated = r.steps.filter((s) => scheduledEventOf(s) !== null).sort((a, b) => Date.parse(scheduledEventOf(a)!.start) - Date.parse(scheduledEventOf(b)!.start))
  const early = dated[0]!
  const late = dated.at(-1)!
  assert.ok(Date.parse(scheduledEventOf(early)!.start) < Date.parse(scheduledEventOf(late)!.start), 'the premise: two different days')
  const rows = new Map<number, Step[]>([[0, []], [1, [late]], [2, [early]], [3, []]])
  const waves = [{ phase: 0, wave: 0 }, { phase: 1, wave: 1 }, { phase: 2, wave: 2 }, { phase: 3, wave: 3 }]
  assert.deepEqual(phasesByFirstDay(waves, (w) => rows.get(w.wave)!).map((w) => w.wave), [0, 2, 1, 3])
})

test('a step created On with no email says the day alone on its Dates line', () => {
  let alone = 0
  for (const f of [fixture('mid'), withFoundationSettled(fixture('mid'))]) {
    for (const step of runFixture(f).steps.filter((s) => stepCreatedOn(s) && createsNewPolicy(s))) {
      const cs = contentStepFor(step) as Record<string, unknown> | undefined
      if (!cs) continue
      const line = datesLineFor(step, cs)
      if (line === null) continue
      assert.equal(line, cs.comms ? '{datesCreateOn}' : '{datesCreateOnDay}', `${f.name}/${step.id}`)
      if (!cs.comms) alone++
    }
  }
  assert.ok(alone > 0, 'the premise: a created-On step with no email')
  assert.doesNotMatch(String(content.shared.datesCreateOnDay), /Announce/)
})

test('the shared-device finding states the fact alone', () => {
  assert.doesNotMatch(FINDING.bgSharedDevice('Pixel 8', ['Somebody']), /usually|same phone/)
})

test('the prompt pack never announces a step that doesn’t apply, is skipped or set aside', () => {
  const f = fixture('getiamai')
  const r = runFixture(f)
  const ctx = ctxOf(f, r)
  const ctxFor = (s: Step): StepVarContext => ({ ...ctx, reportOnlyAt: s.reportOnlyAt ?? null })
  const withEmail = r.steps.filter((s) => copyBoxes(s, ctxFor(s)).some((b) => b.kind === 'comms'))
  assert.ok(withEmail.length >= 2, 'the premise: two steps with an email')
  const first = withEmail[0]!
  for (const out of [{ doesntApply: true }, { status: 'skipped' as const }, { state: { ...first.state, setAside: true } }]) {
    const steps = r.steps.map((s) => (s.id === first.id ? ({ ...s, ...out } as Step) : s))
    assert.notEqual(exportAnnouncementOf(steps, () => false, ctxFor)?.step, contentTitle(first), JSON.stringify(out))
  }
})

test('8.2 skips a name that differs only in its dashes', () => {
  const step = { id: 'a', status: 'active', doesntApply: false, state: { setAside: false }, action: { intended: {} }, tracking: { members: [{ key: 'p1', sourceName: '', policyId: 'p1', policyName: 'IAC - GLOBAL - SESSION - Admin Persistence (4 Hours)', plannedName: 'IAC - GLOBAL – SESSION – Admin Persistence (4 Hours)' }] } } as unknown as Step
  assert.deepEqual(renamesOf([step]), [])
})
