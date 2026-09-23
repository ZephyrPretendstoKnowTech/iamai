# Roadmap flow: proposal for your review

Nothing is built yet. This is what I would build once you approve it. I checked it against the code at `a433ab41`, the dependency graph in `src/actionability/dependency-data.json`, and 13 test tenants. A second check ran 45 tenant variants and got the same counts. It also found safety details the merges must carry over, and those are now part of Stages 2–4.

## Summary

The Plan should open on All work, and a section should never move. When work is finished it shrinks to one line in the same place, instead of sinking to the bottom or disappearing.

The plan has eight sections instead of ten:
1. make sure you can get back in
2. answer the questions
3. prepare everything the policies need
4. turn on the four core protections (the ones that replace security defaults)
5. extend MFA to the places the core doesn't reach, including risky sign-ins
6. close the remaining doors
7. secure devices and sessions
8. ongoing care

**What changes for you:**
- When every stage is done, your plan has 36 rows instead of 41.
- The countries work you flagged becomes one step, and its lockout checks move onto that step.
- Each risk policy keeps its own report-only history when the risk steps are merged.

**What the dependency check found:**
- In all 13 test tenants, no step waits on anything drawn below it, except two deliberate hand-offs. Each one stays inside a single section:
  - the four core policies are turned on as security defaults go off;
  - two policies are turned on once shared devices have their own policy.
- Today's screen has between 2 and 53 steps waiting on something below them.
- One case the 13 tenants don't cover is an empty countries list. It would make 5.1 wait on the countries step below it. Stage 3 fixes the rule that causes this, and a test keeps the count at zero.

**Jon Hope:** he publishes four layers and one rule, not a step order. His rule is that MFA for all users is turned on "last in Phase 1". This order keeps that rule.

You can approve the five stages one at a time. Emergency Access is not touched.

## Your decisions

| # | Decision | My recommendation | Stage |
|---|---|---|---|
| 1 | All work is the default view. Sections never move. Finished work collapses in place. Show completed and Show deferred are removed | Yes | 1 |
| 2 | Eight sections, in the order below. Four rows that only merge in later stages get a place now, so declining 5 or 7 leaves nothing in the wrong place | Yes | 2 |
| 3 | Direction goes from 4 steps to 3: the office network question joins the devices step, and the work countries question moves onto the countries step | Yes | 3 |
| 4 | Retire three Direction questions that nothing reads: external methods, travel, device exceptions | Yes | 3 |
| 5 | The countries location, the countries policy and the countries list become one step. Its lockout checks and old links move with it | Yes | 3 |
| 6 | Turn Off Security Defaults reads "Doesn't apply" when this plan never saw security defaults on. Define the Trusted Network reads "Doesn't apply" when everyone works remotely. This needs one new saved fact: the date a scan first read security defaults on | Yes | 3 |
| 7 | Each risk pair becomes one step holding two policies. This changes the baseline goal map, which you own. Each policy's record moves over with it | Yes, last | 4 |
| 8 | Print and exports use the screen's sections and numbers | Yes, last | 5 |
| 9 | What happens to choices saved on a step that is merged away | Countries: 6.3's own choice stands, and a different choice on the location step is shown once. Risk: the merged step takes Deferred or Doesn't apply only if both old steps had it | 3, 4 |

I don't recommend these, though you can still ask for them:
- moving the device code question onto Block Device Code;
- folding Finish Moving Off Per-User MFA into Require MFA for Everyone;
- merging or removing tabs.

The reasons are in section 5.

---

## 1. The view

- **All work opens first.** `Plan.tsx:99` changes from `'ready'` to All work.
  - *Why:* you said people are less jarred when a shrunken view is something they choose to switch to.
  - *Helps:* Jordan sees at a glance that Emergency Access is unfinished. Marcus reads one list from top to bottom. Nadia sees the whole journey from the start.
- **Sections never move.** They are numbered 1–8 and stay in place from the first scan to the last. Nothing is lifted into a block above the tabs, sunk to the bottom, or hidden.
  - *Why:* the countries jump you hit happened because a finished Direction had sunk to the bottom. With Direction fixed at section 2, every "Answered in" link points up, to something already answered.
  - *Helps:* everyone. Sam can re-check finished work where it happened.
- **Finished work shrinks in place.**
  - A Completed step becomes one line (number, title, Completed, date). Click it to open it.
  - A section whose steps are all finished becomes just its heading, for example "1. Establish Emergency Access · 4 of 4 completed". Click it to open it.
  - Deferred rows shrink the same way and say Deferred.
  - *Why:* you see what's done and what's left in one picture, and done work doesn't fill the page.
  - *Helps:* Sam, who verifies, keeps finished work at hand. Priya scrolls less.
- **Show completed and Show deferred go.** All work already shows everything, so these two controls have nothing left to do.
- **Tabs stay as filters you choose:** All work (first, and the default), Ready, Up Next, On Hold.
  - Each tab keeps the same headings, order and numbers.
  - A section with nothing in that tab is hidden.
  - Numbers never shift. A gap means the row is in another tab. `rowNumbersOf` already works this way.
  - *Why keep all three for now:* Up Next versus On Hold is a distinction you decided on. Up Next means waiting for a step above. On Hold means held on a person or on evidence. With the new order, an Up Next row's reason always points up the page.
- **Opening a step from a link or a tile** keeps you on your tab if the step is in it. Otherwise it switches to All work, opens the section and scrolls to the step. Today it switches you into the step's lane tab.
- **Header tiles** filter the one list, in section order, so each section heading appears once. Today the Input, Observing and Completed tiles can draw the same heading three times.
- **Doesn't apply here (n)** stays as the collapsed footer.

I read "minimized tabs for items already completed" as completed items shown minimized inside All work, not as a separate Completed tab.

---

## 2. The outline

**Moved** says where a step comes from. **Merged** says what it absorbs. *(only when …)* marks a row that appears only on some tenants.

The numbers below cover the full list. Your board numbers only the rows your tenant has, from 1 to n, so a row that doesn't apply to you leaves no gap.

### §1 Establish Emergency Access (unchanged)
- 1.1 Prepare Emergency Access Accounts
- 1.2 Configure Emergency Exclusions
- 1.3 Configure Passkey Authentication
- 1.4 Verify Emergency Access

**Why first:** it waits on nothing, and it unblocks the most:
- every policy's turn-on waits on 1.1 and 1.4;
- 18 policies can't be created until 1.2 exists;
- your own passkey needs 1.3 and 1.4;
- 2.2 leaves the emergency accounts out of its service-account suggestions (`detectServiceAccounts(snapshot, [...breakGlassUserIds, …])`).

*Helps:* Jordan can't reach a policy before there is a way back in.

### §2 Decide Your Tenant's Direction
- 2.1 Confirm What You Use: services, mail-sending devices, device code, partner accounts. **Changed:** the external methods question is retired.
- 2.2 Identify Service and Shared Accounts (unchanged).
- 2.3 Decide How and Where People Sign In: computers, phones, office network. **Merged:** today's Decide How People and Devices Sign In, plus the office network question from Decide Where People Sign In From. The device exceptions question is retired.

**The rule:**
- Direction asks how your organisation works. These are facts the scan can only suggest, and either several steps need them or they decide which steps you get.
- A setting you pick while building one object is asked on that object's step.
- A question nothing reads is retired.

Applying the rule:
- Work countries is the list you tick when you create the countries location, and only the countries policy reads it. So it moves to 6.3.
- The office network is read by four steps, so it stays in Direction.

**Why second:**
- It waits only on 1.1, because 2.2's suggestions leave out the emergency accounts.
- No policy is Ready until Direction is answered (`foundations.ts`).
- Its answers decide which rows exist (services, phones, office network). Answering first keeps rows that don't apply off the plan.
- It is three steps, each done in one sitting.

*Helps:* Marcus and Priya answer once, up front. Nadia is asked about countries at the point where she builds them.

### §3 Prepare Before Any Policy (new section, replaces Prepare the Groups and Locations)
- 3.1 Disable or Confirm Dormant Accounts (**moved** from Ongoing)
- 3.2 Use Separate Accounts for Admin Work (**moved** from Ongoing)
- 3.3 Register Your Own Passkey (**moved** from Protect Your Administrators)
- 3.4 Prepare Your Team for MFA (**moved** from Turn On MFA for Everyone)
- 3.5 Create the Baseline's Authentication Strength (**moved** from Protect Your Administrators)
- 3.6 Define the Trusted Network
- 3.7 Create or Correct Service Accounts Group *(only when 2.2 names service accounts)*

**Why here:**
- Nothing here waits on anything below it:
  - 3.3 waits on 1.3 and 1.4;
  - 3.4 waits on 3.3, just above it;
  - 3.6 waits on 2.3;
  - 3.7 waits on 2.2.
- Every policy below depends on this section:
  - 3.4 holds the turn-on of 7 policies, and every MFA, guest and admin readiness gate;
  - 3.5 is needed to create 8 policies;
  - 3.6 is read by 4 steps.
- Nothing here changes how anyone signs in.
- It keeps your 2026-09-20 rule: decide, make the things, then roll out the policies. It also applies that rule to the two things that broke it. The authentication strength sat among the admin policies, and the campaign sat among the MFA policies.

**Order inside:** people first, then objects. The campaign is the longest wait in the plan, and the objects take minutes.
- Dormant accounts go first, because a disabled account drops out of every people count (`derive/sets.ts`).
- Separate admin accounts go next. Three admin policies point to this step, and your passkey should go on the admin account you keep.
- Your own passkey comes next, because the campaign can't start without it.
- The campaign comes after that.

*Helps:*
- Marcus meets the campaign in section 3. Today it sits in section 5, after the policies that wait on it.
- Jordan can't turn on admin MFA ahead of the campaign that makes it safe.
- Nadia's accounts that have never signed in are dealt with before anyone counts people.

### §4 Turn On the Core Protections (new section)
- 4.1 Block Legacy Authentication (**moved** from Close the Doors)
- 4.2 Block Device Code Sign-in (**moved** from Close the Doors)
- 4.3 Require Phishing-Resistant MFA for Admins (**moved** from Protect Your Administrators)
- 4.4 Require MFA for Everyone
- 4.5 Turn Off Security Defaults. It is open while security defaults are on, reads Completed once you switch them off, and reads Doesn't apply if this plan never saw them on (decision 6). Once 4.1–4.4 are watched and ready, switch security defaults off and turn those four on in the same sitting.
- 4.6 Finish Moving Off Per-User MFA. It is on every plan with Conditional Access (`generate.ts` always builds it), and its check reads per-user MFA from the scan.

**Why here:**
- These four are the policies that replace security defaults. The graph makes Turn Off Security Defaults wait for exactly these four to be ready.
- Microsoft won't let a Conditional Access policy be turned on while security defaults are on. So in a tenant with them on, every other policy's turn-on waits on 4.5. Putting these four first is the only order in which no later policy waits on a step below it.
- This is also Jon's Foundation layer without the countries block, and it keeps his one rule: MFA for everyone is the last policy.
- What it waits on, all above it:
  - 1.1 and 1.4, for every turn-on;
  - 1.2, for every create;
  - 1.3, for 4.3's turn-on;
  - 2.1 (mail-sending devices, device code);
  - 3.4, for 4.3's and 4.4's turn-on;
  - 3.5, for 4.3's create;
  - 3.7, for 4.1's turn-on.

  It reaches 3.3 only through the campaign.
- 4.6 can only start once 4.4 is on. Nothing waits on 4.6, and it sits directly under 4.4.

*Helps:*
- Sam (4,900 people, security defaults on): the security defaults switch-off happens in one place. Today eight policies across three sections wait on a step in section 5.
- Jordan: the policies that can lock people out sit below the campaign and the emergency access that make them safe.
- You: in a tenant where security defaults are already off, this still reads as "the four protections every tenant needs first".

### §5 Extend MFA and Respond to Risk (new section)
- 5.1 Protect Sign-in Method Registration
- 5.2 Require MFA to Register a Device
- 5.3 Require MFA for Guests
- 5.4 Require MFA at Every Role Activation *(Entra ID P2)* (**moved** from Protect Your Administrators)
- 5.5 Require MFA for Inforcer Access *(only when 2.1 says Inforcer is used)* (**moved** from Ongoing)
- 5.6 Challenge Risky Sign-ins *(P2)*. **Merged:** the high and medium sign-in risk policies, two policies in one step.
- 5.7 Remediate Risky Users *(P2)*. **Merged:** the high and medium user risk policies, two policies in one step.
- 5.8 Require MFA for Azure Management *(only with an uploaded baseline that has it)*. It is new to the registry. Today it would fall into Ongoing by default.

**Why here:**
- Once MFA is on at sign-in, these are the places it doesn't reach yet: registering a method, registering a device, guests, role activation, the consoles that manage the tenant, and sign-ins Entra flags as risky.
- Every one of them waits on security defaults being off. For most this is a graph edge. Inforcer and Azure management are not in the graph, and the engine's own security-defaults rule (`generate.ts`) holds them like every policy step. So in a tenant with security defaults on, this section must sit below §4.
- Every step here that is in the graph asks for the authentication strength (3.5) and waits on emergency access (§1).
- 5.1, 5.3, 5.6 and 5.7 also wait on the campaign (3.4), through a turn-on edge or a readiness gate. 5.2 and 5.4 do not wait on it, and neither do the two consoles. In a tenant without security defaults, those show Ready as early as they're allowed. They sit here because of what they do, not because of what they wait on.
- Risk sits here, not at the end. The risk policies act only on sign-ins Entra flags, and after the campaign every flagged person can clear the flag with their own MFA.

*Helps:* Priya gets one heading for "MFA wherever it's still missing", and four near-identical risk rows become two. Nadia meets each idea right after the one it builds on.

### §6 Close the Remaining Doors (replaces Control Where People Sign In From)
- 6.1 Block Authentication Transfer (**moved** from Close the Doors)
- 6.2 Block Unsupported Device Platforms (**moved** from Close the Doors)
- 6.3 Block Sign-ins From Countries Not Allowed. **Merged:** four tasks: pick your work countries, create or correct the countries location, create the policy in report-only, turn it on. It absorbs Create or Correct Allowed Countries Location, the work countries question, and the location's three lockout checks.
- 6.4 Restrict Service Accounts to the Trusted Network *(only with service accounts)*
- 6.5 Restrict the Directory Sync Service Principal to Its Address *(Workload ID licence only)*
- Block the Admin Portals for Non-Admins stays hidden from every screen (`customerPlanSteps`). If it is released, it goes here.

**Why here:**
- All five block something nobody should legitimately use: a sign-in flow, a platform, a location, a service account used from outside the office, or the sync account used from another address.
- They wait on 1.1, 1.2, 1.4, 2.1 (partner accounts, for countries), 3.6 and 3.7, and on security defaults being off.
- Nothing waits on them. Today, with an empty countries list, 5.1 would wait on the countries step. Stage 3 narrows that wait to the policies that name the countries location.
- They come after section 5 because section 5 finishes the MFA coverage the core started, and a gap there is the bigger exposure.
- They don't depend on section 5, so in a tenant without security defaults they show as Ready as early as they're allowed.

*Helps:*
- You: the countries question, the location and the policy are one step.
- Marcus: one step, with its tasks in the order the portal needs them.
- Priya: one heading for the blocks.

### §7 Secure Devices and Sessions (replaces Require Healthy Devices and the session half of Respond to Risk and Limit Sessions)
- 7.1 Shorten Admin Sessions (**moved** from Protect Your Administrators)
- 7.2 Limit How Long Sessions Last (**moved** from Respond to Risk and Limit Sessions)
- 7.3 Require a Fresh Sign-in for Intune Enrollment
- 7.4 Require a Managed Device Outside the Office
- 7.5 Give Shared Devices Their Own Policy *(only when 2.2 names shared accounts)*. Once 7.2 and 7.4 are created, carve out the shared accounts, then turn 7.2 and 7.4 on.
- 7.6 Keep Company Data Off Phones *(only when 2.3 says phones are blocked)*
- 7.7 Require Token Protection on Windows (**moved** from Respond to Risk and Limit Sessions)
- 7.8 Require App Protection on Phones *(only with an uploaded baseline that has it)*. New to the registry.
- 7.9 Limit Browser Sessions on Unmanaged Devices *(only with an uploaded baseline that has it)*. New to the registry.

**Why last among the policies:** these change every person's day. Browser sessions stop staying signed in, and unmanaged computers are blocked outside the office. So they come after everything that touches only some people.

**Order inside:**
- The two session steps name each other in their Done-when text, so they now sit together, admins first.
- 7.5 must sit with 7.2 and 7.4. It waits for both to be created, and both wait on it before they can be turned on.
- 7.3 comes before 7.4, so enrolment is protected before a managed device is required.
- 7.7 comes after 7.4, because token protection only works on registered Windows devices.
- 7.8 and 7.9 go at the end so they renumber nothing. Neither is in the graph, and only an uploaded baseline builds them.

*Helps:*
- Jordan: the changes that affect the most people come last.
- Sam: the shared-devices hand-off happens inside one section.
- Nadia: sessions are explained once, for admins and everyone together.

### §8 Ongoing Checks and Cleanup
- 8.1 Alert on Emergency Account Sign-ins
- 8.2 Harden Emergency Access *(when it was deferred)*
- 8.3 Remove Emergency Accounts Excluded by Name *(when found)*. Now listed by name. Today it only reaches this section as the default for unplaced steps.
- 8.4 Review Overlapping Policies
- 8.5 Align Policy Names
- 8.6 onward: one row for each baseline policy the plan has no goal for, for example MFA for the baseline's Azure application scope.

**Why last:** this is care after the rollout, and nothing above waits on it. Dormant accounts and separate admin accounts moved out because they belong before the policies, not after.

**Not placed, on purpose:** the six free-tier ladder rows (`s-ladder-security-defaults`, `-legacy-auth-inventory`, `-app-passwords`, `-global-admin-count`, `-guest-review`, `-authenticator-over-sms`). They are built only for a tenant without P1, and that path is switched off (`FREE_TIER_LADDER = false`, `generate.ts:231`). If it is ever switched back on, the ladder needs its own placement first.

Footer: **Doesn't apply here (n)**

---

## 3. Before and after

| | Today | Proposed |
|---|---|---|
| Sections | 10 | 8 |
| Rows on your plan | 41 | 36. It would be 37 if Turn Off Security Defaults kept its row, and 2 more if the risk pairs stayed separate. After Stage 2 alone it is still 41, only moved. |
| Rows per section on your plan | 4 · 2 · 4 · 5 · 7 · 1 · 2 · 6 · 6 · 4 | 4 · 3 · 6 · 5 · 6 · 3 · 5 · 4 |
| Doesn't apply footer | 6 | 7 (Turn Off Security Defaults moves there) |
| Direction steps | 4 | 3 |
| Direction questions, not counting services | 12 | 8 (3 retired, work countries moved to 6.3) |
| Default view | Ready | All work |
| Board controls | 4 tabs, 2 toggles, search, work type | 4 tabs, search, work type |
| Finished sections | Sink to the bottom, or vanish unless Show completed is on | Stay where they are, collapsed |
| Steps waiting on something below them (13 tenants) | 2 to 53 | 0, plus the 2 designed hand-offs. It is also 0 with an empty countries list, once Stage 3 lands |
| Countries work | 3 places: Direction (§10), Prepare (§2), Control Where (§6) | 1 step (6.3) |
| Steps that fall into Ongoing because nothing places them | 4 generated today, 3 more with an uploaded baseline | 0, and a test keeps it at 0 |
| Print and exports | Each orders steps its own way (print groups by phase and lane) | The screen's sections and numbers, after Stage 5. Dates keep following dependencies, which now run top to bottom |

---

## 4. Merges, moves and retirements

| Change | What the admin gains | What is kept | Who it helps | Approval |
|---|---|---|---|---|
| Countries location, countries policy and work countries question become **6.3** | One step, one Entra screen, one sitting, and no jump to Direction. The policy is the location's only reader, and its create is the only graph edge on the location from a drawn step. You raised this, and your 2026-09-19 V1 step map proposed it. | **Kept:** the three lockout checks (seen countries included, your own country included, unknown countries), now on 6.3. A failing check keeps 6.3 from reading Completed and holds its turn-on, as it holds the location step today. **Kept:** a "Needs decision" hold until at least one work country is saved. **Kept:** the location check, now the step's second task, read from the tenant on every scan. **Kept:** your saved list, the older-plan "Confirm Work Countries" hold, the proposed location name, the picker's storage. **Kept:** old links. | You, Nadia, Marcus | Yes (decisions 5 and 9) |
| Decide Where People Sign In From is folded away: the office network joins 2.3, travel is retired, work countries moves to 6.3 | One fewer Direction step. The office network is asked beside the device questions that use it. | The office network answer, still saved and read under its old key (Stage 3 fixes the writer, see section 7) | Priya, Marcus | Yes |
| Retire external methods (2.1), travel (old D4) and device exceptions (2.3) | Three fewer questions. Each one holds policies until it is answered (travel holds the countries policy, device exceptions holds every device policy), yet no code reads the answer. The travel condition in `graphConditions.ts` reads the old travel answer on the countries step, not this one. | The saved answers stay in storage, unread. Nothing gets stricter. | Priya, Jordan | Yes |
| The risk pairs become 5.6 and 5.7 | Four near-identical rows become two | Each policy keeps its own report-only window, evidence and turn-on, the same way Require MFA for Guests already carries two policies. Each old record moves to its policy inside the merged step. A risk policy already in your tenant is still found, even though its tag names the old step. The "plain MFA first" decision for high sign-in risk stays with that policy. | Priya | Yes, because it changes the goal map you own (Stage 4) |
| Turn Off Security Defaults (never seen on by this plan) and Define the Trusted Network (everyone remote) move to Doesn't apply | No row reads Completed when nobody did anything | A plan that saw security defaults on and then off still reads Completed. This needs one new saved fact (section 7). Both steps keep reading as satisfied underneath, so no policy is held by the new wording. This matches the specs' own "Applies when". | Priya, Sam | Yes (decision 6) |
| Moves only, no merge | Each step sits above everything that needs it, as argued in section 2 | Step ids, and so all saved state | Everyone | Covered by decision 2 |

---

## 5. Alternatives considered

1. **Direction before Emergency Access.** Rejected.
   - 2.2 leaves the emergency accounts chosen in 1.1 out of its service-account suggestions. An unused emergency account can look like a service account (no MFA method, never signed in).
   - Your own foundation rule puts lockout prevention first.
2. **Keep Close the Doors as one section before MFA** (outlines A and B). Rejected.
   - With security defaults on, every block's turn-on waits on Turn Off Security Defaults, which would then sit one or two sections lower.
   - On the test tenant with security defaults on, that is 12 (A) or 10 (B) turn-on waits pointing down. This plan has 4 same-section hand-offs instead.
3. **Keep Protect Your Administrators** (today, and outline C). Rejected.
   - On most tenants it would hold 2–3 rows, because PIM needs P2 and Inforcer is rare.
   - It separates Shorten Admin Sessions from Limit How Long Sessions Last, which name each other.
   - "Admins first" survives inside each section: 4.3 before 4.4, and 7.1 before 7.2.
4. **Ten sections** (outline C). Rejected. It gets the same dependency result with two extra headings of 3–5 rows each. It also left Use Separate Accounts for Admin Work below the admin MFA step that points to it.
5. **Two Direction steps** (outline B). Rejected.
   - One step would mix the usage questions with picking accounts.
   - B moved the mail-sending devices question onto Block Legacy Authentication. That would put it below the service accounts group it feeds, because `decisions.ts:325` adds mail-sending accounts to the service accounts list.
6. **Move the device code question onto Block Device Code.** Not now. It is a usage fact read from sign-in records, like the services and mail devices next to it. It can move later without moving any data, because its answer is already stored under that step's id (`QUESTION_STEP.deviceCode`).
7. **Fold Finish Moving Off Per-User MFA into Require MFA for Everyone** (outlines A and B, the duplication audit, your V1 map). Not recommended.
   - A policy step completes when its policy is on. Folding this in would keep Require MFA for Everyone open for a tenant setting, and change what Completed means.
   - It is a tenant setting with its own check, and it already sits directly below.
8. **Risk last, after devices** (outline C, Jon's layer 4). Rejected. Risk policies act only on flagged sign-ins, and people can clear them with their own MFA. Devices and sessions change everyone's day.
9. **Keep risk with sessions** (today's section 8). Rejected. Limit How Long Sessions Last has to sit with Require a Managed Device, because shared devices wait on both. Today that is a backward wait between two sections.
10. **Merge Up Next and On Hold into "Waiting", drop Up Next, or add a Completed tab.** Deferred, so the flow can settle first. With finished work shown in place, a Completed tab adds nothing.
11. **Follow Jon's layers exactly.** Rejected.
    - He publishes layers, not steps (his README and CALayers image; his wiki is empty). His one ordering rule is kept.
    - Following the layers strictly would put the countries block in the core, where it can't be turned on before security defaults go off. It would also put risk after devices.
    - You asked for logic over a documented order.
12. **Keep the countries location as its own step in §3** (the result if you decline decision 5). It works, and Stage 2 places it there in the meantime. The merge is still better: the location has one reader, and asking for the countries on a different step from the one that uses them is the jump you flagged.
13. **Security defaults: plans saved before the new record keep Completed.** This is the safer variant of decision 6. Choose it if you know of a plan that switched security defaults off in the last few days. Otherwise such a plan would read Doesn't apply, because nothing recorded that it ever saw them on. Either way it is only a word on a row with no records behind it; no policy is affected.

---

## 6. Dependency check

**What I counted:** every dependency the product itself reads, on the board's own rows:
- the graph's start, create and turn-on edges, with each tenant's conditions resolved;
- `blockedBy` and step blockers;
- turn-on waits (`enforceWaitsOn`);
- the Direction answers a step reads, and its "Answered in" links;
- readiness-gate routes to the campaign;
- the steps that create a missing object.

I ran it through `boardOf` on 13 tenants and counted distinct pairs where a step waits on one drawn below it. The tenants:
- getiamai, curated, with Emergency Access settled and Direction approved. This is the closest to yours.
- demo and demo week two.
- small, mid, large, messy and midflight. Each was run raw on the pinned baseline, and curated with Emergency Access settled.

| Tenant | Today, as drawn (finished groups at the bottom) | Today, registry order | Proposed | Designed hand-offs |
|---|---|---|---|---|
| getiamai (closest to yours) | 11 | 3 | 0 | 0 |
| demo | 4 | 4 | 0 | 2 (shared devices) |
| demo week two | 53 | 4 | 0 | 2 (shared devices) |
| small / large / midflight, curated | 15 / 14 / 12 | 3 / 3 / 3 | 0 | 0 |
| small / large / midflight, raw | 2 / 2 / 2 | 2 / 2 / 2 | 0 | 0 |
| mid, curated / raw (P2, shared devices) | 17 / 3 | 4 / 3 | 0 | 1 |
| messy, curated / raw (security defaults on, Sam's shape) | 20 / 11 | 11 / 11 | 0 | 4 (4.1–4.4 with 4.5) |

**Second check.** A separate review ran 45 variants: the 13 tenants plus micro and hostile, each raw, curated, fully settled and on the fixture baseline. Every generated step id maps to a section, and every number above came out the same.

It found one case the 13 tenants never reach. With an empty confirmed countries list, `generate.ts:2802-2812` gives every policy that names any place a wait on the countries location step. On raw getiamai, mid, small, large and demo, 5.1 received that wait, and on demo so did 7.4. Pointed at 6.3, that would be a wait on a step below. Those policies name only "All" or the trusted network, which a countries list can't change. Stage 3 narrows the wait to the policies that name the countries location, and the Stage 2 test covers the empty-list case.

**The two hand-offs are not waits on work further down:**
- Turn Off Security Defaults can only start once 4.1–4.4 are ready to turn on, and those four can only be turned on once security defaults are off. So the one step does both: switch security defaults off, then turn the four on.
- 7.5 does the same for 7.2 and 7.4.

**Other outlines on the same check** (the security-defaults tenant, counting pairs pointing down including hand-offs): outline A 12, outline B 10, outline C 4, this plan 4. The 4 for C and for this plan are the same hand-off inside one section.

**Text links:** the "who" text on admin MFA, admin sessions and PIM points to Use Separate Accounts for Admin Work, which now sits above all three (3.2).

**Housekeeping:** this pass wrote no probe. Six probes from earlier in this run are still in `docs/qa/night/personas/` in `C:\Dev\IAMAI-q-flow`:
- `qflow-graph.ts`
- `qflow-walk.ts`
- `order-probe.ts`
- `probe-flow-board.ts`
- `probe-flow-hist.ts`
- `probe-flow-steps.ts`

They are untracked and gitignored, which is why `git status` reads clean. They should be deleted before any stage starts. I have not deleted them.

---

## 7. Saved progress carries over

| What you saved | What happens |
|---|---|
| Anything on a step that stays | Untouched. Step ids don't change, so decisions, per-policy observation records, evidence, lifecycle, and Deferred or Doesn't apply choices stay under the same id. A section only changes where a row is drawn. |
| Emergency Access | Nothing changes. |
| Direction answers | Read from the same keys as today (`directionAnswers.ts`). Stage 3 also fixes the writer. Today, approving 2.3 would save the office network answer under 2.3's own id (`directionAnswers.ts:286`), but `savedAnswerOf` reads it only from `s-direction-locations:officeNetwork` (line 192). So 2.3 would never complete, and the "remote" / "not in Entra" answers would be lost. After Stage 3, each answer is written under its question's storage key. `s-direction-locations` stays a storage id that saved decisions still expand, kept apart from the three drawn Direction steps. |
| A Direction step you approved | If Where People Sign In From was approved but Devices was not, 2.3 opens with the office network already answered. If Devices was approved but Where was not, 2.3 asks only for the office network. Nothing new is held, because those policies already wait on that answer today. |
| Retired questions | Their saved values stay in storage, unread. A Direction step that was waiting only on one of them becomes complete, and the countries and device policies stop waiting on them. Nothing becomes stricter, and nothing you saved is lost. |
| Your countries | Your list (`allowedCountries`, `workCountriesConfirmed`) and the picker's saved decision stay under `s-prereq-allowed-countries`, and 6.3 reads them. Whether the location exists is read from the tenant on every scan. Old links to the location step and to `s-blocker-allowed-countries` open 6.3. |
| Choices on the countries location step | Decision 9. 6.3 is the policy step, so its own Deferred or Doesn't apply stands. If the location step had a different choice, 6.3 shows it once so you can decide again. That choice is not applied to the policy, because only a choice made on the policy itself takes a policy off the plan. Owner confirmations saved on the location step are read by 6.3. |
| Risk records | Today each risk step's history is stored as member `sole` (`tracking.ts requiredMembers`). A two-policy step looks for members by their baseline keys, so without a migration both report-only windows and their evidence would restart. Stage 4 moves the high step's record to the high policy's member key, and the medium step's record to the medium member key under the merged id. This is done once, on load. |
| Risk policies already in your tenant | IAMAI can't rewrite a policy's description (read-only), so a medium policy created from the old step keeps a tag naming the old step id. The merged step also reads that tag as its medium policy. |
| Choices on the medium-risk steps | Decision 9. The merged step holds two policies of equal standing. It is Deferred or Doesn't apply only if both old steps were. Otherwise it stays open and names the old choice once. The "plain MFA first" decision stays on the high sign-in risk policy. |
| Security defaults | New saved fact: the date a scan first read security defaults on (`PlanDecisions`, like `planCreatedAt`). If they are now off and that date exists, the step reads Completed. If they are off and no date exists, it reads Doesn't apply. Plans saved before this change have no date. See alternative 13 if you would rather they keep Completed. |
| Owners and ring dates | Not restored per step today (`progress.ts mergePersisted` is never called), so no merge can lose one. |
| Row numbers | These change. Printouts and exports made earlier carry the old numbers. The step ids remain the stable identity. |

---

## 8. Implementation plan, in build order

Each stage is its own set of commits. Before each push I run `npm run verify -- --prepush <that stage's tests>`. A stage is done only when its acceptance shows on screen, a unit test asserts it, and CI is green.

### Stage 1: the view (screen only, no engine change)
1. `src/ui/surfaces/planBoard.ts`:
   - `TABS` becomes `[ALL_WORK_TAB, ...LANES]`.
   - `allWorkGroups` keeps finished groups in place with `closed: true`. `drawGroup` already honours that flag, but nothing sets it today.
   - `applyFocus` drops the two toggles.
   - Delete `partitionPinnedGroups`, `pinnedBoardGroups`, `splitPinned`, `asideGroupsFor`, and the dead priority sort in `groupsFor` (lines 895–896).
2. `src/ui/surfaces/Plan.tsx`:
   - Line 99 defaults to All work.
   - Remove the foundation blocks and the aside (around lines 425 and 430).
   - `PlanControls` loses Show completed and Show deferred (around lines 491–496).
   - `TabFollowsOpenStep` (line 519) switches to All work when the opened step isn't in the current tab.
   - The header tiles filter the one list.
   - Completed and Deferred rows draw as one line.
3. `src/roadmap/stepGroups.ts`: remove `pinned` and `pinnedGroups`. `roadmap/foundations.ts` doesn't change, because the "no policy is Ready before Emergency Access and Direction" rule reads group membership, not pinning.
4. `docs/design/content.json`: change the how-to text ("Start with Ready" becomes "start at the top of All work"). The heading line for a finished section reuses `pages.app.plan.board.groupCompleted`.
5. Tests and checks that read the old view:
   - `planBoard.test.ts`: tab order, a finished section closed in place, nothing drawn twice from the header tiles.
   - `src/roadmap/stepGroups.test.ts`: it imports `partitionPinnedGroups`, `pinnedBoardGroups`, `splitPinned` and `pinnedGroups`, and asserts `pinned` (lines 9, 38, 88, 177–196). These tests are rewritten to "sections in order, finished ones closed in place".
   - `src/ui/surfaces/oneProducer.test.ts:199`: remove `BOARD.showCompleted` and `showDeferred` from the vocabulary list.
   - `docs/qa/night/personas/harness.ts:30,242`: it imports `asideGroupsFor`. The file is tracked but sits outside the tsconfig include, so type checking won't catch the break. I update it by hand and run it once.
   - `scripts/smoke.mjs`:
     - the default-tab check (line 585) becomes "All work first and selected";
     - the toggles check (line 599) is removed;
     - `revealAll` (line 1100) is removed;
     - the "Ready's order is what's next" comment (line 601) is rewritten.

**Acceptance:** the Plan opens on All work. With Emergency Access finished, the first line reads "1. Establish Emergency Access · 4 of 4 completed", collapsed. Show completed is gone.

### Stage 2: the order (registry and wording)
1. `stepGroups.ts STEP_GROUPS` gets eight entries in the order above. Their keys are `emergency-access`, `direction`, `prepare`, `core`, `extend-mfa`, `remaining-doors`, `devices-sessions`, and `ongoing` as the catch-all. Membership:
   - Every row in section 2's outline is listed by name, including the three uploaded-baseline rows and `cleanup-namedExclusions`.
   - Until the merges land, four rows get an interim place:
     - `s-direction-locations` as 2.4;
     - `s-prereq-allowed-countries` as 3.8 (an object, under your 2026-09-20 rule);
     - `s-goal-sign-in-risk-medium` and `s-goal-user-risk-medium`, each directly after its high partner.
   - If you decline decision 5 or 7, those places become permanent and nothing falls into Ongoing.
2. `content.json`: five new `pages.app.plan.groups.*` titles. The old ones are removed, and the commit message names them.
3. Two new tests in `stepGroups.test.ts`:
   - **Every wait points up.** For every edge in `dependency-data.json`, the prerequisite must sit above the step, except the two named hand-offs.
     - Graph nodes the plan never draws are mapped to where their question is asked now: `s-question-mail-devices` and `s-question-partner` to 2.1, `s-prereq-device-plan` to 2.3, and `s-question-travel` to the countries step (its old answer is stored there).
     - From Stages 3 and 4 onward, merged ids map to the step that absorbs them.
     - A board-level case runs the 13 tenants plus the empty-countries-list case.
   - **Nothing lands in Ongoing by accident.** Every step id the generator can build must be listed by a section. That covers the fixed ids, plus every catalogue goal passed through `goalMapFor` over the whole catalogue (what an uploaded baseline can build). The exceptions are the baseline-review rows (a prefix, in §8 by design) and the free-tier ladder while it is switched off.
4. Step snapshots regenerate (`docs/qa/step-snapshots`, following the `[snapshots]` commit rule).

**Acceptance:** your tenant shows sections 1–8 in this order, still with 41 rows. The tests fail if a later change puts a prerequisite below the step that needs it, or leaves a buildable step to the catch-all.

### Stage 3: merges and retirements
1. **Direction.**
   - `roadmap/direction.ts`:
     - `useQuestions` drops external methods.
     - `deviceQuestions` drops device exceptions and gains the office network.
     - `locationQuestions` goes, and `directionSteps` returns three steps.
     - `GOAL_DEPENDS`: the countries policy keeps only partner accounts, and the device policies keep computers and phones.
     - `ANSWERED_IN` loses the countries entry.
   - `roadmap/directionAnswers.ts`:
     - `legacyDecisionsOf` writes each Direction-only answer under its question's storage id (office network goes to `s-direction-locations`), not under the id of the step being approved.
     - `expandDirectionDecisions` expands a storage-id set: the three drawn steps plus `s-direction-locations`.
   - `stepGroups.ts DIRECTION_STEP_IDS` becomes three ids. `s-direction-locations` leaves the drawn set and stays a storage id.
2. **Countries (6.3).**
   - `generate.ts`: the location step is no longer built. Its reading (location matched, proposed name, older-plan "Confirm Work Countries" hold) becomes 6.3's second task and check.
   - 6.3 carries a decision hold (reads Needs decision) until at least one work country is saved. The picker is on the step, and its decision is still saved under `DECISION_STEPS.countries`.
   - `resolvePolicy.ts` (lines 40, 491, 493): the countries location's maker becomes 6.3 itself. The policy text says "create the countries location first (task 2)" instead of naming another step.
   - `planLanes.ts observe`: a missing object the step makes itself is treated as its own task, not a wait. Without this, 6.3 would wait on itself, or read On Hold · missingObject as the second check found on getiamai, mid and small.
   - `stepIds.ts REPAIR_STEP_ALIASES`: `s-blocker-allowed-countries` and `s-prereq-allowed-countries` both resolve to 6.3. `blockerSteps.ts attachConfigurationFindings` then puts `cty.seenCountriesIncluded`, `cty.includesOperator` and `cty.unknownCountries` on 6.3 instead of silently dropping them.
   - `generate.ts:2802-2812` (the countries-unsafe hold):
     - it applies only to policies that name the countries location, either by its resolved id or by the `{allowedCountriesLocation}` token;
     - on 6.3 itself it holds the turn-on and adds no step wait.
   - Implementation content: `docs/implementation-content/s-prereq-allowed-countries` folds into `s-goal-geo-restriction` (its tasks come first), regenerated through the registry pipeline.
   - The graph's source, `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md`, folds the location node into 6.3. `dependency-data.json` is regenerated from it. I'll show you the playbook diff.
3. **Doesn't apply readings.**
   - Security defaults:
     - A new `PlanDecisions` field records the date a scan first read security defaults on.
     - If they are off and that date exists, the step reads Completed. If they are off and no date exists, it reads Doesn't apply.
     - Engine rule 3 (`generate.ts:2816-2822`) reads the scan's security-defaults reading (on, or not read) instead of the step's `satisfied`. So drawing the row as Doesn't apply can never hold every policy behind it.
     - I will not copy the service-accounts pattern here, because that pattern sets `satisfied: false`.
   - Trusted network: "Everyone works remotely" reads Doesn't apply. 5.1's "no trusted location" hold (`generate.ts:2796`) currently checks whether the network step is done. It must treat Doesn't apply the same as done, so remote tenants keep that hold.
4. **Tests:**
   - `direction.test.ts`: three steps, and the retired questions are gone.
   - `decisions.test.ts` / `stepDecisions.test.ts`: approving 2.3 saves the office network answer, reads it back, and completes 2.3.
   - `resolvePolicy.test.ts` / `planLanes.test.ts`, on getiamai, mid and small:
     - 6.3 is Ready or Up Next, never On Hold · missingObject;
     - it reads Needs decision with no countries saved;
     - on getiamai, mid and demo, the three lockout checks show on 6.3;
     - with an empty list, no other step waits on 6.3.
   - `planLanesHolds.test.ts`:
     - security defaults off at the first scan: Doesn't apply, and no policy is held;
     - seen on, then off: Completed;
     - everyone remote: 5.1 keeps its hold.
   - Step snapshots regenerate.

**Acceptance:** Direction shows three steps. The countries work is one row (6.3) that asks for your countries, creates the location, then the policy. Turn Off Security Defaults is in the Doesn't apply footer on your tenant. The empty-list test reads 0.

### Stage 4: the risk pairs
1. **Goal map.**
   - The pinned baseline's `goalMap` puts both sign-in risk policies under `sign-in-risk`, and both user risk policies under `user-risk`. That file is yours, so you edit it or approve my edit.
   - `coverage/goalIdentity.ts MERGE_ANCHOR` gains the two pairs, so an uploaded baseline merges the same way. This is the existing precedent: Limit Browser Sessions on Unmanaged Devices already absorbs the block-downloads goal.
   - `content.json mergesGoals` gains the same two pairs.
2. **Records:**
   - On load, each old `sole` record moves to its policy's member key under the merged id, once (section 7). This is tested on mid, where both risk steps are `sole` today.
3. **Tags:** for the merged step, `findTaggedPolicies` also reads the retired medium id's tag as the medium policy.
4. **Readers that know high from medium stay per policy:**
   - `evidence.ts` (`RISK_HIGH_GOALS` / `RISK_MEDIUM_GOALS`)
   - `readiness.ts RISK_GOALS`
   - `rowWho.ts`
   - `scenarioLines.ts`
   - `deviations.ts` (plain MFA first stays with the high sign-in risk policy)
5. **Links and choices:**
   - Old medium ids open the merged step (`routes.ts` alias).
   - Choices follow decision 9.
6. **Content and graph:**
   - The medium implementation-content packages fold into the high ones.
   - The playbook folds the medium nodes into their pairs, and `dependency-data.json` is regenerated from it.
7. **Tests:**
   - `tracking.test.ts`: after migration, both policies keep their report-only windows and evidence, and a medium policy tagged with the old id is found.
   - `stepGroups.test.ts` and `planLanes.test.ts`: the merged ids map to 5.6 and 5.7.
   - Step snapshots regenerate.

**Acceptance:** on mid, Challenge Risky Sign-ins and Remediate Risky Users are two rows, each holding two policies, and neither policy's report-only window restarts.

### Stage 5: print and exports
- Print (`printPlan.ts`) groups rows by phase and lane today. After this stage it prints the eight sections in board order with board numbers, and finished sections as one line (it already reads `planRows`).
- Exports (the plan file's readable steps, CSV, calendar) list steps in board order with section numbers.
- Dates are not reordered. They come from dependencies (`schedule.ts`), which now run top to bottom.
- Stage 5 touches print, which you review on paper. I'll bring its exact file list and tests to you before building it.

**Acceptance:** the printed plan and the export show the same sections, order and numbers as the screen.