// Every binding a package REQUIRES, against every binding the product produces.
//
// G-F2, 2026-09-22. `s-check-dormant-accounts` declares `account.current.id`,
// `account.current.displayName` and `account.decision.disposition` as required
// bindings and its blocks are written per account against them. Nothing emits
// an `account.*` key on any tenant, so those blocks project nowhere and the
// generic review block is the only thing a reader has ever seen — which is why
// that step's per-account channels were reported empty.
//
// Sweeping the whole library found it is not one package. Over 1,234 step
// bindings — every shipped fixture in four foundation states — the product
// emits 52 distinct keys, and 41 of 42 packages require at least one that is
// not among them. Those blocks are withheld, correctly and silently, on every
// tenant.
//
// This test does not assert the hole is closed. It pins it, so it can only
// get smaller: a NEW required binding with no producer fails here, and a
// producer added for one of these fails here too and asks for the list to be
// shortened. The fix for any single line is a producer in stepPackage.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved, withEmergencyAccessSettled, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { packageBindings } from '../../ui/surfaces/stepPackage.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'

/** Required bindings no producer emits, as measured on 2026-09-22. Shrinks only. */
const UNPRODUCED: readonly string[] = [
  "account.current.displayName",
  "account.current.id",
  "account.decision.disposition",
  "admin.peopleToSeparate",
  "campaign.snoozeDurationInDays",
  "dependencies.replacementMfaSummary",
  "dependencies.replacementProtectionSummary",
  "device.evidence.summary",
  "emergency.target.upn",
  "emergency.target.userId",
  "group.current.id",
  "group.target.mailNickname",
  "group.target.memberId",
  "group.target.memberODataBindings",
  "intune.appProtection.prerequisiteState",
  "intune.compliance.prerequisiteState",
  "license.defenderCloudApps",
  "location.current.id",
  "location.syncServer.displayName",
  "location.syncServer.id",
  "location.syncServer.ipRanges",
  "location.target.ipRanges",
  "mfa.perUser.accounts",
  "operator.displayName",
  "peoplePolicies.resolvedPatches",
  "pim.roleManagementPolicyIds",
  "policies.guests.mixed.current.id",
  "policies.guests.mixed.target.conditions",
  "policies.guests.mixed.target.displayName",
  "policies.guests.mixed.target.grantControls",
  "policies.guests.mixed.target.sessionControls",
  "policies.guests.mixed.target.users",
  "policies.guests.semanticMismatches",
  "policies.guests.strong.current.id",
  "policies.guests.strong.target.conditions",
  "policies.guests.strong.target.displayName",
  "policies.guests.strong.target.grantControls",
  "policies.guests.strong.target.sessionControls",
  "policies.guests.strong.target.users",
  "policies.session.browser.current.id",
  "policies.session.semanticMismatches",
  "policies.unmanagedBrowser.a.target.conditions",
  "policies.unmanagedBrowser.a.target.displayName",
  "policies.unmanagedBrowser.a.target.sessionControls",
  "policies.unmanagedBrowser.b.target.conditions",
  "policies.unmanagedBrowser.b.target.displayName",
  "policies.unmanagedBrowser.b.target.sessionControls",
  "policies.unmanagedBrowser.semanticMismatches",
  "policy.current.semanticMismatches",
  "policy.target.conditionsWithExclusion",
  "readiness.activeCount",
  "readiness.adminsNeedingPasskey",
  "readiness.percent",
  "securityDefaults.current.isEnabled",
  "serviceAccounts.group.id",
  "sharepoint.unmanagedDevices.currentMode",
  "sourceConflict.summary",
  "strength.current.id",
  "strength.current.semanticMismatches",
  "workload.cloudSync.servicePrincipalId",
]

function emittedKeys(): Set<string> {
  const out = new Set<string>()
  const preps: ((f: Fixture) => Fixture)[] = [(f) => f, withDirectionApproved, withEmergencyAccessSettled, withFoundationSettled]
  for (const raw of allFixtures()) {
    for (const prep of preps) {
      const f = prep(structuredClone(raw))
      const run = runFixture(f)
      const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
      for (const step of run.steps) {
        try {
          for (const key of Object.keys(packageBindings(step, ctx, stepContract(step, ctx)) ?? {})) out.add(key)
        } catch {
          // A step whose contract cannot be built on this tenant binds nothing;
          // the sweep is about what IS produced somewhere, so it moves on.
        }
      }
    }
  }
  return out
}

test('every required binding a package declares either has a producer or is on the recorded list', () => {
  const emitted = emittedKeys()
  assert.ok(emitted.size > 20, `the sweep produced only ${emitted.size} keys, so it is measuring nothing`)
  const packages = (registry as { packages: Record<string, { meta?: { requiredBindings?: string[] } }> }).packages
  const unproduced = new Set<string>()
  for (const p of Object.values(packages)) {
    for (const key of p.meta?.requiredBindings ?? []) if (!emitted.has(key)) unproduced.add(key)
  }
  assert.deepEqual([...unproduced].sort(), [...UNPRODUCED].sort(), 'the set of required bindings with no producer changed: a new one is a package block that can never project, and one that has gone is a producer to take off this list')
})
