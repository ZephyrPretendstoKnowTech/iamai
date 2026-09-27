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

Ranked by the same rubric, all from Needs attention. The next round re-verifies
these against main and live, then picks ten. F-143, OWN-W6 and OWN-I1 moved to
Review later.

| ID | Fix | Effort | Risk | Frozen |
|---|---|---|---|---|
| F-017 | In the demo, Scan switches to the follow-up scan: say so in the banner | XS | low | |
| F-002 | Configure Emergency Exclusions: 4 policies vs 5. Fixture row lacks `excludeGroups: []`; fix it and the cleanup "why" | S | medium | yes |
| F-003, OWN-W3 | Legend gets the second words (Create, Correct, Decision, Review, Turn on) and the Report-only/Enforced chips; the Observing tile's word matches its row | XS | low | |
| OWN-W2 | "Waiting on your answers in {step}": name the question (planBoard.ts holdLabelOf) | S | medium | |
| F-044 | Readiness headline "4 of 30 (29 people and 1 guest) are ready…" | XS | low | |
| F-007 | × on an emergency account saves at once: hold removals until Done | S | medium | yes |
| F-010 | The exclusions step's AI brief says no group exists while one is chosen | S | medium | yes |
| F-013 | A deferral's reason is shown again, on its card and in the print's Set aside list | S | medium | yes |
| F-057 | A cancelled or failed sign-in leaves Sign in spinning: clear the busy state and keep the consent text | S | medium | |
| OWN-X1 | Export: "a policy's JSON and PowerShell are on its step while it is still to create or correct" | XS | low | |
| OWN-W5 | 5.9: say how a medium-risk flag clears (the person changes their password, or the risk is dismissed) | S | medium | |
| OWN-W7 | Completed steps drop "After making changes, select Scan…" | XS | medium | yes |
| F-012 | Report-only's "blocked no one" states its numbers and days | S | medium | yes |
| F-016 | Troubleshooting speaks to the user; TAP first; "Close", not "Minimize" | S | medium | yes |
| F-018 | The Plan says 10 of 30 aren't ready, the linked Readiness page 21–26: scope the link to the step's people and name the bar | S | medium | |
| F-184 | A briefing from an old scan carries the screen's "Scan again before acting" warning | XS | low | |
| F-062 | 4.3's "Select (45)" role list reads as unticking Global Administrator: reword | XS | medium | yes |
| F-144 | The demo's Initial / Follow-up switch looks like a switch and says what it is | XS | low | |

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

## Needs attention (89)

Everything here is worth fixing: a real user is misled, put at risk, blocked or
meaningfully slowed on a path they actually take. Each round picks its ten from
this list only. Sorted by reward, then effort. The fix sketch and files for each
item are in the -backlog.json.

| ID | Round | Status | Effort | Risk | Reward | Frozen | Surface | Finding |
|---|---|---|---|---|---|---|---|---|
| F-017 |  | partly | XS | low | 4 |  | Step | In the demo, 'Scan to update the plan' quietly switches to a pretend follow-up scan that completes work, and decisions, the user never did |
| F-061 | 1 | present | XS | medium | 4 | yes | Step | The step 'AI Info' copy carries sign-in addresses, object IDs and the tenant name with no purpose line, warning or redaction, though Export says every copied prompt is masked |
| F-068 | 1 | present | XS | medium | 4 | yes | Decision | 'SharePoint and OneDrive from outside the office: Yes' keeps a policy that blocks SharePoint outside the office |
| F-070 | 1 | present | XS | medium | 4 | yes | Decision | 'Recurring travel countries' looks like an allowlist but does nothing, so travellers will be blocked |
| F-002 |  | partly | S | medium | 4 | yes | Step | Four places give four answers to 'are both emergency accounts outside the enforced MFA policy?', and 'Configure Emergency Exclusions' says 5 policies in one place and 4 in another |
| F-004 | 1 | present | S | low | 4 |  | Plan | Estimated rollout is '9 weeks' on Connect and '5 weeks / Est. Oct 29' on the Plan, and the finish tip credits a step dated Oct 5 |
| F-007 |  | present | S | medium | 4 | yes | Step | One click on the × beside an emergency account saves at once, survives reload, removes a plan step and turns the exclusions advice into 'remove Break-glass 2', with no Done, confirmation or undo |
| F-013 |  | partly | S | medium | 4 | yes | Step | A deferral's required reason is never shown again (not on the step, the plan or the print), and deferring shrinks the progress total |
| F-016 |  | present | S | medium | 4 | yes | Step | Troubleshooting opens with 'IAMAI is about to configure…' in internal runbook language, and the section the step points to is last of eight |
| F-018 |  | partly | S | medium | 4 |  | Readiness | The Plan says 10 of 30 people are not ready; the linked MFA Readiness page, its CSV and the print say 21, 25 or 26, and no count names its bar |
| F-057 |  | present | S | medium | 4 |  | Connect | After a cancelled or failed Microsoft sign-in, the Sign in button spins forever, ignores clicks, and the admin-consent guidance disappears |
| F-071 | 1 | present | S | low | 4 |  | Readiness | Every 'Not counted' link on MFA Readiness opens an empty list |
| F-160 | 1 | present | S | low | 4 |  | Shell (mock) | Forget this tenant deletes the whole plan on one click: no confirmation, no list of what goes, no offer to save the plan file, no undo and no message afterwards |
| OWN-B3 | 1 | present | S | low | 4 |  | Readiness | Demo MFA Readiness shows banned 'couldn't read' phrasing |
| OWN-R1 | 1 | present | S | medium | 4 |  | Readiness | MFA Readiness 'Nobody needs action' while a person lapses in 7 days |
| OWN-W1 | 1 | present | S | low | 4 |  | Plan | Plan board names no next action (no 'Next up') |
| OWN-W2 |  | present | S | medium | 4 |  | Plan | Rows say 'Waiting on your answers' without naming the question |
| F-161 |  | present | M | high | 4 |  | Shell | Two open tabs silently overwrite each other: the tab that saves last replaces the whole plan, even undoing a plan file the other tab just loaded |
| F-006 |  | present | L | high | 4 | yes | Plan | A saved change freeze has no visible effect on the plan rows, the finish tip, the PDF or the calendar |
| F-003 |  | present | XS | low | 3 |  | Plan | Tile counts and state words don't match the rows, and the legend defines only half of them: 'Needs your input 6' against 11 'Waiting on your answers' rows, an 'Observing' tile whose row says 'On Hold · Report-only', and undefined 'Correct' and 'Enforced' |
| F-035 |  | partly | XS | medium | 3 | yes | Step | Completion criteria and the AI briefing contain contradictions and stray text: 'except Core - Exclusions and Break-glass 1', 'for guests except Core - Exclusions and guests', and a stray 'strong:' line |
| F-041 |  | present | XS | medium | 3 | yes | Decision | Exempting partner and MSP technicians is suggested 'Yes', and the baseline's version is not shown at the decision |
| F-044 |  | present | XS | low | 3 |  | Readiness | The MFA Readiness headline reads as if 29 people and a guest are ready |
| F-062 |  | present | XS | medium | 3 | yes | Step | 'Require Phishing-Resistant MFA for Admins' says 'change the Directory roles selection as listed below. Select (45)', and the list leaves out Global Administrator |
| F-063 |  | present | XS | medium | 3 | yes | Step | 'Set up Windows Hello for Business' rows have no how-to in the Plan step they link to |
| F-078 |  | partly | XS | low | 3 |  | Shell | The demo, Connect and How never say how to remove the tenant data kept in this browser |
| F-092 |  | present | XS | high | 3 | yes | Plan | A 'Ready' step is dated a month out and sits at the very bottom of the plan |
| F-144 |  | present | XS | low | 3 |  | Shell | The demo's 'Initial scan / Follow-up scan' switch is unexplained, and its styling is backwards: the selected option looks like a link and the other barely looks clickable |
| F-147 |  | partly | XS | low | 3 |  | Shell | Switching from a scrolled Plan to MFA Readiness keeps the old scroll offset, and Readiness has no sticky header, so the page opens mid-list with no heading or navigation |
| F-168 |  | present | XS | low | 3 |  | Shell (mock) | Plan, MFA Readiness and Export in the header stop working before the first scan and during every rescan, look the same as live links, and say 'after the first scan' even when a plan exists |
| F-184 |  | present | XS | low | 3 |  | Export | A printed plan made from an old scan drops the screen's 'Scan again before acting' warning |
| F-195 |  | present | XS | medium | 3 |  | Export (mock) | The 'masked' calendar and prompts file keep guest sign-in addresses in full (43 in the calendar at 5,000 seats) |
| OWN-ACCEPT | 1 | present | XS | medium | 3 | yes | Step | Owner ask: the Completed 'Difference Accepted' panel repeats fluff |
| F-001 |  | partly | S | medium | 3 | yes | Step | 'Up Next' steps give go-live and exclusion-removal instructions, plus a script that writes to the tenant, and never say 'not yet' |
| F-010 |  | present | S | medium | 3 | yes | Step | The AI Info brief for 'Configure Emergency Exclusions' says no exclusions group exists, while the same card shows the group as selected and verified |
| F-012 |  | partly | S | medium | 3 | yes | Step | Report-only evidence is one unquantified sentence, so 'nothing was evaluated' reads the same as 'safe to enforce' |
| F-023 |  | present | S | medium | 3 |  | Export | Loading a plan file silently replaces current decisions and recorded deferrals, with no preview, warning or summary of what came back |
| F-036 |  | present | S | high | 3 | yes | Step | 'Configure Passkey Authentication' names one account as affected and a different account as the one that would be locked out |
| F-037 |  | present | S | medium | 3 | yes | Step | The Email tab's single Copy button copies the staff, admin and follow-up emails as one blob, signed 'IT', in a code-style monospace box |
| F-040 |  | present | S | medium | 3 |  | Decision | Approving a decision jumps to the next one while the 'steps removed' note sits off-screen, focus is lost, and a removed review step is never listed |
| F-051 |  | present | S | medium | 3 |  | Shell | Opening a step replaces the history entry, so Back skips the plan or leaves IAMAI, and the demo's Follow-up scan resets on reload |
| F-056 |  | present | S | medium | 3 | yes | Decision | You can mark your own admin account as a printer: it is the first search result, nothing warns, and approving takes it out of admin MFA |
| F-058 |  | present | S | low | 3 |  | Connect | '1 section was not read in full … check what is listed under Scan' leads to a row that explains nothing |
| F-064 |  | partly | S | medium | 3 | yes | Step | Inventory shows two accounts using legacy authentication; the Block Legacy Authentication step names only one |
| F-067 |  | present | S | medium | 3 | yes | Decision | Confirm What You Use explains only one direction of each choice, so the other answer's effect is invisible, including an MSP lockout risk |
| F-072 |  | partly | S | medium | 3 | yes | Readiness | The same person is given different next steps on MFA Readiness, Prepare Your Team for MFA and Require MFA to Register a Device |
| F-073 |  | present | S | medium | 3 |  | Readiness | 'Couldn't read' has no usable next step: 'Nothing to do' stays after a rescan |
| F-075 |  | present | S | low | 3 |  | Readiness | Jamie Brown's row says to use a passkey that the drawer says will stop working |
| F-077 |  | present | S | low | 3 |  | Export | 'Summarise this plan for a non-technical business owner' prompt is grounded only on five cleanup items, with no MFA step in it |
| F-095 |  | present | S | medium | 3 |  | Plan | The demo's Follow-up scan gives different results on repeat visits and shows the Initial scan's timestamp |
| F-116 |  | present | S | low | 3 |  | Readiness | Search leaves matches hidden in collapsed groups and gives a dead-end empty state |
| F-177 |  | present | S | high | 3 | yes | Step (mock) | The Plan tells the signed-in admin, the only Global Administrator, to disable their own account as dormant |
| F-180 |  | partly | S | low | 3 |  | Plan (mock) | A tenant with no policies and security defaults off is never told nobody is asked for MFA today, and the print counts an empty exclusions step as 'in place' |
| F-186 |  | present | S | medium | 3 |  | Connect | Connect says 'Ready to plan' for a 40-day-old scan while every other page says to scan again, and the warning is a small grey line that never escalates |
| OWN-W5 |  | present | S | medium | 3 |  | Step | 5.9 Reset Passwords for Medium-Risk Users has no path forward |
| F-183 |  | partly | L | high | 3 | yes | Plan | Weeks later the plan silently re-dates every unfinished step to today: nothing reads overdue, the finish slides, and the (i) blames report-only for the slip |
| F-005 |  | partly | XS | medium | 2 |  | Plan | The Plan never says it was built on a partial read (the beta-caveat half is dropped: the banner was removed on purpose) |
| F-034 |  | present | XS | low | 2 |  | Plan | At 1024px wide the plan tabs overlap ('Up Next 8On Hold') and the On Hold count is cut off |
| F-066 |  | present | XS | medium | 2 | yes | Decision | Emergency access accounts can be picked as service or shared-device accounts, and the card that offers them says they are already out |
| F-069 |  | partly | XS | medium | 2 | yes | Decision | 'Everyone works remotely' silently undoes the service-accounts decision: service accounts and the Teams Room fall under MFA for Everyone |
| F-079 |  | present | XS | low | 2 | yes | Shell | Keyboard focus is invisible on every filled primary button in the light theme |
| F-088 |  | present | XS | low | 2 |  | Plan | Plan empty states don't say which filter emptied the list and offer no way out: 'No steps match this search.' with nothing searched, and 'Nothing in this lane.' |
| F-089 |  | partly | XS | low | 2 |  | Plan | Work type categories leave policy work out of 'Conditional Access', and the select has no label |
| F-100 |  | present | XS | medium | 2 | yes | Step | The admin-center instructions sit in an inner scroll box that hides the last steps, in the smallest text on the step |
| F-104 |  | present | XS | medium | 2 | yes | Step | A key model added to the list is silently lost unless a second Save is pressed |
| F-107 |  | partly | XS | medium | 2 | yes | Step | Prepare Your Team says the registration campaign is already on, then tells you to turn it on |
| F-108 |  | present | XS | medium | 2 | yes | Step | The service-accounts step says 'the accounts you picked' before anything was picked |
| F-111 |  | partly | XS | medium | 2 | yes | Step | The admin MFA step has no Readiness hand-off, and its Readiness view gives a misleading reason |
| F-114 |  | present | XS | medium | 2 | yes | Decision | The account picker says '8 results' when more match, and already-picked accounts vanish from search |
| F-120 |  | present | XS | low | 2 |  | Readiness | The guest row has no real action and a contradictory 'best option' |
| F-121 |  | present | XS | low | 2 |  | Readiness | Personal (registered) Windows devices get opposite advice about Windows Hello for Business |
| F-128 |  | partly | XS | low | 2 |  | Export | Redaction differs by export, and the bundle's switch gives no sign of which version will download |
| F-138 |  | present | XS | low | 2 |  | Inventory | Inventory's 'distinct users' note says Readiness can count more, but Readiness counts fewer (30 against 34) |
| F-152 |  | present | XS | medium | 2 | yes | Plan | A decision row's due date has no 'Est.', so it reads like a completion date |
| OWN-W7 |  | present | XS | medium | 2 | yes | Step | Completed steps still say 'After making changes, select Scan to update the plan.' |
| OWN-X1 |  | present | XS | low | 2 |  | Export | Export claims JSON/PowerShell are on each policy step |
| F-028 |  | present | S | low | 2 |  | Plan | After a scan the page jumps to the top, and 'what changed' is a truncated sentence that cannot be expanded or exported |
| F-042 |  | present | S | medium | 2 | yes | Decision | An answer changed on a completed decision is thrown away silently if the user leaves without re-approving |
| F-047 |  | present | S | low | 2 |  | Export | Export files carry no tenant or date in their names, and 'Accounts as CSV' saves as people.csv |
| F-086 |  | present | S | low | 2 |  | Plan | Search says 'No steps match' or shows nothing when matches are inside a collapsed group or hidden as deferred |
| F-091 |  | present | S | medium | 2 |  | Plan | The Estimated finish (i) opens on hover, closes on click, and closes on Enter |
| F-117 |  | present | S | low | 2 |  | Readiness | Legend states and list groups use different names, and the legend cannot be clicked |
| F-123 |  | partly | S | low | 2 |  | Readiness | The Readiness Details drawer lets focus leave while it stays open, covers focusable controls at 1024–1280, and hides device join state from keyboard users |
| F-127 |  | present | S | low | 2 |  | Export | CSVs are hard to use in Excel: no UTF-8 marker, a sample-data sentence in column A of every row, mixed blanks and dashes, and different header names for the same field |
| F-130 |  | present | S | low | 2 |  | Export | The grounding bundle carries no dates, although its readme says it does |
| F-135 |  | present | S | low | 2 |  | How | 'Every check' leaves out the checks behind most steps |
| F-137 |  | present | S | low | 2 |  | Inventory | Inventory and MFA Readiness describe the same people's MFA state in different, undefined words |
| F-140 |  | present | M | medium | 2 |  | Inventory | The sample data contradicts itself in places an expert will notice |
| F-101 |  | partly | XS | medium | 1 | yes | Step | Instructions name controls the step doesn't have: a Service accounts group picker, a Done shown only inside the open list, and 'Mark as done' |

## Not worth fixing / review later (130)

Kept out of the rounds.
- **Drop (42):** not worth building. Already fixed or gone, an
  owner decision that stands, or cosmetic.
- **Merged (4):** the same defect as another item, tracked there.
- **Review later (84):** real, but parked until its trigger
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
| F-049 | Review later | An owner decision: Inventory lists only policy-referenced groups by design; revisit so the plan's own exclusions group always appears. | The exclusions group the plan calls 'Verified' is missing from Inventory's 'Everything the scan read' and from the Groups CSV |
| F-060 | Review later | An owner decision: The one-click answer is deliberate; revisit a confirm, since it removes five steps and marks a decision approved. | One click on 'Everyone works remotely' inside Define the Trusted Network answers a decision, removes 5 steps and makes the open step vanish, with no confirmation or undo |
| F-124 | Review later | An owner decision: The briefing could carry one line per answer; revisit if a manager or board asks why a policy is in or out. | Printed plan lists the decisions as Completed but not the answers |
| F-173 | Review later | An owner decision: The no-P1 refusal is an owner decision in a state no real tenant has shown; revisit naming security defaults when one does. | Without Entra ID P1 the Plan is one sentence: no security defaults route, no steps that need no licence, no link to MFA Readiness |
| F-178 | Review later | An owner decision: Same root as F-177; counting the operator as active reverses a documented rule, so revisit once F-177 lands. | When the signed-in admin looks dormant, admin policies show 'No user impact' and the admin vanishes from Readiness |
| OWN-B1 | Review later | An owner decision: A product image needs an owner-approved Home pack revision; batch the output wording with it. | Home shows no product image and undersells the output |
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
| F-129 | Review later | Wait for evidence: Cutting prompts at whole lines is cheap, but the prompt export is secondary; do it when prompts are next touched or a cut is reported. | The prompt list shows titles only; the 68,000-character prompt gives no size warning, and three steps are cut mid-instruction |
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

## Prompt for the next chat

Copy everything in the block below into a new chat, opened in `C:\Dev\IAMAI`. Change `ROUND` to the round you want.

```text
We're working the low-hanging-fruit backlog in docs/plans/2026-09-27-low-hanging-fruit.md
(and its -backlog.json). ROUND = 2.

Read that plan first, then CLAUDE.md's rules as always. Don't read the whole backlog
JSON into context: filter it with a small node script.

1. Pick the round's ten (skip if the plan already lists this round's ten as approved).
   - Pick only from "Needs attention" (bucket "attention" in the JSON). Start from the
     plan's "Round N" candidates, then the rest of that list: status present or partly,
     effort XS or S, highest reward first, low risk before medium.
   - Never pick from "Not worth fixing / review later" unless an item's trigger has
     fired (a decision was made, a real tenant showed the data state, users reported
     it). In that case move it to Needs attention first and tell the owner why.
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
   - Update the plan: mark the round done (commits, what was verified live), move any
     item whose worth changed between the two lists (with the reason), list the
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
