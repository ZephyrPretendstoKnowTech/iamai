# Walk of build 022acf4 — demo tenant, 2026-09-03

`npm run walk` (prompt 53 Unit 0): every surface of the demo at 1280, every plan row
opened one by one, the contract diff, the walk-51 invariants, the GetIAMAI plan file scanned
offline. Captures and screenshots under `walk/022acf4/` (not committed).

Verdict: show-ready on this walk (no P0). 14 P1, 22 P2.

## P0 — wrong or broken facts on screen

_none_

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
11. mock-signedout @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
12. mock-auth-consent @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
13. mock-auth-personal @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"
14. mock-auth-cancelled @1280 /connect: sentence over 25 words: "IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access base…"

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

## GetIAMAI

No plan file at fixtures/private/getiamai.plan.json; nothing scanned.

## Surfaces walked

| fixture | width | route | words | rows |
|---|---|---|---|---|
| demo | 1280 | /plan | 502 | 30 |
| demo | 1280 | /today | 600 | 38 |
| demo | 1280 | /export | 213 | 7 |
| demo | 1280 | /how | 2801 | 91 |
| demo | 1280 | /connect | 294 | 0 |
| demo | 1280 | /inventory | 129 | 0 |
| demo-week2 | 1280 | /plan | 441 | 30 |
| demo-week2 | 1280 | /today | 591 | 38 |
| mock-roles | 1280 | /connect | 353 | 0 |
| mock-gaps | 1280 | /connect | 396 | 0 |
| mock-free | 1280 | /connect | 348 | 0 |
| mock-scanning | 1280 | /connect | 324 | 0 |
| mock-ready | 1280 | /connect | 336 | 0 |
| mock-crash | 1280 | /error | 43 | 0 |
| mock-signedout | 1280 | /connect | 299 | 0 |
| mock-auth-consent | 1280 | /connect | 285 | 0 |
| mock-auth-personal | 1280 | /connect | 276 | 0 |
| mock-auth-cancelled | 1280 | /connect | 246 | 0 |
| home | 1280 | / | 228 | 1 |

First load of the demo on a throttled connection (Fast 3G, the production bundle served statically): 2.8 s to the first plan row. Readiness values seen: demo: mfa 36% · device 24%; demo-week2: mfa 45% · device 30%. Active-people counts seen: demo 33; demo-week2 33. Learn links checked: 39.
