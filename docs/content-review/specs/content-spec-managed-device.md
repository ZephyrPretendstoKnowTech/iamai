# Content spec: Require a Managed Device Outside the Office

**Step ID:** `s-goal-require-managed-device`
**Package:** `docs/implementation-content/s-goal-require-managed-device/`

Every change is a word-for-word replacement. If a section isn't listed, it doesn't change.

---

## Why

CURRENT →
```
Company data on a device you manage can be protected, updated and wiped; on any other device, outside the office, it cannot. Learn →
```

No change. Clear and simple.

---

## Readiness tiles (6 tiles)

### Tile 1: THRESHOLD

CURRENT → `! THRESHOLD — 0%`

TARGET (collapsed summary) → `! THRESHOLD — 0% of devices compliant`

The "0%" alone is meaningless in the collapsed view. Adding "of devices compliant" gives context.

### Tile 2: AFFECTED PEOPLE

CURRENT → `! AFFECTED PEOPLE — Not established`

No content change.

### Tile 3: BASELINE MAPPING

CURRENT → `! BASELINE MAPPING — Baseline references an unmapped group`

No content change. The "Open Baseline mappings" button inside the expanded tile is correct.

### Tile 4: PREREQUISITE · READY — Exclusions Group

CURRENT → `! PREREQUISITE · READY — Create or Correct Exclusions Group`

**Same label/icon fix as other steps:** `PREREQUISITE · IN PROGRESS` when Ready but not Complete.

### Tile 5: PREREQUISITE · READY — Devices Decision

CURRENT → `! PREREQUISITE · READY — Decide How Devices Are Managed`

Same label fix.

### Tile 6: PREREQUISITE · READY — Trusted Network

CURRENT → `… PREREQUISITE · READY — Define the Trusted Network`

**Icon "…"** — this is a different icon from "!" on the other tiles. It appears to mean "in progress" or "partially met." The inconsistency is confusing. All prerequisite tiles in the same state (Ready but not Complete) should use the same icon. **Renderer fix:** use "!" consistently for all incomplete prerequisites, or use a neutral icon like "○" for all, and reserve "!" for blockers and "✓" for satisfied.

Same label fix: `PREREQUISITE · IN PROGRESS`.

---

## Readiness bar and explanation text

CURRENT →
```
Baseline references an unmapped group

Baseline mappings first (Plan settings): the baseline names a group of its author's, and IAMAI does not yet know whether it stands for something in GetIAMAI or is left out. Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.
```

TARGET →
```
Baseline references an unmapped group

Two things need to happen before this step can proceed:

1. Resolve the baseline mapping: the baseline references a group from its author's tenant. Go to Plan settings → Baseline mappings to tell IAMAI which group in your tenant corresponds to it (or mark it as not applicable).

2. Complete the Exclusions Group step: IAMAI found a group that matches, but needs your confirmation before any policy can reference it.
```

Changes made:
- "names a group of its author's" → clearer grammar
- Broken into two numbered items instead of one run-on paragraph
- Removed "only your Save makes it the one this policy excludes" (confusing)

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

On Hold · Baseline references an unmapped group
```

TARGET →
```
NEXT MILESTONE

—
```

**Same renderer fix:** milestone shows lane text instead of a date. On Hold steps have no scheduled date, so show "—".

---

## Implementation

Could not read (sensitive key filter blocked the content). The step has 5 channels: Entra, PowerShell, JSON, AI Info, Email.

**Content review needed:** read the Entra channel content directly from the package CONTENT.md file and verify:
1. It doesn't use "IAMAI-resolved canonical target" or other internal terms
2. It gives step-by-step portal instructions for creating the policy
3. It names the policy and its settings explicitly
4. The Email channel has a user notification template

If the Entra content uses internal terms, rewrite following the same pattern as the Medium-Risk and Device Code specs above:
```
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: [baseline policy name].
3. Users → Include: All users. Exclude → Groups: add the exclusions group.
4. Target resources: All resources.
5. Conditions → Locations: Exclude → trusted locations (the network you defined in the Trusted Network step).
6. Grant → Grant access → Require device to be marked as compliant OR Require hybrid Azure AD joined device.
7. Session: leave empty.
8. Enable policy: Report-only.
9. Create. Rescan in IAMAI.
```

---

## Done when

CURRENT →
```
The policy is enforced in GetIAMAI, requiring a managed (compliant or domain-joined) device outside the trusted network, with the exclusions group and the shared-device exception applied.
```

No change. Specific and correct.

---

## Links

- ✓ Learn → `learn.microsoft.com/entra/identity/conditional-access/policy-all-users-device-compliance` — correct
- ✓ Open links to Exclusions Group, Devices Decision, Trusted Network — all correct and functional

---

## Global issues on this step

1. **Milestone shows lane text** — same renderer fix.
2. **Prerequisite tile labels** — same renderer fix.
3. **Inconsistent tile icons** — "…" vs "!" for tiles in the same state. Renderer fix.
4. **6 tiles is visually dense** — after compact/expand this is acceptable but at the edge. The three prerequisite tiles could potentially be collapsed under a "3 prerequisites" summary in a future iteration.
5. **THRESHOLD tile "0%"** has no context in collapsed view — content fix (add "of devices compliant").

---

## Items needing Lachlan's input

1. **The Email channel** on this step: I couldn't read its content. Verify it has a reasonable user notification template. If it's generic or empty, flag it for the content pass.
2. **Shared-device conditional input:** The Done-when mentions "shared-device exception" but this step has no conditional input for shared devices in the action column (unlike Device Code's dropdown). Should it? Per U28, the `shared-devices-exist` condition should have a question the admin answers. If this question exists on a different step (like "Give Shared Devices Their Own Policy"), that's fine. If it doesn't exist anywhere, add it.
