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

## Round 1: the top 10 (each verified live on 2026-09-27)

| # | ID | Fix | Effort | Risk |
|---|---|---|---|---|
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

## Round 2: candidates (verify live before presenting)

Ranked by the same rubric. The next round re-verifies these against main and
live, then picks ten.

| ID | Fix | Effort | Risk | Frozen |
|---|---|---|---|---|
| F-017 | In the demo, Scan switches to the follow-up scan: say so in the banner | XS | low | |
| F-002 | Configure Emergency Exclusions: 4 policies vs 5. Fixture row lacks `excludeGroups: []`; fix it and the cleanup "why" | S | medium | yes |
| F-003, OWN-W3 | Legend gets the second words (Create, Correct, Decision, Review, Turn on) and the Report-only/Enforced chips; the Observing tile's word matches its row | XS | low | |
| OWN-W2 | "Waiting on your answers in {step}": name the question (planBoard.ts holdLabelOf) | S | medium | |
| F-044 | Readiness headline "4 of 30 (29 people and 1 guest) are ready…" | XS | low | |
| F-143 | A "Sample data" marker in the header that stays when the page scrolls | XS | low | |
| F-007 | × on an emergency account saves at once: hold removals until Done | S | medium | yes |
| F-010 | The exclusions step's AI brief says no group exists while one is chosen | S | medium | yes |
| F-013 | A deferral's reason is shown again, on its card and in the print's Set aside list | S | medium | yes |
| F-057 | A cancelled or failed sign-in leaves Sign in spinning: clear the busy state and keep the consent text | S | medium | |
| OWN-X1 | Export: "a policy's JSON and PowerShell are on its step while it is still to create or correct" | XS | low | |
| OWN-W5 | 5.9: say how a medium-risk flag clears (the person changes their password, or the risk is dismissed) | S | medium | |
| OWN-W7 | Completed steps drop "After making changes, select Scan…" | XS | medium | yes |
| OWN-W6 | 8.1 alert before the rollout (owner decides the timing) | XS | medium | |
| F-012 | Report-only's "blocked no one" states its numbers and days | S | medium | yes |
| F-016 | Troubleshooting speaks to the user; TAP first; "Close", not "Minimize" | S | medium | yes |
| OWN-I1 | Inventory in the top nav | XS | medium | |

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

### Other larger items

- **OWN-B1:** a product image on Home (an approved-pack revision, M).
- **OWN-D4:** stagger turn-ons by weekly capacity (L, engine).
- **F-009:** one plan-wide list of deviations from the baseline (L).
- **F-192:** a bulk path at scale (L).
- **F-024:** baselines-as-code export (L).
- **F-025:** a multi-tenant path (XL).
- **F-004, part two:** the finish tip names the step that actually finishes
  last (M).

## Full backlog

219 items: 144 present, 51 partly, 2 unclear, 17 intentional, 1 fixed, 4 superseded. Sorted by status, then reward, effort and risk. "(mock)" findings came from the dev mock (no P1, 5,000 seats, unreadable policies, failed rescans). Each item's fix sketch and files are in the -backlog.json.

| ID | Round | Status | Effort | Risk | Reward | Frozen | Severity | Surface | Finding |
|---|---|---|---|---|---|---|---|---|---|
| F-061 | 1 | present | XS | medium | 4 | yes | Major | Step | The step 'AI Info' copy carries sign-in addresses, object IDs and the tenant name with no purpose line, warning or redaction, though Export says every copied prompt is masked |
| F-068 | 1 | present | XS | medium | 4 | yes | Major | Decision | 'SharePoint and OneDrive from outside the office: Yes' keeps a policy that blocks SharePoint outside the office |
| F-070 | 1 | present | XS | medium | 4 | yes | Major | Decision | 'Recurring travel countries' looks like an allowlist but does nothing, so travellers will be blocked |
| F-004 | 1 | present | S | low | 4 |  | Major | Plan | Estimated rollout is '9 weeks' on Connect and '5 weeks / Est. Oct 29' on the Plan, and the finish tip credits a step dated Oct 5 |
| F-071 | 1 | present | S | low | 4 |  | Major | Readiness | Every 'Not counted' link on MFA Readiness opens an empty list |
| F-160 | 1 | present | S | low | 4 |  | Major | Shell (mock) | Forget this tenant deletes the whole plan on one click: no confirmation, no list of what goes, no offer to save the plan file, no undo and no message afterwards |
| OWN-B3 | 1 | present | S | low | 4 |  | own | Readiness | Demo MFA Readiness shows banned 'couldn't read' phrasing |
| OWN-W1 | 1 | present | S | low | 4 |  | own | Plan | Plan board names no next action (no 'Next up') |
| F-007 |  | present | S | medium | 4 | yes | Major | Step | One click on the × beside an emergency account saves at once, survives reload, removes a plan step and turns the exclusions advice into 'remove Break-glass 2', with no Done, confirmation or undo |
| F-016 |  | present | S | medium | 4 | yes | Major | Step | Troubleshooting opens with 'IAMAI is about to configure…' in internal runbook language, and the section the step points to is last of eight |
| F-057 |  | present | S | medium | 4 |  | Major | Connect | After a cancelled or failed Microsoft sign-in, the Sign in button spins forever, ignores clicks, and the admin-consent guidance disappears |
| OWN-R1 | 1 | present | S | medium | 4 |  | own | Readiness | MFA Readiness 'Nobody needs action' while a person lapses in 7 days |
| OWN-W2 |  | present | S | medium | 4 |  | own | Plan | Rows say 'Waiting on your answers' without naming the question |
| F-161 |  | present | M | high | 4 |  | Major | Shell | Two open tabs silently overwrite each other: the tab that saves last replaces the whole plan, even undoing a plan file the other tab just loaded |
| F-006 |  | present | L | high | 4 | yes | Major | Plan | A saved change freeze has no visible effect on the plan rows, the finish tip, the PDF or the calendar |
| F-003 |  | present | XS | low | 3 |  | Minor | Plan | Tile counts and state words don't match the rows, and the legend defines only half of them: 'Needs your input 6' against 11 'Waiting on your answers' rows, an 'Observing' tile whose row says 'On Hold · Report-only', and undefined 'Correct' and 'Enforced' |
| F-044 |  | present | XS | low | 3 |  | Minor | Readiness | The MFA Readiness headline reads as if 29 people and a guest are ready |
| F-080 |  | present | XS | low | 3 |  | Minor | Home | The home page never says 'read-only' or names MFA and Conditional Access beside its buttons, and its no-change promise sits below the fold |
| F-094 | 1 | present | XS | low | 3 |  | Minor | Plan | On first view nothing says where to start; the guidance is hidden behind 'How to use this plan +' |
| F-143 |  | present | XS | low | 3 |  | Minor | Shell | Demo banner scrolls away while the header stays, so a scrolled plan no longer says it is sample data |
| F-144 |  | present | XS | low | 3 |  | Minor | Shell | The demo's 'Initial scan / Follow-up scan' switch is unexplained, and its styling is backwards: the selected option looks like a link and the other barely looks clickable |
| F-168 |  | present | XS | low | 3 |  | Minor | Shell (mock) | Plan, MFA Readiness and Export in the header stop working before the first scan and during every rescan, look the same as live links, and say 'after the first scan' even when a plan exists |
| F-184 |  | present | XS | low | 3 |  | Minor | Export | A printed plan made from an old scan drops the screen's 'Scan again before acting' warning |
| OWN-F1 | 1 | present | XS | low | 3 |  | own | Connect | Connect sample card '9 weeks' vs sample plan 'Est. Oct 29' |
| OWN-W3 |  | present | XS | low | 3 |  | own | Plan | Legend omits suffixes and tags |
| F-041 |  | present | XS | medium | 3 | yes | Minor | Decision | Exempting partner and MSP technicians is suggested 'Yes', and the baseline's version is not shown at the decision |
| F-062 |  | present | XS | medium | 3 | yes | Minor | Step | 'Require Phishing-Resistant MFA for Admins' says 'change the Directory roles selection as listed below. Select (45)', and the list leaves out Global Administrator |
| F-063 |  | present | XS | medium | 3 | yes | Minor | Step | 'Set up Windows Hello for Business' rows have no how-to in the Plan step they link to |
| F-195 |  | present | XS | medium | 3 |  | Major | Export (mock) | The 'masked' calendar and prompts file keep guest sign-in addresses in full (43 in the calendar at 5,000 seats) |
| OWN-ACCEPT | 1 | present | XS | medium | 3 | yes | own | Step | Owner ask: the Completed 'Difference Accepted' panel repeats fluff |
| OWN-W6 |  | present | XS | medium | 3 |  | own | Plan | 8.1 Alert on Emergency Account Sign-ins waits until after the rollout |
| F-092 |  | present | XS | high | 3 | yes | Minor | Plan | A 'Ready' step is dated a month out and sits at the very bottom of the plan |
| F-021 |  | present | S | low | 3 |  | Major | Export | The printed plan omits the pinned baseline version, the deviations from baseline and the 'In the baseline, not in this plan' list |
| F-058 |  | present | S | low | 3 |  | Minor | Connect | '1 section was not read in full … check what is listed under Scan' leads to a row that explains nothing |
| F-075 |  | present | S | low | 3 |  | Minor | Readiness | Jamie Brown's row says to use a passkey that the drawer says will stop working |
| F-077 |  | present | S | low | 3 |  | Major | Export | 'Summarise this plan for a non-technical business owner' prompt is grounded only on five cleanup items, with no MFA step in it |
| F-116 |  | present | S | low | 3 |  | Minor | Readiness | Search leaves matches hidden in collapsed groups and gives a dead-end empty state |
| F-162 |  | present | S | low | 3 |  | Minor | Shell (mock) | The Account menu explains neither action on screen, hides who is signed in to which tenant, and styles the destructive item like Sign out |
| F-171 |  | present | S | low | 3 |  | Minor | Connect (mock) | When an admin has to act (consent or a missing role), IAMAI names the need but gives the user nothing to hand to that admin |
| F-010 |  | present | S | medium | 3 | yes | Major | Step | The AI Info brief for 'Configure Emergency Exclusions' says no exclusions group exists, while the same card shows the group as selected and verified |
| F-023 |  | present | S | medium | 3 |  | Major | Export | Loading a plan file silently replaces current decisions and recorded deferrals, with no preview, warning or summary of what came back |
| F-037 |  | present | S | medium | 3 | yes | Minor | Step | The Email tab's single Copy button copies the staff, admin and follow-up emails as one blob, signed 'IT', in a code-style monospace box |
| F-040 |  | present | S | medium | 3 |  | Minor | Decision | Approving a decision jumps to the next one while the 'steps removed' note sits off-screen, focus is lost, and a removed review step is never listed |
| F-051 |  | present | S | medium | 3 |  | Minor | Shell | Opening a step replaces the history entry, so Back skips the plan or leaves IAMAI, and the demo's Follow-up scan resets on reload |
| F-056 |  | present | S | medium | 3 | yes | Major | Decision | You can mark your own admin account as a printer: it is the first search result, nothing warns, and approving takes it out of admin MFA |
| F-067 |  | present | S | medium | 3 | yes | Minor | Decision | Confirm What You Use explains only one direction of each choice, so the other answer's effect is invisible, including an MSP lockout risk |
| F-073 |  | present | S | medium | 3 |  | Minor | Readiness | 'Couldn't read' has no usable next step: 'Nothing to do' stays after a rescan |
| F-095 |  | present | S | medium | 3 |  | Minor | Plan | The demo's Follow-up scan gives different results on repeat visits and shows the Initial scan's timestamp |
| F-109 |  | present | S | medium | 3 | yes | Minor | Step | No baseline version shown next to the step or the 'Differs from the Baseline' panel |
| F-169 |  | present | S | medium | 3 |  | Minor | Plan (mock) | After a rescan fails, Plan, MFA Readiness, Export and Inventory never say so; only Connect explains that the last full plan was kept |
| F-186 |  | present | S | medium | 3 |  | Minor | Connect | Connect says 'Ready to plan' for a 40-day-old scan while every other page says to scan again, and the warning is a small grey line that never escalates |
| OWN-W5 |  | present | S | medium | 3 |  | own | Step | 5.9 Reset Passwords for Medium-Risk Users has no path forward |
| F-036 |  | present | S | high | 3 | yes | Minor | Step | 'Configure Passkey Authentication' names one account as affected and a different account as the one that would be locked out |
| F-177 |  | present | S | high | 3 | yes | Major | Step (mock) | The Plan tells the signed-in admin, the only Global Administrator, to disable their own account as dormant |
| OWN-B1 |  | present | M | medium | 3 |  | own | Home | Home shows no product image and undersells the output |
| F-031 |  | present | XS | low | 2 |  | Minor | Plan | After the 'Ready now' tile is clicked, the Ready tab stays selected even while other tiles show On Hold or Completed rows |
| F-032 |  | present | XS | low | 2 |  | Minor | Plan | 'Show completed' and 'Show deferred' start on, so clicking them hides rows under an unchanged label |
| F-033 |  | present | XS | low | 2 |  | Minor | Plan | Three excluded baseline policies give no reason, and baseline names appear only in collapsed sections |
| F-034 |  | present | XS | low | 2 |  | Minor | Plan | At 1024px wide the plan tabs overlap ('Up Next 8On Hold') and the On Hold count is cut off |
| F-079 |  | present | XS | low | 2 | yes | Minor | Shell | Keyboard focus is invisible on every filled primary button in the light theme |
| F-081 |  | present | XS | low | 2 |  | Minor | Connect | Connect's permission list gives no scope names and no link to How's full permission table |
| F-083 |  | present | XS | low | 2 |  | Minor | Connect | On Connect, keyboard focus reaches the permissions disclosure before the Sign in button |
| F-088 |  | present | XS | low | 2 |  | Minor | Plan | Plan empty states don't say which filter emptied the list and offer no way out: 'No steps match this search.' with nothing searched, and 'Nothing in this lane.' |
| F-090 |  | present | XS | low | 2 |  | Minor | Plan | Plan settings mixes instant-apply and Save, gives no confirmation, and says 'freeze' for 'Pause' |
| F-097 |  | present | XS | low | 2 |  | Minor | Plan | In forced colours, the selected tab, pressed toggles and the Readiness bar disappear |
| F-099 |  | present | XS | low | 2 |  | Minor | Plan | 'Plan settings' and 'How to use this plan' are links that act as toggles |
| F-112 |  | present | XS | low | 2 |  | Minor | Step | Defer dialog: focus starts on an icon named 'Cancel', and the disabled primary button gives no reason |
| F-115 |  | present | XS | low | 2 |  | Minor | Readiness | The Readiness CSV drops the Guest tag and gives no reason, department or last-seen date for each state |
| F-118 |  | present | XS | low | 2 |  | Minor | Readiness | Printing Readiness silently omits the people in collapsed groups |
| F-120 |  | present | XS | low | 2 |  | Minor | Readiness | The guest row has no real action and a contradictory 'best option' |
| F-121 |  | present | XS | low | 2 |  | Minor | Readiness | Personal (registered) Windows devices get opposite advice about Windows Hello for Business |
| F-129 |  | present | XS | low | 2 |  | Minor | Export | The prompt list shows titles only; the 68,000-character prompt gives no size warning, and three steps are cut mid-instruction |
| F-138 |  | present | XS | low | 2 |  | Minor | Inventory | Inventory's 'distinct users' note says Readiness can count more, but Readiness counts fewer (30 against 34) |
| F-146 |  | present | XS | low | 2 |  | Minor | Shell | No skip link: every page starts with the header, and the first Plan step is the 25th Tab stop |
| F-148 |  | present | XS | low | 2 |  | Minor | Shell | The theme stops following the computer's light/dark setting after the first visit |
| F-156 |  | present | XS | low | 2 |  | Minor | Inventory | Inventory heading outline skips a level and the info button is part of the heading |
| F-164 |  | present | XS | low | 2 |  | Minor | Export (mock) | The wrong-tenant message names only display names, so two tenants with the same name read 'made for Contoso Pty Ltd, and you are connected to Contoso Pty Ltd. Nothing was loaded.' |
| F-170 |  | present | XS | low | 2 |  | Minor | Plan (mock) | During a rescan, Plan shows one small grey line that scrolls away, and nothing says the tiles and evidence may change |
| OWN-X1 |  | present | XS | low | 2 |  | own | Export | Export claims JSON/PowerShell are on each policy step |
| F-066 |  | present | XS | medium | 2 | yes | Minor | Decision | Emergency access accounts can be picked as service or shared-device accounts, and the card that offers them says they are already out |
| F-100 |  | present | XS | medium | 2 | yes | Minor | Step | The admin-center instructions sit in an inner scroll box that hides the last steps, in the smallest text on the step |
| F-104 |  | present | XS | medium | 2 | yes | Minor | Step | A key model added to the list is silently lost unless a second Save is pressed |
| F-108 |  | present | XS | medium | 2 | yes | Minor | Step | The service-accounts step says 'the accounts you picked' before anything was picked |
| F-114 |  | present | XS | medium | 2 | yes | Minor | Decision | The account picker says '8 results' when more match, and already-picked accounts vanish from search |
| F-152 |  | present | XS | medium | 2 | yes | Cosmetic | Plan | A decision row's due date has no 'Est.', so it reads like a completion date |
| OWN-I1 |  | present | XS | medium | 2 |  | own | Inventory | Inventory is not in the top nav |
| OWN-W7 |  | present | XS | medium | 2 | yes | own | Step | Completed steps still say 'After making changes, select Scan to update the plan.' |
| F-025 |  | present | S | low | 2 |  | Minor | Shell | No multi-tenant path: the tenant is barely visible, there is no switcher or guidance, and every artefact is tied to one tenant |
| F-026 |  | present | S | low | 2 |  | Minor | Home | The home page promises an inspectable baseline version but shows none and links nowhere |
| F-027 |  | present | S | low | 2 |  | Minor | Plan | Plan search matches step titles only, so the people, accounts and policy names shown inside steps return nothing, and the empty state points nowhere |
| F-028 |  | present | S | low | 2 |  | Minor | Plan | After a scan the page jumps to the top, and 'what changed' is a truncated sentence that cannot be expanded or exported |
| F-039 |  | present | S | low | 2 | yes | Minor | Step | Script and payload style varies between steps, and IAMAI writes an unexplained tag into policy descriptions |
| F-047 |  | present | S | low | 2 |  | Minor | Export | Export files carry no tenant or date in their names, and 'Accounts as CSV' saves as people.csv |
| F-052 |  | present | S | low | 2 |  | Minor | Shell | A step link or saved plan cannot be opened without that tenant loaded, and nothing says why |
| F-085 |  | present | S | low | 2 |  | Minor | Plan | A refresh drops the Plan's tab, search, Work type and tile filter |
| F-086 |  | present | S | low | 2 |  | Minor | Plan | Search says 'No steps match' or shows nothing when matches are inside a collapsed group or hidden as deferred |
| F-117 |  | present | S | low | 2 |  | Minor | Readiness | Legend states and list groups use different names, and the legend cannot be clicked |
| F-119 |  | present | S | low | 2 |  | Minor | Readiness | A person the Plan set aside ('Turn On Without Them') still shows as needing action on Readiness |
| F-126 |  | present | S | low | 2 |  | Minor | Export | Readiness CSVs share one name whatever they hold: the page's Export CSV follows the on-screen filter, the Export page's copy holds everyone, and nothing names the view, tenant or date |
| F-127 |  | present | S | low | 2 |  | Minor | Export | CSVs are hard to use in Excel: no UTF-8 marker, a sample-data sentence in column A of every row, mixed blanks and dashes, and different header names for the same field |
| F-130 |  | present | S | low | 2 |  | Minor | Export | The grounding bundle carries no dates, although its readme says it does |
| F-134 |  | present | S | low | 2 |  | Minor | How | No page links to the right part of How, and its sections can't be linked to |
| F-135 |  | present | S | low | 2 |  | Minor | How | 'Every check' leaves out the checks behind most steps |
| F-137 |  | present | S | low | 2 |  | Minor | Inventory | Inventory and MFA Readiness describe the same people's MFA state in different, undefined words |
| F-145 |  | present | S | low | 2 |  | Minor | Shell | The browser tab title never changes by page or tenant, and a surface change is not announced |
| F-163 |  | present | S | low | 2 |  | Minor | Shell (mock) | The Account menu doesn't behave like a menu from the keyboard: arrow keys do nothing, Escape from an item drops focus to the page, and the menu stays open after focus leaves |
| F-167 |  | present | S | low | 2 |  | Minor | Shell (mock) | During a scan and after a failed first scan, other pages still say 'Scan the tenant', Export tells a signed-in user to 'Connect a tenant first', and every link lands at the top of Connect with the Scan button off-screen |
| F-176 |  | present | S | low | 2 |  | Minor | Readiness (mock) | Without P1, Readiness says it can't be measured for anyone, then lists three people as measured and counts people 'who signed in' after saying no sign-ins were read |
| F-199 |  | present | S | low | 2 |  | Cosmetic | Readiness (mock) | Guest accounts appear under raw '#EXT#' sign-in names, which wrap to three lines in Readiness and repeat '(guest)' in the dormant list |
| OWN-F2 |  | present | S | low | 2 |  | own | Connect | Returning admin sees the full Connect hero + Global Reader explainer every visit |
| F-042 |  | present | S | medium | 2 | yes | Minor | Decision | An answer changed on a completed decision is thrown away silently if the user leaves without re-approving |
| F-043 |  | present | S | medium | 2 | yes | Minor | Decision | Labels a beginner cannot decode: an 'Inforcer' yes/no question with no explanation, and an 'AI Info' tab that is really a prompt to paste into an assistant |
| F-065 |  | present | S | medium | 2 |  | Minor | Step | After Defer, Put back, Approve answers, picker Done, chip removal or Scan, keyboard focus drops to the page body and the user's place is lost |
| F-084 |  | present | S | medium | 2 |  | Minor | Connect | After 'Leave the demo', Connect gives no sign that sample progress is kept, and the sample can't be reset |
| F-091 |  | present | S | medium | 2 |  | Minor | Plan | The Estimated finish (i) opens on hover, closes on click, and closes on Enter |
| F-098 |  | present | S | medium | 2 |  | Minor | Plan | Plan list rows and the Readiness person list look like tables but are not |
| F-113 |  | present | S | medium | 2 | yes | Minor | Decision | The decisions use five different patterns, and Save Countries gives no feedback |
| F-185 |  | present | S | medium | 2 |  | Minor | Plan | A plan left open doesn't notice time passing: two weeks on it still shows past 'Est.' dates and no stale-scan line, then every date jumps when you change page |
| F-188 |  | present | S | medium | 2 | yes | Major | Step (mock) | On a 5,000-seat tenant, '2,914 more' opens a 2,914-person list inside the step: the page grows from 5,500 to 132,000 px, with no search, paging, export or bottom collapse |
| OWN-W8 |  | present | S | medium | 2 | yes | own | Plan | 'Enforced' badge vs Entra's own word 'On' |
| OWN-W9 |  | present | S | medium | 2 | yes | own | Step | Same create appears in 3.6 and 7.3 |
| F-139 |  | present | M | low | 2 |  | Minor | Inventory | Inventory tables sort but can't be searched or filtered, unlike Plan and Readiness, and have small layout inconsistencies |
| F-050 |  | present | M | medium | 2 |  | Minor | Inventory | Inventory, the expert's best raw view, has no nav entry and no links to plan steps |
| F-122 |  | present | M | medium | 2 | yes | Minor | Readiness | Returning to MFA Readiness loses your place, an open person can't be linked, and a step opened from Readiness has no way back |
| F-140 |  | present | M | medium | 2 |  | Minor | Inventory | The sample data contradicts itself in places an expert will notice |
| F-192 |  | present | M | medium | 2 | yes | Minor | Step (mock) | Per-object instructions don't scale: 52 policies to edit by hand (156 numbered lines in a 370 px box) and 785 dormant accounts to disable one at a time, with no bulk path or tick-off |
| F-193 |  | present | M | high | 2 | yes | Major | Step (mock) | Review Overlapping Policies at 60 policies runs three overlap sets into one 250-word sentence and gives a single form for all of them |
| F-196 |  | present | L | medium | 2 |  | Minor | Step (mock) | Opening a step freezes the page for 1.8–6.5 s at 5,000 seats (0.15–0.34 s at 30 seats) with no loading state |
| OWN-D4 |  | present | L | high | 2 |  | own | Plan | Demo dates cluster on one day |
| F-054 |  | present | XS | low | 1 | yes | Cosmetic | Step | The 'Expand implementation' icon is an external-link glyph but opens an in-page overlay |
| F-132 |  | present | XS | low | 1 |  | Minor | Export | Printing the Plan screen with the browser cuts the Estimated finish tile to 'Est. Oct 2' |
| F-136 |  | present | XS | low | 1 |  | Minor | How | The 'What IAMAI reads' table in How cuts off its WHY column at 1024, 1280 and 1440 px |
| F-149 |  | present | XS | low | 1 |  | Cosmetic | Connect | Connect's permission table has a ragged second column squeezed into half the card |
| F-151 |  | present | XS | low | 1 |  | Cosmetic | Connect | Connect's status bar repeats step 1, and its dot sits below the text |
| F-153 |  | present | XS | low | 1 |  | Cosmetic | Plan | The Display time zone list shows UTC twice and raw zone IDs |
| F-154 |  | present | XS | low | 1 |  | Cosmetic | Step | Copied tasks are Markdown and include IDs the screen does not show |
| F-155 |  | present | XS | low | 1 |  | Cosmetic | Readiness | The two greens and the two browns in the readiness bar are almost the same colour |
| F-172 |  | present | XS | low | 1 |  | Minor | Shell (mock) | The error page's 'Start over' doesn't say what it does, and the way to report is plain text |
| F-197 |  | present | XS | low | 1 |  | Minor | Inventory (mock) | Unreadable groups show as 125 identical 'an unnamed group' rows in Inventory, while steps, pickers and the CSV use IDs such as g-003 that Inventory never shows |
| OWN-HOW |  | present | XS | low | 1 |  | own | How | How build stamp shows the UTC date |
| OWN-LI |  | present | XS | low | 1 |  | own | Shell | Footer 'Follow me on LinkedIn' is personal in a product footer |
| F-055 |  | present | XS | medium | 1 | yes | Cosmetic | Decision | Service-account names in decision chips wrap mid-name onto three lines ('svc- / mailer- / 1') |
| F-182 |  | present | S | low | 1 |  | Minor | Readiness (mock) | Without P1, Readiness still points into a plan that isn't there, and loses its only how-to link |
| F-198 |  | present | S | low | 1 |  | Minor | Readiness (mock) | After 'Show the next 50', keyboard focus stays on a button now 3,000 px off-screen, and the next Tab skips the 50 new rows |
| F-017 |  | partly | XS | low | 4 |  | Minor | Step | In the demo, 'Scan to update the plan' quietly switches to a pretend follow-up scan that completes work, and decisions, the user never did |
| F-002 |  | partly | S | medium | 4 | yes | Major | Step | Four places give four answers to 'are both emergency accounts outside the enforced MFA policy?', and 'Configure Emergency Exclusions' says 5 policies in one place and 4 in another |
| F-013 |  | partly | S | medium | 4 | yes | Major | Step | A deferral's required reason is never shown again (not on the step, the plan or the print), and deferring shrinks the progress total |
| F-018 |  | partly | S | medium | 4 |  | Major | Readiness | The Plan says 10 of 30 people are not ready; the linked MFA Readiness page, its CSV and the print say 21, 25 or 26, and no count names its bar |
| F-078 |  | partly | XS | low | 3 |  | Minor | Shell | The demo, Connect and How never say how to remove the tenant data kept in this browser |
| F-147 |  | partly | XS | low | 3 |  | Minor | Shell | Switching from a scrolled Plan to MFA Readiness keeps the old scroll offset, and Readiness has no sticky header, so the page opens mid-list with no heading or navigation |
| F-035 |  | partly | XS | medium | 3 | yes | Minor | Step | Completion criteria and the AI briefing contain contradictions and stray text: 'except Core - Exclusions and Break-glass 1', 'for guests except Core - Exclusions and guests', and a stray 'strong:' line |
| F-166 |  | partly | S | low | 3 |  | Minor | Connect (mock) | The scan wait shows only the current section and elapsed seconds; the read-only line disappears, nothing says whether you can leave, and Stop or a reload silently discards the scan |
| F-174 |  | partly | S | low | 3 |  | Major | Export (mock) | Without P1, the calendar, prompts and bundle still export a 'Conditional Access rollout' that the screen says doesn't exist, including work that needs P1 |
| F-175 |  | partly | S | low | 3 |  | Major | Plan (mock) | Without P1, Conditional Access policies that still exist and still enforce MFA are ignored |
| F-180 |  | partly | S | low | 3 |  | Minor | Plan (mock) | A tenant with no policies and security defaults off is never told nobody is asked for MFA today, and the print counts an empty exclusions step as 'in place' |
| F-001 |  | partly | S | medium | 3 | yes | Minor | Step | 'Up Next' steps give go-live and exclusion-removal instructions, plus a script that writes to the tenant, and never say 'not yet' |
| F-012 |  | partly | S | medium | 3 | yes | Major | Step | Report-only evidence is one unquantified sentence, so 'nothing was evaluated' reads the same as 'safe to enforce' |
| F-020 |  | partly | S | medium | 3 |  | Major | Export | No export says when a policy is turned on: the calendar holds 7–8 eight-day blocks for Ready preparation steps only, and the print has no per-step dates |
| F-060 |  | partly | S | medium | 3 | yes | Minor | Step | One click on 'Everyone works remotely' inside Define the Trusted Network answers a decision, removes 5 steps and makes the open step vanish, with no confirmation or undo |
| F-064 |  | partly | S | medium | 3 | yes | Major | Step | Inventory shows two accounts using legacy authentication; the Block Legacy Authentication step names only one |
| F-072 |  | partly | S | medium | 3 | yes | Major | Readiness | The same person is given different next steps on MFA Readiness, Prepare Your Team for MFA and Require MFA to Register a Device |
| F-105 |  | partly | S | medium | 3 | yes | Minor | Step | Completing a step leaves no 'what next', and the confirmation appears off-screen |
| F-110 |  | partly | S | medium | 3 | yes | Minor | Step | Passkey model decision needs raw AAGUIDs typed in; the affected model cannot be approved from its card |
| OWN-W4 |  | partly | S | medium | 3 | yes | own | Step | 4.3 leads with weakening a stricter admin policy |
| F-191 |  | partly | M | high | 3 | yes | Major | Step (mock) | Require MFA for Everyone blocks on 53 raw group IDs, says 'scan again', and then turns Completed after the next scan while the panel still says Blocked |
| F-183 |  | partly | L | high | 3 | yes | Major | Plan | Weeks later the plan silently re-dates every unfinished step to today: nothing reads overdue, the finish slides, and the (i) blames report-only for the slip |
| F-015 |  | partly | XS | low | 2 |  | Minor | Step | Policy JSON and PowerShell exist on only 8 of 19 policy steps, not on the two core MFA policies, and vanish when a step is deferred, though Export says they are on each step |
| F-087 |  | partly | XS | low | 2 |  | Minor | Plan | Group headers and tab badges don't follow the active filters |
| F-089 |  | partly | XS | low | 2 |  | Minor | Plan | Work type categories leave policy work out of 'Conditional Access', and the select has no label |
| F-128 |  | partly | XS | low | 2 |  | Minor | Export | Redaction differs by export, and the bundle's switch gives no sign of which version will download |
| F-141 |  | partly | XS | low | 2 |  | Minor | Shell | Before sign-in the planner shows no navigation, and How is a dead end from the home page |
| F-005 |  | partly | XS | medium | 2 |  | Minor | Plan | The demo path never shows the 'Public beta — check every script' caveat or the '1 section was not read in full' notice; both live only on Connect |
| F-069 |  | partly | XS | medium | 2 | yes | Minor | Decision | 'Everyone works remotely' silently undoes the service-accounts decision: service accounts and the Teams Room fall under MFA for Everyone |
| F-106 |  | partly | XS | medium | 2 |  | Minor | Step | An open step can be closed only from its row header: no Close control in the panel, and Esc does nothing |
| F-107 |  | partly | XS | medium | 2 | yes | Minor | Step | Prepare Your Team says the registration campaign is already on, then tells you to turn it on |
| F-111 |  | partly | XS | medium | 2 | yes | Minor | Step | The admin MFA step has no Readiness hand-off, and its Readiness view gives a misleading reason |
| F-049 |  | partly | S | low | 2 |  | Minor | Inventory | The exclusions group the plan calls 'Verified' is missing from Inventory's 'Everything the scan read' and from the Groups CSV |
| F-074 |  | partly | S | low | 2 |  | Minor | Readiness | After a Follow-up scan the numbers change with no explanation of who moved, including a silent regression |
| F-102 |  | partly | S | low | 2 | yes | Minor | Step | The cleanup steps look like a different product, and the overlap review form is unstyled and opaque |
| F-123 |  | partly | S | low | 2 |  | Minor | Readiness | The Readiness Details drawer lets focus leave while it stays open, covers focusable controls at 1024–1280, and hides device join state from keyboard users |
| F-165 |  | partly | S | low | 2 |  | Major | Plan (mock) | When Conditional Access policies can't be read, the plan still says 'Ready', tells you to create policies and a trusted location that already exist, and nothing on Plan, Export or the printed plan says so |
| F-059 |  | partly | S | medium | 2 |  | Minor | Plan | Most state changes are silent to assistive technology |
| F-093 |  | partly | S | medium | 2 | yes | Minor | Plan | IMPACT mixes units (steps, people, text labels) and counts the same population three ways |
| F-189 |  | partly | S | medium | 2 |  | Major | Export (mock) | At 5,000 seats the printed plan runs to 354 pages, 262 of them name lists, with the same 2,919 people printed twice |
| F-038 |  | partly | S | high | 2 |  | Minor | Step | 'Align Policy Names' forces the baseline's names, can't be deferred, and sets the plan's finish date |
| F-009 |  | partly | L | medium | 2 | yes | Minor | Step | The 'Differs from the Baseline' block appears on one policy step; other gaps, and the user's own narrowing, show only as small inline grey text or not at all |
| F-029 |  | partly | XS | low | 1 |  | Minor | Plan | Display time zone resets to UTC after reload and changes nothing visible |
| F-053 |  | partly | XS | low | 1 |  | Cosmetic | Home | Home header 'Dark theme' is larger and off-baseline, and the release stage is 'Free public preview' on Home but 'Public beta' on Connect |
| F-142 |  | partly | XS | low | 1 |  | Minor | Shell | Home page and planner feel like two products at the seam |
| F-101 |  | partly | XS | medium | 1 | yes | Minor | Step | Instructions name controls the step doesn't have: a Service accounts group picker, a Done shown only inside the open list, and 'Mark as done' |
| F-181 |  | partly | S | low | 1 |  | Minor | Inventory (mock) | Without P1, Inventory says everyone holds P1 and shows recent sign-ins, while Licensing says no P1 and How says those dates need P1; every registered method becomes 'Possibly broken' |
| F-082 |  | partly | S | medium | 1 |  | Minor | Connect | Connect repeats the full marketing hero and beta notice even after a scan |
| F-158 |  | partly | S | medium | 1 | yes | Cosmetic | Shell | Capitalisation switches between Title Case, sentence case and mixed forms |
| F-159 |  | partly | M | medium | 1 | yes | Cosmetic | Shell | Layout rhythm and control styles vary between surfaces |
| F-190 |  | partly | M | medium | 1 |  | Major | Export (mock) | Print, 'Download every prompt', 'See the prompts' and the masked bundle freeze the tab for 12–33 s at 5,000 seats, with no busy state |
| F-194 |  | unclear | M | high | 3 |  | Major | Export (mock) | Loading an unchanged plan file removes 3 steps and moves the finish date 7 weeks earlier until the next reload |
| F-179 |  | unclear | M | high | 2 | yes | Minor | Step (mock) | With no existing policies, 'Require MFA for Everyone' gives two creation dates and two go-live bars |
| F-173 |  | intentional | XS | low | 3 |  | Major | Plan (mock) | Without Entra ID P1 the Plan is one sentence: no security defaults route, no steps that need no licence, no link to MFA Readiness |
| F-011 |  | intentional | S | medium | 3 | yes | Major | Step | Rollback, blast radius and 'what could go wrong' appear only in the printed plan, never on screen |
| F-008 |  | intentional | XS | medium | 2 | yes | Minor | Step | 'Require Phishing-Resistant MFA for Admins' tells you, by default, to replace the stricter Phishing-resistant strength with the baseline's Modern MFA + TAP |
| F-014 |  | intentional | XS | medium | 2 | yes | Minor | Step | Steps that correct an existing policy also offer to create a second, baseline-named one, and an existing guest MFA policy is ignored |
| F-048 |  | intentional | S | low | 2 |  | Minor | How | The How page has no glossary for the words the plan relies on |
| F-124 |  | intentional | S | low | 2 |  | Minor | Export | Printed plan lists the decisions as Completed but not the answers |
| F-096 |  | intentional | S | medium | 2 |  | Minor | Plan | Answered decisions collapse into 'All 3 completed' behind a small +, which makes changing your mind hard to find |
| F-103 |  | intentional | XS | low | 1 | yes | Minor | Step | Policy names to type by hand mix en dashes and hyphens |
| F-131 |  | intentional | XS | low | 1 |  | Minor | Export | Export page: most formats are hidden behind a small 'Additional Formats' toggle, several buttons look disabled, and a download gives no confirmation |
| F-157 |  | intentional | XS | low | 1 |  | Cosmetic | Shell | The theme switch reads like a status ('Dark theme' while light is on) and exposes no pressed state |
| F-187 |  | intentional | XS | low | 1 |  | Minor | Shell | In the demo every reload silently re-runs the scan as of now, so the scan never ages and the sample's dates shift under your saved decisions |
| F-030 |  | intentional | XS | medium | 1 | yes | Minor | Plan | Emergency-access safeguards sit after the rollout: the print files 'Verify Emergency Access' under Cleanup, and 'Alert on Emergency Account Sign-ins' waits for 'After security rollout' with no reason |
| F-046 |  | intentional | XS | medium | 1 |  | Minor | Export | On Export, the '?' beside the plan-file tip hides the tip instead of explaining it |
| F-150 |  | intentional | XS | medium | 1 |  | Cosmetic | Connect | In dark theme the primary action looks almost like the secondary one |
| F-133 |  | intentional | S | low | 1 |  | Cosmetic | Export | The plan file uses internal goal names and statuses rather than the screen's words |
| F-178 |  | intentional | M | high | 1 | yes | Minor | Plan (mock) | When the signed-in admin looks dormant, admin policies show 'No user impact' and the admin vanishes from Readiness |
| F-024 |  | intentional | L | low | 1 |  | Minor | Export | No whole-plan policy export for baselines-as-code, and the Policies CSV has no baseline mapping |
| F-019 |  | fixed | XS | low | 1 |  | Minor | Export | Nothing gives a short status or client summary: the print's 'one-page summary' is a paragraph of 30+ step names, followed by about 98 pages of runbook |
| F-022 |  | superseded | XS | low | 1 |  | Major | Export | The printed plan runs alternative tasks together as one sequence (create a new MFA policy, then correct the existing one, then turn it on) |
| F-045 |  | superseded | XS | low | 1 |  | Minor | Export | The printed plan keeps live controls and IAMAI-only instructions, prints 'Learn →' links with no URL, and drops policy names from evidence rows |
| F-076 |  | superseded | XS | low | 1 |  | Major | Export | Printed plan: the page footer is printed over body text on 17 of 102 pages, including the lockout-recovery PowerShell command |
| F-125 |  | superseded | XS | low | 1 |  | Minor | Export | The printed plan wastes pages and strands headings: a blank page, a page per phase heading, and a Contents list with no page numbers in a 102-page document |

## Prompt for the next chat

Copy everything in the block below into a new chat, opened in `C:\Dev\IAMAI`. Change `ROUND` to the round you want.

```text
We're working the low-hanging-fruit backlog in docs/plans/2026-09-27-low-hanging-fruit.md
(and its -backlog.json). ROUND = 2.

Read that plan first, then CLAUDE.md's rules as always. Don't read the whole backlog
JSON into context: filter it with a small node script.

1. Pick the round's ten (skip if the plan already lists this round's ten as approved).
   - Start from the plan's "Round N" candidates, then the backlog: status present or
     partly, effort XS or S, highest reward first, low risk before medium.
   - Leave out anything already done in an earlier round (git log, the plan's round
     notes) and anything the plan lists under "Not low-hanging".
   - Re-verify every candidate before presenting it. Code moves, and the audits ran on
     55017e4.
     - Code: read the files the fix sketch names at HEAD.
     - Screen: check it live, solo, in the built-in browser on
       https://getiamai.com/planner/?demo=1, or on the owner's tenant in Claude in Chrome
       (read-only: never click Forget, Sign out, Scan or any save).
     - A finding that no longer reproduces is marked fixed in the plan and replaced.
   - For full detail on an F-* finding (steps, expected, actual, verifier notes), read
     C:\Users\Owner\Downloads\IAMAI UX Audit.zip (index.html, the JSON in
     <script id="data">). Extract it to your scratchpad.
   - Present the ten to the owner as low-hanging fruit: one line each on what's wrong
     (as verified today), the fix, effort, risk, and whether it reaches a finished step.
     Recommend an order.

2. Build them one at a time. The owner approves every fix.
   - Before each fix: say what the reader sees now, what they'll see after, and which
     finished screens it touches. For wording on an approved step, show the exact new
     words. Wait for a yes.
   - Build on one branch per round from origin/main (fix/low-hanging-N).
   - Words come from docs/design/content.json. Name added, removed and edited keys in
     the commit message.
   - Each fix gets a unit test that fails before the fix and passes after. Run
     `npm run verify -- <the test files>`. Commit per fix, plain message.
   - If a fix turns out bigger or riskier than sized, stop and say so. Don't widen it.

3. Close the round.
   - Run `NODE_OPTIONS=--max-old-space-size=14000 npm test` once, and
     `npm run verify -- --prepush <the round's test files>`.
   - Run a review workflow over the round's diff (ultracode: reviews only; audits stay
     solo).
   - Ask the owner before pushing. After deploy-pages finishes, re-check every fix
     live and report what you saw.
   - Update the plan: mark the round done (commits, what was verified live), list the
     next round's candidates, and keep this prompt current. Commit that update with
     the round.

Standing rules:
- Read-only product.
- Never commit tenant data (UPNs, object ids, tenant GUIDs).
- Never say "couldn't read".
- Exact controls: every difference is corrected or accepted with a reason.
- The pinned baseline wins.
- Don't run the walk.
- Stop idle servers and agents when done.
- Ring the chime (bash "$HOME/.claude/hooks/chime.sh" call "<reason>") when the owner
  must look.
```
