# Require a Managed Device Outside the Office

## Goal
Require an IAMAI-approved trusted device posture outside trusted locations, using the pinned **compliant device OR Microsoft Entra hybrid joined device** grant while keeping Intune compliance configuration as a separate prerequisite.

## Why this exists
Conditional Access can trust a compliance/hybrid-join claim only if the tenant has real device management and compliance posture behind that claim. A CA policy alone cannot create device compliance.

## Applies when
The saved device-management decision is resolved, Intune/compliance prerequisites apply and are verified for the in-scope device paths, the trusted-location behavior is resolved, and Conditional Access is licensed.

## Do not show implementation when
Hide implementation while the device-management decision, Intune compliance prerequisite, canonical exclusions, trusted-location behavior, or licensing is unresolved; during a source conflict; or when the policy is already canonical/in place.

## Intune prerequisite
IAMAI source requires real compliance policy coverage before the CA policy: in current Intune navigation, verify **Endpoint security > Device compliance > Compliance policy settings > Mark devices with no compliance policy assigned as = Not compliant**. IAMAI also calls for a three-day `Mark device non-compliant` grace action in each applicable compliance policy. Do not bulk-edit guessed policies: resolve the in-scope compliance policy set and verify the action per policy. Current Microsoft guidance says the default “no policy assigned” behavior is Compliant, which is unsafe as a CA readiness signal unless changed.

## Target state
Pinned member `660ab461-0de5-4b00-baea-ec7325280f60` defines: All users with canonical exclusions; All resources; all client apps; Locations = Any location excluding All trusted locations; Grant = **Require device to be marked as compliant OR Require Microsoft Entra hybrid joined device**; no session controls; Report-only first. The saved device-plan answer determines which platforms/populations IAMAI actually places into the canonical target; this package never guesses that decision.

## Security-significant fields
Saved device plan, Intune prerequisite state, user/exclusion scope, All-resources scope, trusted-location exclusion, OR operator, both pinned device grant controls, null session controls, and lifecycle.

## Preserve
Preserve the source's compliant-or-hybrid OR semantics. The current Microsoft generic compliant-device template is reference behavior, not authority to delete the hybrid-joined path from Jon's pinned destination.

## Do not do
- Do not treat a device with no compliance policy as safely compliant just because that is Intune's default tenant setting.
- Do not invent which compliance policies should receive the three-day grace action.
- Do not replace the OR grant with compliant-device-only.
- Do not silently exclude phones, servers, Autopilot tooling, or personal devices; scope changes come from the saved device-plan decision and canonical IAMAI target.
- Do not claim Intune compliance settings are configured by the CA JSON.
- Do not correct an enabled policy's access semantics without staging Report-only first.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Verify the Intune prerequisite against actual in-scope compliance policies, inspect device readiness and server/Autopilot edge paths, then review Report-only sign-ins. Re-read the CA policy by stable ID and confirm the exact location scope and OR grant. Test both a compliant device and, where intentionally supported, a hybrid-joined device outside the trusted location.

## Rollback / safe recovery
Move the same CA policy back to Report-only if legitimate devices fail. Fix compliance assignment/check-in or the saved device-plan scope; do not add a permanent user exclusion. Intune prerequisite changes should be rolled back only with explicit awareness of the compliance effect on all consuming CA policies.

## Source verification
Pinned member plus current Microsoft device-compliance CA, Intune compliance, noncompliance-action, and device-filter documentation rechecked September 10, 2026.
