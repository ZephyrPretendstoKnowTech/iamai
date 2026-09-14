# Limit How Long Sessions Last

## Goal
Apply the pinned baseline's browser session lifetime and persistence limits with its one browser policy. The pinned baseline has no unmanaged-device session policy, so this step creates, corrects and enables the browser policy alone.

## Why this exists
A browser session that persists indefinitely can keep working after the original interactive sign-in is long forgotten. The pinned baseline sets one boundary: every browser session is non-persistent and reauthenticates every 12 hours. Apps outside the browser are not limited by this step.

## Applies when
Use this implementation only when IAMAI classifies this exact step as actionable and has resolved the tenant-specific exclusions and shared-device accounts. The browser policy is evaluated on its own.

## Do not show implementation when
Do not render actionable implementation for `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, or `notLicensed`. Do not render a corrective mutation for a component whose stable tenant policy ID is unknown. If a current component contains a security-significant condition or session control IAMAI cannot safely model, stop at review rather than overwriting it.

## Prerequisites
- Conditional Access licensing is available.
- Emergency/global exclusions are already resolved by IAMAI.
- Shared-device accounts are resolved to a complete tenant set, including an explicitly empty set when none apply.
- The current policies and their stable IDs are known before update/enforcement.

## Owner decisions
No new owner decision is introduced here. The current Jon Hope baseline pin `8461e0f2fd10167bf034e7c20ed8ea293827d890` remains authoritative. The available pinned projection exposes stable ID `ea9459a9-91b6-4d2b-b929-03781ac81d54` for the all-user browser member. An earlier merged-step source described a second, unmanaged-device policy; the pin has no such policy, so this package offers none and does not invent one.

## Current-state inputs
IAMAI may use the current matching session policies, unmanaged-browser evidence, shared-device accounts, canonical exclusions, target frequency/persistence values, and device-compliance state already available to the product. Unknown evidence remains Unknown.

## Target state
**Policy A — browser:** All users; canonical exclusion groups plus resolved shared-device user accounts; All resources; Client apps = Browser; no other security-significant condition; no grant control; Sign-in frequency = 12 hours, time based, primary and secondary authentication; Persistent browser = Never; Report-only before enforcement.

**No unmanaged-device policy.** The pinned baseline has no unmanaged-device session policy. The package's retained unmanaged-device blocks and script modes are not offered, and are left for a separately authorized change.

Microsoft documents that persistent-browser controls should target All apps/resources; the browser policy does so.

## Security-significant fields
For the browser policy: included users, excluded users/groups, target resources, client-app scope, any device filter, risk/location/platform/authentication-flow conditions, grant controls, sign-in-frequency settings, persistent-browser settings, any other session controls, and lifecycle state.

## Preserve
- Treat the browser policy as the step's one Conditional Access object.
- Update each existing object only by its stable tenant policy ID.
- Preserve the exact canonical exclusion set on the browser policy.
- Keep Report-only while correcting a material mismatch.

## Do not do
- Do not add an unmanaged-device session policy the pinned baseline does not contain.
- Do not add grant requirements, authentication strengths, locations, platforms, risks, or application exclusions not present in the canonical target.
- Do not treat a missing device-compliance claim as proof that a device is unmanaged unless IAMAI's existing evidence/classifier says so.
- Do not remove shared-device exclusions just to simplify rollout.
- Do not create a duplicate based only on display-name mismatch.

## State variants
- **Missing:** create the browser policy in Report-only. If IAMAI already found it, use Partial instead of duplicating it.
- **Partial:** compose only the mismatch modules for the browser policy; an existing policy is updated by its stable ID.
- **Report-only:** keep the canonical browser policy non-enforcing while validating expected browser behavior.
- **Ready to enforce:** enable the canonical browser policy by its stable ID in a controlled change window.
- **In place:** no implementation action.
- **Blocked / Needs decision / Source conflict / Not licensed:** no actionable implementation.

## Verification
Read the browser policy back by stable ID. Verify its exact scope and session controls. Use Conditional Access What If and sign-in logs where appropriate, and test representative managed and unmanaged browser sessions. Confirm shared-device accounts remain excluded. After enforcement, confirm expected reauthentication/persistence behavior and rescan IAMAI.

## Rollback / safe recovery
If rollout causes unexpected prompts or shared-device disruption, return the browser policy to Report-only first. Correct the same stable objects; do not delete/recreate them or broaden exclusions as the first response.

## Limitations / unknowns
- Session controls govern token/session behavior and do not guarantee that every application discards its own local state at the same instant.
- Sign-in-frequency timing can interact with other Conditional Access session policies; the most restrictive applicable control can dominate user experience.
- Device-compliance claims are evidence, not a guarantee that every browser/device reports them consistently.
- The pinned baseline has no unmanaged-device session policy; runtime update identity for the browser policy comes only from IAMAI's resolved tenant policy ID.

## Source verification
Checked 2026-09-10 against current first-party Microsoft documentation for adaptive session lifetime, Graph v1.0 session controls, sign-in frequency, persistent browser mode, and device filters. Shared Conditional Access create/update and PowerShell primitives were already verified for this authoring run.
