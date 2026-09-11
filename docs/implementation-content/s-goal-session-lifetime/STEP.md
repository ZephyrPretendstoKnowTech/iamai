# Limit How Long Sessions Last

## Goal
Apply the baseline's intended browser and unmanaged-device session lifetime and persistence limits as an intentional two-policy set. Do not collapse the two scopes into one policy.

## Why this exists
A browser session that persists indefinitely can keep working after the original interactive sign-in is long forgotten. The retained IAMAI step uses two different boundaries: every browser session is non-persistent and reauthenticates every 12 hours, while sessions on devices that are not compliant reauthenticate every 9 hours and are also non-persistent.

## Applies when
Use this implementation only when IAMAI classifies this exact step as actionable and has resolved the tenant-specific exclusions and shared-device accounts. Both component policies must be evaluated independently.

## Do not show implementation when
Do not render actionable implementation for `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, or `notLicensed`. Do not render a corrective mutation for a component whose stable tenant policy ID is unknown. If a current component contains a security-significant condition or session control IAMAI cannot safely model, stop at review rather than overwriting it.

## Prerequisites
- Conditional Access licensing is available.
- Emergency/global exclusions are already resolved by IAMAI.
- Shared-device accounts are resolved to a complete tenant set, including an explicitly empty set when none apply.
- The current policies and their stable IDs are known before update/enforcement.
- Device-compliance evidence used to judge the unmanaged-device boundary is current enough for the rollout decision.

## Owner decisions
No new owner decision is introduced here. The current Jon Hope baseline pin `8461e0f2fd10167bf034e7c20ed8ea293827d890` remains authoritative. The available pinned projection exposes stable ID `ea9459a9-91b6-4d2b-b929-03781ac81d54` for the all-user browser member. The IAMAI canonical merged-step source specifies a second unmanaged-device companion policy but does not surface a stable pinned source ID for it in the available projection; this package does not invent one.

## Current-state inputs
IAMAI may use the current matching session policies, unmanaged-browser evidence, shared-device accounts, canonical exclusions, target frequency/persistence values, and device-compliance state already available to the product. Unknown evidence remains Unknown.

## Target state
**Policy A — browser:** All users; canonical exclusion groups plus resolved shared-device user accounts; All resources; Client apps = Browser; no other security-significant condition; no grant control; Sign-in frequency = 12 hours, time based, primary and secondary authentication; Persistent browser = Never; Report-only before enforcement.

**Policy B — unmanaged-device:** All users; the same canonical exclusions/shared-device users; All resources; Client apps = All; device filter mode `exclude` with rule `device.isCompliant -eq True`; no grant control; Sign-in frequency = 9 hours, time based, primary and secondary authentication; Persistent browser = Never; Report-only before enforcement.

Microsoft documents that persistent-browser controls should target All apps/resources; both policies do so.

## Security-significant fields
For each component: included users, excluded users/groups, target resources, client-app scope, any device filter, risk/location/platform/authentication-flow conditions, grant controls, sign-in-frequency settings, persistent-browser settings, any other session controls, and lifecycle state.

## Preserve
- Treat the two component policies as one rollout goal but two independent Conditional Access objects.
- Update each existing object only by its stable tenant policy ID.
- Preserve the exact canonical exclusion set on both policies.
- Keep Report-only while correcting a material mismatch.
- If a component is already canonical, do not recreate it merely because the other component is missing.

## Do not do
- Do not collapse the 12-hour browser policy and 9-hour unmanaged-device policy into one policy.
- Do not apply the 9-hour frequency to compliant devices.
- Do not add grant requirements, authentication strengths, locations, platforms, risks, or application exclusions not present in the canonical target.
- Do not treat a missing device-compliance claim as proof that a device is unmanaged unless IAMAI's existing evidence/classifier says so.
- Do not remove shared-device exclusions just to simplify rollout.
- Do not create a duplicate based only on display-name mismatch.

## State variants
- **Missing:** create both missing component policies in Report-only. If IAMAI already found one component, use Partial instead of duplicating it.
- **Partial:** compose only the mismatch modules for the affected component(s). A missing companion is created separately; an existing component is updated by stable ID.
- **Report-only:** keep both canonical policies non-enforcing while validating expected browser and unmanaged-device behavior.
- **Ready to enforce:** enable both canonical component policies by stable IDs as one controlled rollout.
- **In place:** no implementation action.
- **Blocked / Needs decision / Source conflict / Not licensed:** no actionable implementation.

## Verification
Read both policies back by stable ID. Verify the exact scope and session controls independently. Use Conditional Access What If and sign-in logs where appropriate, and test representative managed and unmanaged browser sessions. Confirm shared-device accounts remain excluded. After enforcement, confirm expected reauthentication/persistence behavior and rescan IAMAI.

## Rollback / safe recovery
If rollout causes unexpected prompts or shared-device disruption, return **both** component policies to Report-only first so the pair is no longer partially enforced. Correct the same stable objects; do not delete/recreate them or broaden exclusions as the first response.

## Limitations / unknowns
- Session controls govern token/session behavior and do not guarantee that every application discards its own local state at the same instant.
- Sign-in-frequency timing can interact with other Conditional Access session policies; the most restrictive applicable control can dominate user experience.
- Device-compliance claims are evidence, not a guarantee that every browser/device reports them consistently.
- The available pinned projection does not expose a stable source ID for the unmanaged companion; runtime update identity must therefore come only from IAMAI's resolved tenant policy ID.

## Source verification
Checked 2026-09-10 against current first-party Microsoft documentation for adaptive session lifetime, Graph v1.0 session controls, sign-in frequency, persistent browser mode, and device filters. Shared Conditional Access create/update and PowerShell primitives were already verified for this authoring run.
