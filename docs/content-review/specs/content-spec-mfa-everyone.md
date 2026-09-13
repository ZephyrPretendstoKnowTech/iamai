# Content spec: Require MFA for Everyone

**Step ID:** `s-goal-mfa-all-users`
**Package:** `docs/implementation-content/s-goal-mfa-all-users/`

---

## Why

CURRENT →
```
A stolen or guessed password on its own is how most accounts are taken over. Learn →
```

No change. Short, clear, direct. Good.

---

## Readiness tiles (3)

### Tile 1: THRESHOLD — 33%

CURRENT → `! THRESHOLD — 33%`

TARGET (collapsed) → `! THRESHOLD — 33% MFA-ready`

Context suffix. "33%" alone is meaningless. "33% MFA-ready" tells the tech what the number measures.

The policy is Enforced, so per U22 the expanded text should be informational: "33% of users have registered an MFA method" not "enforcement waits for 90%."

### Tile 2: AFFECTED PEOPLE — Not established

No content change.

### Tile 3: PREREQUISITE · READY — Exclusions Group

Same global renderer fix (label → IN PROGRESS).

---

## Readiness bar and explanation

CURRENT →
```
Needs correction

Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.

This scan could not work out who cannot meet this step's sign-in requirement yet. Open MFA Readiness →
```

TARGET →
```
Needs correction

Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.

Some users may not be able to meet this step's MFA requirement yet. Check MFA Readiness → for per-person detail.
```

Changes:
- Same readiness bar simplification as other steps.
- "This scan could not work out who cannot meet..." → clearer: "Some users may not be able to meet..."
- "Open MFA Readiness →" → "Check MFA Readiness →" (more natural verb).

---

## Milestone / action column

CURRENT → `NEXT MILESTONE / Ready · Correct`

TARGET → `NEXT MILESTONE / —`

Global renderer fix.

---

## Implementation — Entra channel

CURRENT →
```
Open the exact resolved Conditional Access policy by stable tenant ID [GUID]. Apply only the mismatch modules IAMAI selected; do not create a replacement policy.

Replace only the policy assignments/conditions with the complete IAMAI-resolved canonical target. Preserve the same policy ID. This includes All users, canonical exclusions, All resources with Microsoft Intune Enrollment excluded, all client apps, and no extra risk/location/platform/device/flow/action/context conditions.

Save, re-open the same policy by stable ID, verify only the corrected fields plus lifecycle state, and rescan IAMAI. If other mismatches remain, leave them for their selected modules.
```

TARGET →
```
This policy already exists and is enforced. The correction adds the exclusions group and aligns the conditions with the baseline.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named Core - Allow - MFA for Internal Users (or find it by ID in Plan settings).
3. Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.
4. Target resources: All resources. Under Exclude, Microsoft Intune Enrollment should be excluded (this prevents an enrollment loop).
5. Conditions: no sign-in risk, no device platform, no location, no client app filter — leave all conditions blank except client apps (All client apps).
6. Grant: Grant access → Require multifactor authentication.
7. Save. Do not change the policy state (leave it On).
8. Rescan in IAMAI to confirm the correction.
```

This is the most important policy in the plan (MFA for everyone), and the current Entra channel is unreadable to a tech. The rewrite names the policy, lists every setting, and tells the admin what to verify.

---

## Implementation — AI Info channel

TARGET →
```
This is the foundational MFA policy: every user must present a second factor (MFA) at sign-in. It's the single most impactful control in the baseline.

The policy is already enforced on your tenant. The correction aligns its configuration with the baseline:
— The exclusions group is added so emergency access accounts are exempt.
— Microsoft Intune Enrollment is excluded from target resources to prevent devices from failing enrollment because MFA fires during the enrollment flow.
— Conditions are cleaned to match the baseline's intent: no location, platform, or risk filters — MFA applies everywhere, unconditionally.

After this step, the MFA Registration Campaign step ensures every person has registered a phishing-resistant method. Until that's done, the 33% threshold tile tracks progress.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI and matches the baseline's target configuration, with the exclusions group applied.
```

No change. Correct.

---

## Links

CURRENT → Learn → and Microsoft Learn present.

**Note:** The readiness text mentions "Open MFA Readiness →" — verify this is a working link, not just text. It should point to `#/readiness`.

---

## Global issues
1. Milestone shows lane substatus — renderer fix.
2. THRESHOLD collapsed context — content fix ("33% MFA-ready").
3. Implementation is developer spec — content rewrite (done above).
4. "Mismatch modules IAMAI selected" — internal term, removed.
5. MFA Readiness link — verify it's a clickable link.
