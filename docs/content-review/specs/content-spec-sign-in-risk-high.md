# Content spec: Challenge High-Risk Sign-ins

**Step ID:** `s-goal-sign-in-risk`
**Package:** `docs/implementation-content/s-goal-sign-in-risk/`

B7 authored channels for this step by copying from Medium-Risk. Verifying the result.

---

## Why

CURRENT →
```
Microsoft sees leaked-credential lists and impossible travel before you do; this lets that signal act. Learn →
```

No change. Clear, concise.

---

## Readiness tiles (3)

### Tile 1: AFFECTED PEOPLE — Not established
No content change.

### Tile 2: PREREQUISITE · READY — Exclusions Group
Global fix (IN PROGRESS label).

### Tile 3: PREREQUISITE · READY — Authentication Strength
Global fix (IN PROGRESS label). Has a link "Open Create the Baseline's Authentication Strength" — ✓ correct.

---

## Readiness bar

CURRENT →
```
After Create the Baseline's Authentication Strength

Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes. Create the Baseline's Authentication Strength first: this policy names an object GetIAMAI does not have yet.
```

TARGET →
```
After Create the Baseline's Authentication Strength

Two prerequisites need to be completed first:

1. Exclusions Group: IAMAI found a matching group, but needs your confirmation.
2. Authentication Strength: this policy requires the "Modern MFA + TAP" strength, which hasn't been created yet.
```

The current text runs both prerequisites together in one paragraph. Split into numbered items.

---

## Milestone

CURRENT → `NEXT MILESTONE / Up Next · After Create the Baseline's Authentication Strength`
TARGET → `NEXT MILESTONE / —`

---

## Implementation — Entra channel

CURRENT →
```
In Microsoft Entra admin center, go to Entra ID > Conditional Access > Policies > New policy.

Name: Core - Require - Sign-in risk.
Users: Include All users and add only IAMAI-resolved canonical exclusions.
Target resources: All resources.
Conditions > Sign-in risk: High only.
Grant: Grant access > Require authentication strength > ‹authentication strength name›.
Session: Sign-in frequency > Every time.
Enable policy: Report-only.
Create and rescan IAMAI.
```

TARGET →
```
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: Core - Require - Sign-in risk.
3. Users → Include: All users. Exclude → Groups: add the exclusions group.
4. Target resources: All resources.
5. Conditions → Sign-in risk: check High only (not Medium).
6. Grant → Grant access → Require authentication strength → select "Modern MFA + TAP" (the strength you created in the Authentication Strength step).
7. Session → Sign-in frequency: Every time.
8. Enable policy: Report-only.
9. Create. Rescan in IAMAI.
```

Changes:
- "IAMAI-resolved canonical exclusions" → "add the exclusions group."
- "‹authentication strength name›" → named explicitly: "Modern MFA + TAP"
- Added "(not Medium)" clarifier on the risk level — this step is High only; Medium has its own step.
- Step 7 adds the session control which the Medium-Risk step does NOT have — this is a key difference between the two.

---

## Implementation — AI Info channel

TARGET →
```
This policy responds to high-risk sign-ins detected by Microsoft Entra ID Protection. High risk means Microsoft is fairly confident the sign-in is compromised — for example, credentials confirmed in a breach database, or traffic from a known attack infrastructure.

Unlike the medium-risk policy (which requires standard MFA), this one requires the authentication strength "Modern MFA + TAP" — only phishing-resistant methods. The reasoning: if the risk is high, a phished code or push approval might be exactly how the attacker got in.

The "Every time" sign-in frequency forces re-authentication on every high-risk sign-in, even if the user has a valid session. This ensures the attacker can't ride an existing session.

The exclusions group ensures emergency access accounts are not blocked during a high-risk event.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI at the high-risk threshold, with the baseline's authentication strength as the grant control and the exclusions group applied.
```

No change. Specific, names the threshold and the auth strength. Good.

---

## Links

- ✓ Learn → correct (policy-risk-based-sign-in)
- ✓ Open links to Exclusions Group and Auth Strength — both correct and functional.
- ✓ Microsoft Learn at bottom.

---

## Global issues
1. Milestone shows lane text — renderer fix.
2. Prerequisite tile labels — global fix.
3. "IAMAI-resolved canonical exclusions" — replaced.
4. Source checked present (Sep 10, 2026) ✓.
5. B7 successfully authored channels for this step ✓ — the content gap is closed.
