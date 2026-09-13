# Content spec: Block the Admin Portals for Non-Admins

**Step ID:** `s-goal-admin-portals-protected`
**Package:** `docs/implementation-content/s-goal-admin-portals-protected/`

This step is On Hold due to a baseline conflict. It's a RESOLUTION STEP, not a POLICY STEP — the baseline defines the policy two ways and IAMAI can't resolve the contradiction.

---

## Why

CURRENT →
```
A standard account has no business in an admin portal; blocking it there removes a whole class of accidental and stolen-password changes. Learn →
```

No change. Clear and practical.

---

## Readiness tiles (3)

### Tile 1: BASELINE DEFINITION — Conflict unresolved

CURRENT → `! BASELINE DEFINITION — Conflict unresolved`

No content change. This is the primary blocker and is correctly labelled.

### Tile 2: AFFECTED PEOPLE — Not established

No content change.

### Tile 3: PREREQUISITE · READY — Exclusions Group

CURRENT → `… PREREQUISITE · READY — Create or Correct Exclusions Group`

Same global fix (label → IN PROGRESS, icon consistency).

---

## Readiness bar and conflict explanation

CURRENT →
```
Baseline conflict

Wait for a reviewed baseline that settles the contradiction; there is nothing to submit.

Do not deploy this policy from the current baseline

The baseline's documentation says this policy is for people without an admin role. The policy it exports targets All users and excludes no administrator, by role, by account or by group. Both cannot be true, so IAMAI writes no instructions for this one: it would either lock every administrator out of the admin portals or claim a protection the policy does not carry. Nothing is wrong in your tenant, and nothing here needs your attention — this step waits for a reviewed baseline that settles the contradiction. The rest of the plan is unaffected.
```

TARGET →
```
Baseline conflict

This step is on hold until the baseline author resolves a contradiction. There is nothing for you to do.

Do not deploy this policy from the current baseline

The baseline says this policy should block non-admins from admin portals. But the policy it actually defines targets All users and excludes no administrator — by role, account, or group. If IAMAI followed the policy definition literally, it would lock every administrator out of the admin portals. If it followed the documentation, it would need exclusions the policy doesn't have.

IAMAI won't write instructions for either interpretation because one locks admins out and the other is incomplete. Nothing is wrong in your tenant. This step waits for the baseline author to publish a corrected version. The rest of the plan is unaffected.
```

Changes:
- "Wait for a reviewed baseline that settles the contradiction" → "This step is on hold until the baseline author resolves a contradiction. There is nothing for you to do." More direct, addresses the tech.
- The long explanation is broken into three paragraphs: what the contradiction is, why IAMAI won't act, and what the tech should do (nothing).
- "Both cannot be true" → split into concrete consequences so the tech understands the risk.

---

## Implementation

CURRENT →
```
Not enough information to provide implementation guidance.

The baseline defines this policy two ways; resolve the conflict before implementation is available.

IAMAI's written guidance for this step was reviewed against an earlier version of its baseline policy, which has changed since. Until it is reviewed again, these steps come from the baseline itself.
```

TARGET →
```
Not enough information to provide implementation guidance.

The baseline defines this policy two ways. Until the baseline author publishes a corrected version, no implementation steps are available.
```

Changes:
- Remove the third paragraph ("IAMAI's written guidance for this step was reviewed against an earlier version...") — this is internal IAMAI development history that means nothing to the tech. They don't need to know about version history of the authoring process.
- No channels. No copy button. Correct per the baseline-conflict decision.

---

## Milestone

CURRENT → `NEXT MILESTONE / On Hold · Baseline conflict`

TARGET → `NEXT MILESTONE / —`

Global renderer fix.

---

## Done when

CURRENT →
```
A reviewed baseline version settles which of its two definitions of this policy is meant.
```

TARGET →
```
The baseline author publishes a version that resolves the contradiction between the policy's documentation and its definition.
```

Slightly clearer about who needs to act (the baseline author, not the admin).

---

## Links

- ✓ Learn → correct (`concept-conditional-access-cloud-apps`)
- ✓ Microsoft Learn at bottom — correct
- ✓ "Open Create or Correct Exclusions Group" link — correct (even though the prerequisite is secondary to the conflict)

---

## This step is well-handled

This is actually one of the best-written steps in the plan. The conflict explanation is thorough, honest about the limitation, and doesn't blame the admin. The "Do not deploy" heading is the right call. The only changes are tightening the language and removing internal development notes.
