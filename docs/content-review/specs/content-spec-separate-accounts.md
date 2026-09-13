# Content spec: Use Separate Accounts for Admin Work

**Step ID:** `s-check-separate-admin-accounts`
**Package:** `docs/implementation-content/s-check-separate-admin-accounts/`

---

## Why

CURRENT →
```
An admin account that also reads mail and joins Teams meetings is phished like any other mailbox; the admin policies then guard an account that is open all day. Learn →
```

No change. Explains the risk clearly.

---

## Readiness

CURRENT → `✓ Clear — Nothing outstanding changes the next action.` + `1 satisfied / AFFECTED PEOPLE: 1 active person · 1 admin`

TARGET → Change "Nothing outstanding changes the next action." → "No blockers. Ready to proceed."

The AFFECTED PEOPLE tile is collapsed under "1 satisfied" — good, shows there's one admin who needs a separate account.

---

## Readiness bar

CURRENT →
```
Ready now

For each person:
```

TARGET →
```
Ready now
```

"For each person:" is a fragment from the old What-to-do section that survived. It hangs under the bar with no content following it. Remove it — the Implementation section covers the per-person process.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Sep 14, 2026

Verify admin accounts are separated
```

No change. Specific action, has a date. Good.

---

## Implementation — Entra channel

CURRENT →
```
For each person who holds a directory role and uses that same account for mail or Teams:

Create a second, cloud-only account for the role: Entra admin center → Entra ID → Users → New user → Create new user. Name it so the purpose is obvious (adm- and their name), and assign no licence, so it has no mailbox.
Register a passkey or security key on the admin account before its first use: sign in as it at https://aka.ms/mysecurityinfo. The admin policies require one.
Move the directory role to it: Entra admin center → Entra ID → Roles and administrators → the role → Add assignments → the admin account. A role held through Privileged Identity Management stays eligible on the new account; do not make it permanent.
Sign in to an admin portal with the admin account and confirm the role works, then remove the role from the everyday account.
Keep mail, Teams and files on the everyday account; open admin portals with the admin account only.
```

TARGET →
```
For each person who holds a directory role and uses that same account for daily mail or Teams:

1. Create a dedicated admin account: Entra admin center → Users → New user → Create new user. Name it clearly (e.g. adm-jsmith@yourdomain.onmicrosoft.com). Do not assign a license — admin accounts don't need mail or Teams.

2. Register a passkey on the admin account: sign in as the new account at https://aka.ms/mysecurityinfo and register a passkey or hardware security key. The baseline's admin policies require phishing-resistant MFA.

3. Move the directory role: Entra admin center → Roles and administrators → find the role (e.g. Global Administrator) → Add assignments → select the new admin account. If the role is managed through PIM (Privileged Identity Management), keep it as "eligible," not "active."

4. Test the admin account: sign in to an admin portal (e.g. entra.microsoft.com) with the new account. Confirm the role works.

5. Remove the role from the everyday account: go back to Roles and administrators → the same role → remove the everyday account's assignment.

6. Going forward: use the everyday account for mail, Teams, and files. Use the admin account only for admin portals.
```

Changes:
- Numbered steps for scannability.
- "Entra admin center → Entra ID → Users" → "Entra admin center → Users" (simplified navigation).
- Added example naming (adm-jsmith@) so the tech has a template.
- "assign no licence, so it has no mailbox" → "Do not assign a license — admin accounts don't need mail or Teams" (explains why).
- PIM guidance clarified: "keep it as 'eligible,' not 'active'" with the terms a tech would see in the portal.
- Step 4 (test) and step 5 (remove from everyday) split out as explicit steps — the original buried them in one paragraph.

---

## Implementation — AI Info channel

Review current content. If missing or generic, replace with:

```
Separate admin accounts mean an attacker who phishes someone's mailbox doesn't get admin access. The everyday account has mail, Teams, and a license; the admin account has a directory role and no license.

The key rule: the admin account never signs into anything except admin portals. No mail. No Teams. No browsing. This limits the attack surface to the admin portals themselves, which are protected by the phishing-resistant MFA policy.

Name the account obviously (adm-name) so it's clear in audit logs and role assignments which account did what.
```

---

## Done when

CURRENT →
```
No account with a directory role has mail or Teams sign-ins in the records.
```

No change. Verifiable from sign-in logs. Good.

---

## Buttons

- "Defer this step" ✓ — correct, an org may decide not to separate accounts.
- No "Doesn't apply here" — correct, if the step generated, it means an admin uses a shared account.

---

## Links

- ✓ Learn → `learn.microsoft.com/security/privileged-access-workstations/privileged-access-...` — correct.
- ✓ Microsoft Learn at bottom.

---

## Global issues
1. "For each person:" fragment in the readiness bar — content/renderer fix.
2. Readiness tile filler text — global fix.
3. Source checked present ✓.
