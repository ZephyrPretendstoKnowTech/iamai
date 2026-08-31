# IAMAI target state

This document says what each screen contains, in full, and nothing else. It replaces
the seven-step flow in SPEC.md §3. `docs/qa/page-contracts.json` is the machine copy;
the build fails on anything a surface renders that its contract does not list.

Every earlier prompt was a list of changes to a page nobody had defined. Pages grew,
because with no maximum every fix could only add. This is the maximum.

Prompts 46–49 build it. Claude Code does not edit this document or the contract; a
violation is fixed by removing what violates it, or reported for review with the case.

---

## 1. What the product is

IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access
baseline, and produces a dated plan to close the gaps without locking anyone out.

The user is one person at a small MSP or SMB, learning as they go, with no change
process and nobody to ask. The plan has to be executable by that person in a few
weeks, not administered by a team.

The six questions the product answers, and where:

| Question | Surface |
|---|---|
| Where are we now? | **Today** |
| Where should we be? | the baseline line on Connect; the posture page of the printed plan |
| What is stopping us? | each **Plan** row states its gap |
| What do we do about it? | the step: **Do it** |
| What first? | the **Plan**: waves, in order, dated |
| Why? | the step: **Why**, one sentence, one Learn link |

Detail is available on every step behind one **More**. It is never in the flow.

---

## 2. Navigation and states

No sidebar. No stepper. One header:

```
IAMAI Planner · <tenant name>    Today   Plan   Export    Re-scan (scanned 24h ago) · Recovery card · theme · account
```

The product is **IAMAI Planner**; its descriptor, `Conditional Access rollout planner`,
is the page title and the home-page row; its tagline is `Plan the journey to your
Conditional Access baseline.` The path stays `/rollout/` until the demo rebuild.

Signed out, the header shows only the wordmark and theme; the page is Connect.

| State | Where the user lands | Today / Plan / Export |
|---|---|---|
| signed out | Connect | hidden |
| signed in, no scan | Connect (baseline line + Scan) | disabled, tooltip "after the first scan" |
| scanning | Connect (progress inline) | disabled |
| scanned | Plan | enabled |

Routes: `#/connect` · `#/today` · `#/inventory` · `#/plan` · `#/plan/<stepId>` ·
`#/export` · `#/recovery` · `#/how`. Old routes redirect: `start`→`connect`,
`scan`→`today`, `mapping|coverage|roadmap`→`plan`, `checks|reads|licensing|naming`→`how`,
`baseline/package`→`how#package`. No route name is an implementation term.

Demo (`?demo=1`) keeps working on the same surfaces. Its entry link is hidden until
the fixture is rebuilt from the finished product (prompt 50).

---

## 3. Connect

One page, three states.

**Signed out**

- h1 `Connect a tenant`
- one line under it: `Plan the journey to your Conditional Access baseline. Read-only.`
- three lines, as a list: what you need (Global Administrator or Global Reader; Entra ID
  P1 for sign-in evidence, works without it) · what IAMAI reads (Conditional Access
  configuration, user, device and licence inventory, 30 days of sign-in records) · what it
  never does (read-only; nothing leaves the browser; no server, no telemetry)
- primary button `Sign in with Microsoft`
- one `<details>`: `What IAMAI asks for, and how to remove it`
  - the permissions table: columns `Permission` · `What IAMAI reads` · `Without it`. Six
    rows. No preamble, no "Used for" list, no sign-in-scope table (one line under the
    table: "Plus the standard sign-in permissions."), no Application.Read.All anywhere.
  - `Removing it`: the three portal steps. Nothing after "Properties → Delete".
- footer link `How IAMAI works →`

**Signed in, no scan**

- `Signed in to <tenant> as <upn>` · `Sign out`
- baseline line: `Baseline: Jon Hope — Defense in Depth (46 policies) · change`. *change*
  opens a picker with two choices: the default, or upload a package (`how to make one →`
  links to the package section of How IAMAI works). No About card, no version, no file
  counts, no technical details.
- primary button `Scan tenant` · one line: "About ten minutes. Reads the tenant into
  this browser; nothing is sent anywhere."

**Scanning**: the same page; progress bar with the current lane in plain words
("Reading sign-in records, 3 of 8 pages"); the Scan button replaced by `Stop`.

**Scanned**: `Scan complete · 13 people · 10 policies · sign-ins Jul 30 – Aug 29` and
primary `Open the plan →`. Re-scan lives in the header from now on.

Gone: the Start page, the Baseline page, the Scan page, "Predicted impact, confirmed in
report-only", the four How-it-works cards, "What IAMAI never does" as a section.

---

## 4. Today

Answers "where are we now" in one screen. Everything is counted over **active people**
(§8.1). Nothing on this page asks for a decision.

- h1 `Today`
- one line: `4 active people of 12 enabled · 2 admins · sign-ins Jul 30 – Aug 29`
- four tiles, one row, each with an info icon that carries its definition:
  `MFA proven` (n · % of active) · `Registered, unproven` (n · %) · `No method` (n · %) ·
  `Not active` (n; never signed in, inactive 90+ days, or disabled — listed, not counted)
- search box · one dropdown `Show: All · MFA proven · Registered, unproven · No method ·
  Not active · Admins · Guests`
- the table: `Person` · `State` · `Strongest method` · `Evidence`. State is the six-state
  MFA model in plain words: Proven · Likely works · Never prompted · Possibly broken ·
  No method · Not active (with why: never signed in / inactive since <date> / disabled).
  Evidence is one clause ("MFA via Authenticator 3 days ago"; "no sign-in on record").
  Paginated at 50 with the row-count line; `Export CSV` under it.
- link `Everything the scan read →` (Inventory)

No legend. No banner. No rollout tiles. No filter chips.

**Inventory** (`#/inventory`): the existing ten tabs (Policies · Named locations ·
Authentication · People · Groups · Devices · Roles · Apps · Licensing · Sign-in records),
each a table with `Export CSV`. No intro sentence. No per-tab footer. Roles: a
Microsoft-default role whose only holders are service principals is hidden behind
`Show all roles`; "Service:" capitalised.

---

## 5. Plan

The front door once a scan exists. The plan is the page; nothing sits above it but the
header line and the assumptions strip.

**Header**

- h1 `Plan`
- one line: `31 steps · 11 in place · finishes Sep 24 · 3½ weeks` — every number from
  `src/derive`. If the plan cannot finish (a blocker with no step that clears it), the
  line says so in one clause instead of a date.
- **assumptions strip**, one line, each item a chip that edits in place:
  `Assumes: emergency access Breakglass (1) · exclusions group none yet · sign-in
  countries US · trusted locations none · service accounts none · shared devices none ·
  time zone Denver`. Editing a chip regenerates the plan. This is Setup. There is no
  Setup page, no validation block, no portal path here: whatever an assumption is
  missing becomes the plan's first steps.

  Three kinds of chip, and the kind decides whether a question is asked:
  - **detected with evidence** (time zone from the browser; countries from the
    sign-ins; exclusions group, trusted locations, shared devices from the tenant):
    shown as a fact, editable, never asked;
  - **detected weakly** (emergency access from signals; service accounts from name and
    behaviour): shown with `confirm` and the evidence that nominated it ("2 signals:
    name, excluded from every policy"); the steps that depend on it wait for the
    confirmation and say so;
  - **cannot be seen**: asked, once, in the same strip, with the evidence that prompted
    the question and what answering changes: `mail-sending devices: none seen in 30
    days — any printers or apps send mail? adds an SMTP-relay step` · `people who
    travel or work abroad: none seen — adds notice and a travel exclusion` · `partner
    or MSP access: no service-provider sign-ins seen — adds a partner exclusion`.
    Unanswered means the plan proceeds on the evidence and the step carries the
    can't-see line; a question is never a gate.
  One editor pattern for every chip: the picker, then one button, `Save`, at its end.
  The first Ready row in the plan carries a small `next` mark; there is no other "do
  this next" anywhere, and the mark moves as rows complete or a re-scan lands.
- `Plan settings` link (small, right): start date · change freeze from/to. Nothing else.

**Waves**

Each wave is a section: `Wave 1 · Sep 1 → Sep 8 · MFA and low-impact blocks`, then its
steps as rows. Wave 0 is `Before anything else` (foundations: emergency access,
exclusions group, named locations, the operator's own passkey, dormant accounts, the
verification campaign). A row:

```
● Ready      Stop sign-ins from countries you don't work in     nobody affected      Tue Sep 8
● Blocked    Keep admin sessions short                          3 admins             after: second emergency access account
```

- one status chip (§8.3), the title, who (`nobody affected` · `3 admins` · `12 people` ·
  names when ≤3), the date (planned enforcement, or `now` for a foundation step)
- a second line only when blocked: the one binding reason, ≤12 words
- click opens the step (§6) in place; the URL becomes `#/plan/<stepId>`
- a step that is partly in place carries its gap as the who-line's suffix: `3 admins ·
  sessions expire every 168h, baseline wants 4h`

**Footer**, three collapsed `<details>`, one line each when collapsed:

- `Already in place (11)` — the in-place steps, one row each, same row shape
- `Doesn't apply here (5)` — goal · reason (no Intune licence; no Azure DevOps sign-ins)
- `Housekeeping (4)` — one line per item: a policy not in the baseline; names off the
  tenant's convention (with the proposed rename, from the naming rules); "Also in the
  baseline, not assessed: 2 agent-identity policies; 1 policy compared structurally —
  Block file downloads on unmanaged devices · JSON". Ad-hoc items never become steps.

This footer is what Findings becomes. Every gap is a step; the step says its gap.

Gone from this page: Do this next, "things to look at before the plan starts", the
rationale paragraph, the four tiles, "What needs attention before you start", "Nothing
has started yet", the journey band, planned-against-actual chart and table, History,
filter chips, sort, hide-completed, the Plan/Schedule/Export tabs, the Summary / In place /
Needs attention / Details tabs, "Why not fully", proposed names as findings.

---

## 6. A step

Opened in place under its row. First open shows, in this order, and nothing else:

1. **Title** — the plain title, the only title anywhere. The catalogue goal name is not
   shown. Status chip. One line, what changes: `New policy, report-only first: require MFA
   for everyone on every app.` / `Change: shorten admin sessions from 168h to 4h.`
2. **Why** — one sentence. `Learn →` · CIS tag.
3. **Who this touches** — `12 active people · 2 admins · 1 guest`, then only the evidence
   that applies to this tenant, named, with the action and the date it is needed by:
   - `3 people have no MFA method and will be stopped: A, B, C — register before Sep 8`
   - `2 admins have no phishing-resistant method: D, E`
   - `1 service-provider account signs in from outside the US`
   - `2 people use Outlook on unmanaged Windows and will be signed out by token protection`
   - `Your account is in scope: 164 sign-ins in 30 days`
   Nothing tagged "unknown here" appears. Names beyond ten collapse to `and 14 more ·
   Export CSV`.
4. **Do it** — `Portal steps` (numbered, one line each) · `JSON` · `PowerShell` tabs;
   `Download JSON`. Every step has this section. The proposed policy name appears here
   and nowhere else, in the tenant's convention, short: `Core - Block - Countries not
   allowed`, never the goal sentence.
5. **Dates** — `Announce Tue Sep 1 · Report-only from Tue Sep 1 · Enforce Tue Sep 8`.
   Rings only when they exist (§9): `Pilot Sep 8 (5 people) · Everyone Sep 15`.
6. **Done when** — at most three lines.
7. **If it goes wrong** — one line: `Set the policy back to report-only. Recovery card →`
8. **Tell your people** — the draft, `Copy`. Salutation follows the audience.

One `<details>` **More**: the full what-could-go-wrong catalogue (one Learn link, once),
prerequisites and what waits on this step, per-ring exit criteria, the help-desk note,
the manager note, `Copy as prompt`, "IAMAI can't see" as plain notes (no buttons),
`Skip this step`.

Gone from a step: "What the last 30 days say" placeholder, "Why now", "Waiting on this"
as a section, the scheduled-date input, "Answer this", the kind chip, effort and
help-desk-contact estimates, the notice-period rationale table.

---

## 7. Export, Recovery card, How IAMAI works

**Export** (`#/export`): six cards, each a title, one line, one button.
`Print or save as PDF` (page 1 is the posture summary: in place / to do / doesn't apply,
the one an MSP shows a client; then the waves; then every step in full) ·
`Calendar (ICS)` · `Plan file` (save; load) · `CSV` (Today; inventory tables) ·
`Prompts for your own assistant` (one download; `See the prompts` expands the list with a Copy per prompt) · `Grounding bundle` (redacted by
default; the unredacted toggle with its one-line warning).

**Recovery card** (`#/recovery`): unchanged.

**How IAMAI works** (`#/how`): `Permissions` (the table from Connect) · `What IAMAI
reads` (the endpoint tables) · `Every check` (51 rows, once) · `Baseline packages` (how
to make one) · `Limits` (SPEC §5, at most five lines). Deleted pages: Licensing guide,
Naming policies and groups, the Start page.

---

## 8. Rules every surface obeys

### 8.1 One denominator

- **active people**: enabled person accounts with a successful sign-in in the last 90
  days (`src/derive/sets.ts` `activeUsers`). Every percentage on Today, every "who this
  touches", every readiness threshold, and the registration window use this set.
- **not active**: enabled but never signed in or inactive 90+ days. Shown on Today.
  Never in a denominator. Never delays enforcement — enforcement cannot lock out an
  account nobody signs into. They are a risk of a different kind (whoever signs in
  first registers the MFA method), so Wave 0 carries one step: `Decide on N dormant
  accounts: disable or confirm each`, with the names.
- **non-person accounts**: shared mailboxes and resources (sign-in blocked, or a mailbox
  with no service plans and no sign-in), confirmed service accounts. Listed in
  Inventory, counted nowhere, in no step unless a policy targets them directly.
- Every number a user sees comes from one function in `src/derive`. Two surfaces
  showing the same quantity from two paths is a failing test (`renderedNumbers`,
  `agreement`).

### 8.2 One verdict

A goal's verdict (in place · partly · missing · below the baseline · does not apply) is
computed once in `src/coverage`. A step is *in place* if and only if its goal's verdict
is *in place*. Partly and below-the-baseline goals are *Change* steps and state the gap.
The plan header's "in place" and the footer's "Already in place" count the same set.

### 8.3 Step status, one chip

`In place` · `Ready` · `Blocked` (+ one reason ≤12 words) · `Scheduled` · `Report-only` ·
`Enforced` · `Skipped`. No kind chips. The verb is in the title (`Create…`, `Change…`,
`Check…`, `Run…`).

### 8.4 Names

- One title per step, plain English, ≤9 words, the only name shown.
- Proposed policy names follow the tenant's detected convention, else the baseline's
  prefix, and name the control, not the goal: `Core - Block - Legacy authentication`.
- Names, never ids. No developer vocabulary. No first person.

### 8.5 Blocked reasons

One binding reason per row, ≤12 words, one of three shapes: `after: <step title>` ·
`when <measure> reaches <threshold> (now <value>)` · `when <count> <thing> exist (now
<n>)`. The rest of the reasons are in the step under More.

### 8.6 Selectors the contract relies on

The new pages use these class names, because the contract reaches and measures by
them: `header.app`, `main.page`, `.tab-panel`, `details.permissions`, `.assumption`,
`.wave`, `.plan-row`, `.step-title`, `.step-body`, `details.more`, `.plan-footer`,
`.plan-settings`, `.export-card`. Controls inside a repeater (a row, a card, a chip
strip) are items, not page actions.

### 8.7 Prose budgets

Set per surface in the contract. Sentences ≤25 words (existing rule). Explanations of
concepts live in info tips and Learn links, never in the flow.

---

## 9. Schedule rules

Fixed. The only inputs are the plan start date (default: next working day) and a change
freeze. No pace presets, no windows-per-week, no notice inputs, no holidays field, no
revert threshold, no per-step date pickers.

| Rule | Value |
|---|---|
| Enforcement day | Tuesday, Wednesday or Thursday; never Friday, a weekend, inside a freeze, or the last working day before one |
| Enforcement time | 10:00 tenant-local, or one hour after the tenant's peak sign-in hour when the records show one |
| Report-only start | any working day; every step in a wave enters report-only on the wave's first day |
| Report-only soak | 7 days; 3 when the records show nobody affected; extends to 14 only while fewer than 80% of affected active people have signed in during it |
| Notice | nobody affected in the records → 1 working day, courtesy; otherwise 2 / 5 / 10 working days by disruption (low / medium / high). Announce 09:30 Monday–Thursday; remind the working day before |
| Rings | by affected active people: ≤50 none (report-only → enforce); 51–300 Pilot (5 people, IT first) → Everyone; 301–3000 Pilot → Ring (10%) → Everyone; above 3000 unchanged. 5-day soak per ring |
| Batching | low-disruption policies enforce together in one window; high-disruption changes get their own window; up to 3 enforcement windows a week ≤300 active people, 2 above |
| Registration window | active people without a proven method ÷ 5 per working day, minimum 0, maximum 20; runs alongside the first soak, never before it |
| Sequencing | dependencies as today (foundations first; a policy that prompts the same people as another does not enforce in the same window) |

Expected outcomes, reported never targeted: ≤30 active people about 3–4 weeks;
31–300 about 6–8; above 300 about 10–12. The plan states the one constraint that set
its length, in one sentence, in the header line's tooltip.

---

## 10. Deleted

Pages: Start, Baseline, Scan (as a page), Setup, Findings, Licensing guide, Naming.
Chrome: the sidebar, the stepper and its statuses, page "Needs" lines, "Next:" buttons.
Sections and generators (delete the generator, not the string): Do this next; pre-plan
callouts; Findings summary narrative; the six Findings tiles; the four Roadmap tiles;
"What needs attention before you start"; the journey band; planned-against-actual chart
and table; History; "Why not fully"; "What the last 30 days say"; "Why now"; the notice
rationale table; effort and help-desk totals; the Setup validation blocks, notes and
secondary questions; the legend; the rollout tiles; Connect's "Requested, not yet used";
Baseline's About card and technical details; the "Could not be evaluated" section.

---

## 11. Preserved

The engine: collection (Lanes 0/A/B), MFA viability scoring, coverage and the goal
catalogue, validation rules (all 51 checks still run; they surface as steps and as
"done when" lines), the roadmap engine (sequencing, rings, batching, tracking from
evidence on re-scan), plan file v2 (assumptions are the Setup answers, same keys),
redaction, diagnostics, exports, print, demo mode, the security fixes.

Every capability keeps a home: the table below is the map for anyone looking for
something that moved.

| Was | Now |
|---|---|
| Setup questions and validation | assumptions strip; Wave 0 steps; done-when lines |
| Findings tabs | Plan rows (gap on the row); Plan footer |
| Readiness tiles and legend | Today tiles with info tips |
| Inventory | `#/inventory`, unchanged tables |
| Do this next / watch-first | Wave 0, first rows |
| Schedule tab | wave headers and step Dates; Plan settings (start, freeze) |
| Comms table | each step's Tell your people; the ICS export |
| Prompt pack, grounding bundle | Export cards |
| What IAMAI reads / Every check / permissions | How IAMAI works |
| Recovery card | unchanged |

---

## 12. Acceptance

After each of prompts 47–49, the reviewer walks localhost:5173 against the GetIAMAI
tenant and the mock tenant with Chrome and answers, per surface:

- Does the screen have one job, and is it the job in §1's table?
- Is anything on screen not in this document? (The contract should already have failed.)
- Do the numbers agree with every other surface showing them?
- Can a first-time user say what to do next without reading a paragraph?
- Open three steps: can each be executed from Do it alone?
- Is the plan length what §9 predicts for this tenant, and does the header say why?

A prompt is done when the contract lint is green in CI and the walk finds nothing.
"Reported complete" is not done.
