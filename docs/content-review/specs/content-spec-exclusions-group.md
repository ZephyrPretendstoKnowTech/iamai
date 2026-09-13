# Content spec: Create or Correct Exclusions Group

**Step ID:** `s-prereq-exclusion-group`
**Package:** `docs/implementation-content/s-prereq-exclusion-group/`

---

## Why

CURRENT →
```
One group, excluded from every policy in the plan, is the single auditable way back in when a policy goes wrong in GetIAMAI. Learn →
```

TARGET →
```
One group, excluded from every policy in the plan, is how you keep access if a policy goes wrong. Every Conditional Access policy in the baseline excludes this group, so its members can always sign in. Learn →
```

Added the second sentence to explain what the group DOES — the current text says it's "the way back in" but a tech might not understand that means "emergency bypass."

---

## Readiness tile

CURRENT → `! DECISION — Decision`

TARGET (collapsed) → `! DECISION — Confirm the exclusions group`

"Decision" alone tells the tech nothing about what decision. The expanded content is good (says IAMAI found a group).

---

## Readiness bar

CURRENT →
```
Needs a decision

Why IAMAI says this →
```

No content change. The bar text "Needs a decision" is the sentence form (correct, different from the substatus "Decision").

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Ready · Decision

Exclusions group
Breakglass Exclusion
Matched by IAMAI
Save
```

TARGET →
```
NEXT MILESTONE

Sep 14, 2026

Exclusions group

IAMAI found "Breakglass Exclusion" in your tenant. Confirm this is the group every policy should exclude, then Save.

Breakglass Exclusion
✓ Matched by IAMAI
Save
```

Changes:
- "Ready · Decision" → the actual date (Sep 14, 2026). Global renderer fix.
- Added one-line explanation above the pre-filled chip so the tech understands what they're confirming.
- "Matched by IAMAI" should have a ✓ icon, not just text.

---

## Implementation — Entra channel

CURRENT →
```
Create only the owner-confirmed canonical exclusions group.

Go to Entra admin center → Entra ID → Groups → All groups → New group.
Group type: Security.
Membership type: Assigned. Do not use Dynamic User or Dynamic Device.
Name: ‹group name›.
Add only the owner-confirmed emergency access accounts supplied by IAMAI.
Create the group.
Rescan IAMAI before changing Conditional Access policies so the newly created stable group ID becomes tenant truth.

Do not create a second similarly named group as a shortcut.
```

TARGET →
```
If confirming an existing group (like "Breakglass Exclusion"):
Click Save above — IAMAI records the group's ID and uses it in every policy.

If creating a new group:
1. Go to Entra admin center → Groups → All groups → New group.
2. Group type: Security.
3. Membership type: Assigned (not Dynamic).
4. Name: Core - Exclusions (or your preferred name).
5. Members: add only the emergency access accounts you selected in the Emergency Access step.
6. Create.
7. Rescan in IAMAI so it picks up the new group's ID.

Important: this group should contain only emergency access accounts. Do not add regular users or service accounts — they would bypass every policy in the plan.
```

Changes:
- Split into two paths: confirming vs creating. On this tenant, the group already exists — the tech just needs to click Save. The creation path is for tenants without an existing group.
- "owner-confirmed canonical exclusions group" → plain English.
- "stable group ID becomes tenant truth" → "picks up the new group's ID."
- Added the warning about not adding regular users.
- "Do not create a second similarly named group" → removed (edge case that confuses more than helps).

---

## Implementation — AI Info channel

TARGET →
```
The exclusions group is the emergency bypass for every Conditional Access policy in the plan. Its members can always sign in, regardless of MFA requirements, device compliance, location restrictions, or any other policy condition.

This is why it should contain ONLY the emergency access accounts: if a regular user were in this group, they'd bypass every security control.

Every policy IAMAI creates or corrects will exclude this group automatically. You don't need to add it manually to each policy — IAMAI handles that. But you DO need to confirm which group it is, so IAMAI knows the right ID.

If your tenant already has a group used for Conditional Access exclusions (like "Breakglass Exclusion"), confirm it here. If not, create one following the Entra instructions.
```

---

## Done when

CURRENT →
```
The exclusions group is confirmed, has the emergency access accounts as its only members, and IAMAI has recorded its ID for every policy in the plan.
```

No change. Specific and correct.

---

## Header note

CURRENT →
```
Done together with Create or Correct Emergency Access Accounts: the accounts chosen there are this group's only members.
```

No change. Good cross-reference.

---

## Links

- ✓ Learn → correct (security-emergency-access)
- ✓ Microsoft Learn at bottom.
- **Missing:** No link to the Emergency Access step, despite the header saying "Done together with." Add a link.

---

## Buttons

- No "Defer" or "Doesn't apply" — correct. The exclusions group is mandatory.

---

## Global issues
1. Milestone shows "Ready · Decision" instead of date — renderer fix.
2. DECISION tile label too vague ("Decision") — content fix.
3. "owner-confirmed canonical exclusions group" — internal language, replaced.
4. Source checked present (Sep 12, 2026) ✓.
5. Pre-fill with "Matched by IAMAI" working ✓ — U24 landed.
