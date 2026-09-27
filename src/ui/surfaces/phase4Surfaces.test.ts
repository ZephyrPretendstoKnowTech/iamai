// The Phase 4 audit of the surfaces (2026-09-26, the owner's tenant): MFA
// Readiness, Inventory and the Export (print, prompt pack), plus the dash-only
// rename on Align Policy Names. One test per finding.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessRow } from '../../derive/mfaReadiness.ts'
import { emptyReadinessContext, isReady, personReadiness } from '../../scoring/phishingResistant.ts'
import type { MethodClass, Platform } from '../../scoring/phishingResistant.ts'
import { FACET_APPS } from '../../coverage/facetApps.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import { stepCreatedOn } from '../../roadmap/evidenceStrategy.ts'
import { renamesOf } from '../../roadmap/cleanupPhase.ts'
import type { Step } from '../../roadmap/types.ts'
import { FINDING } from '../../copy/validation.ts'
import { monthDay } from '../../copy/dates.ts'
import { app, content, pages, stepById } from '../../content/content.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { completedChecks, deviceNoun, groupWhy, nextCell, whyLine } from './readinessCells.ts'
import { appsModel, workloadsModel } from './inventoryTables.ts'
import { copyBoxes, datesLineFor, exportAnnouncementOf, whoEvidenceLines } from './stepExport.ts'
import { createsNewPolicy } from './stepJson.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const DAY = 86_400_000
const R = pages.readiness as unknown as { next: Record<string, string>; methodsInline: Record<string, string>; panel: { why: Record<string, string> }; seamlessLapsing: string }
const text = JSON.stringify(content)
/** A deliveredBy entry's policy name: "name (state)" without its state. */
const policyName = (d: string): string => d.replace(/ \([^)]*\)$/, '')

function ctxOf(f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming, planSteps: r.steps, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
}

test('a Ready person whose Ready ends within seven days is asked to sign in again, on the row and in the details', () => {
  let seen = 0
  for (const f of allFixtures()) {
    const today = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const ready of today.rows.filter((r) => r.state !== null && isReady(r.state) && !r.guest && r.readiness?.readyUntil && r.readiness.next.kind === 'none' && !r.readiness.recommended).slice(0, 3)) {
      // Three days before this person's Ready ends.
      const view = readinessView(f.snapshot, new Date(Date.parse(ready.readiness!.readyUntil!) - 3 * DAY).toISOString(), f.mapping)
      const row = view.rows.find((r) => r.user.id === ready.user.id)!
      if (!row.lapsing || row.readiness?.next.kind !== 'none' || row.readiness.recommended) continue
      seen++
      assert.ok(view.lapsing.includes(row.user.id), `${f.name}/${row.user.id}: the lapsing list is the rows' own`)
      const rd = row.readiness
      assert.ok(rd.renewWith, `${f.name}/${row.user.id}: the sign-in that sets the day`)
      const method = R.methodsInline[rd.renewWith.cls]
      const date = monthDay(rd.readyUntil!)
      assert.equal(nextCell(row), rd.renewWith.os ? fillText(R.next.renewByOn, { method, device: deviceNoun(rd.renewWith.os), date }) : fillText(R.next.renewBy, { method, date }), `${f.name}/${row.user.id}`)
    }
    // The list and the flag are one reading.
    assert.deepEqual(today.lapsing, today.rows.filter((r) => r.lapsing).map((r) => r.user.id), f.name)
  }
  assert.ok(seen > 0, 'the premise: a Ready person three days before Ready ends')
})

test('the renewal is the sign-in on the device whose proof runs out first, not the latest one', () => {
  const NOW = '2026-09-10T10:00:00.000Z'
  const at = (d: string) => `2026-${d}T10:00:00.000Z`
  const proof = (cls: MethodClass, os: Platform, day: string) => ({ cls, os, at: at(day), method: cls === 'windowsHello' ? 'Windows Hello for Business' : 'Passkey (device-bound)' })
  const rd = personReadiness({
    methods: [{ kind: 'windowsHelloForBusiness' }, { kind: 'passkey' }] as never,
    registered: null,
    // Windows Hello on the computer on Sep 1, a passkey on the phone on Sep 5: the computer's proof ends Ready first.
    signIns: { read: true, proofs: [proof('windowsHello', 'Windows', '09-01'), proof('passkey', 'iOS', '09-05')], platforms: [{ os: 'Windows', at: at('09-01') }, { os: 'iOS', at: at('09-05') }] },
    history: null,
    context: emptyReadinessContext(NOW),
  } as never)
  assert.ok(isReady(rd.state), rd.state)
  assert.equal(rd.readyUntil, at('10-01'), 'thirty days after the computer’s proof')
  assert.equal(rd.lastConfirmed?.cls, 'passkey', 'the premise: the latest proof is the phone’s')
  assert.deepEqual(rd.renewWith, { cls: 'windowsHello', os: 'Windows' })
})

test('the renewal takes the place of "Nothing to do" only, and the Seamless header counts who has to sign in again', () => {
  const row = (over: Record<string, unknown>, lapsing = true): ReadinessRow => ({ user: { id: 'u1' }, kind: 'person', active: true, state: 'seamless', explained: null, admin: false, guest: false, methods: [], viability: null, ...(lapsing ? { lapsing } : {}), readiness: { next: { kind: 'none' }, recommended: null, readyUntil: '2026-10-01T10:00:00.000Z', lastConfirmed: { cls: 'passkey', os: 'iOS', at: '2026-09-05T10:00:00.000Z', retained: false }, renewWith: { cls: 'windowsHello', os: 'Windows' }, signInsRead: true, devices: [], credentials: [], unknown: null, ...over } }) as unknown as ReadinessRow
  assert.equal(nextCell(row({})), fillText(R.next.renewByOn, { method: R.methodsInline.windowsHello, device: deviceNoun('Windows'), date: monthDay('2026-10-01T10:00:00.000Z') }))
  assert.equal(nextCell(row({ recommended: { kind: 'replaceKey', model: 'Old key', aaguid: '00000000-0000-0000-0000-000000000001' } })), R.next.replaceKey, 'the key replacement comes first')
  assert.equal(nextCell(row({}, false)), R.next.none, 'not lapsing: nothing to do')
  assert.equal(groupWhy('seamless', [row({}), row({}, false)], 'Nothing to do'), fillText(R.seamlessLapsing, { n: 1 }))
  assert.equal(groupWhy('seamless', [row({}, false)], 'Nothing to do'), 'Nothing to do')
  assert.equal(groupWhy('ready', [row({})], 'Confirmed'), 'Confirmed')
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
  assert.match(branch, /^isTaskStep && emergencyAccountTasks && \(!printing \|\| \(isOwnTaskStep && POLICY_KINDS\.has\(step\.kind\)\)\) \? <EmergencySubjectReadiness/, 'printing a policy step takes the screen’s cards; Prepare and Ongoing print as before')
  assert.match(src, /const POLICY_KINDS: ReadonlySet<Step\['kind'\]> = new Set\(\['create', 'adjust', 'enforce'\]\)/)
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

test('the coverage line never names the policy the step itself corrects, nor a Cleanup row that may not list it', () => {
  assert.match(String(content.shared.existingCoverage), /Review Overlapping Policies \(Cleanup\)/)
  assert.doesNotMatch(String(content.shared.existingCoverage), /Consolidate/)
  // 4.3 on the demo's week two: its tasks correct the policy its goal is delivered by.
  const f = curatedFixture('demo-week2')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  const own = (step.tracking?.members ?? []).map((m) => m.policyName ?? '').filter(Boolean)
  assert.ok(step.deliveredBy.some((d) => own.some((n) => d.startsWith(`${n} (`))), `the premise: its own policy delivers the goal: ${step.deliveredBy} / ${own}`)
  assert.deepEqual(stepVars(step, ctxOf(f, r)).existingPolicies, [])
  // Only the step's own policy goes: one whose name merely begins with it stays.
  const [mine] = step.deliveredBy
  const pilot = `${policyName(mine)} (Pilot) (On)`
  assert.deepEqual(stepVars({ ...step, deliveredBy: [mine, pilot] } as Step, ctxOf(f, r)).existingPolicies, [pilot])
  // A policy beside the step's own still says so.
  let beside = 0
  for (const g of allFixtures()) {
    const rg = runFixture(g)
    for (const s of rg.steps) {
      const existing = (stepVars(s, ctxOf(g, rg)).existingPolicies ?? []) as string[]
      const mine = (s.tracking?.members ?? []).map((m) => m.policyName ?? '').filter(Boolean)
      for (const d of existing) assert.ok(!mine.includes(policyName(d)),`${g.name}/${s.id}: ${d} is its own`)
      // The line points to Review Overlapping Policies: the row is there, and lists them.
      if (existing.length > 0) {
        const overlaps = rg.schedule.cleanup?.rows.find((x) => x.kind === 'consolidation')?.lists?.overlaps ?? []
        for (const d of existing) assert.ok(overlaps.some((o) => o.includes(policyName(d))), `${g.name}/${s.id}: Review Overlapping Policies does not list ${d}: ${JSON.stringify(overlaps)}`)
      }
      beside += existing.length
    }
  }
  assert.ok(beside > 0, 'the premise: a step with coverage beside it')
})

test('no step asks for workflow tests any more', () => {
  assert.doesNotMatch(text, /workflow tests/)
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
