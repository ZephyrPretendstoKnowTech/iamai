# Pass 3 — journey audit (cognitive walkthrough + service blueprint)

Tree at `906a5dc0`. Evidence: `docs/qa/step-snapshots/` (8 fixtures, 249 step
snapshots), `docs/qa/tile-dump.txt`, and the producers themselves run under
`node` (`laneReadings` → `laneViewOf` → `stepBodyOf`, `runFixture`,
`scheduledEventOf`, `planFinish`, `coreGaps`, `demoFacts`). No dev server, no
walk, no smoke. Every finding below was reproduced against the tree or a
committed snapshot before it was written.

Four questions, at every step: (1) will they try to do the right thing?
(2) will they see the control? (3) will they connect it to the outcome?
(4) will they see that it worked? Only failures are recorded.

---

## 1. The walk

### Scenario 1 — Priya, small-business admin, ~30 people, never wrote a Conditional Access policy

**J1 · Home → sample. Q1, Q3 fail. Severity 2.**
`home/index.html` offers `"/{{TOOL_PATH}}/?demo=1#/plan"`, and `demoUrl()` in
`src/ui/demoMode.ts` does the same from Connect: *"The demo enters at Plan
(target-state §2)."* A first-time visitor's first screen is a 43-row board with
four tabs, a search box, a work-type select and two toggles. The orientation
text exists — `pages.plan.howTo.intro`, *"Start with Ready and open a step to
see its findings, instructions and next action."* — behind a collapsed link
labelled `"How to use this plan"`, closed by default (`const [showHow,
setShowHow] = useState(false)`, `src/ui/surfaces/Plan.tsx:95`).

**J2 · Connect, how long the scan takes. Q4 fails. Severity 2.**
Signed out, stage 3 reads `pages.connect.scan.sample.state`: *"after sign-in ·
about a minute for a small tenant"*. Signed in, the same stage reads
`pages.connect.scan.ready.note`: *"About ten minutes. The scan is processed in
this browser; nothing is uploaded to IAMAI."* Same tenant size, two answers, ten
minutes apart.

**J3 · Plan header vs tabs vs legend: three vocabularies. Q3 fails. Severity 3.**
The five header tiles read `structuralWords.summary` (`pages.app.plan.summary`):
`"Ready now"`, `"Needs your input"`, `"Observing"`, `"Completed"`, `"Estimated
finish"`. The tab strip reads `pages.plan.lanes`: `Ready`, `Up Next`, `On Hold`,
plus `"All work"`. The legend behind *How to use this plan* defines a third set:
`Ready`, `Up Next`, `On Hold`, `Completed`, `Deferred`. Nothing anywhere defines
`"Needs your input"` or `"Observing"`, and both are pressable filters.
(`pages.plan.progress` — `"Steps"`, `"Completed"`, `"Projected finish"`,
`"Started"` — is no longer read by the tiles at all; only its `label` is, as the
`<dl aria-label>`.)

**J4 · "Ready" rows that are not scheduled, or dated three weeks out. Q1 fails. Severity 2.**
Across the committed snapshots, 9 rows read badge `"Ready · Decision"` with rail
`"Not scheduled"` (e.g. `demo-week2/s-goal-block-device-code`,
`demo-week2/s-goal-guests-mfa`). In `small` the Ready tab shows
`[Ready · Decision] Block Legacy Authentication | Sep 20, 2026` beside nine rows
dated `Aug 31, 2026`. A lane that means "you can take the next action now" and a
When column that says "Not scheduled" are on the same row.

**J5 · The board never names the prerequisite. Q3 fails at board level. Severity 2.**
`PlanRow` (`src/ui/surfaces/StepSections.tsx:45`) draws lane, chip, number,
title, who, when — and its own contract says `when` is *"A day, or the
placeholder (planBoard.ts boardWhen): never a reason."* Eleven of `small`'s 30
rows are Up Next and every one shows `"After prerequisites"` in the When column
with no prerequisite named. The information is correct one click down — 75 of
the 249 snapshots have `bar: "After Prepare Emergency Access Accounts"` — but
the board gives a person no way to see that one step unblocks eleven.

**J6 · The report-only step: no date, no next check. Q4 fails. Severity 2.**
The only report-only policy in the corpus is
`s-goal-admins-phishing-resistant`. `demo` reads:
`lane: "On Hold"`, `fact: "Report-only"`, `badge: "On Hold"`, `bar: "Observing"`,
`rail: "Not scheduled"`, `when: "After prerequisites"`, tile
`{"label": "Threshold", "state": "67% of admins phishing-resistant"}`.
`contract.nextAction` is `null`. Nothing states the observation window, the day
it closes, or a date to come back. (The `MfaHandoff` block does give the people
and a `← Back to the step` link — that part works.)

**J7 · The dead-end step. Q1–Q4 all fail. Severity 4.**
`small/s-goal-block-device-code.json`, reproduced exactly:

```
"fact": "Enforced",          "badge": "On Hold",
"bar": "Not supported",      "rail": "Not scheduled",
"reason": "until a scan rebuilds this step",
"tiles": [ …, {"label": "Not supported", "state": "Not supported"} ],
"channels": ["Entra","PowerShell","JSON","AI Info"]
```

`contract.doneWhen` is `["A scan rebuilds this step with a policy IAMAI can
write."]`; the tile's `note` is `null`; the implementation box is
`{"title":"No artifact for this policy yet","text":"IAMAI offers no artifact for
this policy as it stands."}` yet four channel tabs are still drawn. The step's
own state (`src/roadmap/operations.ts:1254`) is `valid.length === 0 && status
!== 'done'` → `no-operation`, which is deterministic: scanning again cannot
change it. So the one instruction the step gives is the one action that cannot
work.

This is severity 4 under the override, not for the dead end but for the chip:
the row asserts **`Enforced`** while the bar asserts **`Not supported`**. A
person cannot tell from this step whether device-code sign-in is blocked in
their tenant. 18 step-instances across 7 of the 8 fixtures
(`s-goal-block-device-code`, `s-goal-guests-mfa`, `s-goal-inforcer-mfa`).

---

### Scenario 2 — Marcus, MSP technician, hourly, twelve more tenants after this one

**J8 · There is no schedule. Q1, Q3 fail. Severity 3.**
Every fixture's plan has exactly one wave:

```
small / demo / mid / messy → waves 1, 2026-08-31 → 2026-09-07, 18–20 steps
```

Distinct `when` values, all eight fixtures: `Aug 31, 2026`, `Est. Aug 31, 2026`,
`Aug 28, 2026` (already-found rows), `Already in place`, `After prerequisites`,
`Not scheduled`. **No step in any fixture is scheduled for a different day from
any other step.** The column headed `When`, the tip on *Estimated finish*, and
the how-to's *"Estimated dates adjust as the plan changes"* all rest on this.

**J9 · The calendar is one day. Q3, Q4 fail. Severity 3.**
`scheduledEventOf` over the same fixtures:

```
small → 12 events, days: {"2026-08-31": 12}
demo  → 11 events, days: {"2026-08-31": 11}
mid   → 13 events, days: {"2026-08-31": 13}
```

including four `createReportOnly` transitions on the same day as the `prepare`
for Emergency Access that they wait on. The Export card is headed `"Timing"` and
reads *"Every scheduled step as a calendar entry, with its portal path and its
done-when lines."*

**J10 · The estimate a technician would quote ignores the held work. Severity 3.**
`messy`: `planFinish` → `{finish: null, held: true, unwritable: {count: 12,
waitsOn: [break-glass, exclusion-group, allowed-countries]}}`. The header tile
nevertheless shows **Sep 7, 2026**, one week, from
`schedule.estimate.targetEnd`, and the tip reads *"MFA registration for 6 people
takes 1 week and no enforcement is left to schedule."* Twelve steps that cannot
be written are not in that sentence. `demo` and `small` show `Sep 20, 2026` on
the same basis.

**J11 · The loop costs a full scan. Q4 fails. Severity 2.**
The only way to see a change landed is `"Scan to update the plan"` in the step
footer, which runs the same scan Connect prices at *"About ten minutes."* There
is no per-step or per-section re-read. A 30-step plan is 30 of those.

**J12 · The header no longer says when the plan started. Q4 fails. Severity 2.**
`progressTiles` (`Plan.tsx:339`) is ready / input / observing / completed /
projectedFinish. `pages.plan.progress.started` (`"Started"`) is not read by any
tile. The start date is behind *Plan settings* → `"Plan starts"`. A technician
picking a tenant back up has no on-screen answer to "when did we start this".

---

### Scenario 3 — Dana, inherits the plan at step 4

**J13 · Nothing records who. Q3, Q4 fail. Severity 3.**
`src/roadmap/decisions.ts:26`:
`export type StepDecision = { picked?: string[]; option?: string; answers?: Record<string, string>; at: string }`
and `OwnerConfirmation = { at: string; basis: string; outcome?; testedAt?; … }`.
Only `at`. The confirm dialog shows `CONTRACT.confirm.confirmedOn` — a date and
nothing else. The only `operator` field in the product is on the exported plan
file (`Export.tsx:156`), which records whoever exported it, not whoever decided.
The inheritor is asked to trust a tick with no name on it.

**J14 · No "what changed since the last scan". Q4 fails. Severity 2.**
Per-step continuity exists in the data (`observation.changed`, `unwritten`,
`"still in {state}, unchanged since the last scan"`), but there is no plan-level
reading of it. After a re-scan the only feedback is that some rows moved lane.

**J15 · A Cleanup row completes from a tick made on another step. Q4 fails. Severity 2.**
`signInMonitoring` is ticked on *Prepare Emergency Access Accounts*
(`onTick: (key: 'credentialStorage' | 'signInMonitoring', done) => void`,
`Plan.tsx:642`) and is the second fact that completes the Cleanup row
*"Alert on Emergency Account Sign-ins"* (`cleanupComplete(row, answers)`). The
Cleanup row's own `doneWhen` is *"A controlled sign-in by an emergency account
produced an alert at the monitored destination, and the response owner confirmed
receipt."* The inheritor can find that row already complete with nothing on it
saying where the completion came from.

**J16 · The product's own "second visit" looks worse than the first. Severity 2.**
`demo-week2` board counts: `{ready: 14, upNext: 0, onHold: 17}`, and 13 of the
17 holds read `"Waiting on your direction"` while the four Direction steps sit
`Ready · Decision` in the same board. Week one: `{ready: 10, upNext: 11, onHold: 5}`.
The demo is what a stranger sees after pressing *Scan again*.

---

### Scenario 4 — the tenant where half the reads fail

**J17 · All-or-nothing: no plan at all. Q1, Q2 fail. Severity 3.**
`coreGaps` (`src/graph/collect/coreSections.ts`) gates on three sources:
`config:caPolicies`, `users`, `signInEvidence`. `hostile` has
`signInEvidence: "insufficient"` → `coreGaps` non-empty →
`ui/actions.ts:115` `if (found.length > 0) return` — the snapshot is not stored
and no plan is built. Connect shows *"finished with gaps · no plan built"*, and
two controls: *Sign in with another account* and *Scan again*. A tenant that
will not grant sign-in-log access gets nothing from IAMAI, although the
policies and the people were read.

**J18 · The same missing data, two different outcomes. Severity 3.**
From the same file: *"A section a licence withholds (sign-in records without
Entra ID P1) is not a gap."* So a free-tier tenant with no sign-in records gets
a full plan (and Connect's complete state adds the note *"Sign-in proof not read
· MFA readiness not measured"*), while a licensed tenant that refuses the same
data gets no plan. Nothing tells the person which side of that line they are on.

**J19 · The gaps sentence counts the wrong thing. Q3 fails. Severity 3.**
`connectView.ts:400`: `lead: fillText(input.lastScan ? G.lead : G.leadFirst, { n: input.unread.length })`
over *"{n} sections could not be read with this account. The plan needs them, so
IAMAI built nothing from this scan."* For `hostile`, `unreadSources` returns
`["registrationDetails","devices","signInEvidence"]` while `coreGaps` returns
one. The person is told the plan needs three sections it needs one of, and will
go chasing two permissions that would not have changed the outcome.

**J20 · The role asked for is hard-coded. Severity 2.**
`ask: fillText(G.ask, { role: READ_EVERYTHING_ROLE })` — always Global Reader.
`coreGaps` computes the least-privileged roles per source and hands them over
unused; for `hostile` that is `["Reports Reader"]`.

**J21 · A refused read leaves no notice on any other page. Severity 3 (override candidate: 4).**
`AppShell.tsx:333`:
`{Object.values(snapshot.config).some((s) => s.status === 'error') && <p className="reason">{SHELL.partialEvidence}</p>}`
— *"Some configuration reads were unavailable. Check the affected steps before
making changes."* A refusal is recorded as `'disabled'`, not `'error'`
(`App.tsx` `?denied=1` does exactly this: `{status: 'disabled', reason:
'Insufficient privileges…'}`), and no `snapshot.sources` status is examined at
all. So a plan built on unread devices, unread registration details or unread
role assignments carries no banner anywhere.

**J22 · Security defaults: the plan's order is the reverse of Microsoft's. Severity 4.**
`messy` has `config.securityDefaults: {rows: [{isEnabled: true}]}` and ~30
Conditional Access steps. The step that turns them off is
`messy/s-prereq-security-defaults`: `lane: "On Hold"`,
`bar: "After Require Phishing-Resistant MFA for Admins"`, tiles
`Block Legacy Authentication · Prerequisite · To do` and
`Require Phishing-Resistant MFA for Admins · Prerequisite · Waiting` — and that
second step is itself `On Hold` behind *Configure Emergency Exclusions*. So the
unblocking step is buried two holds deep under the work it blocks, while the
Ready tab offers `[Ready · Decision] Block Legacy Authentication` and the Up
Next tab offers five more Conditional Access rows.

Microsoft Learn, *Configure Security Defaults for Microsoft Entra ID*
(`learn.microsoft.com/en-us/entra/fundamentals/security-defaults`, checked
2026-09-20): **"Organizations that choose to implement Conditional Access
policies that replace security defaults must disable security defaults."** and
**"After administrators disable security defaults, organizations should
immediately enable Conditional Access policies to protect their organization."**

Nothing on the Plan — no callout, no Ready-tab row, no line on any policy step —
tells a `messy`-shaped tenant that security defaults are on. The step's own
`contract.why` is *"Replacing Security Defaults gives you more control over
access rules. The changeover needs care so the tenant does not lose protection
between the two configurations."* — which does not say a policy cannot replace
them while they are on.

Severity 4: an admin following the Ready tab builds Conditional Access policies
in a tenant where, per Microsoft, they do not replace what is enforcing; and the
step that reverses that is presented as the last link in a chain rather than the
first. (The *portal's* refusal to enable a CA policy while security defaults are
on was not re-verified in this pass — only the documented requirement above.)

---

## 2. Service blueprint

| journey step | what IAMAI read | what it inferred | what it asked the person for | gap? |
|---|---|---|---|---|
| Home | nothing (static page) | nothing | nothing | — |
| Connect, signed out | the demo fixture, baked at build time (`virtual:demo-facts`) | `{people:30, steps:43, inPlace:3, weeks:3, estimated:true}` | sign in, or open the sample | **yes** — `weeks:3` comes from `schedule.estimate` on a plan whose `planFinish` is `held:true`; the panel labels it *"estimated rollout"* but the number itself never accounts for the 20 unwritable steps |
| Sign in | the MSAL token; `rolesInToken` | the account's directory role; whether it can read the tenant at all | a work/school account; one-time GA consent | — |
| Baseline | `baselines/*.pinned.json`, `origin.commit`; optionally the author's HEAD over the network | which policies changed and which steps they touch | nothing | **yes** — the picker is `{false && open && …}` (V2); the only action is *Load Defense in Depth*, and only when nothing is loaded |
| Scan | 12 config sections + 7 sources (`pages.app.scan.sections`) | coverage, population, MFA viability, every lane | nothing | **yes** — 3 of the 19 are mandatory and refuse the whole plan (J17); the other 16 can be `disabled` with no notice on any page (J21) |
| Plan header | the computed plan | ready / input / observing / completed counts; an estimated finish | the start date; *Start the plan* | **yes** — the estimate is at pace over a held plan (J10); "Needs your input" double-counts (see §3.1); no "Started" tile (J12) |
| Direction ×4 (frozen) | named locations, groups, service principals, guests, sign-in records | a suggested answer per question | four approvals | — |
| Emergency Access ×4 | account kind, roles, registered methods, group membership, policy exclusions | which accounts qualify; whether exclusions carve them out | which accounts are the emergency accounts; two attestations | **yes** — one attestation silently completes a Cleanup row three weeks away (J15) |
| A policy step, Ready | the matching tenant policy, its fields, the exclusions group, the reach | candidate vs satisfier, the operation, the population | a confirmation, or an answer that lives in a Direction step | **yes** — `bar: "Needs a decision"` on a step that draws `AnsweredInDirection`, not a decision form (§3.1) |
| Deploy in report-only | — | — | create it in Entra, then scan again | **yes** — dated the plan start day regardless of what it waits on (J8, J9) |
| Observe | `evidencePolicyResults`, sign-ins since `reportOnlyAt`, registered methods | a threshold percentage; whether the window is reviewable | nothing | **yes** — no window length, no closing date, no next check (J6) |
| Enforce | — | `nextAction === 'enforce'` → `Ready · Ready to enforce` | turn the policy On, scan again | **yes** — no fixture in the corpus reaches this badge; unverified end to end |
| Re-scan | the same 19 sections | observation continuity, `unwritten` differences, lane moves | nothing | **yes** — no plan-level statement of what changed (J14) |
| Export | the computed plan | six artifacts, all from `stepExportView` | which one to take | **yes** — the artifact headed *Timing* puts every event on one day (J9) |
| Any page, after the scan | `snapshot.asOf`, `snapshot.config[*].status` | scan age; "partial evidence" | nothing | **yes** — the partial-evidence predicate cannot fire for a refused read (J21) |

---

## 3. Where the story breaks, repeats itself, or asks twice

1. **The same question is asked twice and answered once.** `ANSWERED_IN`
   (`src/roadmap/direction.ts:293`) routes `mailDevices` → *Block Legacy
   Authentication*, `deviceCode` → *Block Device Code Sign-in*, `partner` →
   *Require MFA for Guests*. Each of those three policy steps reads
   `bar: "Needs a decision"` / `Ready · Decision` and each draws
   `<AnsweredInDirection>` instead of `<Decision>` (`ContentStep.tsx:496`). In
   `demo` the **Needs your input** tile counts **9**: the four Direction steps
   plus these three plus two more. Answering the four Direction steps clears
   seven of the nine.
2. **"Not supported", three times on one step, never explained.** The readiness
   bar, the Readiness tile's label and that tile's value are all the literal
   string `"Not supported"`, and the tile's `note` is `null`. 11 snapshots.
3. **The tenant-fact chip contradicts the state beside it.** `"Enforced"` +
   `bar: "Not supported"` (`small/s-goal-block-device-code`); `"Report-only"` +
   `bar: "Observing"` + `rail: "Not scheduled"` (`demo/s-goal-admins-phishing-resistant`).
4. **Two different reasons on one step.** `messy/s-goal-inforcer-mfa`:
   `reason: "until a scan rebuilds this step"`, `bar: "After Turn Off Security
   Defaults"`, `fact: "Enforced"`.
5. **The bar says the lane instead of the reason.** `demo-week2/s-goal-inforcer-mfa`
   has `bar: "On Hold"` — the `r.reason === null` fallback in `holdGroupOf`
   reaching the screen.
6. **Three vocabularies for one state machine** — tiles, tabs, legend (J3).
7. **Connect promises weeks; the Plan is held.** `planFinish` returns
   `held: true` in all eight fixtures, yet Connect's destination panel says
   *"3 weeks · estimated rollout"* and the header tile shows a date.
8. **The scan's length is stated twice, differently** (J2).
9. **One tick, two rows** — `signInMonitoring` (J15).
10. **`"After prerequisites"` is both a When value and an Up Next label tail**
    (`pages.plan.when.afterPrerequisites`), so the column documented as
    *"never a reason"* is where the reason turns up — without the prerequisite.
11. **Every actionable row carries the same date** — the plan-start day, in
    every fixture, in the board, the rail and the calendar (J8, J9).
12. **The rail contradicts the badge.** 9 snapshots read `Ready · Decision` with
    `rail: "Not scheduled"`; 11 read `On Hold` with a dated rail.

---

## 4. FROZEN

Recorded, not applied. The four `s-direction-*` steps and the four Establish
Emergency Access steps.

**F1 · `Est.` is never defined.** All four Direction rows read
`when: "Est. Aug 31, 2026"` (`pages.plan.when.estimate` = `"Est. {date}"`).
Neither the legend, the how-to, the column heading (`When`) nor any tip says
what the abbreviation means or how an estimated date differs from a plain one.
26 other snapshots use it too, so the fix is not confined to the frozen steps —
but the Direction rows are where a first-time admin meets it first.

**F2 · The four Direction rows are indistinguishable on the board.** In every
fixture they read `[Ready · Decision] <title> | Est. Aug 31, 2026` with Impact
`"Tenant settings"` for all four. Same lane, same substatus, same impact, same
date; only the title differs. Nothing says which to do first or that they are
answered as a set.

**F3 · The Direction steps never say what they unblock.** In `demo-week2`, 13 of
17 On Hold steps read `bar: "Waiting on your direction"`. The four Direction
rows carry no count, no "unblocks N steps", and no link in the other direction.
The dependency is stated 13 times on the blocked side and zero times on the
blocking side.

**F4 · *Prepare Emergency Access Accounts* is the most-named prerequisite in the
product and its row does not say so.** 75 of 249 snapshots read
`bar: "After Prepare Emergency Access Accounts"`; in `small` nine steps are
unwritable waiting on it (`planFinish.unwritable.waitsOn`). Its Ready-tab group
summary reads `"1 step"`.

**F5 · `demo/s-prereq-break-glass` reads well and needs nothing.** Recorded for
completeness: the tile *"Emergency access account 1 (bg1@…) — Passkey check
incomplete / IAMAI could not fully check this account. Open MFA Readiness and
find it under Emergency access, where Evidence read says what could not be read.
No account change is established."* is the bar the rest of the product is being
measured against, and it holds.

---

## 5. Patterns

1. **The step is coherent; the board is not.** Every reason, prerequisite name,
   threshold note and population caveat is correct inside the opened step and
   absent from the row. The board is the surface a person spends their time on
   and it carries five fields, one of which (When) is where the reasons leak.
2. **Three producers can disagree about one step.** `factOf` (the chip),
   `laneViewOf` (the lane, badge, bar, rail) and `boardReasonOf` /
   `readiness.bar` (the reason) are computed independently and are rendered
   side by side. Every contradiction in §3.3–§3.5 is an instance.
3. **A dead end is dressed as a wait.** `"Not supported"`, `"until a scan
   rebuilds this step"` and `"A scan rebuilds this step with a policy IAMAI can
   write."` all instruct the one action that provably cannot change the state
   (`no-operation` is deterministic from the snapshot). The product's honesty
   about what it does not know becomes dishonesty about what the person can do.
4. **Time is decorative.** One wave, one date on every actionable row, one day
   of calendar events, and an "Estimated finish" computed from a rollout
   estimate that excludes the work the plan itself says is holding it.
5. **Partial reads are gated hard at the door and silent everywhere after it.**
   Three sources refuse the whole plan; sixteen can fail with no banner on any
   page, because the one banner checks the wrong container and the wrong status
   value.
6. **Provenance stops at the timestamp.** Decisions, confirmations, attestations
   and checkpoints all record `at` and none records who — which is exactly the
   field the third scenario needs.
7. **The safety ordering is right in the engine and invisible on the page.**
   Emergency access before policies, exclusions before enforcement, replacements
   before removing security defaults — all encoded, none stated where a person
   choosing what to do next would read it.

---

## 6. Could not check

- **The enforce leg.** No snapshot in `docs/qa/step-snapshots/` carries the badge
  `Ready · Ready to enforce`; the badge tally is Up Next 76, On Hold 65,
  Ready · Decision 41, Completed 36, Ready · Review 27, Ready · Create 15,
  Ready · Correct 9, Doesn't apply 5. Everything said about report-only →
  enforce is read from `src/actionability/lanes.ts:479` and
  `src/roadmap/lifecycle.ts`, not from a rendered state.
- **Anything that needs a browser** (forbidden this pass): focus return from the
  settings panel, the confirm and troubleshooting dialogs, tab-follows-open-step,
  the print document as printed, mobile widths.
- **Whether the Entra portal refuses to enable a Conditional Access policy while
  security defaults are on.** Only Microsoft's documented requirement to disable
  them was verified (J22).
- **The `getiamai`, `micro` and `huge` fixtures** have no committed snapshots, so
  a real tenant's shape (GetIAMAI) and the largest tenant were not walked.
- **Two demo snapshots under a real re-scan.** `demo-week2` was read as a
  fixture; the seeded decisions the app writes into the plan record are applied
  by `App.tsx`, not by `runFixture`, so the week-two board above is the
  un-answered version of it.
