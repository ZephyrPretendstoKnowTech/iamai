// Every prerequisite of turning a policy on that the board reads holds the
// turn-on too (roadmap/enforceWaits.ts, owner decision 6, 2026-09-22).
//
// Only the drill and security defaults used to. The premise was that the
// readiness gates covered the rest, and they do not: the risk policies have no
// threshold, and Block Legacy Authentication waits on the service-accounts
// group. A sign-in risk policy a week into report-only said "Change Enable
// policy to On" beside a Stop line while thirty people had no method; each of
// them would be blocked the next time Entra flagged their sign-in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import data from '../actionability/dependency-data.json' with { type: 'json' }
import { curatedFixture } from './fixtures/index.ts'
import type { FixtureName } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { DRILL_PREREQUISITE, enforceWaitsOf } from './enforceWaits.ts'
import { graphConditions } from './graphConditions.ts'
import type { Step } from './types.ts'

type Edge = { step: string; action: string; prerequisite: string; prerequisiteKind: string; milestone: string; condition: string | null; edgeKind: string }
const EDGES = (data as { edges: Edge[] }).edges
const FIXTURES: FixtureName[] = ['demo', 'demo-week2', 'hostile', 'large', 'messy', 'mid', 'midflight', 'small']
// Open, with a turn-on still ahead of it: a policy already On (an open step whose On policy has a setting to correct) has no turn-on left to wait on.
const open = (s: Step): boolean => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && s.status !== 'skipped' && !s.state.satisfied && !s.state.setAside && s.state.lifecycle !== 'enforced'

test('a risk policy waits on the MFA campaign, which no readiness threshold covers', () => {
  const f = curatedFixture('mid')
  const run = runFixture(f)
  const campaign = run.steps.find((s) => s.id === 's-verify-mfa')
  assert.ok(campaign && campaign.status !== 'done', 'the premise: the campaign is still open')
  for (const id of ['s-goal-sign-in-risk', 's-goal-sign-in-risk-medium', 's-goal-user-risk', 's-goal-user-risk-medium']) {
    const step = run.steps.find((s) => s.id === id)
    assert.ok(step, `${id} left the plan`)
    assert.equal(step.action.readinessGate, undefined, `the premise: ${id} has no readiness threshold to hold it`)
    assert.ok(step.action.enforceWaitsOn?.some((w) => w.id === 's-verify-mfa' && w.title === 'Prepare Your Team for MFA'), `${id} does not wait on the campaign: ${JSON.stringify(step.action.enforceWaitsOn)}`)
  }
})

test('on every fixture, each open policy waits on exactly the open step prerequisites the board puts on its turn-on, and on nothing the plan does not carry', () => {
  // on every fixture, each open policy waits on exactly the open step prerequisites the board puts on its turn-on
  {
    for (const name of FIXTURES) {
      const f = curatedFixture(name)
      const run = runFixture(f)
      const byId = new Map(run.steps.map((s) => [s.id, s]))
      const conditions = graphConditions(byId, f.mapping)
      for (const s of run.steps.filter(open)) {
        const want = new Set<string>()
        for (const e of EDGES) {
          if (e.step !== s.id || e.action !== 'enforce' || e.prerequisiteKind !== 'step' || e.milestone !== 'complete') continue
          if (e.condition !== null && conditions[e.condition] === 'not-applicable') continue
          if (e.prerequisite === DRILL_PREREQUISITE) continue
          const p = byId.get(e.prerequisite)
          if (p && p.status !== 'done' && p.doesntApply == null) want.add(p.id)
        }
        const got = new Set((s.action.enforceWaitsOn ?? []).map((w) => w.id).filter((id) => id !== DRILL_PREREQUISITE))
        assert.deepEqual([...got].sort(), [...want].sort(), `${name} ${s.id}`)
      }
    }
  }

  // a prerequisite the plan does not carry is nothing to wait on
  {
    for (const name of FIXTURES) {
      const run = runFixture(curatedFixture(name))
      const ids = new Set(run.steps.map((s) => s.id))
      for (const s of run.steps) for (const w of s.action.enforceWaitsOn ?? []) assert.ok(w.id === DRILL_PREREQUISITE || ids.has(w.id), `${name} ${s.id} waits on ${w.id}, which is not on the plan`)
    }
  }
})

test('a prerequisite said not to apply here holds nothing, and neither does its conditional edge', () => {
  const f = curatedFixture('mid')
  const run = runFixture(f)
  const schedule = run.schedule
  const before = enforceWaitsOf(run.steps, schedule, f.mapping)
  const held = [...before.entries()].find(([, w]) => w.some((x) => x.id !== DRILL_PREREQUISITE))
  assert.ok(held, 'the premise: some policy waits on a step prerequisite')
  const prerequisite = held[1].find((x) => x.id !== DRILL_PREREQUISITE)!.id
  const steps = run.steps.map((s) => (s.id === prerequisite ? { ...s, doesntApply: 'not here' } : s))
  const after = enforceWaitsOf(steps, schedule, f.mapping)
  assert.ok(!(after.get(held[0]) ?? []).some((w) => w.id === prerequisite), `${held[0]} still waits on ${prerequisite}`)
})
