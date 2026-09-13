# Content spec: Limit How Long Sessions Last

**Step ID:** `s-goal-all-users-no-persistence`
**Package:** `docs/implementation-content/s-goal-all-users-no-persistence/`

---

## Header

- Step type label: POLICY STEP — No change.
- Title: Limit How Long Sessions Last — No change.
- Badge: On Hold · Baseline references an unmapped group — No change. Correct hold reason.
- Progress bar: Not deployed → Report-only → Ready to enforce → Enforced — No change.

---

## Why

CURRENT →
A browser left signed in on a shared or personal machine is a signed-in attacker later; on a device you do not manage, every app is. Learn →

TARGET →
No change. Clear, plain-language explanation of session risk.

---

## Readiness tiles

### Tile 1: AFFECTED PEOPLE

- Icon: "!" — No change.
- Label: AFFECTED PEOPLE — No change.
- Collapsed summary: "Not established" — No change.

### Tile 2: BASELINE MAPPING

- Icon: "!" — No change.
- Label: BASELINE MAPPING — No change.
- Collapsed summary: "Baseline references an unmapped group" — No change.

### Tile 3: PREREQUISITE · READY

- Icon: "!" — No change.
- Label: PREREQUISITE · READY — No change.
- Collapsed summary: "Create or Correct Exclusions Group" — No change.

---

## Readiness bar

CURRENT →
Baseline references an unmapped group

TARGET →
No change. Correct — this step is held until baseline mappings are resolved.

### Readiness explanation

CURRENT →
Baseline mappings first (Plan settings): the baseline names a group of its author's, and IAMAI does not yet know whether it stands for something in GetIAMAI or is left out. Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.

TARGET →
Resolve the baseline mapping first (Plan settings → Baseline mappings): the baseline references a group from the baseline author's tenant. Decide whether it maps to a group in your tenant or should be left out. Then finish the Create or Correct Exclusions Group step: IAMAI found a group that qualifies, but it is not confirmed until you save it in that step.

Reason: C7 — "GetIAMAI" should reference "your tenant". C12 — "only your Save makes it the one this policy excludes" is internal language. Clarified what "baseline mappings" means.

---

## Milestone / action column

CURRENT →
On Hold · Baseline references an unmapped group

TARGET →
[Date should appear here, not lane substatus]

**Global issue C2**: Milestone shows lane substatus instead of a date.

---

## Implementation — Entra channel

CURRENT →
Create two separate Conditional Access policies. For each: Entra admin center → Entra ID → Conditional Access → Policies → New policy.

Policy A — browser

Name: Core - Session - Non-persistent browser sessions.
Users: Include All users. Exclude IAMAI's canonical groups and the resolved shared-device accounts.
Target resources: All resources.
Conditions → Client apps: Browser.
Grant: no grant requirement.
Session: Sign-in frequency → Periodic reauthentication → 12 hours; Persistent browser session → Never persistent.
Enable policy: Report-only.

Policy B — unmanaged device

Name: ‹unmanaged device session policy name›.
Users: same canonical groups/shared-device exclusions.
Target resources: All resources.
Conditions → Filter for devices: Configure Yes → Exclude filtered devices → device.isCompliant -eq True.
Grant: no grant requirement.
Session: Sign-in frequency → Periodic reauthentication → 9 hours; Persistent browser session → Never persistent.
Enable policy: Report-only.

TARGET →
This step creates two Conditional Access policies. For each: Entra admin center → Protection → Conditional Access → Policies → New policy.

Policy A — Browser sessions

1. Name: Core - Session - Non-persistent browser sessions.
2. Under Users → Include, select All users.
3. Under Users → Exclude, add the exclusions group from the Create or Correct Exclusions Group step, and any shared-device or kiosk accounts.
4. Under Target resources, select All resources.
5. Under Conditions → Client apps, check Browser only.
6. Leave Grant empty (no access control requirement).
7. Under Session, set Sign-in frequency to 12 hours (periodic reauthentication), and set Persistent browser session to Never persistent.
8. Set Enable policy to Report-only.
9. Click Save.

Policy B — Unmanaged devices

1. Name: Core - Session - Unmanaged device session limit.
2. Under Users → Include and Exclude, use the same groups as Policy A.
3. Under Target resources, select All resources.
4. Under Conditions → Filter for devices, set Configure to Yes → Exclude filtered devices from policy → Rule: device.isCompliant -eq True. (This makes the policy apply only to devices that are not compliant / not managed.)
5. Leave Grant empty.
6. Under Session, set Sign-in frequency to 9 hours (periodic reauthentication), and set Persistent browser session to Never persistent.
7. Set Enable policy to Report-only.
8. Click Save, then rescan in IAMAI.

Reason: C6/C7 — "IAMAI's canonical groups", "resolved shared-device accounts", "‹unmanaged device session policy name›", "canonical groups/shared-device exclusions" are internal terms. Rewritten as numbered portal steps with plain explanations.

---

## Implementation — AI Info channel

CURRENT →
ROLE: Help implement the IAMAI step Limit How Long Sessions Last. Create the intentional two-policy session set in Report-only.

AUTHORITY: The retained IAMAI baseline and package own the destination. Current Microsoft documentation owns current product/API behavior. Do not redesign the two-policy set or infer tenant facts.

TENANT CONTEXT: Tenant: GetIAMAI. Existing blockers: [list]. TARGET: Policy A: All users; canonical group/shared-device exclusions; All resources; Browser; 12-hour periodic sign-in frequency; Never persistent; no grant. Policy B: same population/resources; All client apps; exclude compliant devices with device.isCompliant -eq True; 9-hour frequency; Never persistent…

TARGET →
This step creates two Conditional Access policies that limit session duration:

Policy A limits browser sessions to 12 hours and disables "stay signed in" for all users (except the exclusions group and shared-device accounts). Policy B limits sessions on unmanaged (non-compliant) devices to 9 hours, regardless of client app.

Both policies start in Report-only. The two-policy design is intentional — one targets the client app (browser), the other targets the device state (unmanaged). Do not combine them into a single policy.

Prerequisites: resolve the baseline mapping, confirm the exclusions group, and finish the emergency access accounts step.

Reason: C7 — "retained IAMAI baseline and package", "canonical group/shared-device exclusions", "GetIAMAI" throughout. ROLE/AUTHORITY/TENANT CONTEXT scaffolding is developer framing. Rewritten as a plain explanation.

---

## Done when

CURRENT →
Both session policies are enforced in GetIAMAI: browser sessions are non-persistent, and unmanaged-device sessions are time-limited.

TARGET →
Both session policies are enforced: browser sessions are non-persistent with a 12-hour limit, and unmanaged-device sessions are limited to 9 hours.

Reason: "in GetIAMAI" removed. Added the specific hour values so the tech knows what to verify.

---

## Links

- Learn → link present. ✓
- Cross-reference: "Open Create or Correct Exclusions Group" — present. ✓
- Microsoft Learn (footer) — present. ✓

---

## Buttons

- Defer this step: Present. ✓
- Scan to update the plan: Present. ✓

---

## Global issues

- C2: Milestone shows lane substatus instead of a date.
- C6: Entra implementation uses internal placeholders and canonical terms — full rewrite above.
- C7: AI Info uses developer scaffolding (ROLE/AUTHORITY/TENANT CONTEXT) and "GetIAMAI", "canonical", "retained baseline" — rewrite above.
- C7: Done When says "in GetIAMAI" — fix above.
- C12: Readiness explanation uses "only your Save" language — fix above.
