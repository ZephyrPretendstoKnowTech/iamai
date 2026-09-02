# Lockout scenarios the planner must catch

Twenty-two published accounts of Conditional Access changes that locked people out or
broke something, checked against the engine on 31 Aug 2026 (build d9d3213). Prompt 48
adds the evidence the misses need. The rule for every scenario: it earns a line on a
step only when named from this tenant's evidence, with the client, the count, the
people, the action and the date; the generic version stays behind *More*.

Sources are public posts: Microsoft Q&A, Microsoft Tech Community, Microsoft Learn's
own troubleshooting pages, LinkedIn, and MSP blogs.

| # | Scenario | Source | Engine before 48 | Line on the step |
|---|---|---|---|---|
| 1 | Block legacy auth locked out a person on a legacy mail client four minutes after enforcement | LinkedIn, Edward Griggs, Aug 2026 | Caught: legacy client apps flagged per person | "N signed in with IMAP4 / POP3 / Authenticated SMTP this month: A, B — they will break on <date>" |
| 2 | Whole tenant locked out, Global Admin included, until Microsoft's Data Protection team excluded an account | Microsoft Q&A 1600190 (Feb 2024), 1662053 (May 2024) | Caught: break-glass checks; operator lockout is a hard block | existing checks; stays a block |
| 3 | Require-compliant-device blocked Autopilot `-Online` registration (Graph Command Line Tools from a non-compliant machine) | Microsoft Q&A 5599717 (Oct 2025) | Missed: no device state per sign-in | "N technician sign-ins to Graph Command Line Tools came from non-compliant devices — Autopilot registration from those machines stops" |
| 4 | One-hour sign-in frequency locked VPN users out until sessions were revoked; a daily frequency prompted people many times a day and Outlook mobile lost its apps | Microsoft Q&A 852942 (May 2022), 769094 | Partly: generic session warnings | "the 4-hour session also covers FortiClient VPN (2 people), Salesforce (5) — test their re-auth first" |
| 5 | Trusted location shows Not matched (IPv6, stale ranges); ISPs rotate IPs, carrier NAT; a VPN egressing in a blocked country locks out staff | Microsoft Q&A 5883764 (May 2026); m365.fm Apr 2026; CIAOPS May 2026 | Partly: countries evidence-based, IP locations on faith | "0 of 164 sign-ins matched 'HQ' this month — its ranges are stale or IPv6 is missing" |
| 6 | Guests in an MFA-setup loop; guests told to re-register Authenticator; strength blocks Entra guests without home MFA | Tech Community 4292793 (Nov 2024); Microsoft Q&A 2110773, 5778605 (Feb 2026) | Partly: guests known, trust setting collected but unused | "6 guests signed in this month; MFA trust from Entra tenants is off — each will be asked to register here; turn trust on first" |
| 7 | Printers, scanners and LOB apps on SMTP AUTH fail after legacy auth is blocked | Microsoft Learn troubleshooting; Microsoft Q&A 5814896 (Mar 2026); CIS 5.2.2.3 | Caught when the device sent in the window; service accounts carved out | "scanner@ signs in by Authenticated SMTP — move it to the SMTP relay or exclude it"; can't-see: devices that did not send this month |
| 8 | Teams Rooms signed out by sign-in frequency; device-code block stops remote sign-in; strength unsupported; failures surface at the next token renewal | Microsoft Learn Teams Rooms CA matrix; IT trip Jul 2026; Neat Jun 2026 | Partly: device-code evidence only | shared-device population, own step: "3 shared devices: Boardroom, Huddle-1, Lobby — excluded from user policies; their own policy is step 4" |
| 9 | Token protection drops personal Windows devices, admin VMs, RDP jump boxes | CyberHoot Aug 2025; Microsoft Q&A 5817798 (Mar 2026) | Partly: template scoped right; device state guessed from ownership | "5 people sign in to Outlook from Windows devices that are neither joined nor registered — they will be signed out" |
| 10 | A block appears not to work because Outlook keeps syncing on its refresh token | Microsoft Q&A 5607477 (Nov 2025) | Caught in copy, three places | Dates side-line, once: "takes effect as sessions refresh, within a day; to apply now, revoke sessions" |
| 11 | GDAP technician with the right roles cannot reach Conditional Access to fix a customer's policy; Microsoft's answer is to exclude service-provider users | Tech Community 3904648 (Aug 2023); GDAP FAQ | Missed: service-provider sign-ins not stored | "2 service-provider accounts from 1 partner tenant signed in this month — exclude 'Service provider users' or they lose access on <date>" |
| 12 | Everyone had Authenticator registered; nobody had been prompted for years; half the team no longer had that phone, many had forgotten passwords | LinkedIn, Lachlan Robinette, Jun 2026 | Caught by design: the six-state model and the verification campaign | "8 registered but unproven; 5 of them also haven't typed a password this month — line up a reset path before <date>" |
| 13 | MFA-for-all caught the Entra Connect sync account; sync stopped; fix is excluding the Directory Synchronization Accounts role | hametbenoit Jan 2020; Ali Tajran May 2024; Maester MT.1020; Microsoft Learn MFA-for-all | Missed: role known, no exclusion, no check | "Sync_SRV01 holds the sync role and would be prompted — excluded by the template; check the tenant policy" |
| 14 | Remote new hire prompted for MFA cannot register because MFA is required first; block-all with app exclusions still catches the registration flow | Tech Community 4105174 (Apr 2024); Microsoft Q&A 5807041 (Mar 2026), 5860864 (Apr 2026) | Partly: no-method people and TAP state checked | "3 people with no method work outside the office — issue each a Temporary Access Pass before <date>"; static rule on block policies |
| 15 | User-risk policy on day one forces thousands of historical-risk users to change passwords; hybrid users without writeback are blocked outright | Tech Community Oct 2024; Microsoft Learn risk policies | Partly: sign-in risk only | "12 people carry high risk today — dismiss stale risk first or all 12 reset on day one"; hybrid: "password writeback required; IAMAI cannot read it" |
| 16 | Require-compliant-device blocks RDP to Arc-enabled Windows Servers, which cannot enrol | Microsoft Q&A 5627113 (Nov 2025) | Missed | "4 people sign in to Azure Windows VM Sign-In — servers cannot be compliant; scope the policy or they lose RDP" |
| 17 | Block-unknown-platform hits legitimate mobile sign-ins with an empty platform; the template quietly left Linux open | myronhelgering Oct 2023; Microsoft Q&A 736101 | Missed: platform not stored | "9 sign-ins this month had no platform (Outlook mobile widget, 2 people) — they'd be blocked" |
| 18 | Compliant device, still blocked: Chrome without the Windows Accounts extension, Edge InPrivate, profile not signed in; licensing and lagging compliance state | Microsoft Q&A 1181421, 772849 | Partly: InPrivate named generically | "Kaladin's compliant laptop signed in 14 times from Chrome without device claims — blocked on those" |
| 19 | Scripts running as user accounts (az login, ROPC) break under MFA; move to service principals | dev.to Azure MFA enforcement; Microsoft Learn Azure management | Partly: service accounts detected; ROPC stored, unused | "svc-backup signed in 31 times by ROPC to Azure PowerShell — move it to a service principal before <date>" |
| 20 | Users blocked because the app depends on a resource the policy blocks (portal → Resource Manager) | Microsoft Learn CA troubleshooting | Partly: templates avoid it; tenant policies may not | Housekeeping: "policy X blocks Device Registration Service — exclude the dependency" |
| 21 | Block-legacy-auth also blocks the phone's built-in Mail app, because the EAS condition covers all EAS use | Microsoft Learn client apps condition | Caught, client unnamed | "4 people use the phone's built-in Mail (Exchange ActiveSync) — they need Outlook mobile before <date>" |
| 22 | Report-only compliance already prompts macOS, iOS and Android users for a device certificate | Microsoft Learn compliant-device known behaviour | Caught in copy, buried | Dates side-line on device steps: "report-only will prompt mobile users to pick a certificate from <date>" |

## What the tool cannot see, and says so

- Mail-sending devices that did not send during the evidence window.
- SMTP AUTH per-mailbox state (Exchange Online only).
- Password writeback (needs a permission the tool does not hold).

These are `cantSee` lines under *More*; never a question, never a button.
