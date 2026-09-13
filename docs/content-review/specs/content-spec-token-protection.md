# Content spec: Require Token Protection on Windows

**Step ID:** `s-goal-token-protection`
**Package:** `docs/implementation-content/s-goal-token-protection/`

---

## Why

CURRENT →
```
A stolen token copied to another machine is useless once it is bound to the original device. Learn →
```

TARGET →
```
Token protection binds a session token to the device it was issued on. If someone steals the token and tries to use it on a different machine, it's rejected. Learn →
```

The current text is elegant but too compressed. A tech needs to understand what token protection IS, not just what it does in the abstract.

---

## Readiness tiles (2)

### Tile 1: AFFECTED PEOPLE — Not established
No content change.

### Tile 2: PREREQUISITE · READY — Exclusions Group
Global fix (IN PROGRESS label).

---

## Readiness bar

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

---

## Milestone

CURRENT → `NEXT MILESTONE / Ready · Correct`
TARGET → `NEXT MILESTONE / —`

---

## Implementation — Entra channel

CURRENT →
```
Open the IAMAI-resolved existing Conditional Access policy Core - Require - Token Protection (Windows) by its stable tenant policy identity. Do not create a replacement.

Under Users or workload identities > Include, set the population to All users. Preserve the canonical exclusions.

Under Users or workload identities > Exclude, make the exclusion set match IAMAI's canonical target exactly. Do not add a new exception merely because an unsupported client appears; resolve that workflow deliberately first.

Set Enable policy to Report-only while correcting or revalidating this policy.

Save the same policy, read its settings back, and rescan IAMAI. Continue to observation only after IAMAI no longer reports the corrected semantic mismatch(es).
```

TARGET →
```
This policy already exists and is enforced. The correction adds the exclusions group and aligns the user scope.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named Core - Require - Token Protection (Windows) (or find it by ID in Plan settings).
3. Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.
4. Conditions: Client apps = Browser, Mobile apps and desktop clients. Device platforms = Windows only.
5. Session → Token protection (sign-in session): Require.
6. Save. Do not change the policy state (leave it On).
7. Rescan in IAMAI to confirm the correction.

Note: Token protection currently works only on Windows devices with supported applications (Office desktop apps, some Edge scenarios). Non-Windows sign-ins and unsupported apps are not affected by this policy — they pass through without the token binding. Do not add extra exclusions for unsupported clients; they're already unaffected.
```

Changes:
- "IAMAI-resolved existing" / "stable tenant policy identity" / "canonical exclusions" / "canonical target" / "semantic mismatch(es)" — all internal language removed.
- The note about unsupported clients replaces "Do not add a new exception merely because an unsupported client appears; resolve that workflow deliberately first" — which is developer-to-developer advice, not admin instructions.
- "Set Enable policy to Report-only while correcting" — removed. The correction is adding an exclusion group to an existing block policy. This is a safe change (only widens who is exempt). No need to go to Report-only for this.

---

## Implementation — AI Info channel

TARGET →
```
Token protection binds each sign-in token to the device it was created on. If an attacker steals the token (from memory, from a browser export, or from disk) and tries to replay it on their own machine, Entra rejects it because the device doesn't match.

This is one of the strongest protections against token theft, which is the attack that bypasses MFA entirely — the attacker doesn't need the user's password or second factor, just a copy of the session token.

Current limitation: token protection only works on Windows devices running supported apps. Non-Windows devices (Mac, iOS, Android) and some web apps don't support it yet. This doesn't mean those devices are unprotected — other policies (MFA, device compliance) still apply. It means the token binding doesn't fire there.

The correction on this step adds the exclusions group so emergency access accounts are not affected.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI and matches the baseline's target configuration.
```

TARGET →
```
The policy is enforced and matches the baseline's target: token protection required for all users on Windows, with the exclusions group applied.
```

---

## Global issues
1. Milestone shows lane substatus — renderer fix.
2. Entra channel is a different variant of the generic text (more verbose, policy-specific) but still uses internal terms — content rewrite above.
3. Source checked present (Sep 10, 2026) ✓.
