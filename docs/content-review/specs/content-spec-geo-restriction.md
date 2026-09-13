# Content spec: Block Sign-ins From Countries Not Allowed

**Step ID:** `s-goal-geo-restriction`
**Package:** `docs/implementation-content/s-goal-geo-restriction/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Block Sign-ins From Countries Not Allowed — No change.
- Badge: On Hold · Baseline references an unmapped group — No change.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
Most automated attacks come from places the business never operates in, and a password that only works from United States is worth much less. Learn →

TARGET →
No change. Clear, explains geo-blocking value in plain terms. The country name ("United States") is tenant-specific and appropriate.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established" — No change.

### Tile 2: PREREQUISITE · READY — Create or Correct Allowed Countries Location

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct Allowed Countries Location" — No change.

### Tile 3: BASELINE MAPPING

- Icon: "!" — No change.
- Label: BASELINE MAPPING — No change.
- Collapsed summary: "Baseline references an unmapped group" — No change.

### Tile 4: PREREQUISITE · READY — Create or Correct Exclusions Group

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct Exclusions Group" — No change.

---

## Readiness bar

CURRENT →
Baseline references an unmapped group

TARGET →
No change.

### Readiness explanation

CURRENT →
Baseline mappings first (Plan settings): the baseline names a group of its author's, and IAMAI does not yet know whether it stands for something in GetIAMAI or is left out. Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes. Create or Correct Allowed Countries Location first: this policy uses a named location that does not exist yet.

TARGET →
Resolve the baseline mapping first (Plan settings → Baseline mappings): the baseline references a group from the baseline author's tenant. Decide whether it maps to a group in your tenant or should be left out. Then finish the Create or Correct Exclusions Group step: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step. Also finish the Create or Correct Allowed Countries Location step first: this policy uses a named location that does not exist yet.

Reason: C7/C12 — same pattern. "GetIAMAI" → "your tenant", "only your Save" simplified.

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
[Developer-spec content with canonical terms — follows the same C6 pattern. Full text references "IAMAI-resolved canonical target", named location by placeholder.]

TARGET →
1. In Entra admin center → Protection → Conditional Access → Policies, click New policy.
2. Name: Core - Block - Sign-ins from countries not allowed.
3. Under Users → Include, select All users.
4. Under Users → Exclude, add the exclusions group from the Create or Correct Exclusions Group step, and any accounts that legitimately sign in from outside allowed countries (e.g. travel accounts, partner accounts).
5. Under Target resources, select All resources.
6. Under Conditions → Locations → Include, select All locations.
7. Under Conditions → Locations → Exclude, select the allowed-countries named location you created in the Create or Correct Allowed Countries Location step.
8. Under Grant, select Block access.
9. Set Enable policy to Report-only.
10. Click Save, then rescan in IAMAI.

Important: During the Report-only observation period, check for VPN/proxy egress from unexpected countries, mobile roaming, and partner or contractor sign-ins from outside the allowed list before enforcing.

Reason: C6 — rewritten from developer-spec to portal walkthrough. Added the observation-period note since geo-blocking has high breakage risk.

---

## Implementation — AI Info channel

CURRENT →
Review the proposed Block Sign-ins From Countries Not Allowed implementation for GetIAMAI. Confirm the canonical target matches the pinned IAMAI destination, is fully tenant-resolved, starts Report-only, and contains no invented IDs or decisions. Check VPN/proxy/mobile egress and saved travel/partner decisions during observation.

TARGET →
This policy blocks sign-ins from any country not in your allowed list. It uses the named location created in the Create or Correct Allowed Countries Location step to define which countries are permitted.

Review the proposed policy to confirm: it blocks all locations except the allowed-countries location, applies to all users (minus the exclusions group), targets all resources, and starts in Report-only. During the observation period, watch for sign-ins blocked by VPN or proxy egress, mobile roaming, and partner or contractor access from outside the allowed countries.

Reason: C7 — "GetIAMAI", "canonical target", "pinned IAMAI destination" removed. Rewritten to explain what to verify and what to watch for.

---

## Done when

CURRENT →
The policy is enforced in GetIAMAI, blocking sign-ins from countries not in the allowed list, with the exclusions group applied and partner and travel exceptions addressed.

TARGET →
The policy is enforced, blocking sign-ins from countries not in the allowed list, with the exclusions group applied and partner and travel exceptions addressed.

Reason: "in GetIAMAI" removed.

---

## Links

- Learn → link present. ✓
- Cross-reference: "Open Create or Correct Exclusions Group" — present. ✓
- Cross-reference: "Open Create or Correct Allowed Countries Location" — verify present.
- Microsoft Learn (footer) — present. ✓

---

## Buttons

- Defer this step: Present. ✓
- Scan to update the plan: Present. ✓

---

## Global issues

- C2: Milestone shows lane substatus instead of a date.
- C6: Entra implementation uses developer-spec language — rewrite above.
- C7: AI Info uses "GetIAMAI", "canonical target", "pinned IAMAI destination" — rewrite above.
- C7: Done When says "in GetIAMAI" — fix above.
- C12: Readiness explanation uses "only your Save" language — fix above.
