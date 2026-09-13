# Content spec: Create the Baseline's Authentication Strength

**Step ID:** `s-prereq-auth-strength`
**Package:** `docs/implementation-content/s-prereq-auth-strength/`

---

## Why

CURRENT →
```
The baseline's admin, guest, risk and role-activation policies all point at one custom authentication strength; the policy cannot be created until the strength exists. Learn →
```

TARGET →
```
Several policies in the baseline require a specific set of authentication methods (called an "authentication strength"). This step creates that strength so those policies can reference it. Learn →
```

The current text is accurate but assumes the reader knows what an authentication strength is and how policies reference one. The rewrite explains the dependency in plain terms.

---

## Readiness

CURRENT → `✓ Clear — Nothing outstanding changes the next action.`

TARGET → `✓ Clear — No blockers. Ready to proceed.`

Same global fix as Passkeys.

---

## Readiness bar

CURRENT → `Ready now` (no filler sub-text visible)

No change. Good.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Sep 14, 2026

The strength whose combinations match the baseline's.

Authentication strength
Save
```

TARGET →
```
NEXT MILESTONE

Sep 14, 2026

Create or select the authentication strength.

Authentication strength
[picker or dropdown — if a matching strength exists, it should be pre-filled per U24]
Save
```

Changes:
- "The strength whose combinations match the baseline's." → "Create or select the authentication strength." The original is a noun phrase describing the object, not an action. The milestone sub-text should be an action.
- If the tenant already has a strength with the right combinations, U24 pre-fill should show it. Verify the picker works for authentication strengths the same way it does for groups.

---

## Implementation — Entra channel

CURRENT →
```
Open Entra ID > Authentication methods > Authentication strengths.
Select New authentication strength.
Name it Modern MFA + TAP.
Select exactly: Windows Hello for Business; Passkeys (FIDO2); Certificate-based authentication (multifactor); Temporary Access Pass (one-time); Temporary Access Pass (multi-use).
Review and Create.
Read the created object back and rescan IAMAI.
```

TARGET →
```
1. Go to Entra admin center → Authentication methods → Authentication strengths.
2. Click + New authentication strength.
3. Name: Modern MFA + TAP.
4. Select exactly these five methods:
   — Windows Hello for Business
   — Passkeys (FIDO2)
   — Certificate-based authentication (multifactor)
   — Temporary Access Pass (one-time use)
   — Temporary Access Pass (multi-use)
5. Do not select any other methods.
6. Review and Create.
7. Rescan in IAMAI.
```

Changes:
- Numbered steps.
- "Entra ID > Authentication methods" → "Entra admin center → Authentication methods" (consistent arrow notation).
- The five methods listed as a clear sub-list with dashes.
- "Do not select any other methods" added — a tech might tick "Password" by habit.
- "Read the created object back" → removed (internal concept; the rescan handles it).

---

## Implementation — AI Info channel

TARGET →
```
An authentication strength is a named set of methods that a Conditional Access policy can require. Instead of just "require MFA" (which accepts any second factor including phone call), this strength says "require one of these five specific methods."

The five methods are all phishing-resistant or temporary:
— Windows Hello for Business: biometric or PIN bound to the device
— Passkeys (FIDO2): a hardware key or Authenticator passkey
— Certificate-based authentication: a smart card or certificate
— Temporary Access Pass: a one-time code for bootstrapping (so a user with no method can sign in once to register)

Phone call, SMS, and the Authenticator push notification are deliberately excluded. They're not phishing-resistant.

Multiple policies in the plan will reference this strength by name. Create it once; they all share it.
```

---

## Done when

CURRENT →
```
A strength named Modern MFA + TAP exists with exactly those five combinations, or an existing strength with the same combinations is selected above.
```

TARGET →
```
An authentication strength named "Modern MFA + TAP" exists with exactly the five methods listed above, or an existing strength with the same methods is selected and confirmed.
```

Minor — "combinations" → "methods" (the user-facing term in Entra).

---

## Global issues
1. Readiness tile filler text — same global fix.
2. "Read the created object back" — internal concept, removed.
