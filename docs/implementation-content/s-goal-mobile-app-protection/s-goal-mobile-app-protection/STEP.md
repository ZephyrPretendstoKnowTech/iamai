# Require App Protection on Phones

## Goal
Require supported Android and iOS/iPadOS access to use applications protected by Microsoft Intune App Protection so company data remains inside managed app boundaries.

## Why this exists
Conditional Access can require an app protection policy, but that grant is useful only when the matching Intune App Protection policies already exist and apply to the intended users/apps. This is therefore a two-component implementation.

## Components and execution order
1. **Intune App Protection prerequisite** — create or verify the source-required iOS/iPadOS and Android APP coverage for the intended Microsoft apps/users, including the pinned minimum behavior (PIN and block save-as to unmanaged locations).
2. **Conditional Access policy** — require app protection on Android and iOS for the canonical population/resources.
3. Validate both components together before enabling CA.

The CA JSON and PowerShell in this package configure only component 2. They do not pretend to configure Intune APP.

## Applies when
The tenant is licensed for the required Intune/Conditional Access capabilities, the device-plan keeps mobile access in scope, canonical exclusions are resolved, and the Intune APP prerequisite is satisfied.

## Do not show CA implementation when
Hide implementation while the Intune APP prerequisite, licensing, device-plan decision, or canonical exclusions are unresolved; during a source conflict; or when the full composite step is already canonical and in place.

## Pinned target state
The retained goal catalogue's `mobile-app-protection` template defines the CA destination: All users with canonical exclusions; All resources; all client apps; Android and iOS platforms; Grant access with `compliantApplication` / **Require app protection policy** using OR; no session controls. New deployment starts Report-only. The retained goalMap does **not** provide a stable source policy member for this goal, so no GUID is invented.

## Intune prerequisite
The pinned source describes two App Protection policies, iOS/iPadOS and Android, covering the intended Microsoft apps/users, requiring a PIN and blocking save-as to unmanaged locations. Current Microsoft Intune navigation is **Apps > Protection > Create policy**. IAMAI must verify the tenant's real APP objects; this package does not invent their IDs or expand the source-described settings into a new baseline.

## Current Microsoft behavior
For new CA policies, use **Require app protection policy**. Microsoft's June 30, 2026 migration guidance places the old **Require approved client app** control/policies in read-only state for editing and says new policies should use app protection policy. The pinned IAMAI target already uses `compliantApplication` only.

Applying the grant requires the mobile device to register in Microsoft Entra and use the platform broker flow (Authenticator on iOS; Authenticator or Company Portal on Android). App support must be validated rather than assumed.

## Security-significant fields
Intune APP presence/assignment, CA population/exclusions, All-resources scope, Android+iOS platform condition, `compliantApplication` grant, null session controls, and lifecycle.

## Preserve
Preserve the source-described APP scope and the IAMAI-resolved tenant population. Do not copy policy IDs, group IDs, or app-policy names from another tenant.

## Do not do
- Do not configure only CA and call the composite step complete.
- Do not use `approvedApplication` as the new-policy grant.
- Do not invent an Intune APP payload beyond the pinned source-described prerequisite.
- Do not assume every mobile app supports the app-protection grant.
- Do not correct an enabled CA policy in place; move it to Report-only first.

## State variants
Configure APP prerequisite; Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Verify the real iOS/iPadOS and Android APP assignments first. Then review CA Report-only results and test supported mobile apps on both platforms, including broker/registration behavior. Re-read the CA policy by stable tenant ID and compare all canonical fields before enforcement.

## Rollback / safe recovery
Move the CA policy back to Report-only. Correct the Intune APP assignment/settings or mobile-workflow decision separately; do not weaken CA with a permanent user/app bypass unless IAMAI records an owner-approved change.

## Source verification
Pinned goal template plus current Microsoft Intune APP, app-based Conditional Access, approved-client-app migration, grant-control, and Graph v1.0 documentation rechecked September 10, 2026.
