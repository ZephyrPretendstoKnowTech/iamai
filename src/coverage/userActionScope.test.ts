// A policy that targets a user action is that action's goal's own, whoever it is
// assigned to (coverage.ts ownScope). The owner's tenant held Core - Require -
// Security info registration in Report-only, assigned to All users, and 5.1
// Protect Sign-in Method Registration read it as Not deployed and said to
// create it: an all-users policy was taken for Require MFA for Everyone's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'

test('an all-users Register security information policy in Report-only is 5.1’s own: tracked in Report-only, never Not deployed', () => {
  const f = curatedFixture('getiamai')
  const snapshot = structuredClone(f.snapshot)
  const rows = snapshot.config.caPolicies!.rows as Record<string, unknown>[]
  snapshot.config.caPolicies!.rows = [...rows, {
    id: 'security-info-policy',
    displayName: 'Core - Require - Security info registration',
    state: 'enabledForReportingButNotEnforced',
    conditions: {
      users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] },
      applications: { includeApplications: [], excludeApplications: [], includeUserActions: ['urn:user:registersecurityinfo'] },
      locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'], authenticationStrength: null },
  }] as typeof snapshot.config.caPolicies.rows
  const r = runFixture({ ...f, snapshot })
  const candidate = r.coverage.results.find((x) => x.goal.id === 'register-info-protected')?.candidates.find((c) => c.policyId === 'security-info-policy')
  assert.ok(candidate, 'the premise: coverage reads it as a candidate')
  assert.equal(candidate.ownScope, true, 'an all-users user-action policy is its own goal’s')
  const step = r.steps.find((s) => s.id === 's-goal-register-info-protected')!
  assert.equal(step.state.lifecycle, 'report-only')
  assert.equal(step.tracking?.members?.[0]?.policyName, 'Core - Require - Security info registration')
  // Require MFA for Everyone takes no user-action policy, so nothing moves there.
  assert.ok(!(r.coverage.results.find((x) => x.goal.id === 'mfa-all-users')?.candidates ?? []).some((c) => c.policyId === 'security-info-policy'))
})
