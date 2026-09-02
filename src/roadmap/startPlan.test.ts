// Prompt 52 Part 5: Start the plan (target-state §5, §9). Until pressed, every
// visit proposes dates from today and the header carries the start note; pressing
// writes the start date to the plan file and the header's first line becomes the
// started form; later scans update statuses and evidence but never move the
// anchored start. Changing the start afterwards is Plan settings.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { decisionsOf } from './progress.ts'
import { headerLine1, startControl } from '../derive/planHeader.ts'
import { absoluteDate } from '../copy/dates.ts'
import { pages } from '../content/content.ts'

const FINISH = '2026-10-07T12:00:00.000Z'
const START = '2026-09-07T12:00:00.000Z'

test('the header line has three branches, each a content string: proposed, cannot finish, started', () => {
  const base = { steps: 23, inPlace: 5, weeks: '5 weeks', constraint: '2 device steps wait for device readiness' }
  assert.equal(headerLine1({ ...base, finish: FINISH, startedFrom: null }), `23 steps · 5 in place · finishes ${absoluteDate(FINISH)} · 5 weeks`)
  assert.equal(headerLine1({ ...base, finish: null, startedFrom: null }), '23 steps · 5 in place · cannot finish until 2 device steps wait for device readiness')
  assert.equal(headerLine1({ ...base, finish: FINISH, startedFrom: START }), `23 steps · 5 done · started ${absoluteDate(START)} · finishes ${absoluteDate(FINISH)}`)
  // A started plan that cannot finish still says what holds it, never a hole.
  assert.equal(headerLine1({ ...base, finish: null, startedFrom: START }), '23 steps · 5 in place · cannot finish until 2 device steps wait for device readiness')
  const P = pages.plan as unknown as { startControl: string; startNote: string }
  assert.deepEqual(startControl(), { label: P.startControl, note: P.startNote })
  assert.equal(startControl().label, 'Start the plan')
})

test('pressing Start writes the start date and when to the plan file, and a load reads both back', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const file = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { kind: 'github', owner: 'o', repo: 'r', commit: 'c' },
    mapping: f.mapping,
    steps: run.steps,
    checkpoints: [],
    schedule: { startDate: START },
    startedAt: '2026-09-01T09:30:00.000Z',
  })
  const { plan, error } = parsePlanFile(JSON.stringify(file))
  assert.equal(error, null)
  const back = decisionsOf(plan!.decisions, plan!.planId)
  assert.equal(back.startDate, START, 'the anchored start travels')
  assert.equal(back.startedAt, '2026-09-01T09:30:00.000Z', 'when it was started travels')
  // A plan file saved before Start was pressed carries no startedAt.
  const proposal = buildPlanFile({ ...file, planId: f.planId, snapshot: f.snapshot, operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' }, baselineSource: { kind: 'github', owner: 'o', repo: 'r', commit: 'c' }, mapping: f.mapping, steps: run.steps, checkpoints: [], schedule: { startDate: START } })
  assert.equal(decisionsOf(parsePlanFile(JSON.stringify(proposal)).plan!.decisions, f.planId).startedAt, undefined)
})

test('a later scan updates statuses and evidence but never moves the anchored start', () => {
  const day1 = runFixture(fixture('demo'), { startDate: START })
  const week2 = runFixture(fixture('demo-week2'), { startDate: START })
  assert.equal(day1.schedule.start, week2.schedule.start, 'the start is anchored across scans')
  const inPlace = (r: typeof day1): number => r.steps.filter((s) => s.status === 'done').length
  assert.ok(inPlace(week2) > inPlace(day1), 'the later scan moves statuses')
})
