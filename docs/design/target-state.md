# IAMAI target state

Version 2.1 · Sep 1, 2026. Supersedes version 1 (prompts 46–50) and version 2 of earlier today. Incorporates the owner-feedback
rounds 1–3 (`docs/design/owner-feedback-log.md`) and the Stage 2 deep audit
(`docs/design/stage2-deep-audit.md`).

This document says what each screen contains, in full, and nothing else.
`docs/qa/page-contracts.json` (version 2) is the machine copy; the build fails on anything a
surface renders that its contract does not list.

Claude Code does not edit this document or the contract; a violation is fixed by removing what
violates it, or reported for review with the case. Anything in §13 is undecided: it is not built,
and not approximated.

Version 2.1 adds the owner's round-4 and round-5 decisions: the plan's unit is a phase, numbered
and unnamed except Preparation and Cleanup; every product sentence lives in
`docs/design/content.json` and the app imports it; a step's What to do is generated from the
baseline's own policy object ("the baseline wins"), the catalogue keeping intent only; policies
exclude the exclusions group, never the emergency accounts by name; the campaign registers
passkeys for everyone and its readiness gate is time-boxed; and `docs/design/baseline-onboarding.md`
defines how any baseline is imported and validated.

What changed from version 1, in one paragraph: the signed-out page is an opener, not a sign-in;
the Connect page after a scan shows what IAMAI found and asks nothing; every decision is made
inside the step that needs it, pre-filled from the scan, so the assumptions strip and the word
"assume" are gone; steps are titled by what they fix, say only what changes what the reader knows
or does, render lists as lists, end with `Scan to update the plan`, and can be marked
`Doesn't apply here` where their subject can legitimately be absent; the first phase is
`Preparation` and a `Cleanup` phase closes every plan; the Recovery card is gone; every page carries
one dismissable tip and no page teaches the tool; and four engine rules are now law — content per
goal, one number per fact, deterministic derivation, and recognising what the tenant already has.

---

## 1. What the product is

IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access baseline,
and produces a dated plan to close the gaps without locking anyone out.

The user is one person at a small MSP or SMB, learning as they go, with no change process and
nobody to ask. The plan has to be executable by that person in a few weeks, not administered by
a team. The tool is invisible to that person's users: every communication is theirs.

The six questions the product answers, and where:

| Question | Surface |
|---|---|
| Where are we now? | **Today** |
| Where should we be? | the baseline, explained on Connect; page 1 of the printed plan |
| What is stopping us? | each **Plan** row states its gap |
| What do we do about it? | the step: **What to do**, generated from the baseline's policy |
| What first? | the **Plan**: phases, in order, dated |
| Why? | the step: **Why**, one sentence, one Learn link |

Detail is available on every step behind one **More**. It is never in the flow.

Every sentence the product shows is written in `docs/design/content.json`; the app imports that
file and fills its variables from the tenant. The engine never composes a sentence.

No page exists to teach the tool. If a page needs explaining, the page is wrong. Each page
carries one tip (§8.8) that can be dismissed for good.

---

## 2. Navigation and states

No sidebar. No stepper. One header:

```
IAMAI Planner · <tenant name>    Today   Plan   Export    Scan to update the plan (scanned 24h ago) · theme · account
```

The product is **IAMAI Planner**; its descriptor, `Conditional Access rollout planner`, is the
page title and the home-page row; its tagline is `Plan the journey to your Conditional Access
baseline.` The path stays `/rollout/` until the demo rebuild.

Signed out, the header shows only the wordmark and theme; the page is the opener (§3).

| State | Where the user lands | Today / Plan / Export |
|---|---|---|
| signed out | the opener | hidden |
| signed in, no scan | Connect (baseline explained + Scan) | disabled, tooltip "after the first scan" |
| scanning | Connect (progress inline) | disabled |
| scanned | Plan | enabled |

Routes: `#/connect` · `#/today` · `#/inventory` · `#/plan` · `#/plan/<stepId>` · `#/export` ·
`#/how`. Old routes redirect: `start`→`connect`, `scan`→`today`,
`mapping|coverage|roadmap`→`plan`, `checks|reads|licensing|naming`→`how`,
`baseline/package`→`how#package`, `recovery`→`plan`. No route name is an implementation term.

`Sign in with Microsoft` signs in on the first click. A cached session signs in silently on the
first click.

Demo (`?demo=1`) runs the same surfaces on a synthetic small-business tenant built to exercise
the lockout scenarios, with relative dates so it never goes stale. It is entered from the opener
(`See it with sample data →`) and the home page, carries a banner with `Leave the demo`, touches
no real storage, and its scan control advances the sample to a week-two view so the tracking
story can be seen without waiting a week. The demo is rebuilt last, from the finished product; it
is not otherwise touched.

---

## 3. Connect

One page, four states.

**Signed out — the opener**

What it is, who it is built for, what it catches. Not a how-to page.

- h1 `Plan the journey to your Conditional Access baseline.`
- one paragraph, at most three sentences: IAMAI reads a Microsoft Entra tenant, compares it
  with a published Conditional Access baseline, and writes a dated plan to close the gaps
  without locking anyone out. It is read-only and runs in this browser.
- `Built for` — one line: the person doing security at a small MSP or SMB, on their own,
  who has to get this done in a few weeks.
- `What it catches` — five lines, as a list, each a lockout the plan predicts from the tenant's
  own records before a policy is turned on: the admin whose only method is a text message ·
  the emergency account inside the policy it exists to survive · the country rule that blocks
  the person who wrote it · the service account that stops the nightly job · the shared
  meeting-room device that a session rule signs out every hour.
- primary button `Sign in with Microsoft`
- one `<details>`: `What IAMAI asks for, and how to remove it`
  - the permissions table: columns `Permission` · `What IAMAI reads` · `Without it`. Six rows.
    One line under the table: "Plus the standard sign-in permissions."
  - `Removing it`: the three portal steps. Nothing after "Properties → Delete".
- links `How IAMAI works →` · `See it with sample data →`

Gone: the "Needs a Global Administrator…" bullets (the licence fact moves to the tip; the
read-only fact is on the home page and in the footer already).

**Signed in, no scan**

- `Signed in to <tenant> as <upn>` · `Sign out`
- the baseline, explained in place, three lines: `Baseline: Jon Hope — Defense in Depth
  (46 policies) · change` · what it is (a published set of Conditional Access policies for a
  small organisation, maintained by its author, loaded live) · what IAMAI does with it (compares
  each policy's intent with what the tenant has, and plans the difference). *change* opens a
  picker with two choices: the default, or upload a package (`how to make one →` links to the
  package section of How IAMAI works). No About card, no version, no file counts.
- primary button `Scan tenant` · one line: "About ten minutes. Reads the tenant into this
  browser; nothing is sent anywhere."

**Scanning**: the same page; the two-lane progress with the current lane in plain words
("Reading sign-in records, 3 of 8 pages"); the Scan button replaced by `Stop`.

**Scanned — the tenant page**

- `Scan complete · 12 people · 10 policies · sign-ins Jul 30 – Aug 29` (every number from
  `src/derive`, §8.1)
- `What IAMAI found` — a readable list, one row per fact, each row a fact and the evidence that
  found it, nothing else: emergency access accounts (names; how each was recognised) ·
  exclusions group (name; which policies exclude it) · trusted network (location names) ·
  allowed countries (from the sign-ins) · service accounts (names; the signals) · shared devices
  (names) · sign-in window · time zone. A fact IAMAI could not find is one row saying so
  (`Exclusions group: none found`). No controls. No question. Nothing on this page refers to a
  decision the plan will ask for.
- primary `Open the plan →`
- `Scan to update the plan` lives in the header from now on.

---

## 4. Today

Answers "where are we now" in one screen. Everything is counted over **active people** (§8.1).
Nothing on this page asks for a decision.

- h1 `Today`
- one purpose line: `Where each person stands before anything is enforced. The plan waits on
  these numbers.`
- one line: `4 active people of 12 enabled · 2 admins · sign-ins Jul 30 – Aug 29`
- four tiles, one row, each with an info icon that carries its definition, and each saying
  which step holds it, as text: `MFA proven` (n · % of active) · `Registered, unproven` (n · %;
  `held by Create and Enforce the MFA Registration Campaign`) · `No method` (n · %; same) ·
  `Not active` (n; `held by Address Problematic Accounts`). Percentages are of active people;
  the tile says so in its one line, not only in the tip.
- search box · one dropdown `Show: All · Proven · Likely works · Never prompted · Possibly
  broken · No method · Not active · Admins · Guests` — every state the table can show.
- the table: `Person` · `State` · `Strongest method` · `Evidence`. State is the six-state MFA
  model in plain words: Proven · Likely works · Never prompted · Possibly broken · No method ·
  Not active (with why: never signed in / inactive since <date> / disabled). Evidence is one
  clause ("MFA via Authenticator 3 days ago"; "no sign-in on record"). Paginated at 50 with the
  row-count line; `Export CSV` under it.
- link `Everything the scan read →` (Inventory)

Definitions (tips and titles) say what was seen and what was not; they never use the word
assume. The Not active definition says what the plan does with them: listed, never counted,
and decided in `Address Problematic Accounts`, because whoever signs in first registers the
method.

No legend. No banner. No rollout tiles. No filter chips.

**Inventory** (`#/inventory`): unchanged from version 1.

---

## 5. Plan

The front door once a scan exists. The plan is the page; nothing sits above it but two lines.

**Header**

- h1 `Plan`
- line one: `31 steps · 11 in place · finishes Thu Sep 24 · 3½ weeks` — every number from
  `src/derive`; the finish date is the last phase's end (§8.1). If the plan cannot finish (a
  blocker with no step that clears it), the line says so in one clause instead of a date. The
  tooltip states the one constraint that set the length (§9), naming steps by their titles and
  nothing else.
- line two: `Built from what IAMAI found on <tenant>, scanned 17h ago · Today shows where each
  person stands.` — the only place the Plan refers to Today.
- `Plan settings` link (small, right); the panel: `Start date` with its input on one line;
  `Change freeze` with `from` and `to` labelled on one line; one sentence: "No step enforces
  inside the freeze or on the last working day before it." Nothing else.

There is no assumptions strip. Every decision the plan needs is made in the step that needs it
(§6.4). The first Ready row carries a small `next` mark; there is no other "do this next"
anywhere, and the mark moves as rows complete or a scan lands.

**Phases**

Each phase is a section. The first is `Preparation`; the last is `Cleanup`; between them
`Phase 1 · Sep 8 → Sep 13`, `Phase 2 · …`, numbered only, never named — names fall apart when
one tenant is 10% of the way there and another 60%. Preparation holds the foundations: emergency
access, the exclusions group, problematic accounts, named locations, service accounts, shared
devices, security defaults and per-user MFA (each only when present), the passkey method
settings, the baseline's authentication strength, the operator's own passkey, the registration
campaign. `Turn Off Security Defaults` is placed immediately before the first policy that
enforces, on that day, whatever else the plan holds. Cleanup holds hygiene that protects nobody
and delays nothing: emergency-account sign-in alerting, the emergency access drill, names off the
tenant's convention, consolidation of policies this plan superseded, the baseline policies not
assessed, as one row each.

A row:

```
● Ready      Block Sign-ins From Countries Not Allowed     nobody affected      Tue Sep 8
● Blocked    Shorten Admin Sessions                        3 admins             after: Create the Baseline's Authentication Strength
```

- one status chip (§8.3), the title (§8.4), who (`nobody affected` · `3 admins` · `12 people`
  · names when ≤3), the date (planned enforcement, or `now` for a Preparation step)
- a second line only when blocked: the one binding reason, ≤12 words, in one of the three
  shapes of §8.5; the same reason on every load
- click opens the step (§6) in place; the URL becomes `#/plan/<stepId>`
- a step that is partly in place carries its gap as the who-line's suffix, in words: `3 admins ·
  sessions expire weekly, the baseline wants 4 hours`

**Footer**, four collapsed `<details>`, one line each when collapsed:

- `Already in place (11)` — the in-place steps, one row each, same row shape
- `Doesn't apply here (2)` — one row per goal with the reason the person gave (§6.10)
- `Not licensed (7)` — one row per goal the tenant cannot hold: `{title} — needs a licence this
  tenant does not hold: Microsoft Entra ID P2`, and one sentence, "Nothing in the plan waits on
  these." Never a tier's benefits; page 1 of the print carries the count and the sentence only.
- `Housekeeping (4)` — one line per item: a policy not in the baseline (`fine to keep` /
  `review`); a name off the tenant's convention with the proposed rename. Baseline policies not
  assessed are rows in Cleanup, not here. Problems with the baseline package are reported on How
  IAMAI works under Baseline packages, never in a plan.

A group with nothing in it does not render.

Gone from this page: the assumptions strip; the `time zone` chip (Plan settings holds the time
zone); the `Housekeeping (0)` line; the word wave; and everything version 1 §5 already deleted.

---

## 6. A step

Opened in place under its row. A section renders only when it has something to say: a section
with no content, or whose content only restates the title or describes the absence of an
effect, is not rendered. There is no summary or "what changes" line; the Why carries it. First
open shows, in this order, and nothing else:

1. **Title** — from the goal's `fixTitle` (§8.4): imperative verb + the thing being fixed,
   Title Case, ≤9 words. Status chip. Then, where two steps are done together (the emergency
   accounts and the exclusions group), one line saying so.
2. **Why** — one plain sentence, naming the tenant where it helps. Then `Learn →` and, where a
   CIS control genuinely matches, the CIS tag, separated.
3. **Who this touches** — the accounts, groups, devices or policies the step acts on, by name,
   as a list; on a policy step, `12 active people · 2 admins · 1 guest` and then only the
   evidence that applies to this tenant, each item with the action and the date it is needed
   by; when the tenant already covers the control, one line naming those policies and that
   Cleanup retires them. Names beyond ten collapse to `and 14 more · Export CSV`. Nothing
   tagged unknown appears. A fact belongs to the step whose subject it is.
4. **The decision** — only on the steps that consume one, pre-filled from the scan, with the
   tenant's data in front of the person, and nowhere else in the product:
   - emergency access accounts (multi-select; create instructions when fewer than two) →
     `Create or Correct Emergency Access Accounts`
   - the exclusions group (one group, chosen from the tenant's groups, never its members) →
     `Create or Correct Exclusions Group`
   - the allowed-countries named location and the countries themselves, plus the travellers
     question → `Create or Correct Allowed Countries Location`
   - the trusted network → `Define the Trusted Network`
   - service accounts → `Create or Correct Service Accounts Group`
   - shared devices → `Give Shared Devices Their Own Policy`
   - the authentication strength that matches the baseline's → `Create the Baseline's
     Authentication Strength`
   - the admins group → `Block the Admin Portals for Non-Admins`
   - the people who need special care → the registration campaign
   - the partner tier and the partner/MSP question → `Require MFA for Guests`; the partner/MSP
     question again on the countries policy; mail-sending devices on the legacy-authentication
     block
   One editor pattern: the picker, then `Save`. Saving regenerates the plan. A selection is the
   plan's decision, verified on the next scan. Unanswered, the plan proceeds on the evidence.
   Nothing earlier than the step asks the question or says it is coming.
5. **What to do** — numbered, one line each, generated from the baseline's policy object
   through the portal-line translator (§8.9): users and groups, resources, conditions, then
   the grant or session control, then `Enable policy: Report-only → Create`. Exclusions are
   always the exclusions group by name, never the emergency accounts. `Portal steps` · `JSON`
   · `PowerShell` tabs on a policy step; `Download JSON`, offered only once every object the
   JSON needs exists. Where the baseline implements one goal with two policies, both are listed
   as Policy A and Policy B. Where a control needs a licence the tenant does not hold, the
   nearest held control is used and the step says so. Where a baseline policy depends on an
   object the tenant cannot have (a trusted network, in a remote-only company), the step shows
   the nearest Microsoft-documented form and says why. Every step has this section with real
   content; an empty What to do is a build failure. Any list of objects is a numbered or
   lettered list, never inline. One naming instruction, in the tenant's detected convention.
6. **Dates** — policy steps only: `Announce Tue Sep 1 · Report-only from Tue Sep 1 · Enforce
   Tue Sep 8`; on a change to an existing policy, `Announce Tue Sep 1 · Change Tue Sep 8`. One
   format. A phase that does not exist is not written. Preparation steps carry no Dates.
7. **Done when** — one list, at most four lines, the same lines the next scan checks. There is
   no second list.
8. **If it goes wrong** — only on a step where a real failure can occur; one line saying what
   to do, ending "If you are locked out, see Create or Correct Emergency Access Accounts."
   That step carries the one copy of the locked-out procedure: `If a change locks you out`.
9. **Tell your people** — only when someone is affected. A copy box with the `Copy` control
   inside it, top right. Written as from the technician to their audience, signed with the
   name set once in Plan settings (default `IT`), never naming IAMAI, in the audience's
   calendar words. One line under the box: `Paste this into your own assistant to match your
   voice.`
10. **Doesn't apply here** — a control, only on steps whose subject can legitimately not exist
    (trusted network, guests, Intune and devices, on-prem sync and the Entra Connect account,
    shared devices, mail-sending devices, service accounts; never emergency access, the
    exclusions group or any other foundation). It asks for one reason, keeps it in the plan
    file, shows it in the footer and on the printed plan. Distinct from Skipped.
11. **Scan to update the plan** — on every step that changes the tenant. When the scan returns,
    the step re-reads itself and opens with what it now sees.

One `<details>` **More**: `What could go wrong` (the items that apply here first, each with a
mark; the rest under `Also possible`; one Learn link, once) · `Prerequisites` (steps, then
conditions, as one list) · `What waits on this` · `For the help desk` · `For your manager`
(policy steps only; two sentences) · `Copy as prompt` · `Skip this step` (never on a
foundation). Every line in More belongs to this goal.

The registration campaign is the one step with its own shape: the readiness number and the
enrol-by date up front; five lists — no method · text or call only · Authenticator approval
without a passkey · registered but never seen · past the enrol-by date with nothing done —
each person once, in the first list that applies; the special-care picker; in-person
instructions per state; the email for everyone else. The readiness gate holds until the
enrol-by date; after it the first policy enforces on schedule and the holdouts are listed for
review. The campaign registers a passkey in Microsoft Authenticator for everyone, because the
baseline's high-risk policy requires one.

Gone from a step: every "New policy, report-only first…" / "Change: …" line; the no-effect
summary lines; `Do it`; `Exit criteria`; `Recovery card →`; inline object lists; the second
naming instruction; direct exclusion of the emergency accounts; the words template, ring, soak,
handle-with-care, wave; every placeholder ("undefined", "—", "the exclusions group (created by
the step above)"); the object-template manager paragraph; a `Skip this step` on any foundation;
Dates on a Preparation step.

---

## 7. Export and How IAMAI works

**Export** (`#/export`): six cards, each a title, one line, one button. `Print or save as PDF`
(page 1 is the posture summary: in place / to do / doesn't apply, the one an MSP shows a
client; then the phases; then every step in full, with each Doesn't-apply reason) ·
`Calendar (ICS)` · `Plan file` (save; load — described as "steps, evidence, decisions and
checkpoints") · `CSV` (Today; inventory tables) · `Prompts for your own assistant` (one
download; `See the prompts` expands the list with a Copy per prompt) · `Grounding bundle`
(redacted by default; the unredacted toggle with its one-line warning). No Recovery row.

**How IAMAI works** (`#/how`): `Permissions` (the table from the opener) · `What IAMAI reads`
(the endpoint tables) · `Every check` (the rows, once; a check's `Needs` names a decision by
its step: `the emergency-access step`) · `Baseline packages` (how to make one; and, when the
loaded package has a policy whose export dropped conditions, one line per policy saying so,
here and only here) · `Limits` (at most five lines). No text on this page refers to Setup or
to a strip.

---

## 8. Rules every surface obeys

### 8.1 One denominator, one number

- **active people**: enabled person accounts with a successful sign-in in the last 90 days
  (`src/derive/sets.ts` `activeUsers`). Every percentage on Today, every "who this touches",
  every readiness threshold, and the registration window use this set.
- **not active**: enabled but never signed in or inactive 90+ days. Shown on Today. Never in a
  denominator. Never delays enforcement. They are a risk of a different kind (whoever signs in
  first registers the MFA method), so Preparation carries one step: `Address Problematic
  Accounts`, with the names, numbered.
- **non-person accounts**: shared mailboxes and resources, confirmed service accounts, shared
  devices. Listed in Inventory, counted nowhere, in no step unless a policy targets them
  directly, never in a people list, never "walked through setup".
- **one population object per step**: `src/derive/population.ts` returns, for a step, the
  active count, admins, guests, enabled covered, and the names, once. The row, the step body,
  the campaign lists, the manager line and the exit lines read that object. Two figures for one
  quantity on one screen is a failing test.
- **one readiness value per kind** (MFA, admin, device), computed once per plan in
  `src/derive`, shown wherever it is shown from that one value.
- **the header's finish date is the last phase's end**, and the week count is derived from it.
- Every number a user sees comes from one function in `src/derive`. Two surfaces showing the
  same quantity from two paths is a failing test (`renderedNumbers`, `agreement`, now run over
  the step body and More as well as the pages).

### 8.2 One verdict

A goal's verdict (in place · partly · missing · below the baseline · does not apply · not
licensed) is computed once in `src/coverage`. A step is *in place* if and only if its goal's
verdict is *in place*. Partly and below-the-baseline goals are *Change* steps and state the
gap. The plan header's "in place" and the footer's "Already in place" count the same set.

### 8.3 Step status, one chip

`In place` · `Ready` · `Blocked` (+ one reason ≤12 words) · `Scheduled` · `Report-only` ·
`Enforced` · `Skipped` · `Doesn't apply`. No kind chips. A status is never repeated in the
who-column.

### 8.4 Names

- One title per step, from the goal's `fixTitle`: imperative verb + the thing being fixed,
  Title Case, ≤9 words, the only name shown anywhere — in rows, in tooltips, in "after:"
  reasons, in What waits on this, in the ICS, in the print. The catalogue goal name is never
  shown. `Create or Correct Emergency Access Accounts` · `Create or Correct Exclusions Group`
  · `Address Problematic Accounts` · `Create and Enforce the MFA Registration Campaign` ·
  `Define the Trusted Network` · `Block the Admin Portals for Non-Admins` (a title says what
  the baseline's policy does). The full set is `docs/design/content.json`.
- Proposed policy names follow the tenant's detected convention, else the baseline's prefix,
  and name the control, not the goal: `Core - Block - Legacy authentication`.
- Names, never ids. No developer vocabulary. No first person. Durations in words
  (`weekly`, `4 hours`), never `168h`.

### 8.5 Blocked reasons

One binding reason per row, ≤12 words, one of three shapes: `after: <step title>` ·
`when <measure> reaches <threshold> (now <value>)` · `when <count> <thing> exist (now <n>)`.
The rest of the reasons are in the step under More. The binding reason for a step is the first
unmet item of its prerequisites in the plan's own order, so it is the same on every load.

### 8.6 Selectors the contract relies on

Selectors: `header.app`, `main.page`, `.tab-panel`, `details.permissions`, `.found`, `.phase`,
`.plan-row`, `.step-title`, `.step-body`, `.decision`, `.copy-box`, `details.more`,
`.plan-footer`, `.plan-settings`, `.export-card`, `.tip`. Two surface depths exist: phases and
export entries render as raised panels (`--bg-raised`, hairline border, 8px radius) so sections
read as units (phases and export entries); everything else separates by hairlines, and per-step tiles do not return.
Controls inside a repeater (a row, a card, a decision, a copy box, a tip) are items, not page
actions.

### 8.7 Prose budgets

Set per surface in the contract. Sentences ≤25 words. Explanations of concepts live in tips
and Learn links, never in the flow. A sentence earns its place only if it changes what the
reader knows or does: lines that describe the absence of an effect, restate the title, or
narrate the tool's reasoning are deleted at the generator, not hidden by CSS.

### 8.8 The page tip

One `PageTip` per surface: at most two sentences (≤25 words each), expanded on the first visit
to that page, collapsing to a `?` control at the top right of the page column that takes no
space in the flow; the collapsed state is remembered per page in local storage. It says what
the page is for and the one thing worth knowing (Connect: the licence fact; Plan: rows open in
place and decisions are made in them; Today: numbers are of active people; a step: `Scan to
update the plan` refreshes it). No other explanatory prose exists on a page.

### 8.9 Content from one file, policies from the baseline

Every sentence a step or page shows is a string in `docs/design/content.json`, filled with the
tenant's values; the engine fills variables and pluralises counts, and never chooses between
phrasings or composes a sentence. The goal catalogue keeps intent only: `fixTitle`, `why`,
who-line patterns, `comms`, `helpDesk`, `manager`, `risks` (each with the predicate that marks
it as applying), `doneWhen`.

What to do on a policy step is generated from the baseline's policy object by the portal-line
translator: users and groups (placeholders resolved to the tenant's exclusions group, admins
group, service-accounts group, strength, locations), resources, conditions, grant or session
control, state. The baseline wins: where the catalogue's template and the baseline's policy
differ, the baseline's policy is what the step says. `docs/design/baseline-onboarding.md` says
how a baseline is imported, validated and pinned, and lists the validators every baseline runs.

Tests fail the build when: any string in the content file is unused, or any rendered sentence
is not in the content file; any rendered text contains `undefined`, `null`, `**`, `—` as a
value, or a forbidden word (§10); a policy step's portal steps or JSON carry neither a grant
control nor a session control; two goals share a comms body, help-desk block or manager line;
a step renders a section with no content; a policy names an emergency account as a user
exclusion; the rendered step for the GetIAMAI and demo fixtures differs from the review page
built from the same file.

### 8.10 Deterministic derivation

The plan is derived on every load from the snapshot and the decisions, and the same inputs
give the same plan: the same steps, statuses, blocked reasons, phase order, dates and text.
Candidates are ordered by a stable key before dependency resolution; phases are numbered in
order; nothing depends on iteration order of a set or map. A test derives the same
snapshot twice, and after a persist/load round-trip, and diffs the result to nothing.

### 8.11 Recognise what exists

Before the plan tells anyone to create something, the engine looks for it:

- **exclusions group**: an assigned security group excluded from at least one enabled or
  report-only policy whose members are the emergency-access accounts (or a subset), or whose
  name matches the convention (break-glass, exclusion). The exclusion checks resolve group
  membership: an account is excluded when its group is.
- **admins group**: a group whose members hold the core admin roles.
- **trusted network**: named locations marked trusted with IP ranges.
- **allowed countries**: a countries named location; otherwise the countries seen in the
  sign-ins.
- **authentication strength**: a custom strength whose allowed combinations equal the
  baseline's.
- **registered security keys**: every FIDO2 method's model and AAGUID in the tenant, so a key
  restriction never drops one.
- **Entra Connect**: whether directory sync exists and which service principal and address it
  signs in from.
- **security defaults, per-user MFA**: their steps render only when the condition is present.
- **emergency accounts, service accounts, shared devices, partner tenants**: as today,
  pre-selected in the step.

A step that gates other steps lists every failing check by name with the fix for each,
numbered. A blocker with an empty What to do is a build failure. Creating an object between
scans removes or shortens a step; it never adds one.

---

## 9. Schedule rules

Unchanged from version 1, with two additions:

| Rule | Value |
|---|---|
| Cleanup | dated after the last enforcement window; nothing in it delays protection; no notice, no rings |
| Finish | the header's finish date is the end of the last phase, Cleanup included |
| Registration gate | the campaign's readiness threshold holds until the enrol-by date; after it, enforcement proceeds on schedule and holdouts are listed for review |
| Security defaults | the step is scheduled on the first enforcement day, immediately before that policy |

Expected outcomes, reported never targeted: ≤30 active people about 3–4 weeks; 31–300 about
6–8; above 300 about 10–12. The plan states the one constraint that set its length, in one
sentence, in the header line's tooltip, using step titles.

---

## 10. Deleted

Everything version 1 §10 deleted, plus:

Pages and routes: the Recovery card (page, route, header link, Export row, every
`Recovery card →` link; the route redirects to Plan).
Surfaces: the assumptions strip and its chips; `Housekeeping (0)` and any empty group.
Sections and generators (delete the generator, not the string): the no-effect summary lines;
`Exit criteria`; `Do it` (renamed, once); the object-template manager paragraph; the
category-keyed comms, help-desk, manager and risk bodies; the second naming instruction;
"then confirm it on the plan"; the Setup references in Done when and on How IAMAI works; the
`time zone` chip.
Words, everywhere in the product (a `forbidEverywhere` test): assume, assumes, assumed,
assumption, Setup, wave, ring (as a noun for a rollout ring, outside §9's Pilot/Everyone
labels), soak, handle-with-care, template, `168h`, `(p2)`, `undefined`, `**`.

---

## 11. Preserved

The engine: collection (Lanes 0/A/B), MFA viability scoring, coverage and the goal catalogue,
validation rules (all checks still run; they surface as steps and as Done when lines), the
roadmap engine (sequencing, rings, batching, tracking from evidence on re-scan), plan file v2
(decisions are the former Setup answers, same keys), redaction, diagnostics, exports, print,
demo mode, the security fixes, the six-state MFA model, the Portal steps / JSON / PowerShell
tabs, `Prompts for your own assistant` and `Copy as prompt`, the Inventory.

| Was | Now |
|---|---|
| Assumptions strip | the decision inside the step that consumes it (§6.4) |
| Setup questions and validation | the decision in the step; Preparation steps; Done when lines |
| Recovery card | `If it goes wrong` on the step; emergency-account credential guidance in `What to do`; alerting in Cleanup |
| Exit criteria | Done when, one list |
| Do it | What to do |
| Before anything else | Preparation |
| Wave | Phase |
| Recovery card | `If a change locks you out` on the emergency-access step |
| The catalogue's policy templates | the baseline's policy objects, through the portal-line translator |
| Housekeeping's "not assessed" rows | Cleanup rows |
| Baseline package export errors | How IAMAI works → Baseline packages |
| "How to use" prose | the page tip |

---

## 12. Acceptance

After each prompt, the reviewer walks getiamai.com/rollout against GetIAMAI and the demo with
Chrome and answers, per surface:

- Does the screen have one job, and is it the job in §1's table?
- Is anything on screen not in this document? (The contract should already have failed.)
- Do the numbers agree with every other surface showing them, including inside a step and its
  More?
- Load the Plan twice from the same snapshot: is it identical?
- Can a first-time user say what to do next without reading a paragraph?
- Open three steps, one of them a session or device policy: can each be executed from What to
  do alone, and does the policy it builds do something?
- Open a blocker step: does it say which checks fail and how to fix each?
- Does the plan tell the person to create anything the tenant already has?
- Is the plan length what §9 predicts for this tenant, and does the header say why, in titles?
- In the demo's week two, does the plan reflect what changed?

A prompt is done when the contract lint is green in CI and the walk finds nothing. "Reported
complete" is not done.

---

## 13. Open — not built until decided

Still awaiting the owner's yes or no. Nothing here is built, approximated or partially built.

1. A since-last-scan line on the Plan header and on Today.
2. Today tiles linking to the steps they hold (the tiles name the steps; whether they link is open).
3. Already-in-place rows that open to show the satisfying policy, its state and the evidence date.
4. Readiness shown once per phase header instead of per row.
5. A posture line at the top of the Plan for the executive read.
6. Today marking emergency and device accounts in the table.
7. The How page: permissions table as a link; endpoint tables to the README; steps linking to their checks.

Decided since version 2 and now in this document: phases unnamed; `For your manager` on policy
steps only; the download and browser-limit goals as one step with two policies (and the two
persistence policies likewise); `Not licensed` as its own list; the rollback procedure inside
the emergency-access step; the baseline-onboarding process; re-pinning the baseline to its
author's current commit with a diff on each update.

Logged for later, out of scope: an automation that watches every baseline for author pushes and
tells the owner, then a purpose-built skill that evaluates the diff and tunes the product with a
short version note.

---

## 14. Build order

- **51** — the engine and the step (§5, §6, §8.1–8.5, §8.9–8.11, §9): the content loader,
  the portal-line translator, recognition, the baseline re-pin and diff, the header (§2), the
  Recovery card removal (§10), the vocabulary sweep (§10), the first-click sign-in (§2),
  Today's Show dropdown and definitions (§4). Claude Code writes no prose.
- **52** — the frame: the opener and the tenant page (§3), the page tip (§8.8) on every
  surface, Today's purpose line and tile text (§4), the footer, How IAMAI works (§7).
- **53** — whatever §13 becomes.
- **54** — the demo, rebuilt from the finished product.

Each prompt is preceded by the contract entries it needs (already in version 2, with `status`
set to the prompt that builds them) and followed by the §12 walk.
