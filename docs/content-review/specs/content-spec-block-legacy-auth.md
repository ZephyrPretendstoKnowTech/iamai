# Content spec: Block Legacy Authentication

**Step ID:** `s-goal-block-legacy-auth`
**Package:** `docs/implementation-content/s-goal-block-legacy-auth/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Block Legacy Authentication — No change.
- Badge: Ready · Correct, Enforced — No change.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
Legacy protocols skip MFA; this also moves everyone off the built-in phone mail apps (ActiveSync), even with modern sign-in. Learn →

TARGET →
No change. Clear, plain-language explanation of why legacy auth is dangerous and what changes for users.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established"
- Expanded content:

CURRENT →
IAMAI cannot establish exactly who this reaches: this scan could not settle the policy's scope, so no count is shown.

TARGET →
No change. Explains why the count is missing.

### Tile 2: MAIL-SENDING DEVICES

- Icon: "!" — No change.
- Label: MAIL-SENDING DEVICES — No change.
- Collapsed summary: "Confirm" — No change. The tech needs to confirm whether mail-sending devices exist.
- Expanded content: None visible beyond the collapsed summary.

### Tile 3: PREREQUISITE · READY

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct Exclusions Group" (truncated to "Create or Correct E…" in the tile)

CURRENT →
Create or Correct Exclusions Group

TARGET →
No change. Cross-reference is clear. Truncation is a display constraint, not a content issue.

---

## Readiness bar

CURRENT →
Needs correction

TARGET →
No change. Correct status for a policy that exists but needs fixing.

### Readiness explanation

CURRENT →
Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.

TARGET →
Finish the Create or Correct Exclusions Group step first: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step.

Reason: C12 — "only your Save makes it the one this policy excludes" is internal IAMAI language. Simplified.

---

## Milestone / action column

- Milestone:

CURRENT →
Ready · Correct

TARGET →
[Date should appear here, not lane substatus]

**Global issue C2**: Milestone shows lane substatus "Ready · Correct" instead of a date.

- Milestone sub-text:

CURRENT →
No printer, scanner or application sent mail by SMTP since Aug 13, 2026. Is there one? A device that sends by SMTP AUTH stops when this is enforced.

TARGET →
No change. Clear, specific, and actionable — tells the tech exactly what to check.

- Inputs:

**Mail-sending devices radio:**

CURRENT →
- None
- Yes: add: [search box]
- "; the service-accounts group carries them"

TARGET →
- None — no devices in this tenant send mail by SMTP
- Yes: add: [search box] — list every printer, scanner, or application that sends mail by SMTP AUTH

Reason: C10 — radio options need explanation suffixes.

The note "; the service-accounts group carries them" is unclear.

CURRENT →
; the service-accounts group carries them

TARGET →
Added devices are placed in the service-accounts group, which is excluded from this policy.

Reason: The semicolon-prefixed fragment is confusing. Explain what happens when devices are added.

- Save button: Present. ✓

---

## Implementation — Entra channel

CURRENT →
Open the exact resolved policy by stable tenant ID 00000000-0000-0000-0000-000000000001. If it is On, move that same policy to Report-only before changing any access-affecting assignment or condition. Replace the complete conditions object with the IAMAI-resolved canonical target; do not create a replacement policy.

Re-open the same policy by stable ID, verify the corrected fields against the canonical target, and rescan IAMAI. Any policy staged to Report-only stays there until a separate Ready-to-enforce state is reached.

TARGET →
1. In Entra admin center → Protection → Conditional Access → Policies, find the existing policy named for legacy authentication blocking.
2. If the policy is currently On (Enforced), switch it to Report-only before making changes.
3. Under Conditions → Client apps, confirm only "Exchange ActiveSync clients" and "Other clients" are checked.
4. Under Users → Include, confirm "All users" is selected.
5. Under Users → Exclude, confirm the exclusions group from the Create or Correct Exclusions Group step is listed.
6. Under Grant, confirm "Block access" is selected.
7. Leave the policy in Report-only.
8. Click Save, then rescan in IAMAI.

Reason: C6 — the current text is developer-spec language ("stable tenant ID", "resolved policy", "IAMAI-resolved canonical target", "conditions object"). Rewritten as a portal walkthrough a help desk tech can follow.

---

## Implementation — AI Info channel

CURRENT →
Policy 00000000-0000-0000-0000-000000000001 has these mismatches for Block Legacy Authentication: conditions.canonical. Explain only the smallest API-safe corrections. If an access-affecting change is needed while the policy is On, stage the same policy to Report-only first.

TARGET →
This tenant already has a legacy-authentication-blocking policy, but it does not match the baseline. The corrections are to the policy's conditions (which client apps and users it covers). If the policy is currently enforced, switch it to Report-only before making changes, then correct the conditions to match the baseline target.

Reason: C6/C7 — "Policy 00000000-…", "conditions.canonical", "API-safe corrections" are developer terms. Rewritten for a tech audience.

---

## Done when

CURRENT →
The policy is enforced in GetIAMAI and matches the baseline's target: it blocks legacy authentication for all users, excludes the exclusions group, and every mail-sending device is accounted for.

TARGET →
The policy is enforced and matches the baseline: it blocks legacy authentication for all users, excludes the exclusions group, and every mail-sending device is accounted for.

Reason: "in GetIAMAI" — the policy is enforced in Entra, not "in GetIAMAI." Removed the product name.

---

## Links

- Learn → https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-policy-block-legacy — Correct. ✓
- Cross-reference: "Open Create or Correct Exclusions Group" → #/plan/s-prereq-exclusion-group — Correct. ✓
- Microsoft Learn (footer) → same URL — Correct. ✓

---

## Buttons

- Defer this step: Present. ✓
- Scan to update the plan: Present. ✓
- Doesn't apply here: Not present. Correct — blocking legacy auth applies to every tenant.

---

## Global issues

- C2: Milestone shows "Ready · Correct" instead of a date.
- C6: Entra implementation is developer-spec language — full rewrite above.
- C6/C7: AI Info uses policy GUIDs and API terms — rewrite above.
- C7: "GetIAMAI" in Done When — fix above.
- C10: Radio options need explanation suffixes — fix above.
- C12: Readiness explanation uses internal "only your Save" language — fix above.
- Service-accounts note is a confusing semicolon-prefixed fragment — fix above.
