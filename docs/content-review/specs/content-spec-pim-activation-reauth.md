# Content spec: Require MFA at Every Role Activation

**Step ID:** `s-goal-pim-activation-reauth`
**Package:** `docs/implementation-content/s-goal-pim-activation-reauth/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Require MFA at Every Role Activation — No change.
- Badge: Up Next · After Create the Baseline's Authentication Strength — No change. Correct dependency label.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
Role activation is the moment an account becomes powerful; a fresh prompt there is cheap and stops a hijacked session activating anything. PIM for Groups and Azure resource roles can use the same authentication context. Learn →

TARGET →
No change. Clear explanation of why re-authentication at role activation matters. The PIM for Groups note is useful context.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established" — No change.
- Expanded content: (Same as other "Not established" tiles — IAMAI could not settle scope.)

### Tile 2: PREREQUISITE · READY — Create or Correct Exclusions Group

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct E…" (truncated) — No change. Display constraint.

### Tile 3: PREREQUISITE · READY — Create the Baseline's Authentication Strength

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create the Baseline's …" (truncated) — No change.

---

## Readiness bar

CURRENT →
After Create the Baseline's Authentication Strength

TARGET →
No change. Correct — this step is blocked until the auth strength prerequisite is done.

### Readiness explanation

CURRENT →
Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes. Create the Baseline's Authentication Strength first: this policy names an object GetIAMAI does not have yet.

TARGET →
Finish the Create or Correct Exclusions Group step first: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step. Finish the Create the Baseline's Authentication Strength step first: this policy requires an authentication strength that does not exist in the tenant yet.

Reason: C12 — "only your Save makes it the one this policy excludes" is internal language. C7 — "an object GetIAMAI does not have yet" uses the product name where it should reference the tenant.

---

## Milestone / action column

- Milestone:

CURRENT →
Up Next · After Create the Baseline's Authentication Strength

TARGET →
[Date should appear here, not lane substatus]

**Global issue C2**: Milestone shows lane substatus instead of a date.

- Milestone sub-text: Not visible (truncated in data capture, likely a brief action description).
- No inputs visible — this step has no decision picker. Correct for a new-policy step.
- No Save button in the action column. Correct — nothing to save until prerequisites are met.

---

## Implementation — Entra channel

CURRENT →
Entra admin center → Entra ID → Conditional Access → Policies → New policy.

Name: Core - Require - MFA at every role activation.
Users: Include All users; exclude IAMAI's canonical exclusion groups.
Target resources → Authentication context: ‹authentication context name› (‹authentication context ID›).
Conditions: no additional risk, location, platform, device, or authentication-flow condition.
Grant: Grant access → Require authentication strength → IAMAI-resolved target strength.
Session → Sign-in frequency → Every time.
Enable policy: Report-only.

Save, read back, and rescan IAMAI. Do not configure PIM role settings yet.

TARGET →
1. In Entra admin center → Protection → Conditional Access → Policies, click New policy.
2. Name: Core - Require - MFA at every role activation.
3. Under Users → Include, select All users.
4. Under Users → Exclude, add the exclusions group you confirmed in the Create or Correct Exclusions Group step.
5. Under Target resources, select Authentication context, then choose the authentication context created in the authentication strength step.
6. Leave all Conditions unchecked (no risk, location, platform, device, or authentication-flow conditions).
7. Under Grant, select Grant access → Require authentication strength, then choose the authentication strength you created in the earlier step.
8. Under Session, set Sign-in frequency to Every time.
9. Set Enable policy to Report-only.
10. Click Save, then rescan in IAMAI.

Do not configure PIM role settings yet — that happens after this policy is validated and moved to Enforced.

Reason: C1/C7 — "IAMAI's canonical exclusion groups", "‹authentication context name›", "IAMAI-resolved target strength" are internal placeholders. Rewritten as step-by-step portal instructions referencing the prerequisite steps by name.

---

## Implementation — AI Info channel

CURRENT →
ROLE: Help implement the IAMAI step Require MFA at Every Role Activation. Create the dedicated CA policy in Report-only; do not change PIM yet.

AUTHORITY: The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT: Tenant: GetIAMAI. Authentication context: ‹authentication context name› / ‹authentication context ID›. Blockers: [list of prerequisite steps].

SAFETY ORDER: Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. [continues]

TARGET →
This step creates a Conditional Access policy that requires strong authentication every time someone activates a privileged role through PIM. The policy targets an authentication context (created in the authentication strength step) and requires the baseline's authentication strength.

Safety order: Create the authentication context first → create this CA policy in Report-only → validate it works → move to Enforced → only then update PIM role settings to require the authentication context on activation.

Do not change PIM role settings until this CA policy is enforced — PIM's built-in MFA prompt does not fire when a matching Conditional Access policy already handles authentication.

Prerequisites: the exclusions group must be confirmed, the authentication strength must be created, and the emergency access accounts must be set up.

Reason: C7 — "retained IAMAI baseline/package", "canonical", "GetIAMAI" throughout. The ROLE/AUTHORITY/TENANT CONTEXT/SAFETY ORDER structure is developer scaffolding. Rewritten as a plain explanation of what the step does and why the order matters.

---

## Done when

CURRENT →
The policy is enforced in GetIAMAI, not in report-only, with its authentication context assigned, and the Privileged Identity Management role settings require that context on activation.

TARGET →
The policy is enforced (not in Report-only), with the authentication context assigned, and PIM role settings require that context on every activation.

Reason: "in GetIAMAI" — removed product name. Minor: spelled out what PIM abbreviation means on first use (already in the Why section, so abbreviation is fine here).

---

## Links

- Learn → https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-how-to-change-default-settings — Correct. ✓
- Cross-reference: "Open Create or Correct Exclusions Group" → correct. ✓
- Cross-reference: "Open Create the Baseline's Authentication Strength" → correct. ✓
- Microsoft Learn (footer) → same URL. ✓

---

## Buttons

- Defer this step: Present. ✓
- Scan to update the plan: Present. ✓
- Doesn't apply here: Not present. Could be appropriate if a tenant doesn't use PIM, but the baseline includes it, so no change.

---

## Global issues

- C2: Milestone shows "Up Next · After Create the Baseline's Authentication Strength" instead of a date.
- C6: Entra implementation uses placeholder tokens ("‹authentication context name›", "IAMAI-resolved target strength") instead of referencing prerequisite steps by name.
- C7: AI Info is developer scaffolding with "retained IAMAI baseline/package", "canonical", "GetIAMAI" — full rewrite above.
- C7: Done When says "in GetIAMAI" — fix above.
- C12: Readiness explanation uses "only your Save" language — fix above.
