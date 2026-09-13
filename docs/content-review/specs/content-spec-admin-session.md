# Content spec: Shorten Admin Sessions

**Step ID:** `s-goal-admin-session`
**Package:** `docs/implementation-content/s-goal-admin-session/`

---

## Why

CURRENT →
```
A stolen admin session is worth as long as it lasts; is long enough to work and short enough to limit the damage. Learn →
```

TARGET →
```
A stolen admin session stays useful as long as it lasts. A short session limits the damage: an attacker who steals the token has minutes, not hours. Learn →
```

The current text has a grammar gap — "is long enough" has no subject. The rewrite makes both halves of the sentence complete.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE — Not established
No content change. Resolves after baseline mapping.

### Tile 2: PREREQUISITE · READY — Create or Correct Exclusions Group
Same global renderer fixes: label → `PREREQUISITE · IN PROGRESS`, icon logic.

---

## Readiness bar and explanation

CURRENT →
```
Needs correction

Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.
```

TARGET →
```
Needs correction

Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.
```

Same rewrite as Medium-Risk Sign-ins. The long sentence about "only your Save makes it the one" is confusing.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Ready · Correct
```

TARGET →
```
NEXT MILESTONE

—
```

Global renderer fix: lane substatus in milestone → show "—" when no date.

---

## Implementation — Entra channel

CURRENT →
```
Open the exact policy by stable tenant ID [GUID]. If it is On, move that same policy to Report-only first. Replace the complete Conditions object with IAMAI's canonical target; do not create a replacement policy.

Re-open the same policy by stable ID, compare the corrected object to IAMAI's canonical target, and rescan. A policy staged to Report-only stays there until Ready to enforce.
```

TARGET →
```
This policy already exists and is enforced. The correction adds the exclusions group.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named Core - Session - Admin Sign-in Frequency (or find it by ID in Plan settings).
3. Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.
4. Verify the session controls match the baseline: Sign-in frequency enabled, set to the baseline's interval. Persistent browser session: set to Never persistent.
5. Save. Do not change the policy state (leave it On).
6. Rescan in IAMAI to confirm the correction.
```

---

## Implementation — AI Info channel

TARGET →
```
This policy shortens how long an admin's session stays valid. After the sign-in frequency interval, the admin is prompted to re-authenticate.

This protects against token theft: even if an attacker steals an admin's session token, it expires quickly. Combined with phishing-resistant MFA, re-authentication requires a passkey the attacker doesn't have.

The correction on this step adds the exclusions group so emergency access accounts are not affected by the session limit.

The persistent browser session control ensures admin sessions are not remembered across browser closures.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI with the baseline's session controls (sign-in frequency and persistent browser session), and the exclusions group is applied.
```

No change. Specific and correct.

---

## Global issues
1. Milestone shows lane substatus — renderer fix.
2. Prerequisite tile label — renderer fix.
3. "IAMAI's canonical target" in Entra channel — replaced with plain English.
