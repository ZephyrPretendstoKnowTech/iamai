// The printed plan as a leadership briefing (owner, 2026-09-26): the journey
// for a manager, director or business owner. Each open step says what it does
// for you, why it matters and its impact; what needs a decision or an action is
// gathered once; the procedures stay on screen. The document renders only in a
// browser, so these read the view it draws (printPlan.ts briefOf).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { content, directionWords } from '../../content/content.ts'
import { boardOf } from './planBoard.ts'
import { BRIEF, briefOf, printSectionsOf } from './printPlan.ts'
import type { Brief } from './printPlan.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

type Lines = { does?: unknown; matters?: unknown; notice?: unknown }
const PROCEDURE = /Open Microsoft Entra admin center|select \*?\*?Save|Implementation Tasks|→ Conditional Access →|New policy/

function briefFor(f: Fixture): { brief: Brief; board: ReturnType<typeof boardOf>; steps: Step[] } {
  const r = runFixture(f)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names?.label(id) ?? id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming, planSteps: r.steps }) as StepVarContext
  return { brief: briefOf({ board, stepCtx: ctx, cleanup: r.schedule.cleanup ?? null, undated: false }), board, steps: r.steps }
}

const PLANS = (): Fixture[] => [...allFixtures(), curatedFixture('demo'), curatedFixture('demo-week2'), withFoundationSettled(curatedFixture('demo-week2'))]

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
      }
    }
  }
  assert.ok(rows > 100, 'the premise: open rows across the fixtures')
})

test('what we need from you is a decision or a wait on people, never the plan\'s own order', () => {
  let decisions = 0
  let waits = 0
  for (const f of PLANS()) {
    const { brief, board } = briefFor(f)
    for (const n of brief.needs) {
      const row = board.rows.find((r) => r.item.id === n.id)!
      if (n.why === BRIEF.needDecision) {
        decisions++
        assert.equal(row.lane.substatus, 'Decision', `${f.name}/${n.id}: a decision the board does not read as one`)
        continue
      }
      waits++
      assert.ok(row.step?.action.readinessGate != null || (row.step?.tracking?.failuresByUser ?? []).length > 0, `${f.name}/${n.id}: "${n.why}" waits on neither people nor a report-only result`)
      assert.doesNotMatch(n.why, /^After |^Report-only until/, `${f.name}/${n.id}: the plan's own order listed as a request`)
      assert.notEqual(n.why, directionWords.waiting, `${f.name}/${n.id}: a Direction wait is the decision above it, asked once`)
    }
    assert.equal(brief.counts.needs, brief.needs.length, f.name)
  }
  assert.ok(decisions > 0 && waits > 0, `the premise: decisions (${decisions}) and waits on people (${waits})`)
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
