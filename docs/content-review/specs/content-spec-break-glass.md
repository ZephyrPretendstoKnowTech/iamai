# Content spec: Create or Correct Emergency Access Accounts

**Step ID:** `s-prereq-break-glass`
**Package:** `docs/implementation-content/s-prereq-break-glass/`

---

## Header

- Step type label: PREPARATION STEP — No change.
- Title: Create or Correct Emergency Access Accounts — No change.
- Badge: Ready · Create — No change.
- Subtitle: "Done together with Create or Correct Exclusions Group: these accounts are the members of that group, and the group is what every policy excludes." — No change. Clear enough.

---

## Why

CURRENT →
Emergency access accounts are how you keep access to GetIAMAI if a change goes wrong. Learn →

TARGET →
Emergency access accounts are how you keep access to your tenant if a Conditional Access change locks everyone out. Learn →

Reason: "GetIAMAI" is the product name, not the tenant. Emergency access protects tenant access, not IAMAI access. A help desk tech reading this needs to understand the real consequence.

---

## Readiness tiles

### Tile 1: ACCOUNT 1

- Icon: "!" — No change. Appropriate when not yet selected.
- Label: ACCOUNT 1 — No change.
- Collapsed summary: "Not selected" — No change.
- Expanded content:

CURRENT →
Choose an emergency access account in the action column, then save.

TARGET →
No change. Clear instruction.

### Tile 2: ACCOUNT 2

- Icon: "!" — No change.
- Label: ACCOUNT 2 — No change.
- Collapsed summary: "Not selected" — No change.
- Expanded content:

CURRENT →
Choose an emergency access account in the action column, then save.

TARGET →
No change. Same as Tile 1.

---

## Readiness bar

CURRENT →
Ready now

TARGET →
No change. Correct status.

### Readiness explanation (via "Why IAMAI says this")

**Who this touches:**

CURRENT →
The emergency access accounts, and every policy that must exclude them.

Your own account, Admin, is not one of these and must not be.

TARGET →
No change. Clear and specific.

**Why it matters:**

CURRENT →
Object configuration can prove identity, role and membership, but only a controlled drill proves that the emergency path actually works when needed.

TARGET →
No change. Good explanation.

---

## Milestone / action column

- Milestone date: Sep 14, 2026 — No change. Shows a real date (no C2 bug).
- Milestone sub-text:

CURRENT →
Create and verify two emergency accounts

TARGET →
No change. Specific action.

- Explanation paragraph:

CURRENT →
Add every account that exists only for this purpose; two are needed. IAMAI nominated these from names, roles and exclusions; a nomination is not a choice, so no account is emergency access until you choose it here and save.

TARGET →
No change. Clear enough — explains nominations vs. choices well.

- Input: Search box for emergency access accounts — No change. Labeled "Emergency access accounts" with search.
- Save button: Present. No change.

---

## Implementation — Entra channel

CURRENT →
Preamble: "Use the owner-confirmed emergency account identities only."

1. In Entra admin center → Entra ID → Users, create or open the dedicated emergency account.
2. For a new account, use the tenant's *.onmicrosoft.com domain and keep it cloud-only. Do not source it from federation or on-premises synchronization.
3. Confirm the account is enabled and dedicated to emergency recovery rather than normal daily work.
4. Assign Global Administrator as an active permanent assignment, not merely eligible through PIM.
5. Register the organization-approved emergency phishing-resistant method. Microsoft currently recommends Passkey (FIDO2); CBA is also supported where PKI already exists. Do not bind the account to an employee-personal device.
6. Put the account in the single IAMAI-resolved emergency/exclusions group.
7. Repeat for every owner-confirmed emergency account; maintain at least two.
8. Store credentials/keys outside IAMAI in the approved secure custody process.
9. Confirm monitoring exists for emergency-account use.
10. Run the real validation drill before treating the recovery path as proven.

Note: "Machine JSON/PowerShell for this step is deliberately partial: it can ensure the permanent role and group membership for a resolved stable user ID, but it does not create, register, or store credentials."

TARGET →
Preamble: No change.

Steps 1–5: No change. These are clear portal-walkthrough instructions.

6. CURRENT: "Put the account in the single IAMAI-resolved emergency/exclusions group."
   TARGET: "Add the account to the exclusions group you chose in the Create or Correct Exclusions Group step."
   Reason: C1/C7 — "IAMAI-resolved" is an internal term.

7. No change.

8. CURRENT: "Store credentials/keys outside IAMAI in the approved secure custody process."
   TARGET: "Store credentials and recovery keys in your organization's secure custody process (e.g. a safe or vault). Do not store them in IAMAI."
   Reason: "outside IAMAI" is unclear to a tech. The sentence should explain what secure custody means.

9–10. No change.

Note after list: No change. Clear explanation of why the machine scripts are partial.

---

## Implementation — AI Info channel

CURRENT →
Review the owner-confirmed emergency accounts ‹emergency accounts› for GetIAMAI, each on its own evidence. Target: cloud-only onmicrosoft.com identity, enabled, permanent active Global Administrator, phishing-resistant emergency authentication, canonical exclusions-group membership, independent secure custody, monitoring, and real drill proof. Machine actions may only ensure the deterministic role and group membership. Never request or expose credentials.

TARGET →
Review the emergency access accounts for this tenant, checking each account individually. Each account must be: a cloud-only *.onmicrosoft.com identity, enabled, permanently assigned the Global Administrator role (not PIM-eligible), registered with a phishing-resistant authentication method, a member of the exclusions group, stored in secure custody independent of any single person, monitored for sign-in activity, and validated with a real recovery drill. Automation can set the role assignment and group membership, but cannot create accounts, register credentials, or store keys.

Reason: C7 — "canonical exclusions-group membership", "IAMAI-resolved", "GetIAMAI", "‹emergency accounts›" are all internal terms. Rewritten for a help desk audience.

---

## Done when

CURRENT →
Every minimum safety check passes on the next scan.

Each hardening recommendation passes, or is deferred to Cleanup.

TARGET →
No change. Specific to this step — emergency access accounts have minimum safety checks (existence, role, group membership) and hardening checks (monitoring, MFA method, drill).

---

## Links

- Learn → https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access — Correct. ✓
- Microsoft Learn (footer) → same URL — Correct. ✓
- Troubleshooting button — Present. ✓
- No cross-reference links to other steps visible (could link to "Open Create or Correct Exclusions Group" since the subtitle mentions it, but this is a nice-to-have).

---

## Buttons

- Save: Present. ✓
- Scan to update the plan: Present. ✓
- Defer this step: **Not present.** This is a preparation step — deferring may not make sense since other steps depend on it. No change needed.
- Doesn't apply here: Not present. Correct — emergency access is always applicable.

---

## Global issues

- C7 in Entra step 6: "IAMAI-resolved emergency/exclusions group" — fix above.
- C7 in Entra step 8: "outside IAMAI" — fix above.
- C7 in AI Info: multiple internal terms — full rewrite above.
- Why section says "GetIAMAI" instead of referencing the tenant — fix above.
