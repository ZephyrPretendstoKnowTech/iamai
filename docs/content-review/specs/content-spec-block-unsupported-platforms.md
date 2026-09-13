# Content spec: Block Unsupported Device Platforms

**Step ID:** `s-goal-block-unsupported-platforms`
**Package:** `docs/implementation-content/s-goal-block-unsupported-platforms/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Block Unsupported Device Platforms — No change.
- Badge: On Hold · Baseline references an unmapped group — No change.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
Linux, and any platform Entra cannot identify, is blocked; that is where the device rules leak. Learn →

TARGET →
No change. Clear explanation — unrecognized platforms bypass device compliance rules.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established" — No change.

### Tile 2: BASELINE MAPPING

- Icon: "!" — No change.
- Label: BASELINE MAPPING — No change.
- Collapsed summary: "Baseline references an unmapped group" — No change.

### Tile 3: PREREQUISITE · READY

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
Baseline mappings first (Plan settings): the baseline names a group of its author's, and IAMAI does not yet know whether it stands for something in GetIAMAI or is left out. Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.

TARGET →
Resolve the baseline mapping first (Plan settings → Baseline mappings): the baseline references a group from the baseline author's tenant. Decide whether it maps to a group in your tenant or should be left out. Then finish the Create or Correct Exclusions Group step: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step.

Reason: C7/C12 — same pattern as other On Hold steps. "GetIAMAI" → "your tenant", "only your Save" simplified.

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
Open Entra ID > Conditional Access > Policies > New policy. [followed by developer-spec content with canonical terms — full text truncated in capture but follows the same C6 pattern as other enforced-correction steps]

TARGET →
1. In Entra admin center → Protection → Conditional Access → Policies, click New policy.
2. Name: Core - Block - Unsupported device platforms.
3. Under Users → Include, select All users.
4. Under Users → Exclude, add the exclusions group from the Create or Correct Exclusions Group step.
5. Under Target resources, select All resources.
6. Under Conditions → Device platforms → Include, select "Any device" or leave unconfigured.
7. Under Conditions → Device platforms → Exclude, select the platforms your organization supports (e.g. Windows, iOS, Android, macOS).
8. Under Grant, select Block access.
9. Set Enable policy to Report-only.
10. Click Save, then rescan in IAMAI.

Reason: C6 — Entra implementation uses developer-spec language. Rewritten as a portal walkthrough. The key concept (block everything except explicitly supported platforms) is made clear in the steps.

---

## Implementation — AI Info channel

CURRENT →
Review the proposed Block Unsupported Device Platforms implementation for GetIAMAI. Confirm the canonical target matches the pinned IAMAI destination, is fully tenant-resolved, starts Report-only, and contains no invented IDs or decisions. Because platform detection uses user-agent data, review this together with the tenant device-compliance/app-protection posture.

TARGET →
This policy blocks sign-ins from device platforms your organization does not support (e.g. Linux, or any platform Entra cannot identify). It works by blocking all platforms except the ones you explicitly allow.

Review the proposed policy to confirm: it targets all resources for all users (minus the exclusions group), blocks access from platforms not in the supported list, and starts in Report-only. Note: Entra detects platforms from user-agent strings, which can be spoofed — this policy reduces risk but is not a hard boundary.

Reason: C7 — "GetIAMAI", "canonical target", "pinned IAMAI destination", "tenant-resolved" are internal terms. Rewritten to explain what the policy does and what to verify.

---

## Implementation — Email channel

Email notification template present — not fully captured. Verify content is reasonable and uses plain language.

---

## Done when

CURRENT →
The policy is enforced in GetIAMAI, blocking sign-ins from unsupported device platforms, with the exclusions group applied and the baseline mapping resolved.

TARGET →
The policy is enforced, blocking sign-ins from unsupported device platforms, with the exclusions group applied and the baseline mapping resolved.

Reason: "in GetIAMAI" removed.

---

## Links

- Learn → link present. ✓
- Cross-reference: "Open Create or Correct Exclusions Group" — present. ✓
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
