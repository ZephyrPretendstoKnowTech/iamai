# Content spec: Protect Sign-in Method Registration

**Step ID:** `s-goal-register-info-protected`
**Package:** `docs/implementation-content/s-goal-register-info-protected/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Protect Sign-in Method Registration — No change.
- Badge: Up Next · After Create the Baseline's Authentication Strength — No change.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
An attacker with a password adds their own method and keeps the account; the baseline allows registration only from the trusted network. Learn →

TARGET →
No change. Clear explanation: a stolen password lets an attacker register their own MFA method unless registration is restricted. The baseline restricts it to the trusted network.

---

## Readiness tiles

### Tile 1: THRESHOLD

- Icon: "!" — No change.
- Label: THRESHOLD — No change.
- Collapsed summary: "33%"

CURRENT →
33%

TARGET →
33% — 1 of 3 people can meet this policy's sign-in requirement today

Reason: C5 — threshold percentage needs context suffix so the tech knows what 33% means.

### Tile 2: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established" — No change.

### Tile 3: PREREQUISITE · READY — Create or Correct Exclusions Group

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct Exclusions Group" — No change.

### Tile 4: PREREQUISITE · READY — Define the Trusted Network

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Define the Trusted Network" — No change.

### Tile 5: PREREQUISITES

- Icon: "!" — No change.
- Label: PREREQUISITES — No change.
- Collapsed summary: "when 1 trusted location exist (now 0)"

CURRENT →
when 1 trusted location exist (now 0)

TARGET →
Needs 1 trusted location (currently 0)

Reason: Grammar fix ("exist" → implied), and the "when" prefix is confusing. Rewritten as a clearer status.

### Tile 6: PREREQUISITE · READY — Create the Baseline's Authentication Strength

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create the Baseline's Authentication Strength" — No change.

---

## Readiness bar

CURRENT →
After Create the Baseline's Authentication Strength

TARGET →
No change. Correct — this step is blocked until the auth strength prerequisite is done.

### Readiness explanation

CURRENT →
Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.

TARGET →
Finish the Create or Correct Exclusions Group step first: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step.

Reason: C12 — "only your Save makes it the one this policy excludes" is internal language.

### MFA Readiness link

CURRENT →
This scan could not work out who cannot meet this step's sign-in requirement yet. Open MFA Readiness →

TARGET →
No change. Clear — directs the tech to MFA Readiness for more information.

---

## Milestone / action column

- Milestone:

CURRENT →
Up Next · After Create the Baseline's Authentication Strength

TARGET →
[Date should appear here, not lane substatus]

**Global issue C2**: Milestone shows lane substatus instead of a date.

- No inputs or Save button visible. Correct — prerequisites must be completed first.

---

## Implementation — Entra channel

CURRENT →
Open Entra ID > Conditional Access > Policies > New policy.
Name: Core - Require - Security info registration.
Configure exactly this canonical scope: Target resources > User actions > Register security information. Apply the exact IAMAI-resolved Users/exclusions and Location mode. blockOutsideTrusted means Any location with All trusted locations excluded; the no-trusted-network fallback uses the resolved MFA target instead.
Grant/access control: Use ‹registration access control› exactly as resolved by IAMAI and match the canonical grant. Do not improvise a third mode.
Leave session controls unconfigured; this package's canonical sessionControls target is null.
Set Enable policy: Report-only and create it.
Re-open the created policy, compare it with the IAMAI target, then rescan.

TARGET →
1. In Entra admin center → Protection → Conditional Access → Policies, click New policy.
2. Name: Core - Require - Security info registration.
3. Under Target resources, select User actions → Register security information.
4. Under Users → Include, select All users.
5. Under Users → Exclude, add the exclusions group you confirmed in the Create or Correct Exclusions Group step.
6. Under Conditions → Locations, select Any location and exclude All trusted locations. (If no trusted location exists yet, use the MFA requirement from the Grant control instead.)
7. Under Grant, select the access control that matches the baseline — either Block access (outside trusted locations) or Require authentication strength (when no trusted location is defined).
8. Leave Session controls empty.
9. Set Enable policy to Report-only.
10. Click Save, then rescan in IAMAI.

Reason: C6/C7 — "canonical scope", "IAMAI-resolved Users/exclusions", "blockOutsideTrusted", "canonical grant", "canonical sessionControls target is null", "‹registration access control›" are all developer-spec or internal terms. Rewritten as numbered portal steps. The two-mode logic (trusted-network vs. MFA fallback) is explained in plain language.

---

## Implementation — AI Info channel

CURRENT →
Review the proposed Protect Sign-in Method Registration implementation for GetIAMAI. Confirm the canonical target is complete, tenant-resolved, Report-only first, and contains no invented exclusions or source-tenant IDs.

TARGET →
This step creates a Conditional Access policy that restricts where users can register new MFA methods. In the baseline, registration is only allowed from the trusted network. If no trusted network is defined yet, the policy instead requires the baseline's authentication strength at registration.

Review the proposed policy to confirm: it targets the "Register security information" user action, includes all users, excludes only the confirmed exclusions group, uses the correct location or grant control, and is set to Report-only.

Reason: C7 — "GetIAMAI", "canonical target", "tenant-resolved", "source-tenant IDs" are internal terms. Rewritten to explain what the policy does and what to verify.

---

## Done when

CURRENT →
The policy is enforced in GetIAMAI.

TARGET →
The policy is enforced and matches the baseline: it restricts MFA method registration to the trusted network (or requires the baseline's authentication strength if no trusted network is defined), for all users except the exclusions group.

Reason: "in GetIAMAI" removed. The current Done When is also too generic — it doesn't name the specific conditions. Expanded to be specific to this step.

---

## Links

- Learn → (URL not captured in data, but link is present) — Verify URL is correct.
- Cross-reference: "Open Create or Correct Exclusions Group" — present. ✓
- Cross-reference: "Open Create the Baseline's Authentication Strength" — present. ✓
- Cross-reference: "Open Define the Trusted Network" — verify present.
- MFA Readiness → link present. ✓
- Microsoft Learn (footer) — present. ✓

---

## Buttons

- Defer this step: Present. ✓
- Scan to update the plan: Present. ✓
- Doesn't apply here: Not present. Correct — registration protection is always applicable.

---

## Global issues

- C2: Milestone shows lane substatus instead of a date.
- C5: THRESHOLD tile "33%" needs context suffix — fix above.
- C6: Entra implementation is developer-spec language with canonical/resolved terms — full rewrite above.
- C7: AI Info uses "GetIAMAI", "canonical target", "tenant-resolved" — rewrite above.
- C7: Done When says "in GetIAMAI" and is too generic — fix above.
- C12: Readiness explanation uses "only your Save" language — fix above.
- Tile 5 has grammar issue: "when 1 trusted location exist (now 0)" — fix above.
