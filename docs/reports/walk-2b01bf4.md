# Walk of build 2b01bf4 — demo tenant, 2026-09-03

`npm run walk` (prompt 53 Unit 0): every surface of the demo at 1280, every plan row
opened one by one, the contract diff, the walk-51 invariants, the GetIAMAI plan file scanned
offline. Captures and screenshots under `walk/2b01bf4/` (not committed).

Verdict: not show-ready: 2 P0. 6 P1, 19 P2.

## P0 — wrong or broken facts on screen

1. demo @1280 step "Require Token Protection on Windows" / More: forbidden string "is done" on the surface (plan.step.more forbid)
2. demo-week2 @1280 step "Require Token Protection on Windows" / More: forbidden string "is done" on the surface (plan.step.more forbid)

## P1 — visible, not fatal

1. demo: the first load took 2.6 s to the first plan row on a throttled connection (production bundle; over 2 s)
2. demo @1280 step "Create or Correct Service Accounts Group": row "svc-mailer-1 · name contains "svc"; no MFA method registered; uses legacy authen…" is 1 sentences / 33 words, over 2 / 30
3. demo @1280 /export: row "Grounding bundleThe scan and plan as JSON, to feed another tool. Redacted unless…" is 4 sentences / 43 words, over 3 / 60
4. demo @1280 /connect: button "review" is not in the connect.scanned contract's allow list
5. demo @1280 /connect: page prose 10 sentences / 151 words, over the connect.scanned budget 9 / 130
6. demo-week2 @1280 step "Create or Correct Service Accounts Group": row "svc-mailer-1 · name contains "svc"; no MFA method registered; uses legacy authen…" is 1 sentences / 33 words, over 2 / 30

## P2 — the rest

1. demo @1280 step "Create or Correct Allowed Countries Location": (contract question) row "Allowed countriesAustraliaPeople who travel or work abroadNo sign-ins from outsi…" is 3 sentences / 32 words, over 2 / 30
2. demo @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,From, signing in to Contoso Pty Ltd will ask you to confirm with…" is 5 sentences / 103 words, over 2 / 30
3. demo @1280 step "Require Phishing-Resistant MFA for Admins": (contract question) row "CopyAdmins,From Thursday, September 10, sign-ins by your admin account at Contos…" is 3 sentences / 55 words, over 2 / 30
4. demo @1280 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Thursday, September 10, sign-ins to Contoso Pty Ltd from ou…" is 3 sentences / 40 words, over 2 / 30
5. demo @1280 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Tuesday, September 15, admin sessions at Contoso Pty Ltd expire …" is 3 sentences / 42 words, over 2 / 30
6. demo @1280 step "Block the Admin Portals for Non-Admins": (contract question) row "CopyHello,From Tuesday, September 15, the Azure portal and command-line tools at…" is 2 sentences / 51 words, over 2 / 30
7. demo @1280 step "Require a Managed Device Outside the Office": (contract question) row "CopyHi everyone,From Tuesday, September 22, Contoso Pty Ltd mail, files and Team…" is 3 sentences / 40 words, over 2 / 30
8. demo @1280 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Tuesday, September 29, when you close your browser you are …" is 2 sentences / 57 words, over 2 / 30
9. demo @1280 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Tuesday, September 29, Outlook, Teams and OneDrive on your Windows c…" is 4 sentences / 64 words, over 2 / 30
10. demo @1280 step "Protect Sign-in Method Registration": (contract question) row "CopyHi everyone,From Tuesday, September 15, setting up or changing your sign-in …" is 3 sentences / 40 words, over 2 / 30
11. demo-week2 @1280 step "Create or Correct Allowed Countries Location": (contract question) row "Allowed countriesAustraliaPeople who travel or work abroadNo sign-ins from outsi…" is 3 sentences / 32 words, over 2 / 30
12. demo-week2 @1280 step "Create and Enforce the MFA Registration Campaign": (contract question) row "CopyHi everyone,From, signing in to Contoso Pty Ltd will ask you to confirm with…" is 5 sentences / 103 words, over 2 / 30
13. demo-week2 @1280 step "Shorten Admin Sessions": (contract question) row "CopyAdmins,From Tuesday, September 15, admin sessions at Contoso Pty Ltd expire …" is 3 sentences / 42 words, over 2 / 30
14. demo-week2 @1280 step "Block the Admin Portals for Non-Admins": (contract question) row "CopyHello,From Tuesday, September 15, the Azure portal and command-line tools at…" is 2 sentences / 51 words, over 2 / 30
15. demo-week2 @1280 step "Block Sign-ins From Countries Not Allowed": (contract question) row "CopyHi everyone,From Tuesday, September 15, sign-ins to Contoso Pty Ltd from out…" is 3 sentences / 40 words, over 2 / 30
16. demo-week2 @1280 step "Require a Managed Device Outside the Office": (contract question) row "CopyHi everyone,From Tuesday, September 22, Contoso Pty Ltd mail, files and Team…" is 3 sentences / 40 words, over 2 / 30
17. demo-week2 @1280 step "Limit How Long Sessions Last": (contract question) row "CopyHi everyone,From Tuesday, September 29, when you close your browser you are …" is 2 sentences / 57 words, over 2 / 30
18. demo-week2 @1280 step "Require Token Protection on Windows": (contract question) row "CopyHi,From Tuesday, September 29, Outlook, Teams and OneDrive on your Windows c…" is 4 sentences / 64 words, over 2 / 30
19. demo-week2 @1280 step "Protect Sign-in Method Registration": (contract question) row "CopyHi everyone,From Tuesday, September 15, setting up or changing your sign-in …" is 3 sentences / 40 words, over 2 / 30

## GetIAMAI

No plan file at fixtures/private/getiamai.plan.json; nothing scanned.

## Surfaces walked

| fixture | width | route | words | rows |
|---|---|---|---|---|
| demo | 1280 | /plan | 447 | 29 |
| demo | 1280 | /today | 595 | 38 |
| demo | 1280 | /export | 213 | 7 |
| demo | 1280 | /how | 2842 | 91 |
| demo | 1280 | /connect | 175 | 1 |
| demo-week2 | 1280 | /plan | 395 | 26 |
| demo-week2 | 1280 | /today | 586 | 38 |

First load of the demo on a throttled connection (Fast 3G, the production bundle served statically): 2.6 s to the first plan row. Readiness values seen: demo: admin 60% · mfa 36% · device 30%; demo-week2: admin 60% · mfa 45% · device 30%. Active-people counts seen: demo 33; demo-week2 33. Learn links checked: 35.
