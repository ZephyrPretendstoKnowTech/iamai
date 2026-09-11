# Reset Passwords for Medium-Risk Users

## Goal
Require a secure password change when Microsoft Entra ID Protection rates an in-scope user **Medium user risk**, without weakening High-risk coverage or creating a remediation path the user cannot complete.

## Why this exists
The retained IAMAI baseline adds an earlier user-risk remediation rung instead of waiting until risk becomes High. A successful secure password change closes the user-risk event and invalidates the usefulness of a suspected exposed password.

## Applies when
IAMAI identifies this baseline goal as missing, partial, Report-only, or ready to enforce and the tenant has Microsoft Entra ID P2 / qualifying ID Protection capability for the in-scope users.

## Do not show implementation when
Do not emit actionable implementation when IAMAI marks the step In place, Blocked, Needs decision, Source conflict, or Not licensed. If MFA registration, hybrid password writeback, guest/external handling, or overlap with the High-risk policy is unresolved, keep enforcement blocked.

## Prerequisites
- Microsoft Entra ID P2 or qualifying ID Protection capability.
- In-scope users must already have an MFA method registered before the user-risk password-change flow can succeed.
- Hybrid users synchronized from on-premises require working password writeback before enforcement.
- Guest/external users remain excluded from this retained step.
- Investigate active risky-user evidence before broad enforcement.
- SSPR can remain a recovery capability, but current Microsoft guidance says the Conditional Access **Require password change** remediation flow itself does not use SSPR.

## Owner decisions
No new owner decision is authored. The current Jon Hope pin remains authoritative. Do not silently remove the separate High-user-risk control. Any overlap consolidation requires explicit IAMAI authority proving the remaining policy set still covers High risk.

## Current-state inputs
Current matching policy and stable tenant policy ID; semantic mismatches; canonical group exclusions; current guest/external scope; Medium user-risk evidence; MFA registration readiness; hybrid/password-writeback state; current High-risk policy state and effective coverage; current blockers.

## Target state
- Users: All users, with the exact IAMAI-resolved canonical group exclusions.
- Guest/external users: exclude all guest/external types for this retained step.
- Target resources: All resources; no application exclusions.
- Client apps: All.
- User risk: Medium only.
- No sign-in-risk, location, platform, device/filter, authentication-flow, or workload-risk condition.
- Grant: Require multifactor authentication **and** Require password change; operator AND.
- Session controls: none.
- Lifecycle: Report-only before enforcement, then On.

## Security-significant fields
Population, guest/external exclusion, canonical group exclusions, All-resources target, Medium-only user-risk condition, MFA + password-change grant with AND, absence of unrelated conditions/session controls, High-risk overlap, and lifecycle are security-significant.

## Preserve
Preserve stable policy identity, exact canonical exclusions, Medium-only risk scope, secure password-change behavior, and the independent High-risk protection unless IAMAI explicitly resolves a safe consolidation.

## Do not do
- Do not disable the High-user-risk policy merely because this step is enabled.
- Do not add compliant-device, location, platform, or other conditions to a password-change policy; current Microsoft guidance restricts this flow to users/groups, All resources, and user risk.
- Do not combine `passwordChange` with `riskRemediation`.
- Do not use an authentication-strength relationship as the companion to `passwordChange` in deployable v1.0 JSON; current Graph requires built-in `mfa` with `passwordChange` using AND.
- Do not require SSPR solely because the secure Conditional Access password-change flow changes a password.
- Do not enforce for synchronized users until password writeback is known to work.

## State variants
- **Prerequisite required:** show only the unmet MFA/writeback/scope/overlap prerequisite.
- **Missing:** create the supported retained Medium-risk password-change policy in Report-only.
- **Partial:** correct only IAMAI-classified mismatches by stable tenant policy ID.
- **Report-only:** verify exact shape and remediation readiness; review overlap with High-risk protection.
- **Ready to enforce:** enable the same stable policy; do not retire High-risk protection automatically.
- **In place / blocked / needs decision / source conflict / not licensed:** no actionable implementation.

## Verification
Read back by stable policy ID. Verify All users + canonical exclusions + all guest/external types excluded, All resources, client apps All, user risk Medium only, no other effective conditions, built-in MFA + passwordChange with AND, no session controls, and intended lifecycle. Confirm MFA registration and hybrid writeback readiness. Separately confirm the High-risk policy remains protected.

## Rollback / safe recovery
Set the same stable policy back to Report-only. If remediation causes user impact, restore access through the approved risk-recovery path; do not remove the High-risk control as a rollback shortcut.

## Limitations / unknowns
Microsoft currently recommends adaptive **Require risk remediation** at High user risk. This package intentionally preserves IAMAI's separate Medium user-risk password-change goal. Available retained-source evidence also shows an authentication-strength relationship on the existing Medium-risk member, but current Graph v1.0 documents `passwordChange` with built-in MFA + AND instead. This package records and normalizes that API compatibility issue rather than emitting unsupported deployable JSON.

## Source verification
Workbook Order 43 is `s-goal-user-risk-medium`. Retained goal identity maps to stable policy ID `7475b373-0544-4ee8-8827-cff35009136d`. Current Microsoft documentation confirms that password-change remediation requires prior MFA registration, All resources, limited policy conditions, and hybrid password writeback where applicable. Current Graph v1.0 requires `passwordChange` to be accompanied by built-in `mfa` using `AND`. The compatibility normalization is explicitly recorded for final whole-library review.
