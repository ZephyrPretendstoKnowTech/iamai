# Content spec: Require a Fresh Sign-in for Intune Enrollment

**Step ID:** `s-goal-intune-enrollment-reauth`
**Package:** `docs/implementation-content/s-goal-intune-enrollment-reauth/`

---

## Why

CURRENT →
```
Enrollment makes a device trusted; it should never ride on a session someone else could be holding, so it asks for a fresh sign-in every time. Learn →
```

No change. Clear and explains the reasoning.

---

## Readiness tiles (3)

### Tile 1: AFFECTED PEOPLE — Not established
No content change.

### Tile 2: PREREQUISITE · READY — Exclusions Group
Global fix (IN PROGRESS label).

### Tile 3: PREREQUISITE · READY — Decide How Devices Are Managed
Global fix (IN PROGRESS label). Has a link "Open Decide How Devices Are Managed" — ✓ correct.

---

## Readiness bar

CURRENT →
```
After Decide How Devices Are Managed

Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.
```

TARGET →
```
After Decide How Devices Are Managed

Complete the Exclusions Group step first, and answer the Device Decision step (how phones and computers are managed). Both are needed before this policy can be created.
```

---

## Milestone

CURRENT → `NEXT MILESTONE / Up Next · After Decide How Devices Are Managed`
TARGET → `NEXT MILESTONE / —`

---

## Implementation — Entra channel

CURRENT →
```
Microsoft Entra admin center → Entra ID → Conditional Access → Policies → New policy.
Name: Core - Session - Fresh sign-in for Intune enrollment.
Users → Include: All users. Exclude the IAMAI-resolved canonical exclusions: ‹exclusions group›.
Target resources → Resources → Select resources → Microsoft Intune Enrollment.
Leave unrelated Conditions unconfigured. Client apps remains All.
Do not add a Grant control for this retained baseline member.
Session → Sign-in frequency → Every time.
Enable policy → Report-only. Create, read back, and rescan IAMAI.
```

TARGET →
```
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: Core - Session - Fresh sign-in for Intune enrollment.
3. Users → Include: All users. Exclude → Groups: add the exclusions group.
4. Target resources → Select resources → Microsoft Intune Enrollment (not "All resources" — this policy targets only the enrollment flow).
5. Conditions: leave all blank. Client apps: All.
6. Grant: do not add a grant control. This policy only sets a session control, not an MFA requirement.
7. Session → Sign-in frequency: Every time.
8. Enable policy: Report-only.
9. Create. Rescan in IAMAI.
```

Changes:
- "IAMAI-resolved canonical exclusions: ‹exclusions group›" → "add the exclusions group."
- "Do not add a Grant control for this retained baseline member" → step 6 explains why (session control only, not MFA).
- "read back" → removed (internal concept).

---

## Implementation — AI Info channel

TARGET →
```
This policy ensures that every time someone enrolls a device in Intune, they sign in fresh — no cached session, no token reuse. This prevents an attacker who has stolen a session token from enrolling their own device as "trusted."

This is a session-only policy: it doesn't require MFA (the MFA-for-everyone policy already handles that). It only requires that the sign-in happens at that moment, not from a stored session.

It targets Microsoft Intune Enrollment specifically, not all resources. This means it only fires during the enrollment flow — not during normal sign-ins, Teams calls, or email.

The exclusions group ensures emergency access accounts are not affected.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI.
```

TARGET →
```
The policy is enforced, requiring a fresh sign-in for every Intune enrollment, with the exclusions group applied.
```

The current Done-when is the generic text that should have been replaced in B8. This is a missed content edit.

---

## Links

- ✓ Learn → correct (concept-session-lifetime)
- ✓ Open links to Exclusions Group and Device Decision — both correct.
- ✓ Microsoft Learn at bottom.

---

## Global issues
1. Milestone shows lane text — renderer fix.
2. Done-when still generic ("The policy is enforced in GetIAMAI.") — B8 missed this step.
3. "IAMAI-resolved canonical exclusions" — replaced.
4. "retained baseline member" — removed.
5. Source checked present (Sep 10, 2026) ✓.
