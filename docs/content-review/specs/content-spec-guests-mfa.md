# Content spec: Require MFA for Guests

**Step ID:** `s-goal-guests-mfa`
**Package:** `docs/implementation-content/s-goal-guests-mfa/`

This is a **pair policy** — it consists of two Conditional Access policies (a "strong" tier for trusted partners and a "mixed" tier for other guests). The Implementation must address both.

---

## Why

CURRENT →
```
A partner's password hygiene is not yours to control; the prompt at your door is. Learn →
```

No change. Punchy and clear.

---

## Readiness tiles (3)

### Tile 1: AFFECTED PEOPLE — Not established
No content change.

### Tile 2: PARTNER OR MSP ACCESS — Confirm

CURRENT → `! PARTNER OR MSP ACCESS — Confirm`

TARGET (collapsed) → `! PARTNER ACCESS — Confirm whether partners access your tenant`

Shortened label. The expanded content should explain: "If you have partner or MSP organizations that sign into your tenant, identify them here so they get the trusted tier (stronger MFA). If no partners access your tenant, choose 'None.'"

### Tile 3: PREREQUISITE · READY — Exclusions Group
Global fix (IN PROGRESS label).

---

## Readiness bar

CURRENT →
```
Needs correction
```

No change.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Ready · Correct

Partner tenants whose home MFA you trust; they get the stronger tier.

Partner tier
Save
```

TARGET →
```
NEXT MILESTONE

—

Do any partner or MSP organizations sign into your tenant?

Partner access
None — no partners, apply the same guest policy to everyone
Yes — add partner tenant domains (they get the stronger MFA tier):
Save
```

Changes:
- Milestone date: "Ready · Correct" → "—" (global renderer fix).
- "Partner tenants whose home MFA you trust; they get the stronger tier." → reworked as a question with explanatory option labels.
- "Partner tier" is a vague label. "Partner access" is clearer.

---

## Implementation — Entra channel

CURRENT →
```
Open the exact resolved pair by stable tenant IDs: strong ‹guests policy ID›, mixed ‹mixed guests policy ID›. Correct only the member(s) IAMAI identifies as mismatched, using their complete tenant-resolved users objects. Preserve the two-member split and their different grants; do not merge them.
```

TARGET →
```
This step manages two Conditional Access policies that work together:

**Policy 1: Core - Allow - MFA for Guests (strong tier)**
For trusted partners — requires the authentication strength "Modern MFA + TAP."

**Policy 2: Core - Allow - MFA for Internal Users (mixed tier)**
For all other guests — requires standard MFA (any second factor).

Corrections:

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the strong-tier policy (find it by ID in Plan settings).
3. Users → Exclude → Groups: add the exclusions group.
4. Verify: the Grant requires the authentication strength "Modern MFA + TAP."
5. Save.
6. Open the mixed-tier policy (find it by ID in Plan settings).
7. Users → Exclude → Groups: add the exclusions group.
8. Verify: the Grant requires "Require multifactor authentication."
9. Save.
10. Rescan in IAMAI.

Do not merge these two policies into one. They serve different guest populations with different MFA requirements.
```

This is the most complex Entra channel because it's a pair. The current text is incomprehensible to a tech ("complete tenant-resolved users objects", "two-member split"). The rewrite names each policy, explains the difference, and gives numbered steps for both.

---

## Implementation — AI Info channel

TARGET →
```
This step uses two policies to handle guests differently:

Trusted partners (the "strong" tier): organizations you work with regularly, whose home tenant has MFA configured. For these, the policy requires the same phishing-resistant strength as your admins. Because their home tenant already enforces MFA, the cross-tenant MFA trust means they usually don't see an extra prompt.

All other guests (the "mixed" tier): anyone who isn't a trusted partner. For these, the policy requires standard MFA (any method). This is a lower bar because you can't guarantee what methods a random guest has registered.

The correction adds the exclusions group to both policies.

If you have partner organizations, add their tenant domains above. This tells IAMAI which policy tier they belong to. If you have no partners, choose "None" — all guests get the mixed tier.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI and matches the baseline's target configuration, with the exclusions group applied and partner accounts addressed.
```

No change. Specific and correct.

---

## Channels note

This step has Entra, PowerShell, and AI Info (3 channels). It's missing JSON. Per BLOCKED.md, the pair's `partial` projection wasn't authored in the composed shape. This is a known content gap — the JSON channel needs the composed PATCH bodies for both policies. Lower priority than the Entra rewrite.

---

## Global issues
1. Milestone shows lane substatus — renderer fix.
2. Partner tile label too long — content fix.
3. Entra channel incomprehensible for a tech — content rewrite (done above).
4. "Tenant-resolved users objects" / "two-member split" — removed.
5. Source checked present (Sep 12, 2026) ✓.
