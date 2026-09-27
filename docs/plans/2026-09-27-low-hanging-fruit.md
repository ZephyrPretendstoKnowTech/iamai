# Low-hanging fruit: the combined audit backlog (2026-09-27)

One backlog from three sources, worked ten fixes at a time. Each round picks the
ten items that are quickest to build, safest and most valuable. The owner
approves every fix before it is built.

## Sources

- **Own audit** (Claude, 2026-09-26, live 55017e45). IDs `OWN-*`.
- **External UX audit** (27 Sep 2026, build 55017e4, 199 verified findings,
  demo tenant and a dev mock). IDs `F-001`…`F-199`. The full report, with steps,
  screenshots and verifier notes, is `C:\Users\Owner\Downloads\IAMAI UX Audit.zip`:
  `index.html` embeds the findings as JSON in `<script type="application/json" id="data">`.
- **Owner notes** (2026-09-27):
  - Trim the accepted-difference panel (OWN-ACCEPT).
  - Every own finding is reasonable to fix.
  - The policy-matching question (see "Not low-hanging").
- **Triage** (2026-09-27, main at d9516a22). Every item was checked against the
  code: status, effort, risk, reward and a fix sketch. The result is in
  `2026-09-27-low-hanging-fruit-backlog.json` next to this file. Evidence was left
  out; re-read the code before building.

Several items changed after the audits ran. The printed plan was rebuilt as a
leadership briefing (c623ff0d..d9516a22) and the beta notice was removed
(cdf79d82). So the triage marks each item `present`, `partly`, `fixed`,
`superseded`, `intentional` or `unclear`.

## Rubric

- **Effort:**
  - XS: a content string or one condition, under 30 minutes with its test.
  - S: one component or function plus a test, about 2 hours.
  - M: half a day.
  - L: a day or more.
  - XL: architecture.
- **Risk:**
  - low: one surface.
  - medium: a shared component, or words on an approved step's screen.
  - high: the engine (lanes, tracking, matching, scheduling, readiness), or persisted data.
- **Reward:**
  - 5: a truth or trust break on the main path.
  - 4: a real confusion on the main path.
  - 3: friction on the main path, or a truth break on an edge path.
  - 2: polish.
  - 1: cosmetic, or only at extreme scale.
- **Frozen:** the fix reaches a finished step's screen. Each fix is approved
  on its own, so a frozen fix still ships once the owner says yes.

## Readiness scores

The goal: an overall score of **90 or better, with no surface below 85**. Each score is the share of its reader's job the surface does well: would the reader finish what they came to do, trust what it says, and not regret the time?

The baseline comes from the audience-framed audit on 2026-09-26 (live 55017e45), which gave an overall of about 74. Every round re-scores every surface from a live walk and adds a column.

| Surface | Reader | Baseline 2026-09-26 | After Round 1 | After Round 2 | After Round 3 | What moved it |
|---|---|---|---|---|---|---|
| Home + demo | Evaluator deciding whether to try it | 72 | 76 | 80 | 82 | The sample's length now agrees (Connect and the Plan both say 5 weeks), the sample's MFA Readiness no longer shows banned wording and its Not counted lists work, and the Plan names where to start. Still: Scan in the demo jumps to the follow-up scan unexplained (Round 2), no product image (OWN-B1). Round 2: Scan in the demo says it moved to the sample's follow-up scan, and the switch looks like one; the sample's 1.2 lists and counts five policies and 4.4 no longer repeats 1.2's edit. Still: no product image (OWN-B1), nothing says how to remove the sample's data (F-078). Round 3: Back stays in the demo instead of leaving for the home page; Connect and How say how to delete what the browser keeps. Still: no product image (OWN-B1); the sample's data contradicts itself where an expert looks (F-140). |
| Connect | First-time admin deciding whether to trust it | 82 | 86 | 89 | 90 | The beta notice went (cdf79d82), the sample tile is true, and Forget asks first. Still: a cancelled sign-in leaves the button stuck until a reload (F-057, Round 2). Round 2: a cancelled or refused sign-in leaves Sign in ready, with the consent paragraph kept; Forget's plan-file link looks like a link. Still: "1 section was not read in full" leads nowhere (F-058), a 40-day-old scan reads Ready to plan (F-186). Round 3: the removal line says Sign out keeps what is stored and Forget this tenant deletes it. Still: a 40-day-old scan reads Ready to plan (F-186). |
| Plan + steps | Admin doing the work | 82 | 85 | 88 | 90 | Next: names the first Ready step; an accepted difference is said once; AI Info warns before it is copied; service cards say what Yes keeps; Work countries says travellers are blocked. Still: rows waiting on answers don't say where (Round 2), the legend covers half the words (Round 2), a deferral's reason is never shown (Round 2). Round 2: rows name the decision step they wait on, the legend covers every word on the board, a deferral says why, taking an emergency account off asks first, 1.1's Troubleshooting opens on Temporary Access Pass. Still: the Plan's own "could not read" sentences (OWN-B4), Completed steps still say "select Scan" (OWN-W7). Round 3: Back closes the step it opened and keeps a tile filter; a tab another tab saved over stops saving and says Reload; the one-line instruction clips are gone; the account pickers mark administrators and your own account; the signed-in admin is never dormant (F-177). Still: after a scan the page jumps to the top (F-028); the (i) closes on the click that should open it (F-091); Up Next steps never say "not yet" (F-001). |
| MFA Readiness | Admin and help desk running the campaign | 85 | 88 | 90 | 91 | Not counted links list their accounts, someone about to lapse needs action, and nothing says "couldn't read". Still: opened from Prepare Your Team it shows 30 people where the step named 10 (F-018, Round 2). Round 2: opened from Prepare Your Team it shows the nine people the step names. Still: the headline's "(29 people and 1 guest)" reads as if they are the ready ones (F-044); search hides matches in closed groups (F-116). Round 3: opens at its top from a scrolled Plan. Still: the headline's cohort reads as the ready ones (F-044); search misses matches in closed groups (F-116). |
| Inventory | Admin checking what the scan saw | 78 | 78 | 78 | 83 | Unchanged: no round has reached it yet. Round 3: lists the plan's own groups, its Distinct users tip is true, its MFA state words are defined, and it opens at its top. Still: no search; the sample's data contradicts itself (F-140); legacy authentication is named differently from its step (F-064). |
| Export page | Other tools and records | 80 | 80 | 80 | 85 | Unchanged: no round has reached it yet. Round 3: loading a plan file says what it holds and asks over recorded work, and the Plan says which file came back; the prompts are the implementer's and never cut mid-instruction; masked means masked for guests; the JSON note is true. Still: file names carry no tenant or date (F-047); CSVs open badly in Excel (F-127). |
| Printed plan | Manager, director, owner | 25 | 78 | 82 | 85 | First score of the leadership briefing (c623ff0d..d9516a22), walked live on the owner's tenant: status, what it needs from the reader, the journey and each change in manager terms. Still: no scan date, so an old briefing reads as current (F-184, Round 2); set-aside steps carry no reason (F-013, Round 2). Round 2: the cover says which scan it was made from, and warns past a week; a set-aside step says why. Round 3: each decision under What we need from you names the questions it asks. Still: a person the plan waits on is named once per step (4.3, 5.1 and 5.2 each name the same admin). |
| How | Security-minded evaluator | 85 | 85 | 85 | 86 | Unchanged. Round 3: says how to delete what the browser keeps. |
| **Overall** | | **about 74** | **82** | **84** | **86.5** | The mean of the eight. After Round 1 the briefing's first score was most of the rise, and Round 1 added about 2; Round 2 added 2; Round 3 added 2.5, most of it on Export, Inventory and the briefing. The honest whole-tool rating is about 84 (from 81): the truth and safety layer about 89, the experience layer about 78. To reach 90 with none under 85, Inventory (83) and Home + demo (82) need the next rounds, and the experience layer needs the felt fixes. |

## Round 1: done (live at de1695c2, 2026-09-27)

**Commits:** a5b31f9a (OWN-ACCEPT), fcefbe79 (F-004), a76fda99 (F-071),
38568ce4 (OWN-R1), 8ce16280 (OWN-B3), 402118a4 (F-061), 24da5d20 (F-068),
76fe578b (F-070), d716bf17 (F-160), 814055fe (OWN-W1), and de1695c2 (review
fixes: an adversarial review confirmed 17 findings, all fixed).

**What the owner chose:**
- OWN-ACCEPT: the rail keeps only the heading and Remove acceptance; where no Satisfied tile states the acceptance, it says the date and reason itself.
- F-068: every service card says what Yes keeps, in the kept step's own words.
- F-070: the travel picker is removed; Work countries says every other country is blocked; the lane engine reads travel exceptions as not-applicable (a saved "No Recurring Destinations" did that before); Save Countries stays.
- F-061: the warning, not masking. F-160: the confirm, nothing afterwards.
- OWN-B3: four of the approved phrases were corrected before the build, so they stay true where the tenant refused the read.

**The live audit (Claude in Chrome, owner's tenant and the demo):** every fix landed as approved.
- 4.3 reads "Difference Accepted / Remove acceptance"; the Satisfied tile says "Accepted Sep 27, 2026: …".
- Signed-out Connect says 5 weeks, and the demo Plan's ⓘ says "The plan is 5 weeks".
- The demo's Not counted views list their accounts (svc-mailer-1 and svc-mailer-2 under Service accounts).
- The owner's MFA Readiness reads "Needs action · 1", with the lapsing person under Ready, open.
- The demo's MFA Readiness has no "couldn't read" and no Unknown group.
- AI Info shows "Contains tenant context. Review before sharing with an external AI service."
- 2.1: "Limit SharePoint and OneDrive to the office network", with its Yes line; AVD's Yes line shows when Yes is picked.
- 6.3: the new help line, no travel picker, Save Countries kept.
- Forget: the confirm names the tenant and what goes, Cancel is focused, Cancel returns focus to the menu item and Escape to Account; nothing deleted.
- The Plan reads "Next: 3.6 Create the Policies in Report-only →" and opens it.

**Fell short:** the Forget confirm's "Save a plan file first" link takes the header's plain text style, so it doesn't look like a link. It's on Needs attention as F-160b.

### The ten, as planned

| # | ID | Fix | Effort | Risk |
|---|---|---|---|---|---|
| 1 | OWN-ACCEPT | An accepted difference stops repeating itself | XS | medium |
| 2 | F-004, OWN-F1 | Connect's sample "9 weeks" matches the sample plan's finish | S | low |
| 3 | F-071 | MFA Readiness "Not counted" links list their accounts | S | low |
| 4 | OWN-R1 | A person about to lapse counts in Needs action | S | medium |
| 5 | OWN-B3, F-073 (part) | MFA Readiness never says "couldn't read" | S | low |
| 6 | F-061 | AI Info shows its tenant-data warning again | XS | medium |
| 7 | F-068 | The SharePoint question says what Yes does | XS | medium |
| 8 | F-070 | Recurring travel countries say they stay blocked | XS | medium |
| 9 | F-160 | Forget this tenant asks before deleting | S | low |
| 10 | OWN-W1 (F-094) | The Plan names the next step | S | low |

1. **OWN-ACCEPT: an accepted difference stops repeating itself** (owner's ask).
   - **Now:** a Completed step with an accepted difference (4.3 on the owner's
     tenant) shows the date, the reason, then "Covers 89 admin roles also
     included, the grant, persistent browser session and sign-in frequency."
     After Remove acceptance it shows "Reopens if a new gap appears or a setting
     here changes."
   - **Fix:** in the accepted state, drop the Covers line and the caption; keep
     the date, the reason and Remove acceptance. The caption stays on the form
     before acceptance, where it explains what accepting means.
   - **Where:** `src/ui/surfaces/ContentStep.tsx` (~1581–1590),
     `src/ui/surfaces/acceptPanel.ts` (`covers`), and the content key
     `…accept.covers`, removed if nothing else reads it.
   - **Acceptance:** a unit test shows the accepted panel draws no Covers line
     and no caption, while the form before acceptance still draws the caption.
   - Frozen.

2. **F-004 + OWN-F1: Connect's sample rollout length matches the sample plan.**
   - **Now (live):** signed-out Connect says "9 weeks"; the demo Plan says Est.
     Oct 29, 2026, about 4½ weeks out.
   - **Cause:** `src/ui/demoFacts.ts` runs the fixture from its fixed start date
     (2026-08-31). The demo Plan starts from today. The value is built at build
     time (`vite.config.ts` virtual:demo-facts).
   - **Fix:** compute with the start rule the demo Plan uses (`proposedStart`)
     against the shifted snapshot.
   - **Acceptance:** a test that `demoFacts().weeks` equals the demo Plan's
     `planWeeks`.
   - **Later:** the finish tip that credits a step dated Oct 5 is part two (M),
     queued separately.

3. **F-071: the "Not counted" links on MFA Readiness list their accounts.**
   - **Now (live):** `#/readiness/service`, `#/readiness/notActive` and
     `#/readiness/emergency` each show "No people match this view."
   - **Cause:** `MfaReadiness.tsx` groups only rows that have a readiness state.
     Explained people and the emergency, service and shared kinds have none,
     although the CSV includes them.
   - **Fix:** for those views, render one flat list of the matching rows, each
     with its reason.
   - **Acceptance:** a test that each Not counted view lists its named accounts
     (the demo's service view shows svc-mailer-1 and svc-mailer-2).

4. **OWN-R1: a person about to lapse counts in Needs action.**
   - **Now (live, owner's tenant):** "1 lapse in the next 7 days", then
     "Needs action · 0 / Nobody needs action: everyone counted is Ready."
   - **Fix:** needsAction includes the lapsing people, in
     `src/derive/mfaReadiness.ts` and `readinessCells.ts`. The empty text shows
     only when both are zero.
   - **Check first:** every reader of needsAction (the Plan's readiness counts)
     before changing it.
   - **Acceptance:** a test with one lapsing Ready person: Needs action is 1,
     and they are listed.

5. **OWN-B3 (+ part of F-073): MFA Readiness never says "couldn't read".**
   - **Now (live, demo):** "IAMAI couldn't read these people" (twice) and
     "IAMAI couldn't read the method list of 1 person." This breaks the standing
     rule: say what is known and the next step.
   - **Fix:**
     - Give the demo fixture's unread person a read method list, so the demo
       shows none.
     - Reword the keys (content.json ~1368, 1497, 1663, 1665) for real tenants,
       for example "The next scan reads {n} person's sign-in methods."
   - **Acceptance:** a test that no readiness content key contains "couldn't
     read", and that the demo has no unread row.

6. **F-061: AI Info shows its tenant-data warning again.**
   - **Now (live):** the AI Info copy carries object IDs and the tenant name,
     with no warning. `aiWarning` exists in content, but its Callout was removed
     in 8f440021. `exportGuard.ts` still justifies the unmasked copy by that
     warning.
   - **Fix:** restore `<Callout kind="warning">{W.aiWarning}</Callout>` above
     the AI Info preview and in the expanded view.
   - **Acceptance:** a test that the AI Info tab renders the warning.
   - Frozen.

7. **F-068: the SharePoint question says what Yes does.**
   - **Now (live, 2.1 Confirm What You Use):** "SharePoint and OneDrive from
     outside the office: Yes / No". Yes keeps a policy that blocks SharePoint
     outside the office, and only No has an effect line.
   - **Fix:** reword the label to the real choice, for example "Keep SharePoint
     and OneDrive to the office network", and give Yes its effect line. Saved
     answers keep their keys.
   - **Acceptance:** a test on the Direction step's words.
   - Frozen; the owner picks the wording.

8. **F-070: recurring travel countries say they stay blocked.**
   - **Now (live):** "Recurring travel countries — Record recurring destinations
     separately from normal work countries." Nothing says sign-ins from them
     stay blocked.
   - **Fix:** reword the text and effect so the consequence shows before any
     pick. For example: "Sign-ins from these countries stay blocked. Add a
     country to Work countries before someone travels there."
   - **Acceptance:** a content test.
   - Frozen; the owner picks the traveller guidance.

9. **F-160: Forget this tenant asks before deleting.**
   - **Now (code):** `AppShell.tsx` runs `forgetTenant()` on one click. It
     deletes every store for the tenant with no confirmation and no message
     afterwards.
   - **Fix:** an inline confirm in the account menu that names the tenant and
     what goes (scan, answers, deferrals, dates), with:
     - Save a plan file first
     - Cancel (focused)
     - Forget, danger-styled

     Afterwards, show "{tenant} forgotten on this browser" on Connect.
   - **Acceptance:** a test that Forget needs a second action.

10. **OWN-W1 (F-094): the Plan names the next step.**
    - **Now (live, demo):** the tiles count (Ready now 10, Needs your input 6…);
      nothing names the next step, and "How to use this plan" is collapsed.
    - **Fix:** one line under the tiles, "Next: {n.n} {title} →", linking to
      the first Ready row in All work order. It is hidden when nothing is Ready.
    - **Note:** on 2026-09-11 the owner removed a generated status sentence.
      This is a single link, not a status; owner's call.
    - **Acceptance:** a test on the demo (the line names the first Ready row).

## Round 2: done (live at 1265bb24, 2026-09-27)

**Commits:** 3016bda4 (F-160b), 3ae19c1a (F-184), ffaecaa6 (F-003, OWN-W3),
04fdd3a9 (F-057), 5575f0d8 (F-017, F-144), e21497dd (OWN-W2), 1be566bb (F-018),
7eca1078 (F-002), d5f5ac13 (F-013), 4091e340 (F-007), fa8aa8cf (F-016), and
1265bb24 (review fixes: seven confirmed findings, and two from the full run).

**Found while building, fixed with the round:**
- F-070's removal: the countries step kept Save Countries by rule (pickerRows.ts), since the countries it opens with are a suggestion.
- F-013: the rail keeps a date off its headline, so the deferral has its own rail field.
- The review: the F-007 question never named the group (1.1's vars never carry it); the typed deferral reason was bent by the count rules; the report-only tile missed policies past their week.
- F-002 side effect: on the demo, 4.4's card reads "Correct target resources"; adding Core - Exclusions is 1.2's edit now, and 4.4 no longer repeats it.

**The live audit (built-in browser on the demo, Claude in Chrome on the owner's tenant):** every fix landed as approved.
- The demo's Scan: the banner reads "Sample data · a follow-up scan weeks later, after the sample's own technician did some of the work", and the switch is a two-segment control.
- The legend has seven entries; the tile reads "In report-only"; rows read "Waiting on your answers in Confirm What You Use" and the like.
- Opened from Prepare Your Team: "Filtered to the 9 people Prepare Your Team for MFA names as not ready.", nine rows, Needs action · 9.
- 1.2: "Exclude Core - Exclusions from 5 policies.", five listed.
- Deferring with "Ring 1 users are not licensed yet; revisit Q1": the rail reads "Deferred Sep 27, 2026: Ring 1 users are not licensed yet; revisit Q1", the tile "2 / 37 · 1 deferred", the briefing's Set aside line the same reason; put back after.
- 1.1: × on Break-glass 2 asks "Take Break-glass 2 off your emergency access accounts? Configure Emergency Exclusions will then tell you to remove it from Core - Exclusions."; Keep returns focus to the chip's ×; nothing changed.
- 1.1's Troubleshooting opens on Temporary Access Pass; the × reads Close.
- A real sign-in started, then returned cancelled: "sign-in was cancelled" with the consent paragraph, the button ready, and one click went back to Microsoft.
- The briefing's cover: "… · Scanned Sep 27, 2026 · …".
- The owner's Forget confirm: "Save a plan file first" is a link (brand colour, underlined); Cancel, nothing deleted.

**Worth a look, not broken:** the legend's new label "Create, Correct, Turn on, Decision, Review" wraps to four lines in its column (F-003b); the scoped Readiness headline reads "0 of 9 people are ready for phishing-resistant sign-in", true but blunt.

### The ten, as approved (2026-09-27)

Picked by the rubric: the eight reward-4 items, then the two lowest-scored
surfaces (the briefing, the demo). F-144 folds into F-017, so the Plan legend
takes the tenth place. Each was re-verified live or in code on 2026-09-27, and
the owner approved each method.

| # | ID | Fix | Effort | Risk | Frozen |
|---|---|---|---|---|---|
| 1 | F-017, F-144 | The demo's scan switch says what it is | XS | low | |
| 2 | F-057 | A cancelled or failed sign-in never leaves Sign in stuck | S | low | |
| 3 | F-018 | "Open MFA Readiness" shows the people the step named | S | medium | |
| 4 | OWN-W2 | Rows say where the answers are | S | medium | |
| 5 | F-002 | Configure Emergency Exclusions lists and counts the same five policies | S | medium | yes (demo data) |
| 6 | F-013 | A deferral says why, wherever it's seen | S | medium | yes |
| 7 | F-007 | Taking an emergency account off asks first | S | medium | yes |
| 8 | F-016 | Troubleshooting on 1.1 opens on what the step sends you there for | S | medium | yes |
| 9 | F-184 | The printed briefing says how old its scan is | XS | low | yes (briefing) |
| 10 | F-003, OWN-W3 | The legend explains every word on the board | XS | low | |

1. **F-017 + F-144.** The banner's two snapshots become a bordered two-segment control, the selected one filled like the Plan's tabs. On the follow-up scan the banner's announced sentence reads "Sample data · a follow-up scan weeks later, after the sample's own technician did some of the work" (new `pages.app.shell.demoBannerFollowUp`). The demo's Scan buttons keep their words (owner's pick).
2. **F-057.** `authReady` treats a failed redirect as ready (App.tsx still reports the error); the cancelled and failed states keep `account.note`, the Global Administrator consent paragraph. Live check: start a sign-in, then return with its real `state` and `#error=access_denied&error_subcode=cancel`.
3. **F-018.** Opened from Prepare Your Team for MFA while it still names people not ready, MFA Readiness scopes to them: "Filtered to the {cohort} {step} names as not ready." (new `pages.readiness.planContext.notReady`). Everyone it covers once nobody is left (owner's pick).
4. **OWN-W2.** A row held on a decision step reads "Waiting on your answers in {step}" (new `…direction.waitingIn`; owner's pick over "After {step}"). Only the board row: the opened step's Readiness tile already names the decision step.
5. **F-002.** The demo's day-one MFA row gets `excludeGroups: []` (real Graph always returns it), so 1.2 lists and counts five. Remove Emergency Accounts Excluded by Name drops "as well as through the exclusions group", false on day one. `[snapshots]`.
6. **F-013.** A deferred step's Next milestone reads "Deferred {date}: {reason}" (new `app.plan.deferredWhy`); the Completed tile adds "{n} deferred" (new `pages.plan.summary.deferred`; owner's pick over changing the count); the briefing's Set aside list reads "{title}: {reason}" (new `print.brief.asideWhy`).
7. **F-007.** On the emergency accounts picker only, × asks first: "Take {name} off your emergency access accounts? Configure Emergency Exclusions will then tell you to remove it from {group}." Keep (focused) and Take it off (owner's pick over Done or Undo).
8. **F-016.** Temporary Access Pass first; the two entries about IAMAI's own internals (candidate-treated-as-decision, report-only-confusion) removed; the drill entry rewritten: symptom "Every check passes, but an emergency account can't sign in.", check "Try the account's own credential in a clean browser, and look for an enforced policy that still reaches it.", fix "Don't turn on any more policies until it signs in; fix what stopped it.", then "Run the emergency access check again before turning anything on." All three dialog close labels read "Close" (owner's pick).
9. **F-184.** The briefing's cover reads "Prepared {date} by {by} · Scanned {scanned} · Measured against {baseline}", and prints the screen's "This scan is more than a week old. Scan again before acting on its findings." when it is.
10. **F-003 + OWN-W3.** Two legend entries: "Create, Correct, Turn on, Decision, Review": "The kind of action a Ready step asks for: create a policy, correct one, turn it on, answer a question, or review what the scan found."; "Report-only, Enforced": "What the policy is set to in your tenant today. On Hold beside Enforced means the policy is on, but the step still has work." The tile "Observing" becomes "In report-only"; the "Legend" heading moves into content.

## Round 3: done (live at cac1a3e, 2026-09-27; F-177 at caa86c7a)

Picked for felt value (owner, 2026-09-27): changes a user notices on the daily path, the
safety floor, and the surfaces below 85. Every pick was re-checked live and in code first.
The owner confirmed the four refinements to the 90% definition (safety floor, a value
moment per reader, a blocked tenant served only when told why and what next, persona
walks until real users exist).

**What the owner changed while approving:**
- The scroll box around a step's instructions stays (owner: it keeps long tasks from
  making pages endless). Measured on the demo at 1280px: 24 of 33 boxes fit, three are cut
  by one line (11–18px) and six scroll further, mostly role lists. Only the limit rises,
  so the one-line clips and the admins step fit.
- The prompt pack is for the implementer (owner): the business-owner prompt goes, since
  the briefing serves that reader, and the implementer's whole-plan prompt stops cutting
  steps mid-instruction.
- F-056 joins as a safety-floor item.

**Narrowed on a second look (the owner asked for one):**
- F-051's demo half (the Follow-up scan surviving a reload) is dropped: evaluators rarely
  reload, and it needs demo-state plumbing.
- F-023 asks first only when this browser already holds recorded work; a fresh browser
  loads straight away. Both end with the loaded file's date.

| # | ID | Fix | Surface | Effort | Risk | Frozen |
|---|---|---|---|---|---|---|
| 1 | F-051, F-147 | Back closes the step it opened; a new page opens at its top | Plan + steps, shell | S | medium | |
| 2 | F-100 (tweak) | The instructions box's limit rises so one-line clips fit | Plan + steps | XS | medium | yes (look only) |
| 3 | F-161 | A tab another tab has saved over stops saving and says Reload | Shell | M | high | |
| 4 | F-023 | Loading a plan file says what it replaces, and asks when something would be | Export | S | medium | |
| 5 | F-177 | The account that ran the scan is never dormant | Plan + steps | S | high | yes (3.1, only when it fires) |
| 6 | F-077, F-129 | The prompt pack is the implementer's: no business-owner prompt, no step cut mid-instruction | Export | S | low | |
| 7 | F-195, OWN-X1 | "Masked" masks guest addresses; the JSON/PowerShell note is true | Export | XS | medium | |
| 8 | F-049, F-138, F-137 | Inventory lists the plan's groups, its tip is true, its MFA words are defined | Inventory | S | low | |
| 9 | OWN-P1 | The briefing's decisions name the questions they ask | Briefing | S | low | yes |
| 10 | F-078 | Connect and How say how to delete what the browser keeps | Connect, How | XS | low | |
| 11 | F-056 | Pickers mark administrators and your own account, and Approve says so | Decision | S | medium | yes |

OWN-P1 is new (found in this round's walk): the briefing's "What we need from you" read
"2.1 Confirm What You Use: A decision is needed." three times, which a manager cannot act on.

**Commits:** 38325f87 (F-051), b1b778dd (F-147), 54ebb03b (F-100), 4e98ec94 (F-161),
e4a721de (F-023), aad7381f (F-077, F-129), 8007ed36 (F-195), f8fe06de (OWN-X1),
181ade31 (F-049), 017cb15a (F-138), 9aa5f590 (F-137), 5e6da8f6 (OWN-P1), 98e39a47 (F-078),
f890c05c (F-056), e40f3bd8 (full-suite fixes), 6585de5e (review fixes: an adversarial review
confirmed 20 findings, nine defects, all fixed), cac1a3e6 (smoke), caa86c7a (F-177, after the
owner's choice).

**What the owner chose while building:**
- F-177: the scan counts as a sign-in for the account that ran it, everywhere activity is read
  (the dormant list, MFA Readiness, the population). It changes the documented rule that the
  population never depends on who ran the scan, by the one sign-in that really happened, and
  also settles F-178 (the admin vanishing from Readiness).
- Wording made true where the approved sentence was false: F-138's tip says Readiness can count
  "lower or higher"; F-056's line under "Everyone works remotely" drops the MFA clause; the
  oldest plan files, which carry no saved day, load with "This plan file holds …" and "Loaded
  the plan file."

**Found while building, fixed with the round:**
- The first two-tab design warned on opening a second sample tab: the sample re-dates itself on
  every load. Every save is now announced and compared with the receiver's own last save, a tab
  that has loaded and not yet saved is behind any save announced meanwhile, and the sample
  tenant is left out of the guard.
- The review: the load confirm counted the scan's own recovery records as Cleanup items marked
  done; a question a scan reopened was left out of the briefing's list; Back cleared a tile
  filter; a pending file survived a second choice; a bad saved day could fail after the write.
- Two guards from earlier work: the pickers' rows never read who is signed in, so the admin
  marks live in accountMarks.ts; the design lint allows the Replace button's danger colour for
  the reason it allows Forget's.

**The live audit (built-in browser on the demo, Claude in Chrome on the owner's tenant):** every
fix landed as approved.
- Opening 1.1 then Back: #/plan with the step closed; Forward reopens it. From a Plan scrolled
  2,500px, MFA Readiness opens at its top (heading at 171px).
- The boxes at 1280px: Configure Passkey Authentication 466/466, 4.3 506/506, Token Protection
  458/458, Alert on Emergency Account Sign-ins 459/459; 3.4 still scrolls (516/625).
- Two tabs on the owner's tenant: opening the second marked neither; loading the tenant's own
  plan file in the second showed "This plan file was saved Sep 27, 2026. It holds 6 answered
  decisions and 1 Cleanup item marked done. …", and the first then read "This plan changed in
  another tab. Reload before changing anything here." Reload cleared it; Completed stayed 18 / 36.
- The demo's load: the confirm with Cancel focused, then the Plan's "Loaded the plan file saved
  Sep 27, 2026."
- The pack lists Explain this plan, the announcement rewrite and the translation; no
  business-owner prompt. The copied Explain prompt has three cuts, each after a whole instruction.
- Export's note: "Where a policy step offers JSON or PowerShell, they're in its tabs in the Plan."
- The demo's Inventory: Groups 2, Core - Exclusions "The plan's exclusions group"; the Distinct
  users tip and "What each MFA state means" read as approved.
- The demo's briefing: 2.1, 2.2 and 2.3 each read "Answers needed on:" over their questions.
- Connect and How: "What it keeps here stays after Sign out; Account → Forget this tenant deletes it."
- 2.1's email-device picker: "Casey Kim · Administrator · Your account · user0@…", the chip
  "Administrator · Your account", and the Approve line; it goes when the account is taken off.

**Not verified live:** F-195 (masked guest addresses): neither the owner's tenant (no guests) nor
the demo (its guest has no #EXT#) holds a guest sign-in name; the unit test is the acceptance.
The owner's copied prompts carry no raw address (9 masked). F-177 changes nothing on the owner's
tenant or the demo, where the signed-in account is active anyway; its unit tests are the acceptance.

### Backlog scrub (owner, 2026-09-27)

The owner asked that every remaining item pass one test: does a real user hit it on a path
they take, and is fixing it worth the time? Approved as proposed:
- Removed 13 (now in the Drop list below): F-003b, F-034, F-086, F-088, F-089, F-095, F-108,
  F-117, F-120, F-123, F-128, F-135, F-152.
- Moved to Review later (only in data states no real tenant has shown): OWN-B4, F-073, F-058, F-005.
- Put aside as decisions, in "Not low-hanging": F-006 (make the change freeze work, or take the
  setting out) and F-183 (the plan re-dates weeks later).

## Round 4: approved (2026-09-27), building

Branch `fix/low-hanging-4`, cut from main at 82274f1 (Round 3 and F-177 are on main).
Picked with the owner's lens (who hits it on a path they take, and is the fix the quality one),
for the three things the scores say hold the tool back: the experience layer (78), the safety
floor, and the two surfaces under 85 (Home + demo 82, Inventory 83). Every pick was re-checked
at HEAD and live: the demo in the built-in browser at 1280px, the owner's tenant in Claude in
Chrome (read only: no scan, no save).

**The owner approved all ten as recommended (2026-09-27):** item 1 puts the line at the top of the step the page moved to; item 3 shows the after lines only; item 5 states the partner No fact only; item 6 keeps a changed answer until it is approved; item 8 fixes the sample only; item 10 drafts one Plan image for the owner to approve before it ships. On policy matching the owner chose **B, build new and retire old**; the pilot on 4.3 is Round 5.

**Changed from the Round 4 candidates:**
- F-028 and F-040 are one fix: both move the page to a step and leave the line saying what
  changed out of sight.
- F-012 joins (Major in the external audit, safety floor): the card at turn-on says "Report-only
  blocked no one." with no numbers. The owner's tenant reaches it Sep 28 and Oct 2.
- F-064 joins F-140 (Major; the demo names two legacy-auth accounts in Inventory, one on the
  step). On a real tenant the two readings fold the same sign-in rows with near-identical client
  lists, so they agree; the sample's hand-written list is what disagrees.
- F-168 and F-186 join (the returning and daily path).
- F-066 leaves: an emergency account picked as a service account still sits in the exclusions
  group every policy excludes, so nothing locks it out. Nobody is harmed on a path they take.
- F-180 waits: the scan reads per-user MFA, so "nobody is asked for MFA today" needs that
  reading beside it before it can be true. Next round.
- OWN-B1 moves from Review later to Needs attention: Home + demo is the lowest surface, and the
  evaluator's first ten seconds show no product. It comes as a design with options.
- The policy-matching question comes as a design with options (below), not a fix: it is the
  biggest lever on an expert's trust and the owner's decision.

### The ten, as planned

| # | ID | Fix | Reader, moment | Surface (score) | Effort | Risk | Frozen |
|---|---|---|---|---|---|---|---|
| 1 | F-028, F-040 | After Scan or Approve you stay with the step, and what changed is at its top, whole | Admin: every scan from a step; the three decisions in the first hour | Plan + steps (90) | M | medium | yes (Plan board; top of a step) |
| 2 | F-091 | The (i) opens on a click and stays open | Everyone who clicks an (i) | Shared: Plan, steps, Inventory | S | medium | yes (behaviour only) |
| 3 | F-001 | Removing an old exclusion waits for the exclusions group, and says so | Admin on a half-built tenant, opening 4.x early | Plan + steps; safety floor | S | medium | yes (4.1 to 4.3, only while 1.2 is open) |
| 4 | F-012 | At turn-on, the card says what report-only saw | Admin at the riskiest click | Plan + steps; safety floor | XS | medium | yes (every policy step's turn-on card) |
| 5 | F-041, F-067, F-069 | The decisions say what each answer does, beside the baseline's version | Admin in 2.1 to 2.3; every MSP-managed tenant | Plan + steps; safety floor | S | medium | yes (2.1, 2.2, 2.3) |
| 6 | F-042, F-104 | Nothing you change in a decision is lost | Admin revisiting 2.x; adding a key model in 1.3 | Plan + steps; safety floor | S | medium | yes (2.x behaviour; 1.3 one button fewer) |
| 7 | F-044, F-116 | MFA Readiness's headline reads right, and search finds people | Help desk and admin | MFA Readiness (91) | S | low | |
| 8 | F-140, F-064 | The sample tenant holds up to an expert | Evaluator who looks closely | Home + demo (82), Inventory (83) | M | medium | demo only |
| 9 | F-168, F-186 | The header works during a scan; Connect says when a scan is old | Admin rescanning; admin back after a week | Shell, Connect (90) | S | low | |
| 10 | OWN-B1 | Home shows the product | Evaluator, first ten seconds | Home + demo (82) | M | low | Home pack revision |

#### 1. F-028, F-040: after Scan or Approve, you stay with the step

- **Before.** Scan in 4.2 (demo): the page lands at the top and 4.2 sits 1,800px below. The line
  reads "Updated: Confirm What You Use, Identify Service and Shared Accounts, Prepare Emergency
  Access Accounts and 5 more completed · 8 steps removed: … and 5 more." with no way to see the
  rest. Approve 2.1: 2.2 opens, keyboard focus drops to the page, and "3 steps removed: …" sits
  590px above the view. The cause: a new snapshot redraws the Plan from Loading, and nothing
  moves back to the open step.
- **After.** The page returns to the step you scanned from, or to the decision Approve opened,
  with its row at the top of the view. The change line sits at the top of that step (one line,
  in one place at a time: above the board when nothing moved the page). A cut list ends with
  "Show all", which lists every title. Keyboard focus lands on the step's title.
- **Words.** New `pages.plan.changes.showAll`: "Show all". The line's own keys are unchanged.
- **Options.** (a) The line at the top of the step the page moved to (recommended). (b) The page
  and focus move, and the line stays above the board, out of sight.
- **Acceptance.** Unit: `planChanges.test.ts` keeps every title behind a cut list; a pure
  helper says which step to move to after a new snapshot and after Approve. Live (demo): open
  4.2, Scan: 4.2's row within 150px of the top, the line at its top, Show all lists all 8
  removed steps. Initial scan, Approve 2.1: 2.2 open, its top reads "Updated: Confirm What You
  Use completed · 3 steps removed: …", focus on 2.2's title.

#### 2. F-091: the (i) opens on a click and stays open

- **Before.** Hover opens it, so the click that follows closes it (confirmed live on the
  Estimated finish (i)); Enter on a focused (i) closes it too.
- **After.** Hover and focus show it; a click, Enter or Space keeps it open until a second
  click, Esc or a click elsewhere. Moving the mouse off no longer closes a clicked one.
- **Words.** None.
- **Acceptance.** Unit: the open/pinned state as a pure reducer, each event. Live (demo): hover
  then click the Estimated finish (i), move away: still open; click again: closed.

#### 3. F-001: removing an old exclusion waits for the exclusions group

- **Before.** Demo 4.1, 4.2, 4.3 (Up Next): the card reads "Correct users: Under Users → Exclude,
  remove the group Core - Break glass." above "Configure Emergency Exclusions · Prerequisite · To
  do". The Correct task and the PowerShell script remove it with nothing about order. Done
  first, it takes the emergency accounts' exclusion off an enforced policy before the new group
  is on it. (The engine already holds the step on 1.2; only the words are missing.)
- **After.** Under the correction, the card reads "After Configure Emergency Exclusions adds Core
  - Exclusions to it." The Correct task starts "Do this after Configure Emergency Exclusions adds
  Core - Exclusions to this policy.", and the PowerShell script's first comment says the same.
  Only where a correction removes an exclusion from a policy 1.2 still has to edit, and only
  until 1.2 is done. The owner's tenant: no change (1.2 is done).
- **Words.** New `shared.procedure.card.afterExclusions`: "After {step} adds {group} to it." and
  `shared.procedure.afterExclusions`: "Do this after {step} adds {group} to this policy."
- **Options.** (a) The lines (recommended). (b) Also withhold PowerShell and JSON until 1.2 is
  done, as 7.4 withholds them while its create is held.
- **Acceptance.** Unit: on the demo's Initial scan, 4.2's card, Correct task and script carry the
  lines; with the exclusions group already on the policy, none does. Live: demo 4.2's card, its
  Entra task and its PowerShell tab.

#### 4. F-012: at turn-on, the card says what report-only saw

- **Before.** "Report-only blocked no one." and nothing else (demo Follow-up, Token Protection).
  It reads the same whether thirty people were seen or none.
- **After.** "Report-only blocked no one: 0 failing or interrupted, 29 of 29 active people seen in
  8 days." The numbers are the two gates the engine already requires before it calls a policy
  ready (derive/readyWhen.ts), in the words the row's reason line already uses.
- **Words.** New `shared.procedure.card.blockedNoOneBasis`: "Report-only blocked no one: {basis}."
  filled with the existing `shared.engine.tracking.evidenceToday`. `blockedNoOne` stays for a
  reading with no numbers.
- **Acceptance.** Unit: a ready-to-enforce step's card carries "active people seen in". Live: demo
  Follow-up, Require Token Protection on Windows.

#### 5. F-041, F-067, F-069: each answer says what it does, beside the baseline's version

- **Before.** 2.1 suggests Yes for partner and MSP technicians and says only "Keeps partner and
  MSP technicians out of Require MFA for Guests and Block Sign-ins From Countries Not Allowed."
  The baseline includes them (its B2B-Guest policy lists service provider users), and the card
  never says so, against the rule that the baseline's version shows beside the person's choice.
  No, and the mail devices' None, say nothing. "Everyone works remotely" (2.3) takes the
  service-accounts group out of every exclusion, so picked service accounts get MFA like anyone,
  and neither card says it (only the shared-device card says "counts as people").
- **After (words).**
  - Partner, Yes: the existing line, then `shared.deviation.line` with new
    `…questions.partner.baseline`: "… · your choice; the baseline's version: they sign in with MFA
    like any guest, and only from your countries".
  - Partner, No: new `…questions.partner.chosenNo`: "Partner and MSP technicians sign in with MFA
    like any guest, and only from your countries, as the baseline asks."
  - Mail devices, None, where senders were seen: new `…questions.mailDevices.chosenNone`: "Once
    Block Legacy Authentication is on, these accounts can't send mail the old way."
  - Service accounts, picked, with everyone remote: new `…questions.serviceAccounts.joinsRemote`:
    "Counts these accounts as people: everyone works remotely, so there is no office network to
    keep them to, and they get MFA like anyone." The shared-device line takes the same ending
    (edit `…questions.sharedDevices.joinsRemote`).
  - Everyone works remotely, with accounts picked in 2.2: new
    `…questions.officeNetwork.chosenRemoteAccounts`: the existing remote line, then "Your service
    and shared-device accounts then count as people and get MFA like anyone."
- **Option.** Partner No where partners signed in this month: (a) the fact only (recommended);
  (b) add "{n} partner or MSP accounts signed in this month: check each can meet both before
  these policies turn on." (an instruction, so the owner's call).
- **Acceptance.** Unit (`directionStep.test.ts`): each line under its answer. Live (demo): 2.1's
  partner card under Yes and No; 2.2 after 2.3 says everyone works remotely.

#### 6. F-042, F-104: nothing you change in a decision is lost

- **Before.** Change an approved answer (demo 2.1, Azure Virtual Desktop to Yes): the card reads
  "Not approved yet". Open another step and come back: the change is gone and the card reads
  Approved, with nothing said. In 1.3, "Add to List" changes only the screen; the model is lost
  unless "Save Additional Authenticators" is pressed.
- **After.** A changed answer stays on its card, Not approved yet, until you approve it or change
  it back, across closing the step and moving between pages (a reload starts again). In 1.3,
  Add and Remove save at once, and the Save button goes.
- **Words.** 1.3's five hard-coded labels move into content.json unchanged; "Save Additional
  Authenticators" is removed.
- **Options (F-042).** (a) Keep the change until approved (recommended: the approval stays the
  gate the owner designed). (b) On an approved decision, a change saves at once. (c) Ask before
  leaving a step with an unapproved change.
- **Acceptance.** Unit: the draft survives the card unmounting; Add calls the save with the new
  list. Live (demo): the 2.1 change survives opening 2.2 and coming back; a model added in 1.3
  survives closing and reopening the step.

#### 7. F-044, F-116: MFA Readiness reads right and finds people

- **Before.** "4 of 30 are ready for phishing-resistant sign-in: 29 people and 1 guest." reads as
  if the 29 and the guest are the ready ones. Search opens no group and no sub-group, so a
  person in a closed group, or past a group's first rows, stays hidden; with a view that hides
  every match, it says "No people match this view." and stops.
- **After.** "4 of 30 (29 people and 1 guest) are ready for phishing-resistant sign-in." While
  searching, every group and sub-group with a match opens and shows every match; where the view
  hides them all, the empty line has a "Search everyone" button.
- **Words.** Edit `pages.readiness.summaryWithGuests`: "{ready} of {total} ({cohort}) are ready
  for phishing-resistant sign-in." New `pages.readiness.searchEveryone`: "Search everyone".
- **Acceptance.** Unit: the headline; a search's groups open with every match. Live (demo): the
  headline; a name from the closed Ready group shows when typed.

#### 8. F-140, F-064: the sample tenant holds up to an expert

- **Before (demo).** iOS phones "Hybrid joined" and "Entra joined"; the printer account "MFP
  Reception" owns an Entra-joined Windows PC; Inventory's legacy list names svc-mailer-1 and
  svc-mailer-2 while 2.1 and 4.1 name only svc-mailer-1; the client-app breakdown shows no
  legacy client; SharePoint has 408 sign-ins against 272 in total; Quinn Taylor's drawer reads
  "the one seen Sep 18 is no longer registered" beside "None registered yet."
- **After.** iOS devices registered, not joined; the printer owns no PC; one legacy-auth list
  everywhere (Inventory, 2.1, 2.2, 4.1), and legacy clients in the breakdown; app counts within
  the total; "None registered now." where a method was removed.
- **Words.** New `pages.readiness.panel.noneNow`: "None registered now."
- **Options.** (a) The sample only (recommended). (b) Also make the code keep one legacy list
  (every reader through `legacySignInIds`), deleting the second classifier: engine work, for a
  disagreement no real tenant shows.
- **Risk.** The fixture feeds about 150 test files and pinned counts: the full suite runs after it.
- **Acceptance.** Unit: an agreement test on the demo (the legacy lists match; no iOS device
  joined; app counts within the total). Live (demo): Inventory's Devices, Apps and Sign-in
  countries; 4.1's card.

#### 9. F-168, F-186: the header works during a scan; Connect says when a scan is old

- **Before.** During every rescan, Plan, MFA Readiness and Export in the header stop working,
  though the last plan is on screen. A scan 40 days old reads "Ready to plan" on Connect while
  the other pages say to scan again.
- **After.** The three stay live during a rescan. From 7 days, Connect's strip and scan tile read
  the header's own sentence: "This scan is more than a week old. Scan again before acting on its
  findings."
- **Words.** None new (reuses `pages.app.shell.staleEvidence`).
- **Acceptance.** Unit: the tabs are on while a rescan runs over a plan; Connect's tile carries
  the sentence at 8 days and not at 6. Live: none today (the owner's scan is a day old and the
  demo re-dates itself); F-168 can be seen on the owner's next scan, with the owner's OK.

#### 10. OWN-B1: Home shows the product

- **Before.** Home is words only; an evaluator sees nothing of the plan before clicking.
- **After.** One image of the sample tenant's Plan (the tiles, the Next line, section 1) under
  the hero's buttons, in the page's theme, with a caption, linking to the demo. It is captured
  from the demo by a script, so it never shows a real tenant.
- **Words.** New `pages.home.shotCaption`: "The plan IAMAI writes for the sample tenant."
- **Options.** (a) One Plan image under the hero (recommended). (b) Three smaller images (the
  Plan, a step, MFA Readiness) beside Check, Understand and Prepare. (c) Words only: name the
  outputs in the hero.
- **Needs.** A Home pack revision (`home-v3.html`) the owner approves before it is built, then
  the manifest hash, build-home and home.test.
- **Acceptance.** Unit: `home.test.ts` finds the figure and its caption; the anatomy test reads
  the new pack. Live: getiamai.com at 1280 in both themes.

### The decision: how steps meet the policies a tenant already has

Not a fix: a design for the owner (see "Owner question" under Not low-hanging for the full
case). Two scenarios:

- **A fresh tenant** (security defaults on, no policies). Every policy step creates the
  baseline's policy in report-only under its own name. No option changes anything.
- **The sample tenant** (five policies it wrote, four On). Today: 4.1 and 4.2 edit enforced
  policies (remove Core - Break glass), 4.4 edits an enforced policy (exclude Intune
  Enrollment), 4.3 asks to weaken a stricter admin grant or accept it (OWN-W4), Require MFA for
  Guests edits another. Each edit of an On policy applies at the next sign-in, with no
  report-only week.

**Options.**
- **A. As today:** correct the tenant's policy in place, with the safety lines (item 3).
- **B. Build new, retire old (recommended, as in the Owner question):** exact controls under any
  name stay Completed; the plan's own policy (its IAMAI tag or the baseline's name) is corrected
  as now; any other policy is left alone, the step creates the baseline's beside it in
  report-only and lists the old one ("also covers these people today"), and Cleanup retires it
  after the new one is On (turn off, then delete, or keep with a reason; a stricter one can
  stay). Configure Emergency Exclusions still adds the exclusions group to every policy.
- **C. By state:** as B for a tenant policy that is On; a tenant policy that is Off or
  report-only is corrected in place, since editing it affects nobody.

**Costs of B.** A report-only week even where an old policy enforces most of it; more policies
for a while (the sample: five to ten); an L change across every policy step, their frozen
screens, tracking and Cleanup; it reverses the 2026-09-25 narrow rule ("another step's job") and,
for policies the plan did not write, the 2026-09-26 "every difference corrected or accepted".
A patch of the broad rule from 2026-09-25 exists as a starting point.

**Owner decision (2026-09-27): B.** Pilot on 4.3 (the admin policy) in Round 5, then 4.1, 4.2 and
4.4, then every policy step.


## Not low-hanging: decisions or larger work

### Owner question: how should steps meet the policies a tenant already has?

**Today.** A step looks for a tenant policy that does its job, by what the
policy does, not its name:
- Exact controls: Completed. The name may differ, and 8.2 renames it.
- Close but different: "Correct the policy" or "Accept difference".
- Nothing: "Create the policy in Report-only" under the baseline name.

**What goes wrong.** About ten findings come from editing policies the plan did
not create: F-001, F-002 (part), F-008, F-009, F-014, F-035, F-062, F-192,
OWN-W4 and OWN-W9. It is also the riskiest action the tool asks for. Editing an
enforced policy takes effect at once, with no report-only week.

**Recommendation: build new, retire old.**
- Exact controls, any name: Completed (unchanged). This avoids pointless
  duplicates. Matching by name alone would miss these and duplicate them.
- The plan's own policy (its IAMAI tag or the exact baseline name): compare
  and correct, as now.
- Anything else: create the baseline's policy, new, in report-only. Never edit
  the tenant's other policies inside a step. The step lists them ("also covers
  these people today"). They are handled once, in Cleanup's consolidation row,
  after the new policy is on: turn off, then delete, or keep with a reason.

**Why it is safe.** Conditional Access applies every matching policy and
requires all their grants, so running old and new side by side cannot weaken
anything. A stricter existing policy keeps protecting until someone retires
it, and OWN-W4 ("weaken your stricter admin policy") disappears.

**Costs.**
- A report-only week even where an old policy already does most of the job.
- More policies in the tenant for a while.
- An L-sized change across every policy step (frozen screens).
- It revisits the 2026-09-25 choice of the narrow "another step's job" rule
  over "never edit any tenant policy".

**Why it grew this way.** The owner's tenant is the rare one already half-way
through the baseline. Typical tenants have nothing, Security Defaults, a few
Microsoft-template policies or Microsoft-managed ones, and would mostly take
the create path.

**Next.** A one-page design with two scenarios (a fresh tenant; a tenant with
three template policies) for the owner's approval. Then a pilot on 4.3, then
every policy step.

**Decided (owner, 2026-09-27): B, build new and retire old.** The design with its two
scenarios is under Round 4. The pilot on 4.3 is Round 5's felt item.

### Other larger items

- **OWN-B1:** a product image on Home (an approved-pack revision, M).
- **OWN-D4:** stagger turn-ons by weekly capacity (L, engine).
- **F-009:** one plan-wide list of deviations from the baseline (L).
- **F-192:** a bulk path at scale (L).
- **F-024:** baselines-as-code export (L).
- **F-025:** a multi-tenant path (XL).
- **F-004, part two:** the finish tip names the step that actually finishes
  last (M).
- **F-006:** a saved change freeze has no visible effect on the rows, the finish, the
  briefing or the calendar: make it work (L) or take the setting out (owner, 2026-09-27).
- **F-183:** weeks later the plan re-dates every unfinished step to today with nothing
  reading overdue (L, the engine).

## Needs attention (39)

Everything here is worth fixing: a real user is misled, put at risk, blocked or
meaningfully slowed on a path they actually take. Each round picks its ten from
this list only. Sorted by reward, then effort. The fix sketch and files for each
item are in the -backlog.json.

| ID | Round | Status | Effort | Risk | Reward | Frozen | Surface | Finding |
|---|---|---|---|---|---|---|---|---|
| F-035 |  | partly | XS | medium | 3 | yes | Step | Completion criteria and the AI briefing contain contradictions and stray text: 'except Core - Exclusions and Break-glass 1', 'for guests except Core - Exclusions and guests', and a stray 'strong:' line |
| F-041 |  | present | XS | medium | 3 | yes | Decision | Exempting partner and MSP technicians is suggested 'Yes', and the baseline's version is not shown at the decision |
| F-044 |  | present | XS | low | 3 |  | Readiness | The MFA Readiness headline reads as if 29 people and a guest are ready |
| F-062 |  | present | XS | medium | 3 | yes | Step | 'Require Phishing-Resistant MFA for Admins' says 'change the Directory roles selection as listed below. Select (45)', and the list leaves out Global Administrator |
| F-063 |  | present | XS | medium | 3 | yes | Step | 'Set up Windows Hello for Business' rows have no how-to in the Plan step they link to |
| F-092 |  | present | XS | high | 3 | yes | Plan | A 'Ready' step is dated a month out and sits at the very bottom of the plan |
| F-168 |  | present | XS | low | 3 |  | Shell (mock) | Plan, MFA Readiness and Export in the header stop working before the first scan and during every rescan, look the same as live links, and say 'after the first scan' even when a plan exists |
| F-001 |  | partly | S | medium | 3 | yes | Step | 'Up Next' steps give go-live and exclusion-removal instructions, plus a script that writes to the tenant, and never say 'not yet' |
| F-010 |  | present | S | medium | 3 | yes | Step | The AI Info brief for 'Configure Emergency Exclusions' says no exclusions group exists, while the same card shows the group as selected and verified |
| F-012 |  | partly | S | medium | 3 | yes | Step | Report-only evidence is one unquantified sentence, so 'nothing was evaluated' reads the same as 'safe to enforce' |
| F-036 |  | present | S | high | 3 | yes | Step | 'Configure Passkey Authentication' names one account as affected and a different account as the one that would be locked out |
| F-037 |  | present | S | medium | 3 | yes | Step | The Email tab's single Copy button copies the staff, admin and follow-up emails as one blob, signed 'IT', in a code-style monospace box |
| F-040 |  | present | S | medium | 3 |  | Decision | Approving a decision jumps to the next one while the 'steps removed' note sits off-screen, focus is lost, and a removed review step is never listed |
| F-064 |  | partly | S | medium | 3 | yes | Step | Inventory shows two accounts using legacy authentication; the Block Legacy Authentication step names only one |
| F-067 |  | present | S | medium | 3 | yes | Decision | Confirm What You Use explains only one direction of each choice, so the other answer's effect is invisible, including an MSP lockout risk (Round 1 gave every service card its Yes line; the partner and mail-sending cards still explain one direction) |
| F-072 |  | partly | S | medium | 3 | yes | Readiness | The same person is given different next steps on MFA Readiness, Prepare Your Team for MFA and Require MFA to Register a Device |
| F-075 |  | present | S | low | 3 |  | Readiness | Jamie Brown's row says to use a passkey that the drawer says will stop working |
| F-116 |  | present | S | low | 3 |  | Readiness | Search leaves matches hidden in collapsed groups and gives a dead-end empty state |
| F-180 |  | partly | S | low | 3 |  | Plan (mock) | A tenant with no policies and security defaults off is never told nobody is asked for MFA today, and the print counts an empty exclusions step as 'in place' |
| F-186 |  | present | S | medium | 3 |  | Connect | Connect says 'Ready to plan' for a 40-day-old scan while every other page says to scan again, and the warning is a small grey line that never escalates |
| OWN-W5 |  | present | S | medium | 3 |  | Step | 5.9 Reset Passwords for Medium-Risk Users has no path forward |
| F-066 |  | present | XS | medium | 2 | yes | Decision | Emergency access accounts can be picked as service or shared-device accounts, and the card that offers them says they are already out |
| F-069 |  | partly | XS | medium | 2 | yes | Decision | 'Everyone works remotely' silently undoes the service-accounts decision: service accounts and the Teams Room fall under MFA for Everyone |
| F-079 |  | present | XS | low | 2 | yes | Shell | Keyboard focus is invisible on every filled primary button in the light theme |
| F-104 |  | present | XS | medium | 2 | yes | Step | A key model added to the list is silently lost unless a second Save is pressed |
| F-107 |  | partly | XS | medium | 2 | yes | Step | Prepare Your Team says the registration campaign is already on, then tells you to turn it on |
| F-111 |  | partly | XS | medium | 2 | yes | Step | The admin MFA step has no Readiness hand-off, and its Readiness view gives a misleading reason |
| F-114 |  | present | XS | medium | 2 | yes | Decision | The account picker says '8 results' when more match, and already-picked accounts vanish from search |
| F-121 |  | present | XS | low | 2 |  | Readiness | Personal (registered) Windows devices get opposite advice about Windows Hello for Business |
| OWN-W7 |  | present | XS | medium | 2 | yes | Step | Completed steps still say 'After making changes, select Scan to update the plan.' |
| F-028 |  | present | S | low | 2 |  | Plan | After a scan the page jumps to the top, and 'what changed' is a truncated sentence that cannot be expanded or exported |
| F-042 |  | present | S | medium | 2 | yes | Decision | An answer changed on a completed decision is thrown away silently if the user leaves without re-approving |
| F-047 |  | present | S | low | 2 |  | Export | Export files carry no tenant or date in their names, and 'Accounts as CSV' saves as people.csv |
| F-091 |  | present | S | medium | 2 |  | Plan | The Estimated finish (i) opens on hover, closes on click, and closes on Enter |
| F-127 |  | present | S | low | 2 |  | Export | CSVs are hard to use in Excel: no UTF-8 marker, a sample-data sentence in column A of every row, mixed blanks and dashes, and different header names for the same field |
| F-130 |  | present | S | low | 2 |  | Export | The grounding bundle carries no dates, although its readme says it does |
| F-140 |  | present | M | medium | 2 |  | Inventory | The sample data contradicts itself in places an expert will notice |
| F-101 |  | partly | XS | medium | 1 | yes | Step | Instructions name controls the step doesn't have: a Service accounts group picker, a Done shown only inside the open list, and 'Mark as done' |
| OWN-B1 | 4 | present | M | low | 3 |  | Home | Home shows no product image and undersells the output (moved from Review later, Round 4: Home + demo is the lowest surface, and an evaluator sees no product in the first ten seconds) |

## Not worth fixing / review later (141)

Kept out of the rounds.
- **Drop (54):** not worth building. Already fixed or gone, an
  owner decision that stands, or cosmetic.
- **Merged (4):** the same defect as another item, tracked there.
- **Review later (83):** real, but parked until its trigger
  fires. That means a decision is made, a real tenant shows the data state, or
  users report it. When a trigger fires, move the item to Needs attention first
  and say why.

How the lists were made (2026-09-27). Three independent judges read all 219
items against the owner's rules:
- truth and trust first
- usefulness over wording
- no contingencies for data states never met
- polish, not features
- owner decisions stand
- desktop web only

Each judge took one lens: the people using it, the owner's rules, or cost against
benefit. An item's place is the majority vote. The three split votes went to
Review later, and the owner adjudicated the rest where noted. Every judge's vote
is in the -backlog.json (`judges`, `bucket`, `bucket_reason`).

| ID | Decision | Why | Finding |
|---|---|---|---|
| F-019 | Drop | Already fixed or gone: The leadership briefing now gives the manager summary. | Nothing gives a short status or client summary: the print's 'one-page summary' is a paragraph of 30+ step names, followed by about 98 pages of runbook |
| F-022 | Drop | Already fixed or gone: The old runbook print was replaced by the leadership briefing. | The printed plan runs alternative tasks together as one sequence (create a new MFA policy, then correct the existing one, then turn it on) |
| F-045 | Drop | Already fixed or gone: The old runbook print was replaced by the leadership briefing. | The printed plan keeps live controls and IAMAI-only instructions, prints 'Learn →' links with no URL, and drops policy names from evidence rows |
| F-076 | Drop | Already fixed or gone: The briefing dropped the running footer that printed over text. | Printed plan: the page footer is printed over body text on 17 of 102 pages, including the lockout-recovery PowerShell command |
| F-125 | Drop | Already fixed or gone: The 102-page print was replaced by the short leadership briefing. | The printed plan wastes pages and strands headings: a blank page, a page per phase heading, and a Contents list with no page numbers in a 102-page document |
| F-030 | Drop | An owner decision: Placement is an owner decision, and the timing question is carried by OWN-W6. | Emergency-access safeguards sit after the rollout: the print files 'Verify Emergency Access' under Cleanup, and 'Alert on Emergency Account Sign-ins' waits for 'After security rollout' with no reason |
| F-046 | Drop | An owner decision: A deliberate dismissible tip that returns on a second click; the harm is small. | On Export, the '?' beside the plan-file tip hides the tip instead of explaining it |
| F-048 | Drop | An owner decision: The owner's vocabulary plan chose four hover definitions and no glossary page. | The How page has no glossary for the words the plan relies on |
| F-050 | Drop | An owner decision: Inventory's place under MFA Readiness is deliberate, and cross-links would be a new feature. | Inventory, the expert's best raw view, has no nav entry and no links to plan steps |
| F-096 | Drop | An owner decision: The fold is deliberate and answered decisions stay reachable. | Answered decisions collapse into 'All 3 completed' behind a small +, which makes changing your mind hard to find |
| F-131 | Drop | An owner decision: The Export grouping was chosen deliberately and every format is one toggle away. | Export page: most formats are hidden behind a small 'Additional Formats' toggle, several buttons look disabled, and a download gives no confirmation |
| F-133 | Drop | An owner decision: The plan file's internal names are a data format, not a screen, and were left deliberately. | The plan file uses internal goal names and statuses rather than the screen's words |
| F-150 | Drop | An owner decision: The dark primary follows the approved reference. | In dark theme the primary action looks almost like the secondary one |
| F-157 | Drop | An owner decision: The theme label works and persists; the owner chose to leave it. | The theme switch reads like a status ('Dark theme' while light is on) and exposes no pressed state |
| F-187 | Drop | An owner decision: Regenerating the sample as of today is the owner's design; F-095 handles the follow-up's timestamp. | In the demo every reload silently re-runs the scan as of now, so the scan never ages and the sample's dates shift under your saved decisions |
| OWN-LI | Drop | An owner decision: The footer link is the owner's own choice for the launch. | Footer 'Follow me on LinkedIn' is personal in a product footer |
| F-031 | Drop | Cosmetic or taste: The list shown is right and the lit tile names the filter; a stale tab highlight is a small polish point. | After the 'Ready now' tile is clicked, the Ready tab stays selected even while other tiles show On Hold or Completed rows |
| F-032 | Drop | Cosmetic or taste: Pressed toggles are a standard pattern and a second click brings the rows back, so nobody is misled into acting. | 'Show completed' and 'Show deferred' start on, so clicking them hides rows under an unchanged label |
| F-053 | Drop | Cosmetic or taste: A toggle size mismatch and 'preview' versus 'beta' are polish nobody acts on. | Home header 'Dark theme' is larger and off-baseline, and the release stage is 'Free public preview' on Home but 'Public beta' on Connect |
| F-054 | Drop | Cosmetic or taste: An icon glyph choice that slows nobody. | The 'Expand implementation' icon is an external-link glyph but opens an in-page overlay |
| F-055 | Drop | Cosmetic or taste: Names wrap but stay legible, and the shared picker CSS reaches finished steps. | Service-account names in decision chips wrap mid-name onto three lines ('svc- / mailer- / 1') |
| F-080 | Drop | Cosmetic or taste: The hero already says 'You review and make the changes' beside the buttons, and Connect lists the read-only permissions before consent. | The home page never says 'read-only' or names MFA and Conditional Access beside its buttons, and its no-change promise sits below the fold |
| F-081 | Drop | Cosmetic or taste: Microsoft's consent screen shows the scope ids and How has the full table; plain names serve the person choosing. | Connect's permission list gives no scope names and no link to How's full permission table |
| F-083 | Drop | Cosmetic or taste: Focus reaches the disclosure before Sign in, a mild order issue with a visible ring and no trap. | On Connect, keyboard focus reaches the permissions disclosure before the Sign in button |
| F-087 | Drop | Cosmetic or taste: The header count is true for the group; only filtered views look short, and the filter is visibly on. | Group headers and tab badges don't follow the active filters |
| F-142 | Drop | Cosmetic or taste: The home-to-planner seam is visual polish, not a harm. | Home page and planner feel like two products at the seam |
| F-148 | Drop | Cosmetic or taste: The theme toggle works and persists; not following a later OS switch is a small preference. | The theme stops following the computer's light/dark setting after the first visit |
| F-149 | Drop | Cosmetic or taste: A ragged column on Connect is visual polish nobody is slowed by. | Connect's permission table has a ragged second column squeezed into half the card |
| F-151 | Drop | Cosmetic or taste: A repeated status line and an off-centre dot are visual polish. | Connect's status bar repeats step 1, and its dot sits below the text |
| F-153 | Drop | Cosmetic or taste: A duplicate UTC entry and raw zone ids in a rarely used setting slow nobody. | The Display time zone list shows UTC twice and raw zone IDs |
| F-154 | Drop | Cosmetic or taste: Markdown markers in pasted tasks are a small tidy-up, not a harm. | Copied tasks are Markdown and include IDs the screen does not show |
| F-155 | Drop | Cosmetic or taste: The legend text carries the numbers, so similar bar colours mislead nobody. | The two greens and the two browns in the readiness bar are almost the same colour |
| F-158 | Drop | Cosmetic or taste: A capitalisation sweep across frozen screens and pinned tests costs more than it returns. | Capitalisation switches between Title Case, sentence case and mixed forms |
| F-159 | Drop | Cosmetic or taste: Layout rhythm across surfaces is low-value polish that reaches finished steps. | Layout rhythm and control styles vary between surfaces |
| OWN-HOW | Drop | Cosmetic or taste: A build stamp a day off in UTC matters to nobody. | How build stamp shows the UTC date |
| F-043 | Drop | Costs more than it saves: The AI Info warning is F-061, and the Inforcer card already shows the scan evidence needed to answer it. | Labels a beginner cannot decode: an 'Inforcer' yes/no question with no explanation, and an 'AI Info' tab that is really a prompt to paste into an assistant |
| F-085 | Drop | Costs more than it saves: Losing filters on a refresh is a small cost; restoring view state adds code for little gain. | A refresh drops the Plan's tab, search, Work type and tile filter |
| F-106 | Drop | Costs more than it saves: Opening another row closes the step and the admin scrolls back to the list anyway; Esc-to-close is a nicety. | An open step can be closed only from its row header: no Close control in the panel, and Esc does nothing |
| F-162 | Drop | Costs more than it saves: F-160's confirm covers the destructive risk; fold the danger styling into it and skip the extra menu header and helper lines. | The Account menu explains neither action on screen, hides who is signed in to which tenant, and styles the destructive item like Sign out |
| F-170 | Drop | Costs more than it saves: A rescan takes moments and the numbers shown are the last complete scan's, so a sticky banner adds little. | During a rescan, Plan shows one small grey line that scrolls away, and nothing says the tiles and evidence may change |
| F-126 | Drop | Fold into F-047's file-name helper, which can carry the Readiness view name. | Readiness CSVs share one name whatever they hold: the page's Export CSV follows the on-screen filter, the Export page's copy holds everyone, and nothing names the view, tenant or date |
| F-082 | Merged | Same defect as OWN-F2; tracked there. | Connect repeats the full marketing hero and beta notice even after a scan |
| F-094 | Merged | Same defect as OWN-W1; tracked there. | On first view nothing says where to start; the guidance is hidden behind 'How to use this plan +' |
| OWN-F1 | Merged | Same defect as F-004; tracked there. | Connect sample card '9 weeks' vs sample plan 'Est. Oct 29' |
| OWN-W3 | Merged | Same defect as F-003; tracked there. | Legend omits suffixes and tags |
| F-009 | Review later | A feature, not a fix: A plan-wide deviations list is a new report; F-041 puts the baseline beside the partner choice now. | The 'Differs from the Baseline' block appears on one policy step; other gaps, and the user's own narrowing, show only as small inline grey text or not at all |
| F-015 | Review later | A feature, not a fix: The untrue Export sentence is OWN-X1; target-policy JSON on every step is a feature. | Policy JSON and PowerShell exist on only 8 of 19 policy steps, not on the two core MFA policies, and vanish when a step is deferred, though Export says they are on each step |
| F-024 | Review later | A feature, not a fix: A whole-plan baselines-as-code export is a new capability outside current scope. | No whole-plan policy export for baselines-as-code, and the Policies CSV has no baseline mapping |
| F-025 | Review later | A feature, not a fix: Multi-tenant switching and reusable answers are a new capability, not a fix. | No multi-tenant path: the tenant is barely visible, there is no switcher or guidance, and every artefact is tied to one tenant |
| F-027 | Review later | A feature, not a fix: Searching policy and people names inside steps is a new capability; wait for users asking for it. | Plan search matches step titles only, so the people, accounts and policy names shown inside steps return nothing, and the empty state points nowhere |
| F-052 | Review later | A feature, not a fix: Carrying a deep link through sign-in is a new capability. | A step link or saved plan cannot be opened without that tenant loaded, and nothing says why |
| F-074 | Review later | A feature, not a fix: A 'changed since' view is a new capability; seed the demo history if evaluators ask for it. | After a Follow-up scan the numbers change with no explanation of who moved, including a silent regression |
| F-084 | Review later | A feature, not a fix: A 'start the sample fresh' reset is a new capability for repeat demos. | After 'Leave the demo', Connect gives no sign that sample progress is kept, and the sample can't be reset |
| F-110 | Review later | A feature, not a fix: The card-versus-task account mismatch is F-036; approving a model from its card is a later feature. | Passkey model decision needs raw AAGUIDs typed in; the affected model cannot be approved from its card |
| F-122 | Review later | A feature, not a fix: Person deep links and scroll restore on Readiness are new capabilities. | Returning to MFA Readiness loses your place, an open person can't be linked, and a step opened from Readiness has no way back |
| F-134 | Review later | A feature, not a fix: Deep links into How sections are a new capability. | No page links to the right part of How, and its sections can't be linked to |
| F-139 | Review later | A feature, not a fix: Search on Inventory tables is a new capability for an expert view. | Inventory tables sort but can't be searched or filtered, unlike Plan and Readiness, and have small layout inconsistencies |
| F-171 | Review later | A feature, not a fix: A 'copy a request for your admin' template is a new capability; wait for evidence that non-admins reach this dead end. | When an admin has to act (consent or a missing role), IAMAI names the need but gives the user nothing to hand to that admin |
| F-011 | Review later | An owner decision: Keeping rollback content off the step screens was decided; revisit whether turn-on steps should link the emergency runbook. | Rollback, blast radius and 'what could go wrong' appear only in the printed plan, never on screen |
| F-020 | Review later | An owner decision: Whether the calendar dates held turn-ons follows the owner's undated-held-steps decision; ask first, then date them or narrow the card's claim. | No export says when a policy is turned on: the calendar holds 7–8 eight-day blocks for Ready preparation steps only, and the print has no per-step dates |
| F-026 | Review later | An owner decision: The Home claim is true via Connect; add the pinned commit and link with the next Home pack revision (OWN-B1). | The home page promises an inspectable baseline version but shows none and links nowhere |
| F-029 | Review later | An owner decision: The zone only reverts on the demo re-seed; ask the owner whether the control earns its place before explaining it. | Display time zone resets to UTC after reload and changes nothing visible |
| F-033 | Review later | An owner decision: The generic line is true; specific reasons need the owner's words for why these policies are held out. | Three excluded baseline policies give no reason, and baseline names appear only in collapsed sections |
| F-038 | Review later | An owner decision: Whether a cosmetic rename step sets the finish date and can be deferred is the owner's scheduling call; F-004 fixes the tip. | 'Align Policy Names' forces the baseline's names, can't be deferred, and sets the plan's finish date |
| F-060 | Review later | An owner decision: The one-click answer is deliberate; revisit a confirm, since it removes five steps and marks a decision approved. | One click on 'Everyone works remotely' inside Define the Trusted Network answers a decision, removes 5 steps and makes the open step vanish, with no confirmation or undo |
| F-124 | Review later | An owner decision: The briefing could carry one line per answer; revisit if a manager or board asks why a policy is in or out. | Printed plan lists the decisions as Completed but not the answers |
| F-173 | Review later | An owner decision: The no-P1 refusal is an owner decision in a state no real tenant has shown; revisit naming security defaults when one does. | Without Entra ID P1 the Plan is one sentence: no security defaults route, no steps that need no licence, no link to MFA Readiness |
| F-178 | Review later | An owner decision: Same root as F-177; counting the operator as active reverses a documented rule, so revisit once F-177 lands. | When the signed-in admin looks dormant, admin policies show 'No user impact' and the admin vanishes from Readiness |
| OWN-D4 | Review later | An owner decision: Staggering turn-ons by weekly capacity is an L change to the forecast model and needs the owner's call. | Demo dates cluster on one day |
| OWN-F2 | Review later | An owner decision: Trimming the Connect hero for returning admins departs from the approved Connect pack, so it waits for the owner. | Returning admin sees the full Connect hero + Global Reader explainer every visit |
| OWN-W8 | Review later | An owner decision: 'Enforced' versus Entra's 'On' is a vocabulary call that touches frozen steps and the lifecycle bar. | 'Enforced' badge vs Entra's own word 'On' |
| F-093 | Review later | Cosmetic or taste: The counts agree once read; unify the units when Plan row wording is next touched. | IMPACT mixes units (steps, people, text labels) and counts the same population three ways |
| F-136 | Review later | Cosmetic or taste: The text is reachable by scrolling the panel; tighten the column widths when How is next touched. | The 'What IAMAI reads' table in How cuts off its WHY column at 1024, 1280 and 1440 px |
| F-199 | Review later | Cosmetic or taste: Guest addresses read badly, but the name and the Guest tag carry the meaning. | Guest accounts appear under raw '#EXT#' sign-in names, which wrap to three lines in Readiness and repeat '(guest)' in the dormant list |
| F-113 | Review later | Costs more than it saves: Answers do save; a Saved cue is polish and unifying the five patterns is L. | The decisions use five different patterns, and Save Countries gives no feedback |
| F-164 | Review later | Only in data no real tenant has shown: Only confusing when two tenants share a display name, and the refusal still protects; revisit if an MSP hits it. | The wrong-tenant message names only display names, so two tenants with the same name read 'made for Contoso Pty Ltd, and you are connected to Contoso Pty Ltd. Nothing was loaded.' |
| F-165 | Review later | Only in data no real tenant has shown: Real tenants with unreadable policies already stop at the gaps state; only the mock bypasses it. | When Conditional Access policies can't be read, the plan still says 'Ready', tells you to create policies and a trusted location that already exist, and nothing on Plan, Export or the printed plan says so |
| F-167 | Review later | Only in data no real tenant has shown: Reachable only by URL during a first scan or after a failed one. | During a scan and after a failed first scan, other pages still say 'Scan the tenant', Export tells a signed-in user to 'Connect a tenant first', and every link lands at the top of Connect with the Scan button off-screen |
| F-169 | Review later | Only in data no real tenant has shown: A failed rescan keeps the last full plan, which stays true as of its date; revisit when a real rescan failure is seen. | After a rescan fails, Plan, MFA Readiness, Export and Inventory never say so; only Connect explains that the last full plan was kept |
| F-172 | Review later | Only in data no real tenant has shown: The error page is rarely reached; relabel 'Start over' if a user reports avoiding it. | The error page's 'Start over' doesn't say what it does, and the way to report is plain text |
| F-174 | Review later | Only in data no real tenant has shown: No-P1 exports; revisit with the no-P1 page decision (F-173). | Without P1, the calendar, prompts and bundle still export a 'Conditional Access rollout' that the screen says doesn't exist, including work that needs P1 |
| F-175 | Review later | Only in data no real tenant has shown: Lapsed-P1 tenants with leftover policies are real but unseen so far, and listing them needs owner input. | Without P1, Conditional Access policies that still exist and still enforce MFA are ignored |
| F-176 | Review later | Only in data no real tenant has shown: A no-P1 tenant state; revisit when a real no-P1 tenant signs in. | Without P1, Readiness says it can't be measured for anyone, then lists three people as measured and counts people 'who signed in' after saying no sign-ins were read |
| F-181 | Review later | Only in data no real tenant has shown: A no-P1 tenant state; revisit with the no-P1 page decision. | Without P1, Inventory says everyone holds P1 and shows recent sign-ins, while Licensing says no P1 and How says those dates need P1; every registered method becomes 'Possibly broken' |
| F-182 | Review later | Only in data no real tenant has shown: A no-P1 tenant state; revisit with the no-P1 page decision. | Without P1, Readiness still points into a plan that isn't there, and loses its only how-to link |
| F-188 | Review later | Only in data no real tenant has shown: A 2,914-person inline list only happens at 5,000 seats. | On a 5,000-seat tenant, '2,914 more' opens a 2,914-person list inside the step: the page grows from 5,500 to 132,000 px, with no search, paging, export or bottom collapse |
| F-189 | Review later | Only in data no real tenant has shown: A 354-page print needs 5,000 seats, and the briefing rebuild already cut most of it. | At 5,000 seats the printed plan runs to 354 pages, 262 of them name lists, with the same 2,919 people printed twice |
| F-190 | Review later | Only in data no real tenant has shown: A 12-33 second freeze at 5,000 seats is synthetic stress. | Print, 'Download every prompt', 'See the prompts' and the masked bundle freeze the tab for 12–33 s at 5,000 seats, with no busy state |
| F-196 | Review later | Only in data no real tenant has shown: A slow step open at 5,000 seats; small tenants open in a fraction of a second. | Opening a step freezes the page for 1.8–6.5 s at 5,000 seats (0.15–0.34 s at 30 seats) with no loading state |
| F-197 | Review later | Only in data no real tenant has shown: 125 unreadable groups is a mock state. | Unreadable groups show as 125 identical 'an unnamed group' rows in Inventory, while steps, pickers and the CSV use IDs such as g-003 that Inventory never shows |
| F-198 | Review later | Only in data no real tenant has shown: Paging past 50 people only happens in large tenants. | After 'Show the next 50', keyboard focus stays on a button now 3,000 px off-screen, and the next Tab skips the 50 new rows |
| F-021 | Review later | Wait for evidence: The briefing was rebuilt for managers; add the baseline commit and the not-in-plan list when a change-board reader asks for them. | The printed plan omits the pinned baseline version, the deviations from baseline and the 'In the baseline, not in this plan' list |
| F-039 | Review later | Wait for evidence: Pretty-printed JSON is cheap but touches frozen steps; do it when a reviewer asks. | Script and payload style varies between steps, and IAMAI writes an unexplained tag into policy descriptions |
| F-059 | Review later | Wait for evidence: Live-region announcements are a screen-reader refinement with no reported user. | Most state changes are silent to assistive technology |
| F-065 | Review later | Wait for evidence: Returning focus after each action is a keyboard refinement with no reported user; the after-scan scroll part is F-028. | After Defer, Put back, Approve answers, picker Done, chip removal or Scan, keyboard focus drops to the page body and the user's place is lost |
| F-097 | Review later | Wait for evidence: Forced-colours gaps have no reported user; fix them when a High Contrast user reports it. | In forced colours, the selected tab, pressed toggles and the Readiness bar disappear |
| F-098 | Review later | Wait for evidence: Table semantics for screen readers with no reported user. | Plan list rows and the Readiness person list look like tables but are not |
| F-099 | Review later | Wait for evidence: The link-as-toggle works with Enter and a mouse; the button semantics are a screen-reader refinement with no reported user. | 'Plan settings' and 'How to use this plan' are links that act as toggles |
| F-103 | Review later | Wait for evidence: Names stay as the baseline writes them; fold dashes in matching if a rename is reported not to match. | Policy names to type by hand mix en dashes and hyphens |
| F-105 | Review later | Wait for evidence: OWN-W1's Next line covers what comes next; a per-step Next link can wait. | Completing a step leaves no 'what next', and the confirmation appears off-screen |
| F-112 | Review later | Wait for evidence: Defer dialog focus and the required-reason hint are screen-reader refinements with no reported user. | Defer dialog: focus starts on an icon named 'Cancel', and the disabled primary button gives no reason |
| F-115 | Review later | Wait for evidence: The Guest tag and extra CSV columns are nice to have; add them when a client asks for the chase list to carry them. | The Readiness CSV drops the Guest tag and gives no reason, department or last-seen date for each state |
| F-118 | Review later | Wait for evidence: Browser-printing Readiness is not an offered path, and the CSV carries everyone. | Printing Readiness silently omits the people in collapsed groups |
| F-119 | Review later | Wait for evidence: The Readiness state is still true evidence; tag set-aside people if admins turn out to chase the wrong ones. | A person the Plan set aside ('Turn On Without Them') still shows as needing action on Readiness |
| F-132 | Review later | Wait for evidence: The briefing on Export is the print path; a Ctrl+P of the Plan cutting the date is XS CSS if anyone reports it. | Printing the Plan screen with the browser cuts the Estimated finish tile to 'Est. Oct 2' |
| F-141 | Review later | Wait for evidence: Back returns to Home; add the two Connect actions to How if evaluators report getting stuck. | Before sign-in the planner shows no navigation, and How is a dead end from the home page |
| F-145 | Review later | Wait for evidence: Per-route titles and focus on navigation are refinements with no reported user; revisit with multi-tenant work. | The browser tab title never changes by page or tenant, and a surface change is not announced |
| F-146 | Review later | Wait for evidence: A skip link is a keyboard convenience with no trap behind it; add it in the next accessibility pass. | No skip link: every page starts with the header, and the first Plan step is the 25th Tab stop |
| F-156 | Review later | Wait for evidence: A heading-level refinement for screen readers with no reported user. | Inventory heading outline skips a level and the info button is part of the heading |
| F-163 | Review later | Wait for evidence: The full menu keyboard pattern is a refinement once F-160 closes the menu after Forget. | The Account menu doesn't behave like a menu from the keyboard: arrow keys do nothing, Escape from an item drops focus to the page, and the menu stays open after focus leaves |
| F-166 | Review later | Wait for evidence: Scan-wait guidance matters only if real scans run long; check real scan durations first. | The scan wait shows only the current section and elapsed seconds; the read-only line disappears, nothing says whether you can leave, and Stop or a reload silently discards the scan |
| F-179 | Review later | Wait for evidence: Status unclear; run the live check on the no-policies mock before touching the scheduler. | With no existing policies, 'Require MFA for Everyone' gives two creation dates and two go-live bars |
| F-185 | Review later | Wait for evidence: Only a tab left open for days shows stale dates, and any page change re-dates them. | A plan left open doesn't notice time passing: two weeks on it still shows past 'Est.' dates and no stale-scan line, then every date jumps when you change page |
| F-191 | Review later | Wait for evidence: Completed-while-Blocked appeared only with 53 unreadable mock groups; reproduce with a real deleted excluded group before engine work, and promote it if it reproduces. | Require MFA for Everyone blocks on 53 raw group IDs, says 'scan again', and then turns Completed after the next scan while the panel still says Blocked |
| F-194 | Review later | Wait for evidence: Status unclear; reproduce outside the 5,000-seat mock first, and if a normal plan-file load changes the plan it becomes attention. | Loading an unchanged plan file removes 3 steps and moves the finish date 7 weeks earlier until the next reload |
| F-008 | Review later | Waits on the policy-matching decision: Steering a stricter admin grant down to the baseline's is an exact-controls outcome that build-new would retire. | 'Require Phishing-Resistant MFA for Admins' tells you, by default, to replace the stricter Phishing-resistant strength with the baseline's Modern MFA + TAP |
| F-014 | Review later | Waits on the policy-matching decision: Create-versus-correct alternatives exist only because steps edit tenant policies; settle them with build-new. | Steps that correct an existing policy also offer to create a second, baseline-named one, and an existing guest MFA policy is ignored |
| F-102 | Review later | Waits on the policy-matching decision: The overlap review form is the retire-old Cleanup that build-new will reshape; restyle it then. | The cleanup steps look like a different product, and the overlap review form is unstyled and opaque |
| F-109 | Review later | Waits on the policy-matching decision: The Differs panel exists for edited tenant policies; wait for the 'build new, retire old' decision. | No baseline version shown next to the step or the 'Differs from the Baseline' panel |
| F-192 | Review later | Waits on the policy-matching decision: 52 per-policy edits and 785 dormant accounts only occur at 5,000 seats, and the per-policy edits retire under build-new. | Per-object instructions don't scale: 52 policies to edit by hand (156 numbered lines in a 370 px box) and 785 dormant accounts to disable one at a time, with no bulk path or tick-off |
| F-193 | Review later | Waits on the policy-matching decision: Sixty overlapping policies is synthetic, and the overlap review is reshaped by build-new's one-time Cleanup. | Review Overlapping Policies at 60 policies runs three overlap sets into one 250-word sentence and gives a single form for all of them |
| OWN-W4 | Review later | Waits on the policy-matching decision: Leading a stricter admin policy with weakening instructions goes away under build-new; revisit with that decision. | 4.3 leads with weakening a stricter admin policy |
| OWN-W9 | Review later | Waits on the policy-matching decision: The duplicate create in 3.6 and 7.3 is by design; settle it with build-new rather than adding another line. | Same create appears in 3.6 and 7.3 |
| F-090 | Review later | Settings is off the main path; fix the pause and freeze wording together with F-006. | Plan settings mixes instant-apply and Save, gives no confirmation, and says 'freeze' for 'Pause' |
| F-003b | Drop | Owner's scrub (2026-09-27): Cosmetic, inside the collapsed "How to use this plan". | The legend's new label "Create, Correct, Turn on, Decision, Review" wraps to four lines in its column. Found in the Round 2 audit. |
| F-034 | Drop | Owner's scrub (2026-09-27): Below the desktop widths people use. | At 1024px wide the plan tabs overlap ('Up Next 8On Hold') and the On Hold count is cut off |
| F-086 | Drop | Owner's scrub (2026-09-27): Thirty-odd rows, and search by title is rarely used. | Search says 'No steps match' or shows nothing when matches are inside a collapsed group or hidden as deferred |
| F-088 | Drop | Owner's scrub (2026-09-27): The filters that emptied the list are on screen above it. | Plan empty states don't say which filter emptied the list and offer no way out: 'No steps match this search.' with nothing searched, and 'Nothing in this lane.' |
| F-089 | Drop | Owner's scrub (2026-09-27): The Work type filter is rarely used. | Work type categories leave policy work out of 'Conditional Access', and the select has no label |
| F-095 | Drop | Owner's scrub (2026-09-27): Only a returning evaluator sees it, and the fix changes the demo's clock. | The demo's Follow-up scan gives different results on repeat visits and shows the Initial scan's timestamp |
| F-108 | Drop | Owner's scrub (2026-09-27): One phrase on one step. | The service-accounts step says 'the accounts you picked' before anything was picked |
| F-117 | Drop | Owner's scrub (2026-09-27): Polish. | Legend states and list groups use different names, and the legend cannot be clicked |
| F-120 | Drop | Owner's scrub (2026-09-27): Require MFA for Guests handles guests. | The guest row has no real action and a contradictory 'best option' |
| F-123 | Drop | Owner's scrub (2026-09-27): The drawer works; a keyboard nicety. | The Readiness Details drawer lets focus leave while it stays open, covers focusable controls at 1024–1280, and hides device join state from keyboard users |
| F-128 | Drop | Owner's scrub (2026-09-27): Each card says what it masks, and the bundle's toggle warns. | Redaction differs by export, and the bundle's switch gives no sign of which version will download |
| F-135 | Drop | Owner's scrub (2026-09-27): No reader is misled into acting. | 'Every check' leaves out the checks behind most steps |
| F-152 | Drop | Owner's scrub (2026-09-27): A label nuance. | A decision row's due date has no 'Est.', so it reads like a completion date |
| OWN-B4 | Review later | Owner's scrub (2026-09-27): Only where a tenant refuses a read: none on the owner's tenant or the demo. Trigger: a real tenant shows one. | Beyond MFA Readiness, a dozen sentences still say IAMAI "could not read", "could not be judged", "cannot prove", "could not work out" or "Not established" about the tenant (shared.engine.readiness.blind, noneJudged, detectionGap.policies, tracking.evidenceSourceUnread, app.plan.emergencyUnproven, impact.notEstablished, readiness planContext.unknown, workloadIdentity.unknown), and the hard-coded "Named locations could not be fully read. Scan again to load existing office networks." in the office network decision (ContentStep.tsx). Found in the Round 1 walk. |
| F-073 | Review later | Owner's scrub (2026-09-27): The demo no longer has an unread method list. Trigger: a real tenant shows one. | 'Couldn't read' has no usable next step: 'Nothing to do' stays after a rescan (Round 1 removed the "couldn't read" words; the row's next step for a real unread list is still only a rescan) |
| F-058 | Review later | Owner's scrub (2026-09-27): Not on the demo any more. Trigger: a real partial read. | '1 section was not read in full … check what is listed under Scan' leads to a row that explains nothing |
| F-005 | Review later | Owner's scrub (2026-09-27): Only on a partial read. Trigger: a real partial read. | The Plan never says it was built on a partial read (the beta-caveat half is dropped: the banner was removed on purpose) |

## Prompt for the next chat

Paste the block below into a new chat opened in `C:\Dev\IAMAI`. It decides and
runs one round; start a fresh chat for each round, with the same prompt, and keep
this section current at the end of each round.

```text
We're taking IAMAI Planner to 90%. This chat decides the next ten fixes, the ones
that actually lift the tool, then plans, builds and audits them.

Read docs/plans/2026-09-27-low-hanging-fruit.md first: Readiness scores, Rounds 1
to 3 (done), Round 4 candidates, Needs attention, and "Not low-hanging". If a
round's work is not on main yet, it is on its branch fix/low-hanging-N: work there.
(As of the end of Round 3, 2026-09-27: check `git log origin/main` for caa86c7a, F-177,
and the Round 3 plan update; if they are not there, they are on fix/low-hanging-3.
Start Round 4 on fix/low-hanging-4 from wherever they are.)

WHAT 90% MEANS (owner, 2026-09-27)
- 100%: the tool works perfectly, is 100% accurate, and every feature it has has
  zero gap. Out of reach without community feedback.
- 90%, the goal: 90% of the people who touch the tool have an experience they feel
  is useful and has quality; 10% have feedback or complaints before they reach value.
- Refinements the owner confirmed on 2026-09-27:
  - A safety floor outside the percentage. Nothing the tool tells someone to do
    locks anyone out, loses their work or weakens protection.
  - Each reader has a value moment:
    - Evaluator: understands what it would do for their tenant, within minutes of the demo.
    - Admin: an accurate plan for their tenant, and knows the next step, in the first session.
    - Help desk: the people to chase and what each must do.
    - Manager: a briefing they can act on.
  - Someone their tenant blocks (no P1, no Global Administrator to consent) counts
    as served only if the tool said exactly why and what to do next.
  - Until real users exist, the score is a judgement from persona walks across
    tenant shapes: fresh, security defaults on, half-built, no P1, large.
Score every surface by it: would nine in ten of its readers come away feeling it
was useful and well made?

WHERE THINGS STAND (end of Round 3, 2026-09-27)
- Live: cac1a3e (Round 3); F-177 is caa86c7a. Rounds 1–3 shipped 36 fixes, three
  review-fix commits and a backlog scrub (38 items left in Needs attention).
- Table (surface average): 86.5. Home + demo 82, Connect 90, Plan + steps 90,
  MFA Readiness 91, Inventory 83, Export 85, briefing 85, How 86.
- Honest whole-tool rating: about 84.
  - The truth and safety layer is about 89.
  - The experience layer is about 78: Back, top-of-page and the two-tab guard were
    the first felt changes to how the tool moves.
  - Under 85: Inventory and Home + demo.

WHAT ROUND 3 TAUGHT
- The owner judges each pick by one question: who hits this on a path they take, and
  is the fix the quality one? Two of the ten were reshaped by it before building (the
  instruction box stays a scroll box; the prompt pack is the implementer's), and the
  backlog lost 13 items to it. Ask it of every pick before presenting.
- Say when a fix reverses a documented rule (F-177 reversed "the population never
  depends on who ran the scan"): found after approval, it cost a second decision.
- The review workflow earns its tokens on new logic (it found nine real defects, all
  in code written this round); words it can only check against the code.

WHAT ROUNDS 1 AND 2 TAUGHT
- Picking small, safe, reward-ranked items mostly removed contradictions and added
  safety nets. Worth having, but users rarely feel them.
- The fixes users felt were on the main path:
  - sign-in recovering after a cancelled consent
  - MFA Readiness opening on the people the step named
  - the Plan's Next line
  - the demo explaining its follow-up scan
  - rows naming the step they wait on
- Nothing yet has touched what most limits how the tool feels:
  - Steps send admins to edit existing, often enforced, policies in place. This is
    the open policy-matching decision ("build new, retire old") in "Not low-hanging",
    and the biggest lever on an expert's trust.
  - Weight: a 36–38 step plan with long step pages. The owner deferred the polish
    research to v1.5/v2, so ask before touching it.
  - Time to first value: Global Administrator consent, the scan, then a long plan.
    Only the Next line guides the first 15 minutes.
  - Secondary surfaces feel secondary:
    - Inventory is a raw dump.
    - Export is a wall of formats.
    - Home shows no product (OWN-B1 needs an approved-pack revision).
  - The Plan's and steps' own "could not read / not established" sentences (OWN-B4,
    now Review later: no real tenant shows one).

1. Decide the ten.
   - Start from Round 4's candidates and Needs attention, and reshape freely: mix
     low-hanging items with one to three changes a user will feel on the first-hour
     path (Home, demo, Connect, sign-in, scan, Plan, first steps) or the daily path
     (Plan + steps, MFA Readiness).
   - An item from "Not low-hanging" or "Review later" may be picked when it is what
     moves the felt experience. Say why, and move it to Needs attention first. A
     decision-sized item (such as policy matching) comes as a design with options,
     not a fix.
   - For each: the reader, the moment, what they will feel is different, the
     surface score it lifts, and its size and risk.
   - Filter the -backlog.json with a small node script; don't load it whole. Full
     F-* detail: C:\Users\Owner\Downloads\IAMAI UX Audit.zip (index.html, JSON in
     <script id="data">); extract it to your scratchpad.

2. Verify each before planning it: the code at HEAD, and live on your own.
   - The demo: https://getiamai.com/planner/?demo=1 in the built-in browser.
   - The owner's tenant: in Claude in Chrome. The owner lets you use the plan as a
     user would (accept, write, save), but never Forget, Sign out or Scan without asking.
   - If one no longer reproduces, mark it fixed and take the next.

3. Plan each for the customer, and aim for the best fix:
   - reader and moment
   - before and after
   - exact new words, from content.json keys
   - options with a recommendation
   - finished screens it touches
   - effort, risk
   - acceptance: the unit test and the exact live check.
   Prefer deleting or shortening to adding, and keep one place per fact.

4. Present all ten together. Ask about each open choice, and build only what the
   owner approves, the way they approved it. Rejected or deferred items go back on
   the list with the owner's reason.

5. Build on the round's branch (fix/low-hanging-N, from main or from the last round's
   unpushed branch).
   - One commit per fix, plain message, naming content keys added, removed or edited.
   - Each fix gets a unit test that fails before it and passes after:
     `npm run verify -- <tests>`.
   - If a fix grows bigger or riskier than planned, stop and ask.
   To close:
   - `NODE_OPTIONS=--max-old-space-size=14000 npm test` once.
   - A review workflow over the round's diff (workflows review only; audits stay solo).
   - Fix what it confirms in one "Review fixes for Round N" commit, and rerun the
     full suite if code changed.
   - `npm run verify -- --prepush <the round's tests>`.
   - Ask before `git push origin HEAD:main`, then wait for deploy-pages.

6. Audit the live result on your own, one fix at a time. Did it land exactly as
   approved? Is the reader genuinely better off? Quote the screen. Fix a shortfall
   with the owner's OK, or add it to Needs attention.

7. Re-score every surface from a live walk, using the 90% definition, and give the
   honest whole-tool rating beside the table. Update the plan: round done, list
   moves, next candidates, this prompt. Commit, and report: the ten, what the
   customer feels, the scores, the proposed next ten.

PRACTICAL LEARNINGS
- A demo-fixture change ripples into ~150 test files and moves pinned counts:
  run the full suite.
- scripts/smoke.mjs (it runs in --prepush) and scripts/walk.mjs pin on-screen
  words; update them when words change. Never run the walk.
- Run `node scripts/step-snapshots.mjs` after each fix. A commit that moves
  snapshots carries [snapshots] in its subject.
- fillText bends counts across the whole sentence. Set a person's own words in with
  fillTextVerbatim.
- railOf drops a headline that contains a date; the deferral has its own rail field.
- $comments under pages.readiness count toward that page's 25-word rule.
- Heredocs lose backslashes and can write NUL bytes. Use the Edit tool for regexes,
  and check files for NULs.
- Don't fold fixes into earlier commits: app.css appends at the end and rebases
  conflict. Use one review-fix commit.
- Claude in Chrome's window is hidden and throttles timers: wait with MessageChannel
  ticks. Read the briefing by stubbing window.print. Stage a cancelled sign-in by
  starting a real one, then returning with its state and
  #error=access_denied&error_subcode=cancel.
- Never put the owner's tenant or people names in repo docs. The tenant guard does
  not catch display names.
- `node -e "…"` inside a bash double-quoted string loses backslashes and backticks
  (it mangled regexes and template literals four times in Round 3). Write a script
  file with the Write tool, or use a quoted heredoc (<<'EOF'), then run it.
- After a deploy the built-in browser can keep the old bundle: load with ?v=<sha> and
  check How's "Build <sha>" before auditing. A long-lived tab caps history.length at
  50, so check Back by the hash, not the length. A background tab's screenshot is
  stale: tabs_select it first, or read the DOM.
- The two-tab guard (ui/planSync.ts) leaves the sample tenant out. Check it on the
  owner's tenant: sign in a second Chrome tab by SSO, open its Plan (the first tab
  must stay unmarked), then load the tenant's own plan file back in the second tab
  (capture the Save blob in-page; same content, no net change) and read the first.
- Capture any download in-page instead of saving it: stub URL.createObjectURL and
  HTMLAnchorElement.prototype.click, read the Blob, then restore both.
- The full suite has about 2,100 tests and takes about 10 minutes.

STANDING RULES
- The product stays read-only.
- Never commit tenant data (UPNs, object ids, tenant GUIDs).
- Never say "couldn't read".
- Exact controls: every difference is corrected or accepted with a reason.
- The pinned baseline wins.
- Finished screens change only with the owner's yes.
- Don't run the walk.
- Stop idle servers and agents.
- Ring the chime (bash "$HOME/.claude/hooks/chime.sh" call "<reason>") whenever
  the owner must look.

Repeat rounds until the owner judges the tool at 90% by the definition above.
```
