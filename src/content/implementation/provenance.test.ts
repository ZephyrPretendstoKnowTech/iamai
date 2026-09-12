// Package provenance (correction batch 2): a package is classified by what it
// stands on, and none claims a baseline member the pin does not map it to.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from './registry.generated.json' with { type: 'json' }
import { provenanceOf } from './provenance.ts'
import { contentStepForPackage } from '../stepTitle.ts'
import { PINNED } from '../../baseline/pinned.ts'

const REGISTRY = registry as unknown as { provenance?: Record<string, string> }
const LIBRARY = JSON.parse(readFileSync('docs/implementation-content/LIBRARY.json', 'utf8')) as { packages: { stepId: string; relationship: string; provenance?: string }[] }

test('every package is classified by what it stands on, and only a package the pin maps to a policy is baseline-backed', () => {
  const goalMap = (PINNED as unknown as { goalMap: Record<string, string[]> }).goalMap
  for (const p of LIBRARY.packages) {
    const provenance = provenanceOf(p.stepId, p.relationship)
    assert.notEqual(provenance, null, `${p.stepId} is unclassified`)
    const entry = contentStepForPackage(p.stepId) as { id: string; mergesGoals?: string[] } | null
    const mapped = entry ? [entry.id, ...(entry.mergesGoals ?? [])].some((g) => (goalMap[g] ?? []).length > 0) : false
    assert.equal(provenance === 'baseline-member', mapped, `${p.stepId}: ${provenance} disagrees with the pin's goal map`)
  }
  const of = (id: string): string | null => provenanceOf(id, LIBRARY.packages.find((p) => p.stepId === id)?.relationship)
  // A goal the pin holds no policy for stands on its template or the floor, whatever its author called it.
  for (const id of ['s-goal-unmanaged-browser', 's-goal-azure-management-mfa', 's-goal-mobile-app-protection', 's-goal-register-info-protected']) assert.equal(of(id), 'microsoft-template-floor', id)
  assert.equal(of('s-goal-device-registration-mfa'), 'baseline-member')
  assert.equal(of('s-goal-session-lifetime'), 'baseline-member', 'a merged goal is backed by the member one of its goals maps to')
  assert.equal(of('s-prereq-exclusion-group'), 'tenant-prerequisite')
  assert.equal(of('s-shared-devices'), 'tenant-prerequisite', 'a policy IAMAI proposes beside the baseline is not a baseline goal')
  assert.equal(of('s-question-travel'), 'workflow-check')
  assert.equal(of('s-verify-mfa'), 'workflow-check')
  assert.equal(of('cleanup-drill'), 'rollout-proof')
  assert.equal(of('cleanup-notAssessed'), 'source-review')
})

test('the registry and LIBRARY.json carry the same provenance the classification reads', () => {
  for (const p of LIBRARY.packages) {
    assert.equal(p.provenance, provenanceOf(p.stepId, p.relationship), `LIBRARY.json ${p.stepId}`)
    if (REGISTRY.provenance && p.stepId in REGISTRY.provenance) assert.equal(REGISTRY.provenance[p.stepId], p.provenance, `registry ${p.stepId}`)
  }
  assert.ok(REGISTRY.provenance && Object.keys(REGISTRY.provenance).length >= 44, 'the registry carries no provenance')
})
