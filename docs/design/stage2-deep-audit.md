# Stage 2 deep audit — every surface, every step

Build f643973 · walked Sep 1, 2026 · against the Second-Stage directive and owner-feedback rounds 1–3.

Walked as a user in Chrome: getiamai.com home · /rollout signed-out Connect and its permissions disclosure · How IAMAI works · the demo (Plan with every group expanded, all 22 planned steps with More open, Today with every popover, Export, Recovery card, Account, Plan settings, the week-two Re-scan view of Plan and Today) · GetIAMAI signed in (Connect, Plan header and groups, 9 of 31 steps, Today).

Not walked: print output, the ICS, plan-file save/load, narrow widths. Nothing in this ledger comes from source.

Each line below is tagged: **owner** (already decided in rounds 1–3, still not in the build), **defect** (wrong; no decision needed), **proposed** (needs your yes/no — collected in §7).

---

## 1. Verdict

The engine knows the right things: it predicts lockouts per person, gates enforcement on readiness, sequences report-only before enforce, and its check tables on the How page are the best-written security content in the product. The step bodies then hand most of that away. Roughly half of every step is category boilerplate that belongs to a different step, the same number is computed in three places and disagrees on one screen, the plan renders differently on two loads of the same snapshot, and the tool tells both tenants to create objects they already have. A technician following steps 17, 19, 20 or 21 as written would build a policy with no session control, or one containing the words "undefined undefined". The rounds 1–3 decisions fix the frame; this ledger says the content inside the frame has to be regenerated from the goal, not the category, before the frame is worth having.

---

## 2. Root causes

**A. Step content is keyed by category, not by goal.** Summary line, "Tell your people", "For the help desk", "For your manager", "What could go wrong" and the exit criteria are selected by a coarse family (admin / mfa / device / session) so text bleeds between steps:

- Token protection (21), block downloads (19) and app-enforced restrictions (20) all carry the sign-in-frequency email ("shortens how long a browser stays signed in"), the sign-in-frequency help-desk lines and the sign-in-duration manager blurb.
- Keep admin sessions short (9) carries the phishing-resistant help desk ("A FIDO2 key or a passkey registered in advance is the only way through"), the phishing-resistant manager blurb, a summary that says "asks admins for a stronger sign-in", and is gated on phishing-resistant readiness — a session-frequency policy has no such dependency.
- Auth transfer (8) carries the legacy-auth help desk ("Legacy protocols are blocked. Move the device to SMTP AUTH with OAuth").
- App protection on phones (15) carries the device-compliance risk list and a summary that says "requires a managed device".
- Portal steps for 19, 20 and 21 contain no Session control at all; 17 renders "Sign-in frequency: undefined undefined"; 10 says the policy "changes in 1 field" and never names the field.

**B. One fact, several values.** Campaign step (demo): "19 people prove" · "30 active people" · "This confirms … that 21 people". Device steps: "30 people keep working … 17 people on unmanaged devices" in a 33-person tenant. Readiness: 34% on one row and 37% on the next for the same population, 45%/47% in week two while Today says 45%. GetIAMAI: 13 people (Connect) · 12 enabled (Today) · 11 enabled (campaign) · 4 active (Today) · 3 active (campaign). Plan header "finishes Sep 20" while Wave 3 runs Sep 22 → 27.

**C. Derivation is not deterministic.** Same demo snapshot, two loads: the countries step's "after:" line changed from the countries location to the exclusions group; "Sign everyone out when the browser closes" went Ready → Blocked; Wave 2 gained a dependency. Between scans, Wave 1 renamed itself "Admin hardening" → "Low-impact blocks" for the same steps minus one.

**D. The tool does not recognise what the tenant already has.** Demo: policy "Core - Grant - Admins phishing-resistant" already excludes a group called "Core - Break glass"; GetIAMAI: "Core - Allow - MFA for Admins" already excludes "Breakglass Exclusion"; the demo names a "Head office" location. All three plans say "exclusions group none yet", "trusted locations none", and add a Create step. Week two then swaps Create for "Sort out the exclusions group", holds fourteen steps behind it, and its "Do it" section is empty.

**E. Two vocabularies.** The plan-length popover cites goal names ("Enrolling a device in Intune asks for MFA every time", "Unknown platforms blocked") that never appear as titles. Engineering words in the UI: "Setup", "phase 2", "ring", "soak", "handle-with-care", "the template", "the assumptions strip", "(p2)", "must-fix checks", "the tenant policy".

**F. Sections render with nothing to say.** "What could go wrong" as a bare heading; "Do it" empty on the blocker step; "Exit criteria" repeating "Done when" verbatim on every prerequisite step; "Report-only from —"; "Tell your people: No announcement needed" beneath an Announce date.

**G. Nothing says what changed.** Week two: readiness moved 34 → 45, a step landed, a wave renamed, a step appeared — no line anywhere. Today's window is still "Aug 2 → Sep 1" after the second scan.

**H. "Already in place" is inert.** Rows do not open. Nothing says which policy satisfies the goal or what evidence backs "Enforced".

**I. Housekeeping is a dumping ground.** GetIAMAI: 14 items, 11 of them "also in the baseline, not assessed. JSON", two of them an SDK export error addressed to the wrong person.

**J. The story starts in the middle.** The demo opens on Plan under a ten-pill Assumes strip; the real tenant opens on "Connect a tenant" with a baseline named and never explained. Nowhere answers "how are we doing" or "are we improving".

---

## 3. Per-screen ledger

### 3.1 getiamai.com (home)

| As shown | Finding | Tag |
|---|---|---|
| "Know what a change will do before you make it." + three bullets + About | Clear, honest, right length. Keep. | — |
| "Try it with sample data" | Lands on the demo Plan, not on an opener — first-time users meet the Assumes strip first. Resolved by the opener + demo rebuild. | owner |
| Footer "Follow me here: Lachlan Robinette GitHub Source" | Links run together with no separators. | defect |

### 3.2 /rollout signed out — "Connect a tenant"

| As shown | Finding | Tag |
|---|---|---|
| Title "Connect a tenant" | Round 1: the signed-out page is the opener (what it is, who it is built for, what it catches), not a sign-in. Still a sign-in. | owner |
| "Plan the journey to your Conditional Access baseline. Read-only." | Fine as a tagline; not an explanation. "Baseline" first appears here and is never defined on this page. | owner |
| Bullet 1 "Needs a Global Administrator or Global Reader account; Entra ID P1 adds sign-in evidence, and the plan works without it." | Two facts in one sentence; the licence clause is the one people need and it is buried. | defect |
| Bullet 3 "Read-only, with nothing sent anywhere on its own: no server, no telemetry." | Repeats the home page and the footer on the same screen. Once is enough. | defect |
| Sign in with Microsoft | First click does nothing; second click signs in silently. Confirmed today with a cached session. | defect |
| "What IAMAI asks for, and how to remove it" disclosure | Good table. The "Without it" column is the strongest trust writing in the product. Duplicated in full on How IAMAI works. | proposed: keep here, link from How |
| "How IAMAI works →", "See it with sample data →" as two stacked links | Fine. |

### 3.3 How IAMAI works

| As shown | Finding | Tag |
|---|---|---|
| Permissions table | Verbatim copy of the Connect disclosure. | proposed |
| "What IAMAI reads" — four tables of endpoint · API · permission · least role · when it can fail · why | A data dictionary. Right content for the source repo; on the site it reads as engineering. The "Why" column is the only user-facing part. | proposed |
| "runs only while the operator types in a Setup picker" | Setup no longer exists. | defect |
| "Every check" tables | Excellent. The clearest explanation of the emergency-access, exclusions, trusted-location, countries, pilot, service-account and strength rules anywhere. Nothing links here from the steps that apply them. | proposed |
| Needs column: "the assumptions strip" (×4) | The word and the surface both leave the product. | owner |
| "Baseline packages … three ways to make one" | Good; the PowerShell block is the right level. | — |
| "Limits" five lines | Good. |

### 3.4 Connect signed in (becomes the tenant page)

| As shown | Finding | Tag |
|---|---|---|
| "Signed in to GetIAMAI as Lachlan@getiamai.com · Sign out" | Fine. |
| "Baseline: Jon Hope — Defense in Depth (46 policies) · change" | Round 1: the baseline explained in place, three lines. Still one unexplained name. | owner |
| "Scan complete · 13 people · 10 policies · sign-ins Aug 1 → Aug 31" | "13 people" contradicts Today's "12 enabled". The scan was 17 h old and nothing on the page offers to re-scan; only the header does. | defect |
| "Open the plan →" | Round 2/3: after the scan the page shows what IAMAI found as a readable list with confirm/change, then Open the plan. Not present. | owner |
| Progress while scanning | Not observed today (cached scan). Round 1 asks to verify the two-lane progress on a first scan. | open |

### 3.5 Plan header, Assumes strip, Plan settings

| As shown | Finding | Tag |
|---|---|---|
| "27 steps · 5 in place · finishes Oct 4, 2026 · 4 weeks · 3 MFA steps wait for MFA readiness · 1 admin step waits for admin readiness · 3 device steps wait for device readiness" | Seven facts in one line; the three "wait for" clauses are the same fact three times. Executive persona gets nothing from it. | proposed |
| GetIAMAI: "finishes Sep 20, 2026 · 3 weeks" above a Wave 3 dated Sep 22 → 27 | Header finish date is not the last wave's end. | defect |
| ⓘ "What set the plan length: The plan is 4 weeks because two changes prompt the same people, so *Enrolling a device in Intune asks for MFA every time* cannot run in the same window as *Unknown platforms blocked*" | Names two goals by internal name; neither string is a step title. | defect |
| "Assumes:" + ten pills (confirm / change / answer) | Round 2/3: the strip goes; decisions happen in the step that needs them; the tenant page asks nothing. Still the most prominent element on the page. | owner |
| Pill "time zone Sydney · change" | A setting, not a finding; belongs in Plan settings. | proposed |
| Pill "emergency access 2 accounts · confirm" while Today shows both break-glass accounts "Never prompted" | The strip says confirm; the evidence says neither has ever completed MFA. The strip hides what the step would show. | owner |
| "Plan settings" link, then a panel titled "Plan settings" | Same label twice, one above the other. | defect |
| "Change freeze from[date]to[date]" | Labels run into the inputs. Nothing says what a change freeze does to the plan. | defect |
| "Clear the date to reset to the default, the next working day." | Only sentence of guidance in the panel; it explains the reset, not the setting. | defect |
| Plan header does not mention Today | Round 1: Plan references Today by name. | owner |

### 3.6 Plan rows and waves

| As shown | Finding | Tag |
|---|---|---|
| "Before anything else · Sep 7, 2026 → Sep 14, 2026" | Round 3: first wave is "Preparation". | owner |
| "Wave 1 · … · Admin hardening" containing four all-user policies and two admin ones; week two renames it "Low-impact blocks" | Wave names are derived and unstable. Fixed purpose names needed (Preparation and Cleanup decided; middle names in §7). | proposed |
| Row "Ready · next · Decide on 3 dormant accounts · 3 people · now" | "next" chip on the first row only; "now" in the date column on every Ready row. The chip and the date say the same thing. | defect |
| Titles "Decide on…", "Create the…", "Give shared devices…", "Run the…", "Stop attackers…", "Keep non-admins out of the admin portals" | Round 3: imperative + the thing being fixed, Title Case, from a per-goal fixTitle. "Keep non-admins out of the admin portals" is also wrong: the policy requires MFA at the portals for everyone; it keeps nobody out. | owner + defect |
| "when MFA readiness reaches 90% (now 34%)" on one row, "(now 37%)" on the next | Two readiness values for one population on one screen. One number per readiness kind, shown once (wave header), not per row. | defect / proposed |
| "after: Create the policy exclusions group" under a row; "· after Create the policy exclusions group" in a wave title; "after the exclusions group" in week two | Three phrasings of one dependency; which one appears changes between loads (root cause C). | defect |
| GetIAMAI rows "Lachlan Robinette · expire every 168h, wants 4h", "(guest) · requires MFA, wants passwordless sign-in", "covers 0 of 3 active", "covers fewer apps than the baseline" | Engineering shorthand in the who-column. "168h" for a week. | defect |
| "Report-only · Give admins a sign-in method that cannot be phished · 3 people · report-only, not enforced" | Status chip and the who-column both say report-only. | defect |
| Leverage ("What waits on this: 14 steps") exists inside More, never on the row | Stage 2 P0 leverage line still absent; the one fact that says why the exclusions step is first is hidden three clicks down. | proposed |

### 3.7 Steps — applies to every step

| As shown | Finding | Tag |
|---|---|---|
| Summary line "An object or an answer is put in place; nobody notices a difference." (all prerequisite steps) · "Nothing changes for anyone. This is groundwork so a mistake later can be undone." (blockers) | Round 3: no-effect lines deleted at the generator. | owner |
| "Why" one sentence + "Learn →CIS 6.3" | "Learn →" and the CIS reference run together with no space; the same CIS number (6.3) is cited on register-info, countries, device-registration and guests. | defect |
| "Who this touches: nobody affected" on steps that create the exclusions group / trusted location; "1 active person" for the Boardroom device account; "3 accounts" | Round 3: names the objects the step acts on. Boardroom is a device account, not a person. | owner |
| "Do it" | Round 3: "What to do". | owner |
| Inline lists: "Jordan Ivanova, Sasha Walker and Kai Nguyen" · twelve names in one sentence on the campaign · twenty app names in one sentence on GetIAMAI admin-session ("IAMAI (1), One Outlook Web (1), … My Apps (1)") | Round 3: lists are lists. The 20-app sentence includes the tool itself. | owner |
| Two naming instructions in one list: 'Name it clearly, e.g. "CA - Allowed countries"' then 'Name it Core - Allowed - Countries, which follows the convention this tenant already uses.' (steps 1–4) | Contradictory; the convention line is the right one and should replace the example. | defect |
| Post-action lines: "then re-scan so the plan picks it up" (1) · "Then confirm it on the plan" (2, 4) · "Then re-scan; the group is picked up" (3) | Three different instructions for one action. Round 3: every tenant-changing step ends with the control "Scan to update the plan". | owner |
| "Done when: The group exists and is picked in Setup." (2, 4) | Setup is gone. | defect |
| "Dates: now" on Ready steps; "Announce 8 Sept 2026 · Report-only from Sep 7 · Enforce 15 Sept 2026"; emails say "From Sep 15, 2026" | Three date formats on one step. Announce dated after report-only begins reads as an error even where it is deliberate. | defect |
| "Report-only from —" on change-existing-policy steps | Empty value rendered. | defect |
| "Done when" (3 lines) and, under More, "Exit criteria" (3 to 9 lines) starting with the same 3 | Two lists for one concept. One list, once. | defect |
| Exit-criteria lines "Every handle-with-care user in scope is verified (9 to check)", "33 members signed in successfully under the policy during the 5 days soak", "At least 95% of the ring's sign-ins…", "9 handle-with-care users in this ring confirmed access personally" | "handle-with-care", "ring", "soak" are never defined. "33 members" on a step whose population is 30. | defect |
| "If it goes wrong: Nothing destructive here: objects created can be deleted. Recovery card →" (on the step that disables accounts) · "Nothing to undo. Recovery card →" | Round 3: renders only where a real failure can occur; the Recovery card link goes. The disable-accounts step has a real failure (a live account disabled) and gets the template. | owner + defect |
| "Tell your people" email box, "Copy" beneath the box, signed "IT", no adapt-the-voice line | Round 3: copy control inside the box, top right; the note "paste this into your own assistant to match your voice". IAMAI is correctly absent from every email. | owner |
| "What could go wrong" list: "…who have no method registered yetapplies here" | The "applies here" flag is concatenated to the sentence. Render as a mark, or list only the ones that apply and fold the rest under "also possible". | defect |
| "Prerequisites: Create the policy exclusions group is done · MFA readiness is 34%: the threshold is 90%; verify users first (phase 2)" | Mixes done-state with conditions; "phase 2" is internal. | defect |
| "For your manager" — identical paragraph on every prerequisite step ("This puts an object in place that the later changes depend on…") including the dormant-accounts step | Boilerplate where it is not per-goal. Keep per-goal or cut (§7). | proposed |
| "Copy" · "Copy as prompt" · "Skip this step" · "Close" as four plain buttons at the end | "Skip this step" appears on the campaign and on Create the trusted location; correctly absent on the exclusions group and emergency access. Round 3: "Doesn't apply here" (with a reason kept) on steps whose subject can be absent; Skip remains a different outcome. | owner |
| Portal steps / JSON / PowerShell tabs | Right idea, right level, keep. "Exclude groups: the exclusions group" vs "your exclusions group (created by the step above)" — two phrasings. | defect |
| "The exclusions group doesn't exist yet. This JSON omits it; re-download after that step." / "Your exclusions group, your allowed countries don't exist yet… re-download after that step." | Placeholder text in a JSON the person may download; "that step" with two steps. Better: the JSON is not offered until its inputs exist, and the line says which step. | proposed |

### 3.8 Steps — one by one (demo unless marked G = GetIAMAI)

| # | Step | Findings | Tag |
|---|---|---|---|
| 0 | Decide on 3 dormant accounts | Why is right. "Who this touches: 3 accounts" then the names are inline in Do it. "If it goes wrong" says nothing destructive on a step that disables accounts. Manager blurb is the object-template. G: same, with 8 names inline; Dalinar Kholin is listed here as dormant and on the campaign as someone to "walk through setup personally with". | defect |
| 1 | Create the allowed-countries named location | Two names for the location; "Leave Mark as trusted location off; then re-scan" — the only step that says re-scan. Round 3: countries are selected in this step and it states the consequence ("people signing in from outside AU will be blocked"). Not present. | owner + defect |
| 2 | Create the policy exclusions group | "Add only the break-glass accounts" without naming Break-glass 1 and 2, which the tool knows. "Then confirm it on the plan" — nowhere to do that. Done when references Setup. Both tenants already have a break-glass exclusion group in use (root cause D). Round 3: "Create or Correct Exclusions Group", the group selected in this step. | owner + defect |
| 3 | Create the service accounts group | "Add: svc-mailer-1 and svc-mailer-2" — good, inline. The Why is good. | owner (list) |
| 4 | Create a trusted named location | Round 3: first line "Define the trusted network your team usually signs in from", "Doesn't apply here" for remote companies. Demo step 12 says a "Head office" location already exists and 1 of 25 sign-ins matched it — that fact belongs here, not on the countries step. | owner + defect |
| 5 | Give shared devices their own policy | Good Why. "Who this touches: 1 active person" for Boardroom. "Exclude these accounts from every other policy in the plan" gives no way to do it. Round 3: "Doesn't apply here" eligible. | defect |
| 6 | Run the MFA verification campaign | Counts: 19 / 30 / 21. "1 person have not typed a password this month". "Morgan Wilson holds the directory-sync role and would be prompted, so the template excludes it. Check the tenant policy." — unreadable. "svc-mailer-2 signed in 1 time by ROPC to Microsoft Azure PowerShell, so move it to a service principal" — belongs on the service-accounts step. "Walk through setup personally with … svc-mailer-1, svc-mailer-2" — service accounts cannot be walked through setup; Jordan Chen is already Proven. "Pilot the verified people first, one admin, across the 9 departments; never break-glass or handle-with-care" — jargon. Dates "now" against "before Oct 4". Round 3: rebuilt around the state lists (no method / insufficient / registered-unused) with per-state instructions, special-care people chosen here, copy control inside the box. G: "1 person prove", "across the 5 departments" in a 3-person tenant, manager says 2 people. | owner + defect |
| 7 | Stop attackers adding their own MFA method | The best step in the plan: right portal steps, a real per-person consequence ("7 people have no method and work outside the office… issue each a Temporary Access Pass"), correct help desk. Prerequisites say "no trusted location is confirmed, so this policy would apply everywhere including to people with no method" — that is the sentence that should be the row's blocked reason. What-could-go-wrong line "…which this policy has applied to since 6 July 2026" is a Microsoft change date presented as tenant fact. | defect |
| 8 | Stop sign-ins being handed to another device | Help desk is the legacy-auth text. Manager blurb claims "Nobody used it in the last 30 days" — if true it should be the row's who-column. "Tell your people: No announcement needed" under "Announce 14 Sept". Exit criteria "33 members" vs 30. | defect (A) |
| 9 | Keep admin sessions short | Summary "asks admins for a stronger sign-in" (wrong). Gated on phishing-resistant readiness (wrong). Help desk, manager, risks all phishing-resistant text. Portal steps correct. G: the 20-app inline sentence; "expire every 168h". | defect (A) |
| 10 | Give admins a sign-in method that cannot be phished | "changes in 1 field; nothing else about it moves" — the field is never named; portal steps show only Name and Save. "Report-only from —". "Restore the fields listed above from the previous body below" — no previous body is shown. Reveals the existing exclusion group "Core - Break glass" the plan says does not exist. "1 service-provider account … signed in this month, so exclude Service provider users" — good, and it is the partner-access question answered by evidence; the pill still says "none seen". | defect |
| 11 | Keep non-admins out of the admin portals | Title wrong (see 3.6). Why "Gate the Microsoft admin portals behind strong auth" is the truth. Email is the generic MFA blast. | defect |
| 12 | Stop sign-ins from countries you don't work in | Carries the "Head office" trusted-location fact (wrong step). "Your exclusions group, your allowed countries don't exist yet… re-download after that step." Help desk is right and specific (travel = named-location exception, never a user exclusion). Round 3: traveller question asked here. | owner + defect |
| 13 | Ask for MFA before a device can be registered | Summary "asks people to prove who they are with MFA" — generic. Otherwise sound. | defect |
| 14 | Block devices Entra cannot identify | Why is good. "1 sign-in this month carried no platform (Outlook Mobile), so an unknown-platform block would stop them" — good evidence. "Report-only will prompt mobile users to pick a certificate from 22 Sept 2026" — report-only starts Sep 7, so the prompt starts Sep 7. No "Tell your people" at all. Manager: "30 people keep working… 17 people on unmanaged devices" in a 33-person tenant. | defect |
| 15 | Only allow protected apps on phones | Summary says "requires a managed device". Risk list is the compliance list. Email says "company-managed device or the approved apps". | defect (A) |
| 16 | Require a company-managed device for company data | Three good evidence lines ("Quinn Ivanova signed in from Chrome without device claims on a compliant device, so those sign-ins are blocked") buried under a template summary. "1 person sign in to servers". Manager numbers wrong. | defect |
| 17 | Ask for MFA before a device is enrolled | "Session → Sign-in frequency: undefined undefined". Summary "tightens how sessions behave". Manager "This closes a gap the baseline names that this tenant still has" — says nothing. | defect (A) |
| 18 | Sign everyone out when the browser closes | Correct portal steps. Email and help desk fit. The one session step whose boilerplate is its own. | — |
| 19 | Stop downloads to devices you do not manage | Portal steps: no Session control, no device filter — the policy as written does nothing. Email/help desk/manager are the sign-in-frequency set. Why is good and says the mechanism is app-enforced restrictions. | defect (A) |
| 20 | Limit what personal devices can do in the browser | Same as 19: no Session control. Why correctly says 19 and 20 are one mechanism configured once — so they are one step, not two. | defect + proposed (merge) |
| 21 | Stop a stolen session token from being reused | No "Session → Require token protection". Email says browser sessions get shorter. Evidence line ("2 people sign in to Office from Windows devices that are neither joined nor registered… so they are signed out") is exactly right and should lead. | defect (A) |
| G0 | Sort out emergency access before anything else | Do it is real and specific (create the second account, exclude both, move one off the shared Authenticator "SM-S918U"). "Emergency access accounts has 3 must-fix checks outstanding" — grammar, and the three are not named as checks. Round 3: the whole step redesigned (title, credential guidance, select accounts here, alert to Cleanup, no Recovery link, Scan to update the plan). | owner + defect |
| G-blocker (demo wk2) | Sort out the exclusions group | "has 4 must-fix checks outstanding" — none listed; **Do it is empty**; fourteen steps wait on it. | defect |
| G7 | Keep admin sessions short (existing policy) | "Today the policy excludes: Breakglass Exclusion" — the group the plan says does not exist. "Dates: Announce 1 Sept 2026" — today. | defect (D) |
| G8 | Make guests prove who they are too | "requires MFA, baseline wants passwordless sign-in" but portal steps set "Require multifactor authentication" — the thing it already has. Help desk says issue a TAP; the risk list says a TAP cannot be issued to a guest. Both in one step. | defect |

### 3.9 Already in place · Doesn't apply here · Housekeeping

| As shown | Finding | Tag |
|---|---|---|
| "Already in place (5)" rows: "In placeBreak-glass sign-in drill", "EnforcedTurn off old sign-in methods that skip MFA" | Rows do not open. No policy name, no evidence, no date. Chip and title touch. | proposed (H) |
| "Doesn't apply here (7)": "**Risky sign-ins get MFA or are blocked**: needs a licence tier this tenant does not have (p2)." | Literal `**` on every line; "(p2)" lowercase; these titles are a third naming style ("Azure management requires strong auth"). Round 3: "Doesn't apply here" is an outcome the person chooses with a reason; licence-gated goals are a different thing ("not licensed") and belong with the licensing principle (educational catalogue, never an upsell). | owner + defect |
| "Housekeeping (0)" rendered as an empty group | Empty groups do not render. | defect |
| G "Housekeeping (14)": 11 × "…: also in the baseline, not assessed. JSON"; 2 × "targets no users, groups, roles… the export probably dropped conditions the exporting SDK did not support (e.g. agent identities); re-export via Graph REST" | Round-3 decision 4: the baseline policies not assessed go to Cleanup. The SDK message is about the baseline package and belongs on How IAMAI works → Baseline packages, never in a plan. "Monitor Kaladin using Forms (enabled): not in the baseline, fine to keep" is the one useful line. | owner + defect |

### 3.10 Today

| As shown | Finding | Tag |
|---|---|---|
| Title "Today" with no purpose line | Round 1: one purpose line; tiles say which steps they hold. | owner |
| "33 active people of 36 enabled · 5 admins · sign-ins Aug 2 → Sep 1" | Good. Week two still says Aug 2 → Sep 1. | defect |
| Tiles "12 · 36% MFA proven · 14 · 42% Registered, unproven · 7 · 21% No method · 3 Not active" | Percentages are of active (33), counts sum to enabled (36) — the ⓘ explains it, the tile does not. | proposed |
| Table states: Never prompted · Possibly broken · Likely works (G) · Proven · No method · Not active | Three of the six states exist only in the table; the tiles and the Show filter know four. | defect |
| ⓘ "Seen, never assumed." · title "proven, not assumed." | "Assume" leaves the product. | owner |
| ⓘ Not active: "Listed, never counted: nothing can lock out an unused account." | Contradicts the dormant-accounts step's Why one page away and the Aug 30 decision. Say what the step says: whoever signs in first registers the method. | defect |
| "Break-glass 1 Admin · Never prompted · Phishing-resistant" and G "Breakglass · Likely works · Authenticator app, current" while the emergency step says it shares Authenticator device SM-S918U with a daily-use account | Today shows the emergency accounts as ordinary rows and hides the one fact about them that matters. | proposed |
| "Boardroom · Proven · Phishing-resistant · MFA via Microsoft Authenticator notification" | A device account in the people table; strongest method and evidence disagree. | defect |
| "Export CSV" · "Everything the scan read →" | Fine. |

### 3.11 Export

| As shown | Finding | Tag |
|---|---|---|
| Six cards: Print · Calendar · Plan file · CSV (11 links) · Prompts for your own assistant · Grounding bundle | Cards are the right container here. "Plan file: Everything, to load back on any machine: steps, evidence, the ticked facts and checkpoints" — "ticked facts" is nothing the person has seen. | defect |
| "Recovery card" row absent; Recovery card still in the header | Round 3: the card goes entirely. | owner |
| "Prompts for your own assistant" / "Grounding bundle" | Consistent with the paste-into-your-assistant decision. Keep. | — |

### 3.12 Header, Recovery card, Account

| As shown | Finding | Tag |
|---|---|---|
| Header: tenant name (plain text) · Today · Plan · Export · "Re-scan · scanned just now" · Recovery card · theme · Account | Round 3: "Scan to update the plan" in the header; Recovery card removed. Tenant name is not a link to the tenant page. | owner |
| Recovery card page | Well written; per round 3 it goes. Its "Turn a policy off / back to report-only / if the portal blocks you" content is the only rollback how-to in the product — it should survive inside "If it goes wrong" on policy steps, once, generically. | owner + proposed |
| Account menu: Sign out · Forget this tenant | Fine. |
| Footer: "Something wrong or unclear? Tell me." · "All IAMAI tools" · "Follow me here: Lachlan Robinette GitHub Source Build f643973, Sep 1, 2026" | Round 1: three links; build stamp to How IAMAI works. Still seven items running together. | owner |

### 3.13 Week two (demo Re-scan)

| As shown | Finding | Tag |
|---|---|---|
| Header "Re-scan · scanned just now" before and after | Nothing says a second scan happened or what it found. | proposed (G) |
| "6 in place" (was 5); "Give admins a sign-in method that cannot be phished" gone from Wave 1 | The one thing that changed is not announced. | proposed |
| "exclusions group Core - Exclusions" + new first step "Sort out the exclusions group" with empty Do it | Creating the group added a step instead of removing one. | defect (D) |
| "when MFA readiness reaches 90% (now 45%)" and "(now 47%)"; Today 45% | Root cause B. | defect |
| Wave 1 "Admin hardening" → "Low-impact blocks" | Root cause C. | defect |
| Today window unchanged | The week-two snapshot did not move the evidence window. | defect |

---

## 4. The four personas

**Executive.** No screen answers how we are doing, how far from the baseline, or whether we are improving. The only summary is "27 steps · 5 in place". Nothing changes between scans on the surface. The Stage 2 P1 posture line is still the missing screen.

**Security / IAM leader.** The check tables on the How page and the per-person evidence on Today are exactly what this person wants, and per-step evidence lines like "Quinn Ivanova signed in from Chrome without device claims on a compliant device" are the product's best sentences. They sit next to boilerplate that is wrong for the step, so the reader cannot tell which lines to trust. Traceability is "Learn → CIS 4.3" and nothing else.

**Technical implementer.** Portal steps, JSON and PowerShell are the right deliverable. Four policy steps are wrong or incomplete as written (17, 19, 20, 21), one names no changed field (10), and the blocker step that gates fourteen others has no instructions.

**First-time user.** The demo opens on the Plan under ten pills. There is no opener, no "here is where you are". The word baseline is used before it is explained. Steps use ring, soak, phase 2, handle-with-care.

---

## 5. Rounds 1–3 against the live build

| Decision | In the build? |
|---|---|
| Signed-out page is the opener | No |
| Baseline explained in place | No |
| Footer to three links; build stamp to How | No |
| Today purpose line; tiles say which steps; Plan references Today | No |
| Recovery card removed | No (still in header and as a page) |
| PageTip primitive | No |
| Tenant page: consent → scan → what IAMAI found → Open the plan; asks nothing | No |
| "Assume" out of the product | No (strip, How page ×4, Today ×2) |
| First wave "Preparation"; final wave "Cleanup" | No |
| Titles: imperative + thing fixed, Title Case, per-goal fixTitle | No |
| No-effect / narration lines deleted | No |
| Why = one sentence naming the tenant | Partly (the sentence exists; the tenant is named in emails only) |
| Who this touches names the objects | No |
| "Do it" → "What to do" | No |
| Lists render as lists | No |
| "Scan to update the plan" at the end of every tenant-changing step and in the header | No |
| Alerting to Cleanup | No |
| Credential guidance on the create action | No (G0 has none) |
| "If it goes wrong" only with a real failure mode; no recovery link | No |
| No self-references | Not observed (none seen in 31 steps) |
| Decisions inside the step, pre-filled | No |
| Trusted-network first line; "Doesn't apply here" outcome | No |
| Campaign rebuilt around state lists; copy control inside the box; adapt-the-voice line | No |
| Comms never name IAMAI | Yes |

---

## 6. Priorities

**P0 — product**
1. Content per goal (root cause A): every summary, portal step, comms, help-desk, manager and risk line is generated from the goal, with a generator test that fails on `undefined`, on empty sections, on a policy step whose portal steps carry no grant or session control, and on any two goals sharing a comms body.
2. One number, one source (B): a single population object per step; one readiness value per kind, shown once; header finish = last wave end; tests assert equality across Plan header, row, step body, Today.
3. Deterministic derivation (C): stable ordering in dependency resolution; fixed wave names; a test that renders the same snapshot twice and diffs.
4. Recognise what exists (D): detect the exclusions group (a group excluded from enabled policies whose members are the emergency accounts), trusted and countries locations; the step becomes Correct, not Create; a blocker step lists its failing checks with the fix per check.
5. Rounds 1–3 in full (§5), since they are the frame the above sits in.

**P1 — workflow**
6. Since-last-scan line on Plan and Today (open decision; the week-two walk shows the product cannot show progress without it).
7. Already-in-place rows open: satisfying policy, its state, evidence date.
8. Housekeeping → "Not in the baseline" (keep/review) list; not-assessed baseline items to Cleanup; package errors to the How page.
9. Posture line for the executive (open decision).

**P2 — interaction**
10. Sections only with content; Done when and Exit criteria merged; "applies here" as a mark; one date style; "Report-only from —" never rendered.
11. Today: the six states in tiles and filter, or explained in the tile; device and emergency accounts marked.
12. Plan settings: labels, and a sentence on what a change freeze does.
13. First-click sign-in.
14. `**` and `(p2)`; empty groups not rendered; "next" chip vs "now".

**P3 — visual**
15. How page tables (column widths, mono endpoints wrapping mid-word); footer separators; chip/title spacing in the in-place list; the 30-second renderer stalls after expand/scroll on Plan and Today.

---

## 7. Decisions needed from you

Yes/no unless marked.

1. Since-last-scan line on the Plan header and Today (carried from round 3).
2. Today tiles link to the steps they hold (carried from round 3).
3. Recognise an existing exclusions group / trusted location / countries location and make the step "Correct" rather than "Create" — implied by your titles; confirm.
4. "Already in place" rows open and show the policy, its state and the evidence date.
5. Middle wave names, fixed and by purpose. Proposal: Preparation · Protect everyone · Protect admins · Devices · Sessions and risk · Cleanup.
6. Readiness shown once per wave header ("waits for MFA readiness 90%, now 34%") instead of on every row.
7. "For your manager": keep, regenerated per goal — or cut.
8. Merge "Stop downloads to devices you do not manage" and "Limit what personal devices can do in the browser" into one step (one policy, one mechanism).
9. A posture line at the top of the Plan for the executive read ("Where you are → where this plan ends → how long"), also page 1 of the print (Stage 2 P1).
10. Licence-gated goals: leave "Doesn't apply here" to the person's own choice and show the licence-gated ones as "Not licensed" with a one-line note, per the licensing principle.
11. JSON download withheld until its inputs exist, with the line naming the step that supplies them.
12. The Recovery card's rollback how-to survives once, generically, inside "If it goes wrong" on policy steps.
13. Today: emergency accounts and device accounts marked in the table, with the shared-device fact shown where it applies.
14. The How page: permissions table becomes a link to the Connect disclosure; the endpoint tables move to the repo README; "Every check" stays and each step links to its checks.

---

## 8. What happens next

Prompt sequence proposed: **51** = the step, done once and right (P0 1–4 plus every round-3 step decision) · **52** = the frame (opener, tenant page, PageTip, header, footer, Recovery card removal, Today purpose line) · **53** = the yeses from §7. Each preceded by target-state v2 deltas and contract edits from me, each verified by a walk of getiamai.com/rollout against GetIAMAI.

To write the target-state deltas, the contract edits and prompt 51, I need the current `docs/design/target-state.md` and `docs/qa/page-contracts.json` uploaded.
