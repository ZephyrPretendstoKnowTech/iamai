# Content spec: Create and Enforce the MFA Registration Campaign

**Step ID:** `s-verify-mfa`
**Package:** `docs/implementation-content/s-verify-mfa/`

---

## Why

CURRENT →
```
Enforcement should change nothing for anyone; that is only true once every active person holds a phishing-resistant method that has been seen to work. Learn →
```

TARGET →
```
Enforcement should change nothing for anyone. That's only true once every person has registered a phishing-resistant method and used it to sign in at least once. Learn →
```

Split the run-on sentence. "Holds a phishing-resistant method that has been seen to work" → plain English.

---

## Readiness tiles

### Tile 1: PEOPLE WHO NEED SPECIAL CARE — Confirm

CURRENT → `! PEOPLE WHO NEED SPECIAL CARE — Confirm`

TARGET (collapsed) → `! SPECIAL CARE — Confirm who needs hands-on help`

Same issue as Allowed Countries — the label is too long. "PEOPLE WHO NEED SPECIAL CARE" wraps. Shorten the label; put the detail in the expanded content.

### Tile 2: PREREQUISITE · READY — Set Up Passkeys

CURRENT → `… PREREQUISITE · READY — Set Up Passkeys to Match the Baseline`

Same global fix: label → `PREREQUISITE · IN PROGRESS`. The "…" icon vs "!" inconsistency.

### Tile 3: AFFECTED PEOPLE — 3 active people · 2 admins

No change. Good.

---

## Readiness bar

CURRENT → `After Set Up Passkeys to Match the Baseline`

No change. Correct for Up Next.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Sep 15, 2026

Admins, anyone with no method, and anyone with text or call only. These get the in-person instructions.

People who need special care
Admin
Breakglass
Save
```

TARGET →
```
NEXT MILESTONE

Sep 15, 2026

Identify anyone who needs hands-on help registering.

People who need special care

Admins, anyone with no sign-in method, and anyone who only has text or phone call. These people need in-person walkthrough to set up their passkey.

Admin
Breakglass
[search]
Save
```

Changes:
- Milestone sub-text simplified: "Admins, anyone with no method, and anyone with text or call only. These get the in-person instructions." → "Identify anyone who needs hands-on help registering." The detail about who qualifies moves below the picker label.
- Added explanation paragraph between the "People who need special care" label and the chips, so the tech understands WHO belongs here.
- The pre-filled chips (Admin, Breakglass) are correct — IAMAI nominated them from the scan.

---

## Implementation — Entra channel

CURRENT →
```
Open the Entra admin center → Security → Authentication methods → Registration campaign.
Enable the campaign: set State to Enabled.
Target: All users.
Authentication method: Passkey (Microsoft Authenticator).
Enforcement: remind on sign-in, so each person is asked at sign-in until they have set it up.
Save.
```

TARGET →
```
1. Go to Entra admin center → Security → Authentication methods → Registration campaign.
2. State: Enabled.
3. Target: All users.
4. Authentication method: Passkey (Microsoft Authenticator).
5. Number of days allowed to snooze: 14 (or your organization's preference).
6. Save.

Each user will see a prompt at their next sign-in asking them to register a passkey. They can snooze it, but it returns until they complete registration.
```

Changes:
- Numbered steps.
- Added snooze setting (missing from current content — it's a campaign setting the admin needs to decide).
- Added the one-sentence explanation of what happens after Save.
- Removed "Enforcement: remind on sign-in, so each person is asked at sign-in until they have set it up" — redundant with the explanation.

---

## Implementation — AI Info channel

CURRENT → (read from package — likely contains the in-person walkthrough)

TARGET →
```
After enabling the campaign, help each special-care person register in person:

1. Book 10 minutes with each person listed under "People who need special care."
2. Open aka.ms/mfasetup with them signed in.
3. If they have no method at all: issue a Temporary Access Pass first (Entra admin center → Users → [user] → Authentication methods → Add → Temporary Access Pass). This gives them a one-time code to sign in and register.
4. If they only have text or phone call: register the passkey first, then remove the phone number from their authentication methods so it's no longer a sign-in option.
5. Admins: register a passkey or a hardware security key — either counts as phishing-resistant.
6. Have each person sign in one more time after registration. IAMAI checks for the sign-in record on the next scan.

Track progress on the MFA Readiness page — it shows who still needs setup and who still needs a verified sign-in.
```

Changes:
- This was the operational walkthrough previously in "What to do." Now it lives in the AI Info channel.
- Step 3 adds the specific Entra path for issuing a TAP (the original said "issue a Temporary Access Pass first" with no path).
- Step 6 explains WHY the sign-in matters (IAMAI checks for it).
- Added the MFA Readiness cross-reference as a sentence, not just a mention.

---

## Done when

CURRENT →
```
Every admin is Ready for phishing-resistant MFA, and the registration campaign has been reviewed for all other users.
```

No change. This was already rewritten in B8 and is good.

---

## Links

- ✓ Learn → correct
- ✓ Microsoft Learn at bottom — correct
- **Missing:** No link to the MFA Readiness page. The AI Info channel references it by name but doesn't link to it. Add: `[MFA Readiness →](#/readiness)` at the end of the AI Info content.

---

## Global issues
1. Tile label "PEOPLE WHO NEED SPECIAL CARE" too long — content fix.
2. Prerequisite tile "…" vs "!" icon inconsistency — renderer fix.
3. Prerequisite tile label → IN PROGRESS — renderer fix.
4. Missing MFA Readiness link in AI Info — content fix.
