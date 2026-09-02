# Design: the plan file

**Status (2026-08-27):** v1 ships as a JSON file (`iamai-plan-<tenant>.json`);
the self-contained HTML wrapper is planned. The schema below is the design;
`src/roadmap/plan.ts` (`PlanFile`, `Checkpoint`) is the source of truth and
differs in places: `planId`, `mappings: MappingState`, `variantChoices[].chosenPolicyName`,
`coverage[].goalId`, steps per roadmap.md §1, an optional `schedule { startDate, pace }`,
no `sha256`/`compiledIntents`/`intentFingerprint`, and no forward migration (newer files are refused).

The plan file is the single self-contained HTML artifact SPEC §2 promises: it
renders as the roadmap and re-imports as state. Embedded JSON, one schema.
All times are **ISO 8601 UTC**; a display time-zone preference is stored, but
nothing is ever persisted in local time.

## Top level

```
PlanFile {
  schemaVersion: number            // carried by every release (SPEC §8 CI note)
  createdAt: string
  displayTimeZone: string          // IANA name, presentation only
  tenant: TenantHeader
  baseline: BaselinePin
  mappings: Mapping[]
  steps: Step[]
  checkpoints: Checkpoint[]        // first + last 20, summaries only
}
```

## Tenant header

```
TenantHeader {
  id: string
  name: string                     // from /organization
  domains: string[]                // verified domains
  operator: { userId: string, userPrincipalName: string }   // from /me
}
```

## Baseline pin

```
BaselinePin {
  source: { kind: 'github', owner: string, repo: string, commit: string }
        | { kind: 'upload', fileName: string, sha256: string }
  variantChoices: { familyKey: string, chosenPolicyId: string }[]
  compiledIntents: Intent[]        // the compiled intent set the plan was built against,
                                   // so the plan is evaluable even if the source moves
}
```

## Mappings (reference resolution, SPEC §3.3)

```
Mapping {
  placeholder: string              // e.g. CA-GlobalExclusions-GroupId-ReplaceMe, or a role name
  resolvedId: string | null        // null = "doesn't exist yet" → Phase 0 step
  provenance: 'auto-suggested' | 'confirmed'   // suggestions must be confirmed to count
  validation: {
    checkedAt: string
    passed: boolean
    findings: string[]             // plain language, e.g. "not excluded from policy X"
  }
}
```

## Steps

```
Step {
  id: string                       // stable for the life of the plan
  phase: number
  intentFingerprint: string        // intent hash (SPEC §3.6) so tracking survives renames
  title: string
  status: 'planned' | 'reportOnly' | 'enforced' | 'skipped'
  statusHistory: { at: string, from: string, to: string, note: string | null }[]
}
```

Generated policy JSON for a step carries the description tag
**`[IAMAI:<planId>:<stepId>]`** so re-scans can match tenant policies back to
plan steps regardless of display-name edits. The tag lives in the policy
description field; nothing else identifies IAMAI-suggested policies.

## Checkpoints

A checkpoint is a **summary-only** snapshot of tenant posture at a moment —
no raw sign-in rows, no per-user method data, nothing SPEC's privacy rules
exclude. The file keeps the **first checkpoint and the last 20**; middle ones
are dropped oldest-first.

Contents, explicitly:

```
Checkpoint {
  at: string
  coverage: { intentFingerprint: string, state: 'enforced' | 'partial' | 'absent' }[]
  tenantPolicies: {
    id: string
    state: string                              // enabled / disabled / report-only
    microsoftManaged: boolean
    laneB: { reportOnlyFailure: number, reportOnlyInterrupted: number,
             enforcedFailure: number, enforcedSuccess: number } | null
  }[]
  mfaStateCounts: Record<MfaState, number>     // §10 summary counts
  activityCounts: Record<ActivityState, number>
  exclusionGroups: { groupId: string, memberCount: number }[]   // every group used as an
                                                                // exclusion in any policy
  breakGlass: { userId: string, lastSignIn: string | null }[]
  capabilities: Record<Capability, { enabled: boolean, seats: number | null,
                                     coveredUsers: number | null }>
  laneBCoveredWindow: { from: string, to: string } | null
}
```

## Import rules

- `schemaVersion` older than the app: migrate forward, note it in the UI.
- Newer than the app: read-only view with an upgrade prompt; never partially
  import.
- The plan file must never depend on the MSAL session (SPEC §5): importing
  works signed-out; connecting later re-validates mappings against the tenant.
