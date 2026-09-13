# Content spec: Require Phishing-Resistant MFA for Admins

**Step ID:** `s-goal-admins-phishing-resistant`
**Package:** `docs/implementation-content/s-goal-admins-phishing-resistant/`

---

## Why

CURRENT →
```
A code or an approval can be tricked out of an admin by a convincing page; a passkey cannot be used on the wrong site. Learn →
```

TARGET →
```
Phone codes and push approvals can be phished — an attacker builds a convincing sign-in page and the admin hands over the code. A passkey can't be used on the wrong site, so phishing doesn't work. Learn →
```

Expanded slightly to name the attack and explain WHY passkeys are resistant.

---

## Readiness tiles (3)

### Tile 1: THRESHOLD — 0%

CURRENT → `! THRESHOLD — 0%`
TARGET (collapsed) → `! THRESHOLD — 0% of admins phishing-resistant`

Context suffix. Policy is enforced, so the expanded text should be informational per U22: "0% of admins have a qualifying phishing-resistant method" not "enforcement waits for 100%."

### Tile 2: AFFECTED PEOPLE — Not established
No content change.

### Tile 3: PREREQUISITE · READY — Exclusions Group
Global fix (IN PROGRESS label).

---

## Readiness bar

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

Check which admins don't have a phishing-resistant method yet: MFA Readiness →
```

---

## Milestone

CURRENT → `NEXT MILESTONE / Ready · Correct`
TARGET → `NEXT MILESTONE / —`

---

## Implementation — Entra channel

CURRENT →
```
Open the exact resolved admin policy by stable tenant ID [GUID]. Apply only selected mismatch modules.

Replace only the policy assignments/conditions with the complete IAMAI-resolved target: exact pinned built-in directory roles, canonical exclusions, All resources, all client apps, and no extra conditions.

Save and re-read the same policy by stable ID. Verify only the selected corrections plus lifecycle, then rescan IAMAI.
```

TARGET →
```
This policy already exists and is enforced. The correction adds the exclusions group and aligns the admin roles with the baseline.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named Core - Allow - MFA for Admins (or find it by ID in Plan settings).
3. Users → Include: select the directory roles the baseline targets (Global Administrator, Security Administrator, etc. — the full list is in the JSON channel).
4. Users → Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.
5. Target resources: All resources.
6. Grant → Grant access → Require authentication strength: Modern MFA + TAP (the strength you created in the Authentication Strength step).
7. Save. Do not change the policy state.
8. Rescan in IAMAI.
```

Key difference from other enforced-correction steps: this policy uses authentication strength (not just "Require MFA"), and it targets specific admin roles, not All users.

---

## Implementation — AI Info channel

TARGET →
```
This policy requires admins to use a phishing-resistant method — passkey, hardware security key, or Windows Hello — every time they sign in.

Unlike the "MFA for Everyone" policy which accepts any MFA method (including phone call), this policy uses the authentication strength "Modern MFA + TAP" which only accepts phishing-resistant methods and Temporary Access Pass.

The 0% threshold means none of your admins currently have a qualifying method registered. The MFA Registration Campaign step handles getting them registered. This policy enforces the requirement; the campaign helps people meet it.

The correction adds the exclusions group and ensures the admin role list matches the baseline's set of built-in privileged roles.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI with the baseline's authentication strength and the exclusions group, and every admin holds a qualifying phishing-resistant method.
```

No change. Specific, names the auth strength and the admin readiness requirement.

---

## Links
- ✓ Learn → correct
- ✓ "Open MFA Readiness →" link present and pointing to `#/readiness/step/s-goal-admins-phishing-resistant` — good, it's a filtered view
- ✓ Microsoft Learn at bottom

---

## Global issues
1. Milestone shows lane substatus — renderer fix.
2. THRESHOLD 0% needs context — content fix.
3. "IAMAI-resolved target" / "mismatch modules" / "canonical exclusions" — replaced.
4. Source checked present (Sep 12, 2026) ✓.
