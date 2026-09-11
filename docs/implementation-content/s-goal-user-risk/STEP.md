# Remediate High-Risk Users

## Goal
Automatically remediate users Microsoft Entra ID Protection rates **High user risk** using the retained baseline's adaptive risk-remediation policy, while keeping the policy reversible and preventing unsupported guest/external or hybrid-password flows from becoming lockout paths.

## Why this exists
User risk represents the likelihood that an identity itself is compromised, not just one sign-in. The retained baseline uses Conditional Access **Require risk remediation** so Entra can choose the secure remediation path for password-based, passwordless, and attacker-added-device scenarios.

## Applies when
IAMAI identifies this baseline goal as missing, partial, Report-only, or ready to enforce and Microsoft Entra ID P2/qualifying ID Protection capability is available for the in-scope users.

## Do not show implementation when
Do not emit actionable implementation when IAMAI marks the step In place, Blocked, Needs decision, Source conflict, or Not licensed. If the effective population includes guest/external users without an approved exclusion strategy, or hybrid users cannot complete required password writeback, keep enforcement blocked rather than inventing exclusions or recovery behavior.

## Prerequisites
- Microsoft Entra ID P2 or qualifying Microsoft Entra Suite / ID Protection capability for in-scope users.
- In-scope users must already have a Microsoft Entra MFA method registered before relying on risk self-remediation.
- For hybrid users synchronized from on-premises, password writeback must be enabled before enforcement.
- Guest/external users require deliberate handling because Require risk remediation is not supported for them.
- Investigate and remediate already-active risks before enabling broad enforcement.
- **SSPR is not a universal prerequisite for this Conditional Access remediation flow.** Current Microsoft guidance distinguishes password change during risk remediation from SSPR/password reset. SSPR can remain an important recovery route, but lack of SSPR alone must not block this policy if the actual risk-remediation prerequisites are met.

## Owner decisions
No new owner decision is authored here. The current Jon Hope pin remains authoritative. Exclusions and authentication-strength selection must come from IAMAI's resolved tenant/baseline truth; do not substitute model-preferred values.

## Current-state inputs
Current matching policy and stable tenant policy ID; semantic mismatches; exact tenant-resolved exclusions; High user-risk evidence; registered MFA readiness; resolved authentication-strength ID/allowed combinations; guest/external population evidence; hybrid synchronization/password-writeback state; current risk-investigation blockers.

## Target state
- Users: All users, with the exact IAMAI-resolved exclusions required by the retained baseline member.
- Target resources: All resources; no application exclusions.
- Client apps: All.
- User risk: High only.
- No sign-in-risk, location, platform, device/filter, authentication-flow, or workload-risk condition.
- Grant: Grant access; Require risk remediation; Require the IAMAI-resolved retained-baseline authentication strength; operator AND.
- Do not combine `riskRemediation` with `passwordChange` or a separate built-in `mfa` grant.
- Session: Sign-in frequency = Every time.
- Lifecycle: Report-only for validation, then On only after prerequisites/readiness are confirmed.

## Security-significant fields
Population/exclusions, All-resources scope, High-only user risk, `riskRemediation`, the exact authentication-strength ID/allowed combinations, AND operator, Every-time sign-in frequency, guest/external handling, hybrid password-writeback readiness, and lifecycle state are security-significant.

## Preserve
Preserve stable policy identity, exact retained-baseline exclusions, High-only threshold, the resolved authentication strength, the separate medium-risk user step, and the distinction between risk-remediation password change and SSPR recovery.

## Do not do
- Do not replace Require risk remediation with the older MFA + password-change grant just because older IAMAI copy or the workbook brief uses that wording; the retained baseline member and current Microsoft guidance support adaptive risk remediation.
- Do not require SSPR merely because password change can occur during remediation; Microsoft documents that this password-change flow does not use SSPR.
- Do not remove the hybrid password-writeback prerequisite for synchronized password users.
- Do not silently add a guest/external exclusion that is not part of IAMAI-resolved authority; block and surface the incompatibility instead.
- Do not combine user risk and sign-in risk in one policy.
- Do not use the retiring legacy ID Protection user-risk policy.

## State variants
- **Prerequisite required:** show only the unmet MFA-registration, hybrid-writeback, guest/external-scope, or active-risk preparation work; do not emit a CA mutation that is ready for enforcement.
- **Missing:** create the retained shape in Report-only.
- **Partial:** correct only IAMAI-classified mismatches by stable tenant policy ID.
- **Report-only:** verify exact shape and investigate active-risk/readiness evidence.
- **Ready to enforce:** enable the same stable policy only after prerequisite checks are complete.
- **In place / blocked / needs decision / source conflict / not licensed:** no actionable implementation.

## Verification
Read the exact policy by stable tenant ID and verify All users + resolved exclusions, All resources with no app exclusions, High user risk only, riskRemediation + resolved authentication strength with AND, Every-time sign-in frequency, absence of noncanonical effective conditions, and intended lifecycle. Confirm in-scope users have MFA registered, hybrid users can write passwords back when applicable, and guest/external accounts are not relying on unsupported risk remediation. Review active risky-user evidence before enforcement and after remediation.

## Rollback / safe recovery
Set the same stable policy back to Report-only. Do not delete the policy or broaden exclusions as the first response. If a legitimate user cannot remediate, use the approved administrator risk-remediation/recovery process and correct the prerequisite; do not silently weaken the baseline grant.

## Limitations / unknowns
Risk is dynamic. Report-only cannot prove every future user can complete remediation. Passwordless and password-based users can receive different remediation experiences. Guest/external users are not supported by Require risk remediation. Whether a hybrid tenant needs password writeback depends on which users are actually synchronized/in scope. SSPR remains useful for recovery but is not itself the Conditional Access risk-remediation mechanism.

## Source verification
The retained member is stable ID `544cd9ef-5e37-4568-9ad8-b8e151be1814`. Available retained-source evidence shows High user risk, All resources, adaptive `riskRemediation`, a custom/baseline authentication strength, Every-time sign-in frequency, and enabled lifecycle. Current Microsoft documentation now explicitly supports `riskRemediation` in Graph v1.0, requires it to be paired with authentication strength using AND, and documents that the remediation password-change path does not use SSPR. This corrects the workbook's older universal-SSPR prerequisite without changing the retained baseline destination.
