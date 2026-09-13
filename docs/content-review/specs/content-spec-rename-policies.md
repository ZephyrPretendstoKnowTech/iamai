# Content spec: Rename Policies Off the Naming Convention

**Step ID:** `cleanup-naming`
**Package:** `docs/implementation-content/cleanup-naming/`

This is a cleanup step with minimal anatomy: Why, Implementation, Done when, and a Done button. No Readiness section.

---

## Why

CURRENT →
```
One convention means the next person can read the policy list without opening each policy. Learn →
```

No change. Clear and practical.

---

## Implementation

CURRENT →
```
Rename SG - Entra - Users - User Risk Policy → Core - Entra - Users User Risk Policy
Renaming changes no evaluation; do it in one sitting.
```

TARGET →
```
Rename the following policies in Entra admin center → Conditional Access → Policies. Click the policy name to open it, change the Name field, and Save.

1. SG - Entra - Users - User Risk Policy → Core - Entra - Users User Risk Policy

Renaming doesn't change what the policy does — it only changes the name. Do them all in one sitting.
```

Changes:
- Added portal navigation instructions for a tech who doesn't know where to rename.
- Numbered the rename (even though there's only one now — the list may grow on other tenants).
- Moved "Renaming changes no evaluation" to plain English at the end as reassurance.

---

## Done when

CURRENT →
```
Every policy name follows Core - Scope - Action Target.
```

TARGET →
```
Every policy follows the naming convention: Core - [Scope] - [Action] [Target].
```

Minor — added the format template so the convention is self-explanatory.

---

## Done button

CURRENT → "Done on [date field] / Done" button + "Close" button.

No change. The manual-completion pattern is correct for cleanup steps. The admin clicks Done when finished, and the step moves to Completed.

---

## Missing elements

1. **No Readiness section** — correct for a cleanup step. Nothing to check.
2. **No action column** — correct. The rename list is in Implementation, not an IAMAI input. No milestone date needed; this is a do-it-when-you-can task.
3. **No Source checked** — debatable. The naming convention itself could have a source (Jon Hope's baseline documentation). Add it if the convention is documented; skip if it's just an IAMAI-internal convention. **Decision: skip** — the convention is IAMAI's own.
4. **No channels** — the rename instruction renders as plain text under Implementation, not inside a channel tab. This is fine for a one-line cleanup task. No need for Entra/AI Info tabs.
5. **No "Defer this step" button** — cleanup steps can't be deferred? Verify whether this is intentional. If a tenant has no misnamed policies, the step shouldn't generate at all. If it generates, the admin should be able to defer it. Check if "Defer this step" is missing or just not visible in my data.

---

## Global issues
None specific to this step. It's the simplest step in the plan.
