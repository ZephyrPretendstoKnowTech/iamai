# 01 — Lock the data model

Read SPEC.md and docs/design/collection.md before starting. Make these changes, docs and code together. Commit after each numbered item or logical group, and push at the end.

1. Users `$select` adds createdDateTime, accountEnabled, assignedPlans, onPremisesSyncEnabled, externalUserState, department, jobTitle, officeLocation.

2. Lane 0 adds /organization, /me, /me/memberOf; keeps named locations, the auth-methods policy (including registrationEnforcement and policyMigrationState), and CA policies as full objects; marks Microsoft-managed policies (display-name prefix "Microsoft-managed" or templateId present).

3. Add an on-demand collector: transitive member ids for a given group id plus its membershipRule, cached per tenant, counts-and-sample above 20 000 members.

4. Refactor collectors into a declarative registry — name, endpoint, version, scopes, required capability, gate, purpose, lane — and generate a "What IAMAI reads" page from it; update SPEC §4 from the registry.

5. Add `data/first-party-apps.json` (appId, displayName, category, inOffice365Bundle) seeded from Microsoft's documented first-party app ids, with a refresh script.

6. Write docs/design/plan-file.md: schemaVersion; tenant header (id, name, domains, operator); baseline pin (source, commit, variant choices, compiled intents); mappings with provenance (auto-suggested vs confirmed) and validation results; steps with stable ids and status history; the `[IAMAI:<planId>:<stepId>]` description-tag convention for generated policy JSON; checkpoints (first + last 20, summaries only, no raw rows); display time zone preference; all times ISO UTC.

7. Write docs/design/diagnostics.md: a downloadable redacted bundle — statuses, timings, errors; no UPNs, no user GUIDs, tenant id hashed — and make every log line obey it.

8. Extend Lane B's derived tables in collection.md with per-policy applied results (report-only and enforced result counts, affected user ids) and a "currently failing" cohort.

9. Spike, 5 minutes: beta /users/{id}/authentication/requirements in a $batch of 20 — record scope needed, ms, and whether perUserMfaState is returned; note it in the spike doc.

10. Store per-user role data in the snapshot as two separate lists — active assignments and PIM-eligible — keyed by user id and role template id; scoring and impact treat eligible as out of CA role scope until activated.

11. Checkpoint contents in plan-file.md, explicitly: per-intent coverage state; per tenant policy its state, Microsoft-managed flag, and Lane B result counts; MFA state counts and activity counts; member count of every group used as an exclusion in any policy; break-glass accounts' last sign-in dates; tenant capabilities and seat coverage; Lane B covered window; timestamp.

12. Add SPEC.md §11 "Roadmap-stage features (deferred, data already collected)": change-record generator per step (scope, hard-block cohort export, risk, rollback, verification, comms); pilot cohort builder (active, Verified or Likely viable, spread across departments, one admin, never break-glass, output as UPNs); drift and exclusion-creep detection across checkpoints; Microsoft-managed policy auto-enable dates on the timeline; recurring break-glass drill step driven by last sign-in. Name for each the snapshot or checkpoint field it depends on.

13. Licence model: `data/service-plans.json` mapping service plan ids/names to capabilities (entraP1, entraP2, intune, workloadIdPremium, globalSecureAccess, defenderForCloudApps, purviewInsiderRisk) with a refresh script; derive tenant capabilities from subscribedSkus service plans with enabled seat counts and consumed units; derive per-user capabilities from assignedPlans with capabilityStatus Enabled. Collectors report "not available on this licence" before calling and continue. Add SPEC.md §12 "Licensing principle": the tool hardens what the tenant has; intents are security goals with per-tier implementations (free / P1 / P2 / add-on); coverage is scored against the best implementation the tenant's licence allows; nothing is locked or marked accepted-risk; higher-tier implementations appear only in a separate educational catalog. Create `data/licence-catalog.json` empty-but-shaped (tier → features → description, use case, tenant-computed value hook, docs link) and `data/free-tier-ladder.json` with placeholders for the ~10 free-tier hardening items to be curated from Microsoft guidance. Unit-test capability derivation with fixture SKU sets: free, P1-only, P2, mixed with fewer P2 seats than users, trial, disabled plans. Add a ?dev=1 override to simulate a licence profile.

When finished: `npm test` must pass, `vite build` must succeed, and every new document must be linked from SPEC.md §10 (repo layout) or a new "Design documents" list.
