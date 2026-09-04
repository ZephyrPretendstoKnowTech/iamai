# Walk of build df6adf6 — demo tenant, 2026-09-04

`npm run walk` (prompt 53 Unit 0): every surface of the demo at 1280, every plan row
opened one by one, the contract diff, the walk-51 invariants, the GetIAMAI plan file scanned
offline. Captures and screenshots under `walk/df6adf6/` (not committed).

Verdict: not show-ready: 6 P0. 17 P1, 34 P2.

## P0 — wrong or broken facts on screen

1. demo-author: the exclusions-group step is missing; it is on every plan
2. demo-author: the baseline's service-accounts block is not a row, although the demo has service accounts
3. demo-author: no Preparation row asks for separate admin accounts, although two admins use theirs for mail or Teams
4. demo-author: no plan row reads Report-only; the demo has a policy in report-only
5. demo-author: no Report-only row reads ready <date> on week one
6. demo-author: no Preparation row decides how devices are managed, although phones and unjoined computers sign in and the tenant holds Intune

## P1 — visible, not fatal

1. demo: the first load took 2.8 s to the first plan row on a throttled connection (production bundle; over 2 s)
2. demo @1280 step "Create or Correct Service Accounts Group": row "svc-mailer-1 · name contains "svc"; no MFA method registered; uses legacy authen…" is 1 sentences / 33 words, over 2 / 30
3. demo @1280 /export: row "Grounding bundleThe scan and plan as JSON, to feed another tool. Redacted unless…" is 4 sentences / 43 words, over 3 / 60
4. demo @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
5. demo-week2 @1280 step "Create or Correct Service Accounts Group": row "svc-mailer-1 · name contains "svc"; no MFA method registered; uses legacy authen…" is 1 sentences / 34 words, over 2 / 30
6. mock-roles @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
7. mock-gaps @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
8. mock-free @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
9. mock-scanning @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
10. mock-ready @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
11. mock-operator @1280 /plan footer: sentence over 25 words: "Require a Managed Device Outside the Office and Require a Fresh Sign-in for Intune Enrollm…"
12. mock-drop @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
13. demo-author @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
14. mock-signedout @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
15. mock-auth-consent @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
16. mock-auth-personal @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
17. mock-auth-cancelled @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"

## P2 — the rest

1. demo @1280 step "Create or Correct Allowed Countries Location": (contract question) row "Allowed countriesAustraliaPeople who travel or work abroadNo sign-ins from outsi…" is 3 sentences / 32 words, over 2 / 30
2. demo @1280 step "Decide How Devices Are Managed": (contract question) row "Phones Enrol phones in Intune Protect the apps only No company data on phonesCom…" is 4 sentences / 49 words, over 2 / 30
3. demo @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,You already confirm sign-ins to Contoso Pty Ltd with the Microso…" is 4 sentences / 87 words, over 2 / 30
4. demo @1280 step "Require Phishing-Resistant MFA for Admins": (contract question) row "CopyAdmins,From Tuesday, September 15, sign-ins by your admin account at Contoso…" is 3 sentences / 59 words, over 2 / 30
5. demo @1280 step "Block the Admin Portals for Non-Admins": (contract question) row "CopyHello,From Tuesday, September 15, the Azure portal and command-line tools at…" is 2 sentences / 51 words, over 2 / 30
6. demo @1280 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Tuesday, September 15, admin sessions at Contoso Pty Ltd expire …" is 3 sentences / 44 words, over 2 / 30
7. demo @1280 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Wednesday, September 16, sign-ins to Contoso Pty Ltd from o…" is 3 sentences / 40 words, over 2 / 30
8. demo @1280 step "Require a Managed Device Outside the Office": (contract question) row "CopyHi everyone,From Wednesday, September 23, Contoso Pty Ltd mail, files and Te…" is 3 sentences / 42 words, over 2 / 30
9. demo @1280 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Tuesday, September 22, when you close your browser you are …" is 2 sentences / 63 words, over 2 / 30
10. demo @1280 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Tuesday, September 22, Outlook, Teams and OneDrive on your Windows c…" is 4 sentences / 64 words, over 2 / 30
11. demo @1280 step "Protect Sign-in Method Registration": (contract question) row "CopyHi everyone,From Tuesday, September 15, setting up or changing your sign-in …" is 3 sentences / 40 words, over 2 / 30
12. demo @1280 step "Review Baseline Policies IAMAI Did Not Assess": (contract question) row "Does not apply hereIAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocationsSa…" is 1 sentences / 54 words, over 2 / 30
13. demo-week2 @1280 step "Create or Correct Allowed Countries Location": (contract question) row "Allowed countriesAustraliaPeople who travel or work abroadNo sign-ins from outsi…" is 3 sentences / 61 words, over 2 / 30
14. demo-week2 @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,You already confirm sign-ins to Contoso Pty Ltd with the Microso…" is 4 sentences / 95 words, over 2 / 30
15. demo-week2 @1280 step "Block the Admin Portals for Non-Admins": (contract question) row "CopyHello,From Tuesday, September 15, the Azure portal and command-line tools at…" is 2 sentences / 51 words, over 2 / 30
16. demo-week2 @1280 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Tuesday, September 15, admin sessions at Contoso Pty Ltd expire …" is 3 sentences / 44 words, over 2 / 30
17. demo-week2 @1280 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Wednesday, September 16, sign-ins to Contoso Pty Ltd from o…" is 3 sentences / 40 words, over 2 / 30
18. demo-week2 @1280 step "Require a Managed Device Outside the Office": (contract question) row "CopyHi everyone,From Wednesday, September 23, Contoso Pty Ltd mail, files and Te…" is 3 sentences / 42 words, over 2 / 30
19. demo-week2 @1280 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Tuesday, September 22, when you close your browser you are …" is 2 sentences / 63 words, over 2 / 30
20. demo-week2 @1280 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Tuesday, September 22, Outlook, Teams and OneDrive on your Windows c…" is 4 sentences / 64 words, over 2 / 30
21. demo-week2 @1280 step "Protect Sign-in Method Registration": (contract question) row "CopyHi everyone,From Tuesday, September 15, setting up or changing your sign-in …" is 3 sentences / 40 words, over 2 / 30
22. demo-week2 @1280 step "Review Baseline Policies IAMAI Did Not Assess": (contract question) row "Does not apply hereIAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocationsSa…" is 1 sentences / 54 words, over 2 / 30
23. mock-operator @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,You already confirm sign-ins to Contoso Pty Ltd with the Microso…" is 4 sentences / 87 words, over 2 / 30
24. mock-operator @1280 step "Block Legacy Authentication": (contract question) row "CopyHi,Your mail app is using an older sign-in method that stops working on Wedn…" is 3 sentences / 47 words, over 2 / 30
25. mock-operator @1280 step "Require Phishing-Resistant MFA for Admins": (contract question) row "CopyAdmins,From Thursday, September 10, sign-ins by your admin account at Contos…" is 3 sentences / 59 words, over 2 / 30
26. mock-operator @1280 step "Block the Admin Portals for Non-Admins": (contract question) row "CopyHello,From Thursday, September 10, the Azure portal and command-line tools a…" is 2 sentences / 51 words, over 2 / 30
27. mock-operator @1280 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Tuesday, September 15, admin sessions at Contoso Pty Ltd expire …" is 3 sentences / 44 words, over 2 / 30
28. mock-operator @1280 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Tuesday, September 15, sign-ins to Contoso Pty Ltd from out…" is 3 sentences / 40 words, over 2 / 30
29. mock-operator @1280 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Tuesday, September 15, when you close your browser you are …" is 2 sentences / 63 words, over 2 / 30
30. mock-operator @1280 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Tuesday, September 15, Outlook, Teams and OneDrive on your Windows c…" is 4 sentences / 64 words, over 2 / 30
31. mock-operator @1280 step "Protect Sign-in Method Registration": (contract question) row "CopyHi everyone,From Thursday, September 10, setting up or changing your sign-in…" is 3 sentences / 40 words, over 2 / 30
32. GetIAMAI plan file, s-goal-azure-management-mfa: a saved step for azure-management-mfa, a goal the baseline does not hold; the file predates item 9 and the next save drops it
33. GetIAMAI plan file, s-goal-mobile-app-protection: a saved step for mobile-app-protection, a goal the baseline does not hold; the file predates item 9 and the next save drops it
34. GetIAMAI plan file: the saved steps' v2 fields (rings, exit criteria, what-changes, failure modes, help desk, comms) carry old vocabulary (Nothing changes for anyone, This is groundwork, Add a second account above, Nothing to undo, nobody notices, An object or an answer); no v3 surface renders them; the export unit decides what the file keeps

## GetIAMAI

Scanned offline from the saved plan file (32 steps, saved 2026-09-02): every string in every step against the forbidden lists and the hole rule; findings above are labelled "GetIAMAI plan file". The file carries the plan's steps, decisions and checkpoints and no tenant snapshot, so the app cannot regenerate GetIAMAI from it without a sign-in; the in-app walk of GetIAMAI is not possible tonight and is a question for the morning.

## Surfaces walked

| fixture | width | route | words | rows |
|---|---|---|---|---|
| demo | 1280 | /plan | 502 | 30 |
| demo | 1280 | /today | 599 | 38 |
| demo | 1280 | /export | 213 | 7 |
| demo | 1280 | /how | 2801 | 91 |
| demo | 1280 | /connect | 294 | 0 |
| demo | 1280 | /inventory | 129 | 0 |
| demo-week2 | 1280 | /plan | 441 | 30 |
| demo-week2 | 1280 | /today | 590 | 38 |
| mock-roles | 1280 | /connect | 353 | 0 |
| mock-gaps | 1280 | /connect | 396 | 0 |
| mock-free | 1280 | /connect | 348 | 0 |
| mock-scanning | 1280 | /connect | 324 | 0 |
| mock-ready | 1280 | /connect | 336 | 0 |
| mock-crash | 1280 | /error | 43 | 0 |
| mock-operator | 1280 | /today | 253 | 7 |
| mock-operator | 1280 | /plan | 473 | 24 |
| mock-drop | 1280 | /connect | 361 | 0 |
| demo-author | 1280 | /connect | 292 | 0 |
| mock-signedout | 1280 | /connect | 299 | 0 |
| mock-auth-consent | 1280 | /connect | 285 | 0 |
| mock-auth-personal | 1280 | /connect | 276 | 0 |
| mock-auth-cancelled | 1280 | /connect | 246 | 0 |
| home | 1280 | / | 228 | 1 |

First load of the demo on a throttled connection (Fast 3G, the production bundle served statically): 2.8 s to the first plan row. Readiness values seen: demo: mfa 36% · device 24%; demo-week2: mfa 45% · device 30%; mock-operator: mfa 0%. Active-people counts seen: demo 33; demo-week2 33; mock-operator 4. Learn links checked: 39.
