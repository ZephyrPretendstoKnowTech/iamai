# Content spec: Block Authentication Transfer

**Step ID:** `s-goal-block-auth-transfer`
**Package:** `docs/implementation-content/s-goal-block-auth-transfer/`

**Note:** This step has the exact same generic Entra channel text as Shorten Admin Sessions and Block Device Code Sign-in. The same rewrite pattern applies. This spec is a template for all enforced-correction policy steps that share the generic text.

---

## Why

CURRENT →
```
Authentication transfer moves a session to a second device without a new sign-in, which is exactly what an attacker who gets someone to scan a code wants. Learn →
```

No change. Clear and specific about the attack.

---

## Readiness tiles (2)

### Tile 1: AFFECTED PEOPLE — Not established
No content change.

### Tile 2: PREREQUISITE · READY — Exclusions Group
Same global fix (IN PROGRESS label).

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
Open the exact resolved policy by stable tenant ID [GUID]. If it is On, move that same policy to Report-only before changing any access-affecting assignment or condition. Replace the complete conditions object with the IAMAI-resolved canonical target; do not create a replacement policy.

Re-open the same policy by stable ID, verify the corrected fields against the canonical target, and rescan IAMAI. Any policy staged to Report-only stays there until a separate Ready-to-enforce state is reached.
```

TARGET →
```
This policy already exists and is enforced. The correction adds the exclusions group.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named Core - Block - Authentication Transfer Flow (or find it by ID in Plan settings).
3. Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.
4. Verify: Target resources = All resources, Conditions = Client apps: Authentication flows: Authentication transfer, Grant = Block access.
5. Save. Do not change the policy state (leave it On).
6. Rescan in IAMAI to confirm the correction.
```

---

## Implementation — AI Info channel

TARGET →
```
This policy blocks authentication transfer — the flow where a QR code or link moves an authenticated session from one device to another without re-authenticating.

Attackers use this in phishing: they get a victim to scan a code that transfers the victim's session to the attacker's device. Blocking the flow stops this attack entirely.

The correction on this step adds the exclusions group so emergency access accounts can still use authentication transfer if needed in an emergency.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI and matches the baseline's target configuration, with the exclusions group applied.
```

No change.

---

## Template note for all enforced-correction steps

The following steps share the same generic Entra channel text and need the same pattern of rewrite. For each, the only differences are:
- The policy name (step 2)
- What the policy does (step 4 verification)
- The AI Info explanation of the attack/control

Steps sharing this pattern:
- Shorten Admin Sessions (already spec'd)
- Block Device Code Sign-in (already spec'd)
- Block Authentication Transfer (this spec)
- Block Legacy Authentication (already spec'd in archetype review)
- Require MFA for Guests (needs spec)
- Require Token Protection on Windows (needs spec)
- Require Phishing-Resistant MFA for Admins (needs spec)
- Require MFA for Everyone (already spec'd — slightly different because it has additional condition details)
