# Review Baseline Policies IAMAI Did Not Assess

## Goal
Give the administrator a safe, concrete review path for every policy in Jon Hope's retained baseline that IAMAI cannot classify or compare with sufficient semantic confidence.

## Why this exists
The retained baseline contains policies with semantics IAMAI intentionally does not judge automatically, including policy shapes such as device filters, authentication contexts, workload identities, and agent-related conditions. Treating those policies as equivalent, missing, or safe to synthesize would turn an unsupported reading into a security decision.

## Applies when
IAMAI's current pinned-baseline inventory contains one or more policies assigned to the unassessed Cleanup set.

## Do not show implementation when
Do not show actionable implementation when the unassessed list is empty, the cleanup row is already complete, the active baseline source is unavailable, or the source policy itself is in conflict/corrupt. Do not offer a create path from memory, a generic template, or a different baseline.

## Prerequisites
- Use the retained Jon Hope pin `8461e0f2fd10167bf034e7c20ed8ea293827d890`.
- Load the exact unassessed-policy rows from IAMAI's current pinned-baseline package.
- Keep each policy's stable source identity, display name, source file/path, exact source JSON, and any IAMAI-known unsupported-semantic reason together.
- Have enough tenant/licensing context to decide applicability. Unknown context stays Unknown.
- Review one source policy at a time.

## Owner decisions
Applicability is a human decision for each unassessed source policy. The operator may either:
- decide that the source policy applies and implement it from the exact pinned source; or
- mark it "does not apply here" with a concrete reason.

No package-authored default chooses either outcome.

## Current-state inputs
Exact unassessed baseline policy list; exact pinned source objects; source paths/stable keys; IAMAI-known unsupported semantic fields/reasons when available; tenant/licensing context already known to IAMAI; saved per-policy applicability decisions.

## Target state
Every unassessed source policy has an explicit disposition:
- **Applicable:** manually reproduced from the exact retained source, with only tenant-resolved placeholders substituted, initially left in Report-only when Conditional Access supports that lifecycle, then separately validated.
- **Does not apply:** recorded with an operator reason.
- **Still unknown:** remains open; IAMAI does not claim equivalence or completion.

## Security-significant fields
Every field IAMAI does not understand well enough to classify is security-significant by definition. The source population, exclusions, target resources, filters, authentication contexts, workload/agent targeting, grants, session controls, lifecycle, and any placeholder substitutions must remain faithful to the retained source.

## Preserve
Preserve the exact pinned source artifact, stable source identity, source provenance, operator disposition/reason, and all fields IAMAI cannot safely translate.

## Do not do
- Do not manufacture a PowerShell implementation.
- Do not convert source-only JSON into a claimed deployable artifact.
- Do not substitute a generic Conditional Access template for the pinned policy.
- Do not silently drop fields IAMAI cannot assess.
- Do not infer "does not apply" from lack of sign-in evidence.
- Do not reuse an author-tenant object ID as if it were a valid object ID in the target tenant.
- Do not turn an unassessed source policy On as part of this cleanup step.

## State variants
- **Review required:** show the exact unassessed list, source-only JSON bundle, manual review procedure, AI review handoff, and optional review-request email.
- **Complete:** every source row has an explicit disposition and any applicable implementation has been separately validated; no implementation viewer.
- **Blocked / source conflict:** no actionable implementation.

## Verification
For each applicable policy, compare the created tenant policy side-by-side with the exact pinned source semantics after tenant placeholders are resolved. Confirm no source condition or control disappeared in translation. Use Report-only/sign-in evidence and the What If tool only where Microsoft supports those evaluation paths; neither proves semantics IAMAI itself cannot read. Rescan IAMAI and keep the row unassessed until a human disposition is recorded.

## Rollback / safe recovery
If a manually created policy behaves unexpectedly, return that exact tenant policy to Report-only or Off using its tenant stable ID. Preserve the source record and review decision history. Do not delete or weaken unrelated policies.

## Limitations / unknowns
IAMAI intentionally cannot verify equivalence for these rows. This package gives the operator source fidelity and a review workflow; it does not create a new classifier. The exact membership of the unassessed set must come from the active retained baseline, not from a hardcoded list in this package.

## Source verification
Workbook Order 45 is `cleanup-notAssessed`. The retained implementation framework classifies this as `baseline-source-review`, with Entra/manual review output, source-only JSON, and no PowerShell. Existing product authority states that unassessed rows may include device filters, authentication contexts, workload identities, and agent policies. The retained baseline audit accounts for 38 policies as 23 mapped policy keys across 22 goals, one recorded variant, and 14 unassessed Cleanup rows. Microsoft documentation confirms Report-only and What If are validation aids, not substitutes for faithfully understanding a policy's conditions.
