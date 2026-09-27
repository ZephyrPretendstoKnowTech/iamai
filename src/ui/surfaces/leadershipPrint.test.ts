// The printed plan as a leadership briefing (owner, 2026-09-26): the journey
// for a manager, director or business owner. Each open step says what it does
// for you, why it matters and its impact; what needs a decision or an action is
// gathered once; the procedures stay on screen. The document renders only in a
// browser, so these read the view it draws (printPlan.ts briefOf).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, curatedFixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { content, directionWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { applySkips } from '../../roadmap/progress.ts'
import { boardOf } from './planBoard.ts'
import { BRIEF, briefOf, decisionAsksOf, printSectionsOf, readinessNeed, recoveryOf } from './printPlan.ts'
import type { Brief } from './printPlan.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

type Lines = { does?: unknown; matters?: unknown; notice?: unknown }
const PROCEDURE = /Open Microsoft Entra admin center|select \*?\*?Save|Implementation Tasks|→ Conditional Access →|New policy/

function briefFor(f: Fixture, o: { skips?: string[]; over?: (steps: Step[]) => void } = {}): { brief: Brief; board: ReturnType<typeof boardOf>; steps: Step[]; ctx: (s: Step) => StepVarContext } {
  const r = runFixture(f)
  // The person's Skip this step, as the app applies it (roadmap/progress.ts applySkips).
  applySkips(r.steps, Object.fromEntries((o.skips ?? []).map((id) => [id, { reason: 'Not needed for this tenant', at: f.snapshot.asOf }])) as never)
  o.over?.(r.steps)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names?.label(id) ?? id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming, planSteps: r.steps }) as StepVarContext
  return { brief: briefOf({ board, stepCtx: ctx, cleanup: r.schedule.cleanup ?? null, undated: false }), board, steps: r.steps, ctx }
}

const PLANS = (): Fixture[] => [...allFixtures(), curatedFixture('demo'), curatedFixture('demo-week2'), withFoundationSettled(curatedFixture('demo-week2')), ...[curatedFixture('demo'), curatedFixture('demo-week2')].map(noExclusionsAnswer)]

test('every step a plan can show carries its leadership lines, and What it does for you has one source', () => {
  const steps = (content.steps as unknown as { id: string; title?: string; brief?: Lines; more?: { manager?: unknown } }[]).filter((s) => s.title)
  assert.ok(steps.length >= 40, 'the premise: the titled steps')
  for (const s of steps) {
    assert.equal(typeof s.brief?.matters, 'string', `${s.id}: Why it matters`)
    assert.equal(typeof s.brief?.notice, 'string', `${s.id}: its impact`)
    // One source per step: the manager line where the step has one, else the brief's own.
    assert.equal(typeof s.more?.manager === 'string', s.brief?.does === undefined, `${s.id}: What it does for you comes from ${typeof s.more?.manager === 'string' ? 'both the manager line and the brief' : 'nowhere'}`)
  }
  for (const [k, w] of Object.entries(directionWords.steps as unknown as Record<string, { brief?: Lines }>)) {
    for (const f of ['does', 'matters', 'notice'] as const) assert.equal(typeof w.brief?.[f], 'string', `direction ${k}: ${f}`)
  }
  for (const [k, w] of Object.entries(content.cleanup as unknown as Record<string, { brief?: Lines }>)) {
    for (const f of ['does', 'matters', 'notice'] as const) assert.equal(typeof w.brief?.[f], 'string', `cleanup ${k}: ${f}`)
  }
})

test('the manager lines speak to a manager', () => {
  const managers = (content.steps as unknown as { id: string; more?: { manager?: unknown } }[]).flatMap((s) => (typeof s.more?.manager === 'string' ? [[s.id, s.more.manager] as const] : []))
  for (const [id, line] of managers) {
    assert.doesNotMatch(line, /authentication context|hard lifetime|hard expiry|platform label|client\/device paths|app-specific policy|scoped to users/i, id)
  }
})

test('the briefing prints every open row with its three lines, and no procedure', () => {
  let rows = 0
  for (const f of PLANS()) {
    const { brief } = briefFor(f)
    for (const c of brief.chapters) {
      for (const e of c.entries) {
        rows++
        assert.ok(e.does && e.matters && e.notice, `${f.name}/${e.id}: ${JSON.stringify({ does: e.does, matters: e.matters, notice: e.notice })}`)
        assert.match(e.number ?? '', /^\d+\.\d+$/, `${f.name}/${e.id}: its number`)
        assert.ok(Object.values(BRIEF.lanes).includes(e.status), `${f.name}/${e.id}: status "${e.status}"`)
        for (const said of [e.does, e.matters, e.notice]) assert.doesNotMatch(said!, PROCEDURE, `${f.name}/${e.id}: a procedure on paper`)
        // Who it reaches is people, never things ("3 policies" names no one a manager can picture).
        if (e.reaches !== null) assert.match(e.reaches, /\b(person|people|admins?|guests?|accounts?)\b/i, `${f.name}/${e.id}: ${e.reaches}`)
        // "Reaches No guests." over an Impact line that says guests are affected (small, 5.3).
        if (e.reaches !== null) assert.doesNotMatch(e.reaches.trim(), /^(no|none|nobody|no one)\b/i, `${f.name}/${e.id}: ${e.reaches}`)
      }
    }
  }
  assert.ok(rows > 100, 'the premise: open rows across the fixtures')
})

test('what we need from you is a decision or a wait on people, in the briefing\'s words, never the plan\'s own order', () => {
  const NEED = new Set([BRIEF.needDecision, BRIEF.needAnswers, ...Object.values(BRIEF.need)].map((w) => w.split('{')[0]!))
  let decisions = 0
  let waits = 0
  for (const f of PLANS()) {
    const { brief, board } = briefFor(f)
    for (const n of brief.needs) {
      const row = board.rows.find((r) => r.item.id === n.id)!
      // Never the board's tail ("When every admin has a method it accepts (2 of 3)", "After …", "Report-only until …").
      assert.ok([...NEED].some((w) => n.why.startsWith(w)), `${f.name}/${n.id}: "${n.why}" is not the briefing's own wording`)
      if (n.why === BRIEF.needDecision || n.why === BRIEF.needAnswers) {
        decisions++
        assert.equal(row.lane.substatus, 'Decision', `${f.name}/${n.id}: a decision the board does not read as one`)
        continue
      }
      waits++
      const held = row.reading.reason?.kind === 'evidence' && row.reading.reason.id.startsWith('evidence:readiness:')
      const reviewable = row.lane.lane === 'Ready' && row.lane.substatus === 'Observing' && (row.step?.tracking?.failuresByUser ?? []).length > 0
      assert.ok(held || reviewable, `${f.name}/${n.id}: "${n.why}" is held by neither a readiness number nor a report-only result that named people`)
      assert.notEqual(row.lane.waitingFor, directionWords.waiting, `${f.name}/${n.id}: a Direction wait is the decision above it, asked once`)
    }
    assert.equal(brief.counts.needs, brief.needs.length, f.name)
  }
  assert.ok(decisions > 0 && waits > 0, `the premise: decisions (${decisions}) and waits on people (${waits})`)
})

test('a report-only result lists people only once its week is over, never a row still on its week or behind another step', () => {
  // A report-only failure recorded while the week runs (roadmap/tracking.ts) left
  // the row Up Next on its week, and the briefing listed "Report-only until Aug 29"
  // and "After Verify Emergency Access" as asks.
  const f = withFoundationSettled(curatedFixture('demo-week2'))
  const { brief, board } = briefFor(f, { over: (steps) => { for (const s of steps) if (s.tracking) s.tracking = { ...s.tracking, failuresByUser: [{ userId: 'u-1', count: 1 }] } } })
  for (const n of brief.needs) {
    const row = board.rows.find((r) => r.item.id === n.id)!
    if (n.why === BRIEF.needDecision || n.why === BRIEF.needAnswers) continue
    assert.ok(row.lane.lane === 'On Hold' || (row.lane.lane === 'Ready' && row.lane.substatus === 'Observing'), `${n.id}: listed from ${row.lane.lane} "${row.lane.waitingFor}"`)
  }
  assert.ok(board.rows.some((r) => r.lane.lane === 'Up Next' && r.step?.tracking), 'the premise: a row on its report-only week carries the injected failure')
})

test('an admin the plan waits on is named, as the owner decided: names for admins and anyone who must act', () => {
  let named = 0
  for (const f of PLANS()) {
    const { brief, board, ctx } = briefFor(f)
    for (const n of brief.needs) {
      const step = board.rows.find((r) => r.item.id === n.id)?.step
      if (!step || step.goalId !== 'admins-phishing-resistant' || n.why === BRIEF.needDecision || n.why === BRIEF.needAnswers) continue
      const ex = stepVars(step, ctx(step)) as Record<string, unknown>
      const names = (ex.adminsWithout as string[] | undefined) ?? []
      if (names.length === 0) continue
      named++
      assert.equal(n.why, fillText(BRIEF.need.adminsNamed, { names }), `${f.name}/${n.id}`)
    }
  }
  assert.ok(named > 0, 'the premise: a plan waits on admins it can name')
})

test('a step the person set aside is listed, and its chapter counts it as the board does, never Done', () => {
  // Every step of a chapter set aside printed the chapter as "Done" under a
  // purpose line saying the doors are closed, and the steps appeared nowhere.
  const f = curatedFixture('demo')
  const base = briefFor(f)
  const chapter = base.brief.chapters.find((c) => c.key === 'remaining-doors' && c.entries.length >= 2)!
  assert.ok(chapter, 'the premise: the demo has doors still to close')
  const skips = chapter.entries.map((e) => e.id)
  const { brief, board } = briefFor(f, { skips })
  const after = brief.chapters.find((c) => c.key === chapter.key)!
  assert.deepEqual(after.entries, [], 'a set-aside step still prints as work ahead')
  for (const id of skips) assert.ok(brief.aside.some((a) => a.id === id), `${id}: set aside, and on paper nowhere`)
  const section = printSectionsOf(board).find((s) => s.key === chapter.key)!
  assert.equal(after.progress, section.summary, 'the chapter counts its rows otherwise than the board')
  assert.match(after.progress, /deferred/, 'the chapter does not say its steps were set aside')
  // The cover's status counts no finish once nothing is left, and states one while work is.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /brief\.counts\.ahead > 0 && <> \{fillText\(BRIEF\.finishOn/, 'a finished plan says the rest are planned to finish')
})

test('the journey is the board\'s sections, each with its purpose, and the counts are the board\'s rows', () => {
  for (const f of PLANS()) {
    const { brief, board } = briefFor(f)
    const sections = printSectionsOf(board)
    assert.deepEqual(brief.chapters.map((c) => c.key), sections.map((s) => s.key), `${f.name}: chapters are not the board's sections`)
    for (const c of brief.chapters) if (c.key) assert.ok(c.purpose, `${f.name}/${c.key}: a chapter with no purpose line`)
    const lanes = board.rows.map((r) => r.lane.lane)
    assert.equal(brief.counts.done, lanes.filter((l) => l === 'Completed').length, `${f.name}: done`)
    assert.equal(brief.counts.ahead, lanes.filter((l) => l === 'Ready' || l === 'Up Next' || l === 'On Hold').length, `${f.name}: still to do`)
  }
})

test('the printed plan draws the briefing, never a step\'s procedure or a running line over the page', () => {
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.doesNotMatch(print, /ContentStep|CleanupBody/, 'the print draws a step body again')
  assert.match(print, /briefOf\(\{ board, stepCtx, cleanup: schedule\.cleanup \?\? null, undated: finish\.held \}\)/)
  assert.doesNotMatch(print, /print-running/, 'a running header printed over the last lines of a page')
  assert.doesNotMatch(readFileSync('src/ui/app.css', 'utf8'), /\.print-running/, 'the running header style is back')
})

test('the one procedure on paper is the emergency recovery runbook, whole, on a page of its own at the end', () => {
  // Owner, 2026-09-27: the day a change locks people out, nobody can sign in to
  // open the Planner, and the paper copy is what IT has in hand.
  const words = (content.steps as unknown as { id: string; lockedOut?: { label: string; steps: string[] } }[]).find((s) => s.id === 's-prereq-break-glass')!.lockedOut!
  let printed = 0
  for (const f of PLANS()) {
    const { steps, ctx } = briefFor(f)
    const recovery = recoveryOf(steps, ctx)
    if (!steps.some((s) => s.id === 's-prereq-break-glass')) {
      assert.equal(recovery, null, `${f.name}: a runbook with no emergency-access step`)
      continue
    }
    printed++
    assert.equal(recovery!.label, words.label, f.name)
    assert.equal(recovery!.steps.length, words.steps.length, `${f.name}: a runbook line did not print`)
    assert.ok(recovery!.steps.some((s) => s.includes(f.snapshot.tenantId)), `${f.name}: the tenant id Microsoft support asks for`)
    assert.equal(recovery!.accounts.length, f.mapping.breakGlassUserIds.length, `${f.name}: the saved emergency accounts`)
  }
  assert.ok(printed > 0, 'the premise: plans with an emergency-access step')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.ok(print.indexOf('className="brief-recovery"') > print.indexOf('className="brief-not"'), 'the runbook does not print last')
  assert.match(readFileSync('src/ui/app.css', 'utf8'), /\.brief-recovery \{ break-before: page; \}/, 'the runbook shares a page with the briefing')
})

test('a wait on a share says whose move it is: people setting up MFA, guests, or people moving to managed devices', () => {
  // "Waiting on more people to get ready for this step: 0% are ready" left a
  // manager asking ready for what, on a wait for managed devices (live, 7.4).
  const { steps } = briefFor(curatedFixture('demo'))
  const step = steps.find((s) => s.action.readinessGate != null && s.goalId !== 'admins-phishing-resistant')
  assert.ok(step, 'the premise: a step with a readiness gate')
  const at = (measure: string): string => readinessNeed({ ...step!, readiness: { ...step!.readiness, lines: [] }, action: { ...step!.action, readinessGate: { measure, threshold: '80%', value: '12%' } } }, {})
  assert.equal(at('device readiness'), fillText(BRIEF.need.devicesShare, { value: '12%', threshold: '80%' }))
  assert.equal(at('MFA readiness'), fillText(BRIEF.need.mfaShare, { value: '12%', threshold: '80%' }))
  assert.equal(at('guest MFA readiness'), fillText(BRIEF.need.guestsShare, { value: '12%', threshold: '80%' }))
  assert.equal(at('something else'), fillText(BRIEF.need.peopleShare, { value: '12%', threshold: '80%' }))
})

// F-184: a briefing printed weeks after its scan read as current: the cover
// named the day it was prepared and never the scan, and dropped the screen's
// "Scan again before acting" warning. The cover names the scan, and past a
// week prints the screen's own warning.
test('the briefing says which scan it was made from, and warns when that scan is over a week old', async () => {
  const { app } = await import('../../content/content.ts')
  const { STALE_SCAN_DAYS, scanAgeDays } = await import('../../copy/dates.ts')
  assert.equal(fillText(BRIEF.meta, { date: 'Nov 6, 2026', by: 'Alex', scanned: 'Sep 27, 2026', baseline: 'Defense in Depth' }), 'Prepared Nov 6, 2026 by Alex · Scanned Sep 27, 2026 · Measured against Defense in Depth')
  const page = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(page, /fillText\(BRIEF\.meta, \{ date: today, by: operator, scanned: absoluteDate\(scanAt\), baseline: baselineLabel \}\)/)
  assert.match(page, /\{scanAgeDays\(scanAt\) >= STALE_SCAN_DAYS && <p className="brief-stale">\{app\.shell\.staleEvidence\}<\/p>\}/)
  assert.equal(app.shell.staleEvidence, 'This scan is more than a week old. Scan again before acting on its findings.')
  const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()
  assert.equal(scanAgeDays(daysAgo(8)) >= STALE_SCAN_DAYS, true, 'eight days: warned')
  assert.equal(scanAgeDays(daysAgo(6)) >= STALE_SCAN_DAYS, false, 'six days: not')
})

// F-013: the Defer dialog requires a reason, and it was never shown again: the
// deferred step's Next milestone kept the create it was deferred from, the
// Completed tile's total dropped with no word, and the briefing's Set aside
// list named the title alone. The step, the tile and the briefing now say it.
test('a deferral says why: on the step\'s Next milestone, under the Completed tile and in the briefing', async () => {
  const { stepBodyOf } = await import('./stepBody.ts')
  const { deferralOf } = await import('./deferral.ts')
  const { app, structuralWords } = await import('../../content/content.ts')
  const { absoluteDate } = await import('../../copy/dates.ts')
  const f = curatedFixture('demo')
  const id = 's-goal-block-auth-transfer'
  const { brief, steps, board, ctx } = briefFor(f, { skips: [id] })
  const step = steps.find((s) => s.id === id)!
  const deferral = deferralOf(step)
  assert.deepEqual(deferral, { at: f.snapshot.asOf, reason: 'Not needed for this tenant' })
  const expected = fillText(app.plan.deferredWhy, { date: absoluteDate(f.snapshot.asOf), reason: 'Not needed for this tenant' })
  assert.equal(stepBodyOf(step, ctx(step), { lane: board.laneOf(id) }).rail.headline, expected)
  const line = brief.aside.find((a) => a.id === id)
  assert.equal(line?.reason, 'Not needed for this tenant')
  assert.equal(fillText(BRIEF.asideWhy, { title: line!.title, reason: line!.reason! }), `${line!.title}: Not needed for this tenant`)
  assert.match(readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8'), /\{a\.reason \? fillTextVerbatim\(BRIEF\.asideWhy, \{ title: a\.title \}, \{ reason: a\.reason \}\) : a\.title\}/)
  // The person's words come through as they typed them (review, 2026-09-27): the count
  // bending that fills the sentence read "Ring 1 users are" as "Ring 1 user is".
  step.skipReason = 'Ring 1 users are not licensed yet'
  assert.equal(stepBodyOf(step, ctx(step), { lane: board.laneOf(id) }).rail.headline, `Deferred ${absoluteDate(f.snapshot.asOf)}: Ring 1 users are not licensed yet`)
  // The Completed tile's line says how many are deferred.
  const S = (structuralWords as unknown as { summary: { deferred: string } }).summary
  assert.equal(fillText(S.deferred, { n: 1 }), '1 deferred')
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /\.\.\.\(deferredCount > 0 \? \{ sub: \[fillText\(summary\.deferred, \{ n: deferredCount \}\)\] \} : \{\}\)/)
  // A step that is not deferred reads no deferral.
  assert.equal(deferralOf(steps.find((s) => s.id !== id && s.status !== 'skipped')!), null)
})

// OWN-P1: "2.1 Confirm What You Use: A decision is needed.", three times over,
// told a manager nothing they could act on. A decision names what it asks, in
// the step's own question words; one with no questions of its own keeps the line.
test('a decision under What we need from you lists the questions it still waits on, in the step\'s own words', () => {
  const f = curatedFixture('demo')
  const { brief } = briefFor(f)
  const use = brief.needs.find((n) => n.id === 's-direction-use')!
  assert.equal(use.why, 'Answers needed on:')
  assert.deepEqual(use.asks, ['Azure Virtual Desktop', 'Limit SharePoint and OneDrive to the office network', 'Inforcer', 'Devices or apps that send email by signing in (printers, scanners, line-of-business apps)', 'Partner or MSP technicians who sign in to your tenant'])
  assert.deepEqual(brief.needs.find((n) => n.id === 's-direction-devices')!.asks, ['Company computers', 'Phones', 'Office network'])
  assert.equal(decisionAsksOf({ directionQuestions: undefined }).length, 0, 'a decision with no questions of its own asks nothing')
  assert.match(readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8'), /<span className="brief-why">\{n\.why\}<\/span>\n\s+\{n\.asks && \(\n\s+<ul className="brief-asks">/)
})
