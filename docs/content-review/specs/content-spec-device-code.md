# Content spec: Block Device Code Sign-in

**Step ID:** `s-goal-block-device-code`
**Package:** `docs/implementation-content/s-goal-block-device-code/`

Every change is a word-for-word replacement. If a section isn't listed, it doesn't change.

---

## Why

CURRENT →
```
Device code sign-in is how a phishing message gets a person to sign the attacker in; almost nothing legitimate needs it. Learn →
```

No change. This is clear and concise.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

CURRENT → `! AFFECTED PEOPLE — Not established`

No content change. This resolves when the baseline mapping is confirmed.

### Tile 2: DEVICE CODE SIGN-IN

CURRENT → `! DEVICE CODE SIGN-IN — Confirm`

TARGET → `! DEVICE CODE SIGN-IN — Confirm no legitimate use`

The expanded content should read:
```
Confirm that no one in your organization uses device code sign-in for CLI tools (like Azure CLI), IoT devices, or display-limited devices. If they do, add exceptions before this policy blocks it.
```

### Tile 3: PREREQUISITE · READY

CURRENT → `! PREREQUISITE · READY — Create or Correct Exclusions Group`

**Icon issue:** The "!" icon shows on a prerequisite that IS Ready (actionable). The icon should be:
- "!" when the prerequisite is NOT complete (blocking)
- "✓" when the prerequisite IS complete

This is a renderer fix, not content. The tile label says "READY" which means the prerequisite step is in the Ready lane — it's actionable but not done. The icon should match: "!" is correct here because the prerequisite is not yet complete. However, the label is confusing: "PREREQUISITE · READY" reads like "this prerequisite is ready/done." 

**Label change:** `PREREQUISITE · READY` → `PREREQUISITE · IN PROGRESS` when the prerequisite is in the Ready lane (started/actionable but not complete). Keep `PREREQUISITE · COMPLETED` when it's done. This is a renderer change across all steps.

---

## Readiness bar

CURRENT → `Needs correction`

No change. Correct for an enforced policy with drift.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Ready · Correct

Does anyone use device code sign-in for CLI tools, IoT devices, or display-limited devices?

Device code sign-in
Choose…
None
Yes
Save
```

ISSUES:
1. "Ready · Correct" is showing as the milestone date text. This is the lane substatus, not a date or action. **Renderer fix:** when the milestone has no scheduled date, show "—" not the lane substatus.
2. The dropdown label "Choose…" gives no guidance on what each option means.

TARGET →
```
NEXT MILESTONE

—

Does anyone use device code sign-in for CLI tools, IoT devices, or display-limited devices?

Device code sign-in
Choose…
None — no one uses device code, safe to block
Yes — add exceptions before blocking
Save
```

Note: the dropdown option labels ("None — no one uses device code, safe to block" / "Yes — add exceptions before blocking") may not fit in a `<select>` dropdown. If they don't fit, keep the short labels ("None" / "Yes") and add a one-line explanation ABOVE the dropdown: "Choose None if no one uses device code sign-in. Choose Yes to add service accounts that need an exception."

---

## Implementation — Entra channel

CURRENT →
```
Open the exact resolved policy by stable tenant ID [GUID]. If it is On, move that same policy to Report-only before changing any access-affecting assignment or condition. Replace the complete conditions object with the IAMAI-resolved canonical target; do not create a replacement policy.

Re-open the same policy by stable ID, verify the corrected fields against the canonical target, and rescan IAMAI. Any policy staged to Report-only stays there until a separate Ready-to-enforce state is reached.
```

TARGET →
```
This policy already exists and is enforced. The correction adds the exclusions group.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named Core - Block - Device Code Flow (or search by its ID in Plan settings).
3. Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.
4. Verify all other settings match the baseline: Target resources = All resources, Conditions = Client apps: Authentication flows: Device code, Grant = Block access.
5. Save. Do not change the policy state (leave it On).
6. Rescan in IAMAI to confirm the correction.
```

---

## Implementation — PowerShell channel

Review the current PowerShell content. If it's the generic "PATCH the policy by GUID" script, replace the preamble with:

```
# Adds the exclusions group to the device-code block policy.
# Run after confirming the exclusions group in the Exclusions Group step.
```

Keep the actual PowerShell commands as-is (they're generated from the policy body and are correct). The preamble is what the tech reads first.

---

## Implementation — JSON channel

Review the current JSON content. If it shows the full PATCH body, add a one-line comment at the top:

```
// PATCH: adds the exclusions group to the policy's user exclusions.
// Apply this to the existing policy — do not create a new one.
```

---

## Implementation — AI Info channel

TARGET →
```
This policy blocks device code sign-in for all users except the exclusions group.

Device code flow is used in phishing attacks: the attacker sends a victim a code, the victim enters it on a legitimate Microsoft page, and the attacker receives the token. Blocking it stops this attack path.

Legitimate uses: Azure CLI, some IoT devices, and display-limited devices (like printers with web setup). If your organization uses any of these, add those service accounts as exceptions in the Exclusions Group or the service accounts group before this policy blocks them.

The correction on this step adds the exclusions group to the policy. The policy is already enforced and working; this change ensures the emergency access accounts are excluded.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI and matches the baseline's target configuration, with the exclusions group applied and any device code sign-in workflows accounted for.
```

No change. This is specific and correct.

---

## Global issues on this step (renderer, not content)

1. **Milestone shows lane substatus instead of date** — "Ready · Correct" where a date or "—" should be. Renderer fix.
2. **Prerequisite tile label** — "PREREQUISITE · READY" should be "PREREQUISITE · IN PROGRESS" when the prerequisite isn't complete. Renderer fix across all steps.
3. **"!" icon on all tiles including satisfied prerequisites** — renderer logic for icon selection needs review.
