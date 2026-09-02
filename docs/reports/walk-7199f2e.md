# Walk of build 7199f2e — demo tenant, 2026-09-02

`npm run walk` (prompt 53 Unit 0): every surface of the demo at 1280 and 390, every plan row
opened one by one, the contract diff, the walk-51 invariants, the GetIAMAI plan file scanned
offline. Captures and screenshots under `walk/7199f2e/` (not committed).

Verdict: show-ready on this walk (no P0). 2 P1, 20 P2.

## P0 — wrong or broken facts on screen

_none_

## P1 — visible, not fatal

1. Learn link https://learn.microsoft.com/entra/identity/users/users-inactive answers 404
2. Learn link https://learn.microsoft.com/entra/identity/conditional-access/policy-admin-phishing-resistant-mfa answers 404

## P2 — the rest

1. demo @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "People who need special care Casey Kim · No method Quinn Ivanova · Never prompte…" is 1 sentences / 64 words, over 2 / 30
2. demo @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,From Tuesday, September 8, signing in to Contoso Pty Ltd will as…" is 5 sentences / 107 words, over 2 / 30
3. demo @1280 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Wednesday, September 9, admin sessions at Contoso Pty Ltd expire…" is 2 sentences / 38 words, over 2 / 30
4. demo @1280 step "Require Phishing-Resistant MFA for Admins": (contract question) row "CopyAdmins,From Tuesday, September 8, admin sign-ins at Contoso Pty Ltd need a p…" is 3 sentences / 52 words, over 2 / 30
5. demo @1280 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Tuesday, September 8, sign-ins to Contoso Pty Ltd from outs…" is 3 sentences / 40 words, over 2 / 30
6. demo @1280 step "Require a Managed Device for Office 365": (contract question) row "CopyHi everyone,From Monday, September 21, Contoso Pty Ltd mail, files and Teams…" is 3 sentences / 47 words, over 2 / 30
7. demo @1280 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Monday, September 28, when you close your browser you are s…" is 2 sentences / 57 words, over 2 / 30
8. demo @1280 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Monday, September 28, Outlook, Teams and OneDrive on your Windows co…" is 3 sentences / 53 words, over 2 / 30
9. demo @390 step "Create and Enforce the MFA Registration Campaign": (contract question) row "People who need special care Casey Kim · No method Quinn Ivanova · Never prompte…" is 1 sentences / 64 words, over 2 / 30
10. demo @390 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,From Tuesday, September 8, signing in to Contoso Pty Ltd will as…" is 5 sentences / 107 words, over 2 / 30
11. demo @390 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Wednesday, September 9, admin sessions at Contoso Pty Ltd expire…" is 2 sentences / 38 words, over 2 / 30
12. demo @390 step "Require Phishing-Resistant MFA for Admins": (contract question) row "CopyAdmins,From Tuesday, September 8, admin sign-ins at Contoso Pty Ltd need a p…" is 3 sentences / 52 words, over 2 / 30
13. demo @390 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Tuesday, September 8, sign-ins to Contoso Pty Ltd from outs…" is 3 sentences / 40 words, over 2 / 30
14. demo @390 step "Require a Managed Device for Office 365": (contract question) row "CopyHi everyone,From Monday, September 21, Contoso Pty Ltd mail, files and Teams…" is 3 sentences / 47 words, over 2 / 30
15. demo @390 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Monday, September 28, when you close your browser you are s…" is 2 sentences / 57 words, over 2 / 30
16. demo @390 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Monday, September 28, Outlook, Teams and OneDrive on your Windows co…" is 3 sentences / 53 words, over 2 / 30
17. GetIAMAI plan file, s-goal-register-info-protected: a saved step for register-info-protected, a goal the baseline does not hold; the file predates item 9 and the next save drops it
18. GetIAMAI plan file, s-goal-azure-management-mfa: a saved step for azure-management-mfa, a goal the baseline does not hold; the file predates item 9 and the next save drops it
19. GetIAMAI plan file, s-goal-mobile-app-protection: a saved step for mobile-app-protection, a goal the baseline does not hold; the file predates item 9 and the next save drops it
20. GetIAMAI plan file: the saved steps' v2 fields (rings, exit criteria, what-changes, failure modes, help desk, comms) carry old vocabulary (Nothing changes for anyone, This is groundwork, Add a second account above, Nothing to undo, nobody notices, An object or an answer); no v3 surface renders them; the export unit decides what the file keeps

## GetIAMAI

Scanned offline from the saved plan file (32 steps, saved 2026-09-02): every string in every step against the forbidden lists and the hole rule; findings above are labelled "GetIAMAI plan file". The file carries the plan's steps, decisions and checkpoints and no tenant snapshot, so the app cannot regenerate GetIAMAI from it without a sign-in; the in-app walk of GetIAMAI is not possible tonight and is a question for the morning.

## Surfaces walked

| fixture | width | route | words | rows |
|---|---|---|---|---|
| demo | 1280 | /plan | 376 | 27 |
| demo | 1280 | /today | 575 | 37 |
| demo | 1280 | /export | 177 | 6 |
| demo | 1280 | /how | 2839 | 91 |
| demo | 1280 | /connect | 48 | 0 |
| demo | 390 | /plan | 376 | 27 |
| demo | 390 | /today | 575 | 37 |
| demo | 390 | /export | 177 | 6 |
| demo | 390 | /how | 2839 | 91 |
| demo | 390 | /connect | 48 | 0 |

Readiness values seen: admin 60% · mfa 36% · device 30%. Active-people counts seen: 33. Learn links checked: 16.
