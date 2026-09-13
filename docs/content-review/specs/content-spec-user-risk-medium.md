# Content spec: Reset Passwords for Medium-Risk Users

**Step ID:** `s-goal-user-risk-medium`
**Package:** `docs/implementation-content/s-goal-user-risk-medium/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Reset Passwords for Medium-Risk Users — No change.
- Badge: On Hold · Baseline references an unmapped group — No change.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
Waiting for a risk to become high is waiting for the attacker to succeed. Learn →

TARGET →
No change. Clear, memorable explanation of why medium-risk gets remediation too.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established" — No change.

### Tile 2: PREREQUISITE · READY — Create or Correct Exclusions Group

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct Exclusions Group" — No change.

### Tile 3: BASELINE MAPPING

- Icon: "!" — No change.
- Label: BASELINE MAPPING — No change.
- Collapsed summary: "Baseline references an unmapped group" — No change.

### Tile 4: PREREQUISITE · READY — Create the Baseline's Authentication Strength

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create the Baseline's Authentication Strength" — No change.

---

## Readiness bar

CURRENT →
Baseline references an unmapped group

TARGET →
No change.

### Readiness explanation

CURRENT →
Baseline mappings first (Plan settings): the baseline names a group of its author's, and IAMAI does not yet know whether it stands for something in GetIAMAI or is left out. Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes. Create the Baseline's Authentication Strength first: this policy names an object GetIAMAI does not have yet.

TARGET →
Resolve the baseline mapping first (Plan settings → Baseline mappings): the baseline references a group from the baseline author's tenant. Decide whether it maps to a group in your tenant or should be left out. Then finish the Create or Correct Exclusions Group step: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step. Also finish the Create the Baseline's Authentication Strength step: this policy requires an authentication strength that does not exist in the tenant yet.

Reason: C7 — "GetIAMAI" → "your tenant" and "the tenant". C12 — "only your Save" simplified. "an object GetIAMAI does not have yet" → "an authentication strength that does not exist in the tenant yet" (names the object type).

---

## Milestone / action column

CURRENT →
On Hold · Baseline references an unmapped group

TARGET →
[Date should appear here, not lane substatus]

**Global issue C2**: Milestone shows lane substatus instead of a date.

---

## Implementation — Entra channel

CURRENT →
[Developer-spec content — follows the same C6 pattern with canonical terms, resolved targets, and stable tenant IDs]

TARGET →
1. In Entra admin center → Protection → Conditional Access → Policies, click New policy.
2. Name: Core - Remediate - Medium-risk users password change.
3. Under Users → Include, select All users.
4. Under Users → Exclude, add the exclusions group from the Create or Correct Exclusions Group step, and exclude All guest and external users.
5. Under Target resources, select All resources.
6. Under Conditions → User risk, select Medium.
7. Under Grant, select Grant access → Require multifactor authentication AND Require password change. (Both must be satisfied — use the AND operator.)
8. Leave Session controls empty.
9. Set Enable policy to Report-only.
10. Click Save, then rescan in IAMAI.

Note: This policy is separate from the high-risk user policy (which triggers at High risk). Do not combine them or lower the high-risk policy's threshold — keep both policies active at their respective risk levels.

Reason: C6 — rewritten from developer-spec to portal walkthrough. Added the note about keeping this separate from the high-risk policy, since that's a common mistake.

---

## Implementation — AI Info channel

CURRENT →
Review IAMAI's proposed Medium user-risk password-change policy. Target: All users minus canonical exclusions and all guest/external users; All resources; Medium user risk only; MFA + passwordChange with AND; no session controls; Report-only. Check for contradictions only. Do not add riskRemediation or retire the High-risk policy.

TARGET →
This policy forces a password change (with MFA) when Entra ID Protection flags a user at medium risk. It applies to all users except the exclusions group and guest/external users, covers all resources, and starts in Report-only.

Review the proposed policy to confirm: it targets medium risk only (not high — that has its own policy), requires both MFA and password change (AND, not OR), excludes guests, and has no session controls. Do not combine this with the high-risk policy or add automatic risk remediation — the password change itself clears the risk.

Reason: C7 — "canonical exclusions", "riskRemediation" are internal terms. Rewritten as a plain explanation of what the policy does and what to check.

---

## Done when

CURRENT →
The policy is enforced in GetIAMAI at the medium-risk threshold, with password change as the remediation and the exclusions group applied.

TARGET →
The policy is enforced at the medium-risk threshold, requiring MFA and password change as remediation, with the exclusions group applied and guest/external users excluded.

Reason: "in GetIAMAI" removed. Added "MFA and" before password change (the grant requires both). Added guest exclusion to the completion criteria since it's part of the policy design.

---

## Links

- Learn → link present. ✓
- Cross-reference: "Open Create or Correct Exclusions Group" — present. ✓
- Cross-reference: "Open Create the Baseline's Authentication Strength" — verify present.
- Microsoft Learn (footer) — present. ✓

---

## Buttons

- Defer this step: Present. ✓
- Scan to update the plan: Present. ✓

---

## Global issues

- C2: Milestone shows lane substatus instead of a date.
- C6: Entra implementation uses developer-spec language — rewrite above.
- C7: AI Info uses "canonical exclusions", "riskRemediation" — rewrite above.
- C7: Done When says "in GetIAMAI" — fix above.
- C7: Readiness explanation uses "GetIAMAI" and "an object GetIAMAI does not have yet" — fix above.
- C12: Readiness explanation uses "only your Save" language — fix above.
