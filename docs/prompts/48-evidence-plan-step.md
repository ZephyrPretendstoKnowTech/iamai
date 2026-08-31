# 48 — Evidence for the lockout scenarios, then the Plan and the step

Precondition: 47.1 committed and green (d9d3213). Read `docs/design/target-state.md` and
`docs/qa/page-contracts.json` in full before starting. Neither is yours to edit, with the
same single exception as 47: in Part 6 you flip `status` to `built` on exactly the
surfaces this prompt builds.

Part 1 is engine and evidence; it exists because the reviewer checked the engine against
twenty-two published lockouts (`docs/design/lockout-scenarios.md`, committed with this
prompt) and found that what the engine misses clusters
on four sign-in fields it does not store. Parts 2–5 build the Plan and the step so that
every scenario the evidence can see becomes a named line on the step it belongs to.

## Rules for this prompt

- Every part ends green and is its own commit.
- New pages live in `src/ui/surfaces/`, on the 47 tokens and primitives, from `src/copy`
  strings and the contract's exact labels. No cards, no chips, no colour outside the
  status mark.
- Old pages: `MappingPage` (Setup) and `CoveragePage` (Findings) are deleted in Part 5.
  `RoadmapPage` stays mounted at `#/roadmap`, unlinked, only for its Export tab, until
  49 builds Export. Do not restyle it.
- No line reaches a step's first open unless it is named from this tenant's evidence.
  Generic catalogue text lives behind *More*.
- Report by part, with measured counts per built surface against budget, the lowest
  contrast ratio per mode, and the GetIAMAI-shaped fixture's plan header line.

## Part 1 — Evidence

1. **Lane B fields.** The sign-in collector stores, per row, derived labels only —
   never an IP address, never a user-agent string:
   - from `deviceDetail`: `os` (normalised: Windows, macOS, iOS, Android, Linux,
     ChromeOS, empty), `browser` (family only), `isCompliant`, `isManaged`,
     `trustType` (Entra joined, hybrid, registered, none);
   - `crossTenantAccessType` (none, b2bCollaboration, b2bDirectConnect,
     serviceProvider, passthrough);
   - `appDisplayName` and `resourceDisplayName`;
   - from `networkLocationDetails`: the named-location names matched and whether any was
     trusted — the boolean and the names, not the address;
   - `authenticationProtocol` already stored; keep it.
   Verify on beta which of these `$select` accepts (the collector notes some fields are
   not selectable); fetch without `$select` and prune client-side where it does not.
   Snapshot schema 7; cached scans from schema 6 load with the new fields absent and the
   derived lines simply do not fire.
2. **App catalogue.** `data/first-party-apps.json` gains: Windows Sign In, Microsoft
   Authentication Broker, Device Registration Service, Microsoft Intune Enrollment,
   Azure Windows VM Sign-In, Microsoft Teams Rooms / Teams device apps, Microsoft Remote
   Desktop, with their app ids and a `role` (dependency, technician tool, device
   sign-in, server sign-in).
3. **Derivations** in `src/derive/evidence.ts`, each a pure function over the stored
   rows and returning `{ people, count, detail }`:
   - `passwordNotTyped`: people whose every sign-in in the window authenticated by PRT,
     Windows Hello, passkey or certificate — nobody typed a password;
   - `legacyClients`: per person, the legacy client app names used (Authenticated SMTP,
     IMAP4, POP3, Exchange ActiveSync, other);
   - `ropcAutomation`: accounts whose sign-ins are ROPC or password-only to Azure CLI,
     Azure PowerShell, Graph Command Line Tools or a custom app;
   - `highUserRisk`: people whose recent sign-ins carry aggregated high user risk;
   - `nonMicrosoftApps`: per person, non-first-party apps signed in to (for session and
     frequency steps);
   - `serverSignIns`: people who signed in to Azure Windows VM Sign-In or Remote Desktop;
   - `technicianToolsOffCompliance`: sign-ins to technician tools from non-compliant
     devices (the Autopilot case);
   - `unregisteredWindows`: people who sign in to Outlook, Teams or SharePoint from
     Windows devices with `trustType` none (token protection);
   - `browserWithoutClaims`: sign-ins from a browser without device claims by people
     who own a compliant device (Chrome without the extension, InPrivate);
   - `emptyPlatform`: sign-ins with an empty `os`, with the app;
   - `serviceProviderSignIns`: service-provider (GDAP) accounts seen, with their home
     tenant count;
   - `trustedLocationMatches`: per trusted named location, the share of sign-ins that
     matched it in the window;
   - `guestsSeen`: guests who signed in, for the MFA-trust rule.
4. **Populations and config.**
   - Shared-device accounts: users holding a Teams Rooms Pro or Teams Shared Devices
     service plan (`data/service-plans.json`), or whose only sign-ins are to Teams
     device apps. Detected, listed in the assumptions strip as `shared devices (3)`,
     excluded from every user policy template, and given one step, `Give shared devices
     their own policy` (known location plus compliant device; no MFA, no frequency, no
     device-code block), from Microsoft's Teams Rooms guidance.
   - Directory Synchronization Accounts: user holders of the role are excluded by the
     MFA and strength templates; a check flags any tenant or baseline policy that would
     catch one.
   - Guest MFA trust: the cross-tenant access policy's default inbound trust
     (`isMfaAccepted`) already collected; a guest-facing MFA or strength step reads it.
   - Hybrid users (`onPremisesSyncEnabled`): the user-risk password-change step notes
     that password writeback is required and that IAMAI cannot read that setting.
5. **Static rules on policy JSON**, run against the tenant's policies, the baseline and
   every template:
   - a block policy scoped to all resources must exclude the *Register security
     information* user action, Device Registration Service, Windows Sign In, Intune
     Enrollment and the Authentication Broker; a compliance policy scoped to all
     resources gets the Autopilot line when technician-tool sign-ins exist;
   - an app-protection policy must target unmanaged devices only.
   Violations are Housekeeping lines with the policy name; templates are corrected.
6. **Step evidence lines.** `src/roadmap/evidence.ts` returns for every step an ordered
   list of `{ kind, text, people, count, byDate }` lines, built only from derivations
   that fired. The text names the client, the count, the people (up to ten, then "and N
   more"), the action and the date it is needed by. The canonical lines, one per
   scenario, are in `docs/design/lockout-scenarios.md`; the table below maps each to its
   step and its derivation.
   Lines whose derivation returned nothing do not exist. Unknowns the tool cannot see
   (mail-sending devices outside the window, SMTP AUTH per mailbox, password writeback)
   are `cantSee` lines for *More*, never buttons, never questions.
7. **Dates side-lines.** Device steps carry "report-only will prompt mobile users to pick
   a certificate from <date>"; block steps carry "takes effect as sessions refresh,
   within a day; to apply now, revoke sessions". Once each, on Dates; removed from
   everywhere else.
8. **Fixtures.** Each of the eight synthetic tenants gains rows so that every scenario
   below fires on at least one fixture and on no fixture where the evidence is absent.
   Property tests: a line appears iff its derivation returns people; the GetIAMAI-shaped
   fixture's admin cohort never stands in for the tenant's readiness.

The scenarios (sources and the exact line wording are in the design doc):

| # | Scenario | Step it lands on | Line fires when |
|---|---|---|---|
| 1 | Legacy mail client user locked out by block-legacy-auth | Legacy protocols blocked | `legacyClients` — names the client |
| 2 | Whole tenant locked out, Global Admin included | every deny-capable step | break-glass and operator checks (existing) |
| 3 | Autopilot registration blocked by require-compliant-device | device compliance | `technicianToolsOffCompliance` |
| 4 | Sign-in frequency broke a SAML VPN app; daily frequency prompted people all day | session steps | `nonMicrosoftApps` |
| 5 | Trusted location stale (IP changed, IPv6, carrier NAT); VPN egress in a blocked country | location steps | `trustedLocationMatches` below 50% |
| 6 | Guests in an MFA loop; MFA trust off; strength blocks guests without home MFA | guest steps | `guestsSeen` and `isMfaAccepted` false |
| 7 | Printers and LOB apps on SMTP AUTH break | Legacy protocols blocked | `legacyClients` with Authenticated SMTP; `cantSee` for devices outside the window |
| 8 | Teams Rooms signed out by frequency, blocked by device-code block, strength unsupported | shared-device step | shared-device population |
| 9 | Token protection drops unmanaged Windows devices, VMs, jump boxes | token protection | `unregisteredWindows` |
| 10 | A block "doesn't work" because existing tokens keep syncing | block steps | Dates side-line (always) |
| 11 | GDAP technicians blocked by strength or location; can't fix CA via GDAP | strength and location steps | `serviceProviderSignIns` |
| 12 | Registered but never prompted; phones gone; passwords forgotten (the founding case) | verification campaign | unproven population, plus `passwordNotTyped` |
| 13 | Entra Connect sync account caught by MFA-for-all; sync stops | MFA-for-all | sync-role holder exists |
| 14 | Remote new hire can't register MFA; block-all catches the registration flow | registration step; block policies | no-method people off trusted networks; static rule |
| 15 | User-risk policy forces mass password changes; hybrid users without writeback blocked | user-risk steps | `highUserRisk`; hybrid users present |
| 16 | Require-compliant-device blocks RDP to servers | device compliance | `serverSignIns` |
| 17 | Block-unknown-platform hits empty-platform mobile sign-ins | unknown platforms | `emptyPlatform` |
| 18 | Compliant device, still blocked: Chrome without the extension, InPrivate | device compliance | `browserWithoutClaims` |
| 19 | Scripts running as user accounts break under MFA | MFA-for-all, Azure management | `ropcAutomation` |
| 20 | App depends on a resource the policy blocks | block policies | static rule |
| 21 | Block-legacy-auth also blocks the phone's built-in Mail (EAS) | Legacy protocols blocked | `legacyClients` with Exchange ActiveSync |
| 22 | Report-only compliance already prompts mobile users for a certificate | device steps | Dates side-line (always) |

## Part 2 — The Plan (target-state §5)

9. `src/ui/surfaces/Plan.tsx` at `#/plan`. Header: h1, the one line from `planFinish`
   ("31 steps · 7 in place · finishes Sep 20 · 3 weeks · 3 device steps wait for
   device readiness"; when nothing can finish, the clause instead of a date). The
   header tooltip carries the single binding-constraint sentence.
10. The assumptions strip (target-state §5, three kinds of chip): `.assumption` chips
    for emergency access, exclusions group, sign-in countries, trusted locations,
    service accounts, shared devices, time zone, plus the three questions the tool
    cannot answer from evidence — mail-sending devices, people who travel or work
    abroad, partner or MSP access. Each chip states its kind: a detected fact
    (editable), a weak detection with `confirm` and the signals that nominated it, or a
    question with the evidence that prompted it and what answering changes. Each opens
    an in-place editor reusing the 46 pickers (people, group, country allowlist,
    named-location, confirm list, time-zone select; a free-text list for the three
    questions), ending in one button, `Save`, always at the editor's end — the one
    label, the one position. Saving regenerates the plan in place. `none found — choose`
    when a detection is empty. A question is never a gate: unanswered, the plan proceeds
    on the evidence and the affected step carries the can't-see line. Answered, it adds
    the carve-out step (SMTP relay; travel exclusion and notice; partner exclusion). No
    question is asked anywhere else.
11. `Plan settings` link → `.plan-settings` popover: start date, change freeze from/to,
    `Close`. Nothing else.
12. Waves as `.wave` sections with the h2 from the schedule (`Before anything else ·
    Aug 31 → Sep 1`, `Wave 1 · Sep 8 → Sep 13 · MFA and low-impact blocks`). Rows as
    `.plan-row`: the status mark and word (§8.3), the plain title (`.step-title` class on
    the title everywhere it renders), the who-line (`nobody affected` · `3 admins` · `12
    people` · names when ≤3; the gap suffix for change steps), the date (`now` for
    foundation steps). A second line only when blocked: the one binding reason from 46.
    The first Ready row carries a small `next` mark beside its status; nothing else in
    the product says "next". Clicking a row opens the step under it and sets
    `#/plan/<stepId>`; opening one closes another.
13. Footer, `.plan-footer`: three `<details>` — `Already in place (N)` (rows, same
    shape), `Doesn't apply here (N)` (goal · reason), `Housekeeping (N)` (one line per
    item: policy not in the baseline; names off convention with the proposed rename;
    "Also in the baseline, not assessed" with the policy's own name and a `JSON` button;
    static-rule violations; checks that could not run).
14. `?demo=1` and the header's Plan tab and wordmark point at `#/plan`; `#/mapping` and
    `#/coverage` redirect to `#/plan`; `#/roadmap/step/<id>` redirects to
    `#/plan/<id>`.

## Part 3 — The step (target-state §6)

15. `src/ui/surfaces/Step.tsx`, rendered in place under its row inside `.step-body`,
    in this order and nothing else on first open:
    1. Title (`.step-title`), the status mark and word, one line of what changes (from
       `WHAT_CHANGES`, ≤25 words).
    2. `Why` — one sentence, `Learn →`, the CIS tag as text.
    3. `Who this touches` — the population line, then the evidence lines from Part 1 in
       their order, each with names, the action and the date. Beyond ten names: `and N
       more · Export CSV`. Your-account-in-scope is one of these lines.
    4. `Do it` — for policy steps, tabs `Portal steps` · `JSON` · `PowerShell` and
       `Download JSON`; for check and create steps (emergency access, exclusions group,
       named locations, the campaign, dormant accounts, the operator's passkey, a TAP,
       an SMTP relay), the numbered portal steps from the validation action or a
       PowerShell one-liner, no JSON tab. Every step has this section. The proposed
       policy name appears here only.
    5. `Dates` — `Announce <date> · Report-only from <date> · Enforce <date>`; rings on
       a second line when they exist; the Part 1 side-lines beneath.
    6. `Done when` — at most three lines, from the exit criteria and the validation
       done-when lines (the emergency-access step carries the two former secondaries).
    7. `If it goes wrong` — one line, `Recovery card →`.
    8. `Tell your people` — the comms draft, `Copy`.
    Then one `<details class="more">` **More**: `What could go wrong` (the family
    catalogue, one Learn link once, `applies here` marks only where evidence exists),
    `Prerequisites`, `What waits on this`, `Exit criteria` (per ring), `For the help
    desk`, `For your manager` (`Copy`), `Copy as prompt`, `What IAMAI can't see` (the
    `cantSee` lines as plain text), `Skip this step`.
16. Delete the generators for: "What the last 30 days say", "Why now", "Waiting on this"
    as a section, the scheduled-date input, "Answer this", the kind chip, effort and
    help-desk estimates, the notice rationale table, "Proposed name:" as a label outside
    Do it. Deleting the generator, not the string.

## Part 4 — Schedule and states

17. Status words from the engine states (§8.3): In place · Ready · Blocked · Scheduled ·
    Report-only · Enforced · Skipped. One per row and per step; the verb lives in the
    title (`Create…`, `Change…`, `Check…`, `Run…`).
18. Re-scan updates rows in place: a step that became report-only or enforced moves
    state; the header line recomputes; nothing is announced.
19. Print export and the ICS read the same `planFinish` and rows; no other consumer of
    schedule data remains.

## Part 5 — Deletions and routes

20. Delete `MappingPage.tsx`, `CoveragePage.tsx`, the Setup validation block, the
    Findings tabs and their copy modules. `RoadmapPage.tsx` stays for 49. Every literal
    `#/mapping` and `#/coverage` in the codebase and docs points at `#/plan`.
21. Smoke walks Connect → Scan → Today → Plan → one step (Do it renders) → assumptions
    edit regenerates → Plan settings → footer details, on the mock tenant; asserts the
    header line, one status per row, no forbidden strings, the `.step-title` word count.

## Part 6 — Contracts, inventory, audit

22. Flip `status` to `built` for `plan`, `plan.settings`, `plan.footer`, `plan.step`,
    `plan.step.more`. Nothing else in the file changes.
23. `npm run inventory`; rule 12 green on all built surfaces; `docs/qa/ui-inventory.md`
    updated. `layout-audit` in both modes at five widths; report the lowest ratio.

## Finishing

`npm test && npm run smoke && npm run lint-mutations && npm run inventory && npm run
layout-audit`, `vite build`, commit by part, push, confirm CI green and the build
stamp. Report by part, with the measured counts, the contrast minima, the GetIAMAI-
shaped fixture's header line, which of the 22 scenario lines fire on which fixture, and
anything you could not do with why.
