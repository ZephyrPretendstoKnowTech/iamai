# Content spec: Challenge Medium-Risk Sign-ins

**Step ID:** `s-goal-sign-in-risk-medium`
**Package:** `docs/implementation-content/s-goal-sign-in-risk-medium/`

Every change is a word-for-word replacement. If a section isn't listed, it doesn't change.

---

## Why

CURRENT →
```
Medium risk is where most real attacks land: a new country, a new device, a password that appears on a list. Learn →
```

No change. Clear and well-written.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

CURRENT → `! AFFECTED PEOPLE — Not established`

No content change. Resolves when baseline mapping is confirmed.

### Tile 2: PREREQUISITE · READY

CURRENT → `! PREREQUISITE · READY — Create or Correct Exclusions Group`

**Same label/icon issue as Device Code.** Apply the global renderer fix: `PREREQUISITE · IN PROGRESS` when the prerequisite is Ready but not Complete.

---

## Readiness bar and explanation text

CURRENT →
```
After Create or Correct Exclusions Group

Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.
```

TARGET →
```
After Create or Correct Exclusions Group

Complete the Exclusions Group step first. IAMAI found a matching group, but it needs your confirmation before this policy can reference it.
```

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Up Next · After Create or Correct Exclusions Group
```

TARGET →
```
NEXT MILESTONE

—
```

**Renderer fix:** milestone shows lane text instead of a date. When no date is scheduled, show "—". This step has no inputs in the action column, so the column shows only the milestone.

---

## Implementation — Entra channel

CURRENT →
```
In Microsoft Entra admin center, go to Entra ID > Conditional Access > Policies > New policy.

Name: Core - Require - Medium sign-in risk.
Users: Include All users and add only IAMAI-resolved canonical exclusions.
Target resources: All resources.
Conditions > Sign-in risk: Medium only.
Grant: Grant access > Require multifactor authentication.
Do not add session controls for this retained baseline member.
Enable policy: Report-only.
Create and rescan IAMAI.
```

TARGET →
```
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: Core - Require - Medium sign-in risk.
3. Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.
4. Target resources: All resources.
5. Conditions → Sign-in risk: check Medium only.
6. Grant → Grant access → Require multifactor authentication.
7. Session: leave empty (no session controls).
8. Enable policy: Report-only.
9. Create. Rescan in IAMAI.
```

Changes made:
- "IAMAI-resolved canonical exclusions" → plain English naming the exclusions group step
- "retained baseline member" removed (internal term)
- Numbered steps for scannability
- Arrow notation (→) for portal navigation consistency

---

## Implementation — PowerShell channel

Review current content. If the preamble references internal terms, replace with:

```
# Creates the medium sign-in risk policy in Report-only.
# Run after the Exclusions Group step is complete.
```

---

## Implementation — JSON channel

Review current content. If the preamble references internal terms, add:

```
// POST: creates the medium sign-in risk policy.
// The exclusions group ID is filled from the Exclusions Group step.
```

---

## Implementation — AI Info channel

Review current content. If it references internal terms or is missing, replace with:

```
This policy requires MFA when Microsoft detects a medium-risk sign-in — for example, a sign-in from an unfamiliar location, a new device, or credentials found in a leaked database.

It starts in Report-only so you can observe which sign-ins would be challenged without blocking anyone. After the observation window, IAMAI will prompt you to enforce it.

The exclusions group is excluded so emergency access accounts are never blocked by this policy.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI at the medium-risk threshold and matches the baseline's target configuration, with the exclusions group applied.
```

No change. Specific and correct.

---

## Links

- ✓ Learn → points to `learn.microsoft.com/entra/identity/conditional-access/policy-risk-based-sign-in` — correct
- ✓ "Open Create or Correct Exclusions Group" → points to `#/plan/s-prereq-exclusion-group` — correct
- ✓ Microsoft Learn at bottom — correct

No changes needed to links.

---

## Global issues on this step

1. **Milestone shows lane text** — same renderer fix as Device Code.
2. **Prerequisite tile label** — same renderer fix.
