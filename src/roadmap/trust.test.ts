// ux-review-06 §4 and §7, prompt 23 §3 and §6: no user-facing roadmap string
// carries an id where a name belongs, and every step's counts come from one
// population.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../ui/pages/fixtureSnapshot.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { generateRoadmap } from './generate.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildQuestions } from '../mapping/questions.ts'
import { buildNameDirectory } from '../names.ts'
import { adminUserIds } from '../roles.ts'
import type { Step } from './types.ts'

const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
// Fragments like "9c094953…" are ids too.
const ID_FRAGMENT = /\b[0-9a-f]{8}…/i

function plan(): { steps: Step[]; snapshot: ReturnType<typeof fixtureSnapshot> } {
  const snapshot = fixtureSnapshot()
  const baseline = fixtureBaseline()
  const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
  const viability = buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability)
  const coverage = computeCoverage({
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: baseline.pkg.policies,
    baselineUnusable: [],
    strengths,
    groupMembers: new Map(),
  })
  const mapping = { ...emptyMappingState(snapshot.tenantId), breakGlassUserIds: ['u-4'] }
  const { steps } = generateRoadmap({
    planId: 'trust',
    coverage,
    snapshot,
    baseline: baseline.pkg,
    baselineAuthor: null,
    mapping,
    questions: buildQuestions(baseline.pkg),
    viability,
    strengths,
    operatorUserId: 'u-1',
    names: buildNameDirectory(snapshot, new Map()),
  })
  return { steps, snapshot }
}

/** Every string a person reads on a step card, the print plan or the timeline. */
function userFacing(s: Step): { where: string; text: string }[] {
  return [
    { where: 'title', text: s.title },
    { where: 'why', text: s.why },
    { where: 'impact', text: s.impact },
    { where: 'stateReason', text: s.stateReason },
    { where: 'comms', text: s.comms ?? '' },
    ...s.action.summary.map((t) => ({ where: 'action.summary', text: t })),
    ...s.action.portalSteps.map((t) => ({ where: 'portalSteps', text: t })),
    ...s.exitCriteria.map((t) => ({ where: 'exitCriteria', text: t })),
    ...s.readiness.lines.map((t) => ({ where: 'readiness', text: t })),
    ...s.evidence.lines.map((t) => ({ where: 'evidence', text: t })),
    ...s.unblockNotes.map((t) => ({ where: 'unblockNotes', text: t })),
    ...s.blockers.map((b) => ({ where: 'blockers', text: b.label })),
    ...s.highCare.notes.map((t) => ({ where: 'highCare', text: t })),
    { where: 'rollback', text: s.rollback },
    { where: 'naming', text: s.naming?.proposed ?? '' },
  ]
}

test('no user-facing roadmap string contains a GUID or an id fragment', () => {
  const { steps } = plan()
  const hits: string[] = []
  for (const s of steps) {
    for (const { where, text } of userFacing(s)) {
      if (GUID.test(text) || ID_FRAGMENT.test(text)) hits.push(`${s.id} ${where}: ${text.slice(0, 120)}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('a step that creates a pilot group names it in the tenant convention, not by the baseline id', () => {
  const { steps } = plan()
  const creating = steps.filter((s) => s.action.summary.some((t) => /creates a new pilot group/.test(t)))
  for (const s of creating) {
    const line = s.action.summary.find((t) => /creates a new pilot group/.test(t)) ?? ''
    assert.match(line, /for example "Pilot[^"]*"/, line)
    assert.doesNotMatch(line, GUID)
  }
})

test('one population per step: header, readiness line and admin count agree', () => {
  const { steps, snapshot } = plan()
  const admins = adminUserIds(snapshot.roles)
  for (const s of steps) {
    const ids = new Set(s.population.ids)
    // The header's active count is the readiness line's active count.
    const m = s.readiness.lines.join(' ').match(/of (\d+) active users? ready/)
    if (m) assert.equal(Number(m[1]), s.population.active, `${s.id}: readiness says ${m[1]} active, population says ${s.population.active}`)
    const inScope = s.impact.match(/^(\d+) active users? in scope/) ?? s.impact.match(/All (\d+) active users?/)
    if (inScope) assert.equal(Number(inScope[1]), s.population.active, `${s.id}: impact says ${inScope[1]}, population says ${s.population.active}`)
    // Admin and guest counts are subsets of the same id set.
    assert.equal(s.population.admins, [...ids].filter((id) => admins.has(id)).length, `${s.id}: admin count`)
    assert.equal(s.population.guests, snapshot.users.filter((u) => ids.has(u.id) && u.userType === 'guest').length, `${s.id}: guest count`)
  }
})
