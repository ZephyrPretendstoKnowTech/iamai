# Challenge Medium-Risk Sign-ins

## Goal
Require MFA when Microsoft rates a sign-in **Medium risk**, using the retained baseline's separate medium-risk rung without accidentally broadening the high-risk policy or collapsing both risk levels into one policy.

## Why this exists
Medium sign-in risk catches suspicious authentication attempts before they rise to High. This retained baseline implements Medium as its own policy so the organization can stage and reason about that rung independently from Challenge High-Risk Sign-ins.

## Applies when
IAMAI identifies this baseline goal as missing, partial, Report-only, or ready to enforce and Microsoft Entra ID P2/qualifying ID Protection capability is available.

## Do not show implementation when
Do not emit actionable implementation when IAMAI marks the step In place, Blocked, Needs decision, Source conflict, or Not licensed.

## Prerequisites
- Microsoft Entra ID P2 or qualifying ID Protection capability for in-scope users.
- In-scope users must have an MFA method registered before relying on sign-in-risk self-remediation.
- Preserve the separate High-risk policy; this Medium step must complement it rather than absorb High risk.
- Investigate material active risk before broad enforcement.

## Owner decisions
No new owner decision is authored. The current Jon Hope pin remains authoritative. Do not merge Medium and High merely because Microsoft's generic recommendation commonly configures them together.

## Current-state inputs
Current matching policy and stable tenant ID; semantic mismatches; tenant-resolved exclusions; Medium-risk sign-in evidence; MFA readiness; current High-risk policy state/scope; licensing; lifecycle evidence.

## Target state
- Users: All users with IAMAI-resolved canonical exclusions.
- Target resources: All resources.
- Client apps: All.
- Sign-in risk: Medium only.
- User risk: none.
- No location, platform, device/filter, authentication-flow, or workload-risk condition.
- Grant: built-in **Require multifactor authentication**, operator OR.
- Session controls: none in the retained baseline member.
- Lifecycle: Report-only before enforcement, then On.

## Security-significant fields
Population/exclusions, All-resources target, Medium-only sign-in-risk condition, built-in MFA grant, absence of a session control in this retained member, separation from the High-risk policy, and lifecycle state are security-significant.

## Preserve
Preserve stable policy identity, the exact Medium-only threshold, canonical exclusions, built-in MFA grant, the separate High-risk step, and the retained member's lack of session controls.

## Do not do
- Do not broaden this policy to High + Medium; IAMAI authors High separately.
- Do not replace the retained built-in MFA grant with an authentication-strength grant unless the baseline/owner authority changes.
- Do not add Sign-in frequency = Every time solely because current Microsoft generic guidance recommends it. The pinned baseline member has no session control; adding one here would redesign the baseline.
- Do not treat no Medium-risk events in the observation window as proof the policy is unnecessary.
- Do not use the retiring legacy ID Protection sign-in-risk policy.

## State variants
- **Missing:** create the retained Medium-only policy in Report-only.
- **Partial:** correct only IAMAI-classified mismatches by stable tenant policy ID.
- **Report-only:** verify exact shape, Medium-risk evidence, MFA readiness, and separation from the High-risk policy.
- **Ready to enforce:** enable the same stable policy.
- **In place / blocked / needs decision / source conflict / not licensed:** no actionable implementation.

## Verification
Read back by stable tenant policy ID. Verify All users + canonical exclusions, All resources, client apps All, Sign-in risk Medium only, no user-risk or other noncanonical effective condition, built-in MFA with OR, **no session controls**, and intended lifecycle. Confirm the High-risk policy remains independently scoped to High and review Medium-risk sign-in evidence/MFA readiness.

## Rollback / safe recovery
Set the same stable policy back to Report-only. Do not delete it or merge its risk threshold with the High policy as a rollback shortcut.

## Limitations / unknowns
Risk occurrence is dynamic. Report-only can inform impact but cannot guarantee a future risky sign-in will remediate cleanly. Current Microsoft guidance generally recommends Medium + High with MFA and recommends Every-time reauthentication; this package intentionally preserves the retained IAMAI baseline's split Medium-only policy and no-session shape.

## Source verification
The retained member is stable ID `180ab5a3-d3ae-4457-9ef1-e3c06f5dfbfc`. Available retained-source evidence shows All resources, All client apps, Medium sign-in risk only, built-in MFA, Report-only, and `sessionControls: null`. Current Microsoft guidance supports Medium-risk MFA and recommends combining Medium + High plus Every-time reauthentication, but the pinned baseline is the higher implementation authority. Therefore the workbook brief's sign-in-frequency wording is not implemented for this step.
