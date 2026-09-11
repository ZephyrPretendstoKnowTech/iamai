# Challenge High-Risk Sign-ins

## Goal
Challenge **high-risk sign-ins** with fresh authentication using the owner-selected first-enforcement grant, while preserving the retained baseline's final stronger authentication destination and exact high-risk scope.

## Why this exists
Microsoft Entra ID Protection evaluates sign-in risk in real time. A Conditional Access policy can require the user to prove the sign-in is legitimate before access continues. IAMAI's retained baseline separates this high-risk step from the later medium-risk step and supports a deliberate initial rollout choice so users who are not yet ready for the stronger baseline requirement are not silently locked out.

## Applies when
Use this step when Microsoft Entra ID P2/ID Protection is licensed for the in-scope population, IAMAI has resolved canonical exclusions and the current policy identity/state, and the saved **First enforcement** choice is available. If the saved choice is unavailable, render `needsDecision` with no mutation output.

## Do not show implementation when
Do not render actionable implementation for `blocked`, `needsDecision`, `sourceConflict`, `notLicensed`, or `inPlace`. Never guess the First-enforcement choice. Never update by display name.

## Prerequisites
- Microsoft Entra ID P2 (or qualifying Entra Suite capability) covers the in-scope users for risk-based Conditional Access.
- In-scope users have authentication methods capable of satisfying the **selected initial grant** before enforcement.
- IAMAI has the stable tenant policy ID for update states and canonical exclusions.
- If the selected mode is `baselineStrength`, IAMAI has resolved the tenant authentication-strength object that represents the retained baseline destination, including its exact allowed combinations where available.
- Risky-sign-in evidence/readiness is reviewed without treating absence of recent risk as proof that no future risk will occur.

## Owner decisions
The retained baseline pin `8461e0f2fd10167bf034e7c20ed8ea293827d890` remains authoritative. The saved **First enforcement** decision supports exactly two implementation modes already defined by IAMAI:
1. `baselineStrength` — require the retained baseline authentication strength from the start.
2. `plainMfa` — start with plain MFA, then raise to the retained baseline strength once readiness permits.

The supplied/retrieved project authority does not reveal which option the owner selected. Therefore this package **does not choose one**. Actionable projections require `decision.signInRisk.firstEnforcementMode`.

## Current-state inputs
IAMAI may use risky-sign-in evidence, active population, canonical exclusions, current policy, resolved authentication strength, MFA/passkey readiness, push-only counts, the saved First-enforcement decision, and blockers already known to the product. Unknown evidence stays Unknown.

## Target state
Common policy shape:
- Users: All users with IAMAI-resolved canonical exclusions.
- Target resources: All resources.
- Client apps: All.
- Sign-in risk: **High only** for this step.
- No user-risk, service-principal-risk, location, platform, device/filter, authentication-flow, or user-action condition.
- Session: Sign-in frequency = **Every time** using primary and secondary authentication.
- Lifecycle: Report-only before enforcement, then On.

Selected initial grant:
- `baselineStrength`: Require the IAMAI-resolved retained-baseline authentication strength.
- `plainMfa`: Require multifactor authentication for the initial rollout. This is an intentional temporary rung, not the final baseline destination.

## Security-significant fields
Population/exclusions, All-resources target, High sign-in-risk condition, selected grant mode and exact strength ID/allowed combinations when applicable, Every-time session control, and lifecycle state are security-significant. The First-enforcement choice is itself security-significant and must not be defaulted.

## Preserve
Preserve the owner's saved First-enforcement choice, canonical exclusions, exact High-only scope for this step, and the separate medium-risk step. Preserve the final baseline authentication-strength destination even when initial rollout uses plain MFA.

## Do not do
- Do not broaden this step from High to Medium+High merely because current Microsoft general guidance commonly recommends Medium and High; IAMAI has a separate medium-risk step.
- Do not guess `baselineStrength` or `plainMfa` when the saved choice is unavailable.
- Do not reduce a custom/baseline strength to a generic phishing-resistant label when exact allowed combinations matter.
- Do not implement the retiring legacy ID Protection risk policy. Microsoft says legacy risk policies retire **October 1, 2026**; use Conditional Access.
- Do not treat no recent risky sign-ins as proof the policy is unnecessary.

## State variants
- **Needs decision:** show the existing First-enforcement choice and no actionable mutation until the saved selection is available.
- **Missing:** create the selected variant in Report-only.
- **Partial:** correct only IAMAI-classified mismatches; the grant correction must follow the saved First-enforcement mode.
- **Report-only:** verify the selected canonical shape and review risky-sign-in/readiness evidence.
- **Ready to enforce:** enable the same stable policy only after selected-grant readiness is acceptable.
- **In place / blocked / source conflict / not licensed:** no actionable implementation.

## Verification
Read back the exact policy by stable tenant ID. Verify All users + canonical exclusions, All resources, client apps All, sign-in risk High only, selected grant variant, Every-time sign-in frequency, absence of noncanonical conditions/controls, and lifecycle. Review ID Protection risky sign-ins and confirm users can satisfy the selected grant. After enforcement, validate with a safe test/real risk event when available; do not manufacture a risky sign-in claim.

## Rollback / safe recovery
Set the same stable policy back to Report-only. Do not delete it or broaden exclusions as the first response. If the initial mode is `baselineStrength` and readiness proves insufficient, moving to `plainMfa` is allowed only when that matches the saved/updated owner decision; never downgrade automatically.

## Limitations / unknowns
Risk detections are dynamic and not guaranteed to appear during a test window. Report-only can help evaluate policy impact but cannot prove every future risky sign-in will successfully self-remediate. Authentication-strength readiness depends on exact allowed method combinations. The owner's selected First-enforcement value is currently unavailable to this authoring run, so actionable output is intentionally gated until the existing decision is supplied.

## Source verification
Current Microsoft documentation confirms sign-in-risk Conditional Access, P2 licensing, MFA/authentication-strength grants, Every-time sign-in frequency, Graph v1.0 risk fields, and the October 1, 2026 retirement of legacy ID Protection risk policies. Microsoft commonly recommends Medium+High risk, but the retained IAMAI baseline splits Medium into a separate later step, so this package preserves High-only scope.
