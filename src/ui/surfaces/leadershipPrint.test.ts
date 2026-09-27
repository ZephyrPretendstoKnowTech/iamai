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
import { BRIEF, briefOf, printSectionsOf } from './printPlan.ts'
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
  const NEED = new Set([BRIEF.needDecision, ...Object.values(BRIEF.need)].map((w) => w.split('{')[0]!))
  let decisions = 0
  let waits = 0
  for (const f of PLANS()) {
    const { brief, board } = briefFor(f)
    for (const n of brief.needs) {
      const row = board.rows.find((r) => r.item.id === n.id)!
      // Never the board's tail ("When every admin has a method it accepts (2 of 3)", "After …", "Report-only until …").
      assert.ok([...NEED].some((w) => n.why.startsWith(w)), `${f.name}/${n.id}: "${n.why}" is not the briefing's own wording`)
      if (n.why === BRIEF.needDecision) {
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
    if (n.why === BRIEF.needDecision) continue
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
      if (!step || step.goalId !== 'admins-phishing-resistant' || n.why === BRIEF.needDecision) continue
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
