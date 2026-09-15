# IAMAI Product Audit

*Full product audit · getiamai.com · build c65d9f4*

Scored against one reader: a help desk tech or junior admin at an MSP who has never opened the Entra admin center. Every Plan step in the production test tenant (32) was opened and every implementation tab read.

- **Date** Sep 13, 2026
- **Tenant** GetIAMAI test tenant, signed in as Global Administrator
- **Scan** 3 active people · 38 baseline policies · 32 steps
- **Browsers** Chrome 1280 px (both themes); headless Chrome at 390 and 768 px

| Fail | Weak | Pass | Not tested |
| --- | --- | --- | --- |
| 50 | 86 | 73 | 3 |

**Changes this audit made to the test tenant's plan (nothing was written to the tenant):**

- **Start the plan** was clicked to test item 3.2.1. The plan now reads *Started Sep 14, 2026*. No undo was offered.
- **Scan again** was run once, so the snapshot is from today.
- `iamai-mfa-readiness.csv` was downloaded to Downloads (item 5.3.4).
- I signed out and you signed back in. No mapping, decision, or Save button was used, and the theme is back to light.

**A premise in the checklist is out of date.** Item 4.7a treats *Entra admin center → Protection → Conditional Access* as the correct path. Current Microsoft Learn pages say *Entra ID › Conditional Access › Policies*, so this audit flags the older “Protection” wording and any missing “Entra ID” level as the problem.

## Summary — What to fix, in order

The code is honest and careful about safety. The main risk is the words a tech reads on a step: some are wrong, some are placeholders, and some are internal. Critical items would embarrass the product or send a tech to change the wrong policy.

### Critical — fix before sharing

1. **Require MFA for Everyone points at the admin policy.** The Entra tab says “Open the policy named Core - Allow - MFA for Admins”. The tenant's all-users policy is *Core - Allow - MFA for Internal Users*. The JSON PATCH targets the same policy ID `3761575d…` used by the two admin steps. Following the step would re-scope the admin policy to All users and swap its phishing-resistant grant for plain MFA. The demo names the right policy. _(see 4.7a · step 8)_
2. **“Content could not be loaded — report this at feedback@getiamai.com” appears on 26 of 32 steps:** in the Email tab on 26 steps, JSON on 12, PowerShell on 10, and Entra and AI Info on 3 each. The product tells the tech it is broken on most steps. _(see 4.7 · 9.4)_
3. **Set Up Passkeys to Match the Baseline** reads Ready, with “No blockers. Ready to proceed.”, yet every tab is withheld or fails to load and the action column is empty. A Ready step gives the tech nothing to do. _(see step 3)_
4. **Six steps have Entra instructions a tech cannot follow.** They contain phrases like “Configure the canonical grant and session controls exactly as described in STEP.md”, “Apply the IAMAI-resolved canonical conditions exactly”, and “Open the exact existing policy identified by IAMAI stable ID 0a8317a6…”, plus unfilled placeholders such as `‹registration access control›` and `‹authentication context name›`. Affected: Token Protection, High-Risk Users, Sign-in Method Registration, Unsupported Platforms, Countries Not Allowed, MFA at Role Activation. _(see 4.7a)_
5. **PowerShell contradicts Entra on the same step.** Entra says “Save. Do not change the policy state (leave it On)”. The script for Shorten Admin Sessions, Authentication Transfer and Device Code refuses to correct an On policy and moves it to Report-only first. The generic scripts also can't run: they require `-TargetPolicyJson`, which nothing supplies, and are invoked with `'‹exclusions group›'`, which fails their own GUID check. _(see 4.7b)_
6. **The JSON tab offers copyable payloads that Graph will reject.** Examples: `{"conditions":"‹policy conditions›"}`, and `"excludeGroups":"‹exclusions group›"` as a string instead of an array. Found on 17 steps. _(see 4.7c)_
7. **The readiness bar says “Ready now” while its tiles block.** Emergency Access Accounts shows two “!” *Not selected* tiles. Allowed Countries shows a “!” *Confirm* tile. _(see 4.5)_
8. **Internal vocabulary reaches the tech** in step text, dialogs and tabs, counted across all 32 steps: “canonical” on 22, “IAMAI-resolved” on 9, “tenant-resolved” on 4, “source-tenant” and “pinned IAMAI” on 3 each, “retained IAMAI/baseline” on 3, and “owner-confirmed”, “tenant truth” and “stable tenant” on 2 each. There are no hits for “profileOptInApproved” or “mismatch modules”. _(see 9.2)_

### Major — fix within a week

1. **Impact reads “Not established” on 20 rows.** That's all 9 enforced policies, all Up Next policies and all On Hold steps. Every one repeats the tile “this scan could not settle the policy's scope, so no count is shown”. To a tech it looks broken. _(see 3.5 · 4.3)_
2. **The projected finish is misleading.** Sep 21 assumes “once nothing is held”, but 7 steps are on hold and one waits on the baseline's author with no date. _(see 3.1.3)_
3. **Start the plan has no confirmation, explanation or undo.** It stamps a start date and removes the Start date control. _(see 3.2.1)_
4. **Baseline mappings don't say what the groups are.** They show fragments like “Group 62d67e66” with no hint of each group's purpose, while the tenant already has a likely match (*SG - Entra - Passkey Bootstrap*). Group 8d0564e5 says “names it in 2 of its 38 policies” but lists one. _(see 3.3)_
5. **Search in the step list only covers the open tab.** Searching “exclusions” on On Hold answers “No steps match this search.” while *Create or Correct Exclusions Group* sits in Ready, and tab counts never change. _(see 3.4.4)_
6. **Progress bars on the 9 “Ready · Correct” policies show all four stages filled**, up to Enforced. Legacy Authentication's own instructions move that policy back to Report-only. _(see 4.1)_
7. **Remediate High-Risk Users is Ready** although it has the unmapped-group blocker that puts six sibling policies On Hold. _(see step 16)_
8. **Prerequisite tiles say “PREREQUISITE · IN PROGRESS”** for steps nobody has started. Three “Confirm” tiles open to empty detail: travel, mail-sending devices, partner access. _(see 4.3)_
9. **The Why IAMAI says this dialogs use internal reasoning.** Examples: “IAMAI's proof ledger is the readiness authority”, “the source tenant GUID is not portable”. The only button is “Minimize”, and one dialog sends the tech to a step that doesn't exist (*Consolidate Overlapping Policies*). _(see 4.5)_
10. **Email templates exist on only 4 steps.** “Emails signed as: IT” is unexplained, and none of the 4 templates uses it. _(see 3.2 · 4.7e)_
11. **Change baseline opens the operating system file picker at once**, with no explanation of the format. The open picker also froze the tab. _(see 2.2.2)_
12. **A direct load of /planner/#/plan took about 20 seconds**, and one attempt showed nothing after 30 seconds. In a background tab it stays on “Loading…” indefinitely. _(see 9.5)_
13. **Readiness row buttons are mislabelled.** “Test Android →” opens an explanation and runs no test. Export CSV exports only the current filter, so the default view drops Ready people. _(see 5.2 · 5.3)_
14. **Missing trust basics:** no privacy policy (/privacy is a 404), no pricing statement, no Preview label, no security contact. _(see 1.1.5 · 9.6 · 10.1)_
15. **The demo doesn't match production for the same step.** Differences include the policy name, a real JSON payload versus placeholders, and different Done-when text on Block Device Code Sign-in. _(see 8.2)_
16. **Guests MFA sends the tech to “find it by ID in Plan settings”.** Plan settings shows no policy IDs. _(see step 14)_

### Minor — fix within a month

1. **Plan settings text runs together:** “Eligible workdaysMonday to Friday and Saturday and Sunday”. _(see 3.2.3)_
2. **The home page trust line is 11 px grey text.** The GitHub link in the source section opens in the same tab. The phone navigation hides “How it works”. _(see 1.1.4 · 1.4 · 1.5.3)_
3. **Pinned version is confusing.** “pinned version” is never explained. Source and version reads “tells you when he updates it”, with no clear “it” or “he”. _(see 2.2)_
4. **Scan times are relative only** (“yesterday”, “24 minutes ago”), with no absolute time or time zone. Sign-out leaves `?state=…` in the address bar. _(see 2.3.2 · 2.1.5)_
5. **Tile and label polish:** _(see 3.1 · 3.2)_
   - The projected-finish year sits on its own line with a stray comma.
   - “Started —” should read “Not started”.
   - The Time zone list has 419 raw IANA names.
   - The Change freeze “to” field wraps to a new line.
6. **Tile copy has typos and fragments:** _(see 4.3 · 4.6)_
   - “when 1 trusted location exist (now 0)”
   - “device readiness is 0% today” (lowercase start)
   - “leave it out there.Open Baseline mappings” (missing space)
   - “Blocking items still closed: 7”
   - “Yes: add: ; the service-accounts group carries them”
7. **Portal paths are inconsistent across steps.** They mix “Protection →”, a missing “Entra ID” level, and “Security → Authentication methods”. The old name “Require hybrid Azure AD joined device” also appears. _(see 4.7a)_
8. **Readiness footer runs together:** “1 sign-in disabled sign-ins Aug 14 → Sep 13”. _(see 5.3.1)_
9. **Export tip ends “…does not depend on it.?”**, where the tip button reads as punctuation. _(see 6.1)_
10. **The How page's build line is dated tomorrow** (“Sep 14, 2026”). _(see 7.2)_
11. **Copy implementation gives no “Copied” confirmation.** The implementation preview box is about 110 px tall and shows three lines. _(see 4.7a · 9.8)_
12. **Cleanup steps look different.** They have no step-type label, seven separate Save buttons, and an empty “Done on” label. _(see 4.10)_

### Strategic — next version

1. **Implementation tabs.** Show a tab only when its content is complete and valid for this tenant. Drop the five-tab grid, and make Entra steps a numbered, tenant-specific walkthrough every time. _(see 4.7)_
2. **Plain-language layer.** Add one glossary and state model a tech can learn once: Correct, Report-only, exclusions group, baseline mapping, proof. Use it for row states, bars and tiles. _(see 3.5 · 9.2)_
3. **Affected people for enforced policies.** Compute who each enforced policy reaches, so Impact and the Affected people tile carry a number. _(see 3.5)_
4. **Mapping assistant.** Show the author's group name and purpose from the baseline repo and suggest tenant matches. _(see 3.3)_
5. **Export redesign.** Offer a runbook PDF per step, a management one-pager, a readiness PDF, an importable policy pack and a before/after diff. Fold the 11 CSV buttons into one download. _(see 6)_
6. **In-app “Report a problem with this step”.** Carry the step ID and build, never tenant data. _(see 10.4)_
7. **Positioning.** Add a “How IAMAI differs” note (CIPP, Secure Score, Maester), a cost statement and a Preview label. Plan for testimonials once pilot MSPs exist. _(see 10)_
8. **Session.** A session that survives a new tab, and a Plan that renders in a background tab. _(see 9.5)_

## Part 1 — Homepage · getiamai.com

### 1.1 First impression

- **1.1.1 · W** — **Headline explains what IAMAI does**

  “Strengthen identity security without guessing what will break.” reads as a benefit, not a product. A tech can't tell it's a Conditional Access rollout planner until the subhead.

  **Fix:** Say what it is: “Plan your Microsoft Entra Conditional Access rollout without locking anyone out.”

- **1.1.2 · P** — **Subhead explains how it works**

  Covers reading the tenant, the reviewed baseline, the dated plan and report-only first. Read-only and browser-only follow directly beneath it.

- **1.1.3 · W** — **CTAs differentiated**

  Filled “Open IAMAI” next to outlined “Try it with sample data” is visually clear. Nothing warns that Open IAMAI needs a Microsoft admin sign-in and consent.

  **Fix:** “Connect a tenant” and “Try with sample data (no sign-in)”.

- **1.1.4 · W** — **Trust signals answer “will this change my tenant?”**

  The words are right (“Read-only · Runs in your browser · Source is public”), but it is the smallest, lowest-contrast text above the fold (11 px grey).

  **Fix:** Promote it to a sentence under the buttons: “Read-only: IAMAI has no permission that can change your tenant.”

- **1.1.5 · F** — **Preview or Beta indicator**

  None on the homepage, planner or How page. The product is changing daily; the last five commits are content fixes from today.

  **Fix:** Add a “Preview” tag beside the wordmark and a line on what that means.

### 1.2 Value communication

- **1.2.1 · P** — **What it does: Reads / Compares / Plans**

  Three concrete rows a newcomer can follow: policies, people, groups, devices and 30 days of sign-ins; a control you built counts as done; dated steps with who each change touches.

- **1.2.2 · W** — **Baseline section explains baseline, Jon Hope, why it matters**

  It defines a baseline and names Jon Hope as a Microsoft MVP. It doesn't link to the baseline or ConditionalAccess.Tech, and doesn't say why a published baseline beats policies written by hand. “Shows you the author's changes before you take them” is abstract.

  **Fix:** Link the source, and add one line: “A tested set of 38 policies used across many tenants, so you aren't inventing your own.”

- **1.2.3 · P** — **What it catches: concrete examples**

  A help desk tech recognises these: an admin whose only method is SMS, a meeting-room device signed out hourly, a service account stopped at 2 a.m. “Legacy-authentication block” is the one unexplained term.

- **1.2.4 · W** — **“Inspect it before you connect a tenant” addresses security**

  Strong copy: no write permission, no server, public source. An MSP owner still wants three things it doesn't give here. The permission list isn't linked. It doesn't say consent adds an Enterprise application (“IAMAI Planner”) to the client tenant. The Cloudflare page-load beacon is disclosed only on the How page.

  **Fix:** Add “See the 6 permissions and how to remove the app →” linking to How.

### 1.3 About

- **1.3.1 · W** — **Builds credibility**

  Names Lachlan Robinette, identity security posture management work and MSP-scale baselines, with a humble tone. Missing: a photo or company, years or scale, and a link. “These tools” implies several products.

  **Fix:** Say “this tool”, add a LinkedIn link inline and one concrete credential (tenants, years).

- **1.3.2 · W** — **Contact beyond the footer email**

  Only the footer: LinkedIn and `feedback@getiamai.com`. No GitHub Issues link, form or security contact.

### 1.4 Links and navigation

- **1.4.1 · P** — **IAMAI logo**

  `/` loads (200).

- **1.4.2 · P** — **How it works**

  `/planner/#/how` loads. It is the in-app technical page, not a marketing explainer (see 7.1.4).

- **1.4.3 · P** — **GitHub (nav)**

  Opens the public repo in a new tab.

- **1.4.4 · P** — **Open IAMAI → (nav)**

  `/planner/#/connect` loads.

- **1.4.5 · P** — **Open IAMAI (hero)**

  `/planner/#/connect` loads.

- **1.4.6 · P** — **Try it with sample data**

  `/planner/?demo=1#/plan` renders the sample plan in about 0.35 s.

- **1.4.7 · P** — **Open IAMAI → (baseline section)**

  `/planner/#/connect` loads.

- **1.4.8 · W** — **GitHub link (source section)**

  Correct repo, but opens in the same tab; the other two GitHub links open a new tab.

- **1.4.9 · P** — **Follow me on LinkedIn**

  Opens linkedin.com/in/lachlanrobinette in a new tab. The server's 999 response to a script is LinkedIn's bot block and is normal.

- **1.4.10 · P** — **GitHub (footer)**

  New tab, correct repo.

- **1.4.11 · P** — **feedback@getiamai.com**

  `mailto:feedback@getiamai.com`, correct address.

- **1.4.12 · W** — **External links open in new tabs**

  All except the source-section GitHub link (1.4.8).

- **1.4.13 · P** — **GitHub repo exists and is public**

  Public, MIT licence, description “Read-only Microsoft Entra Conditional Access rollout planner that runs in your browser.”

### 1.5 Visual quality

- **1.5.1 · W** — **Dark theme**

  Clean and well spaced. In dark mode the primary “Open IAMAI” is a dark teal fill with a teal border, visually no stronger than the secondary button. The trust line gets fainter still.

- **1.5.2 · P** — **Light theme**

  Renders correctly at 390 and 1280 px, with no contrast problems in the body copy.

- **1.5.3 · W** — **Responsive**

  At 390 and 768 px the page stacks with no horizontal scroll. At phone width the nav drops “How it works”, the main trust link.

## Part 2 — Connect · /planner/#/connect

### 2.1 Sign-in flow

- **2.1.1 · P** — **Sign in with Microsoft works on first click**

  Silent sign-in through the existing Microsoft session in about 3 s. After a sign-out it redirects to the Microsoft account picker, as expected.

- **2.1.2 · P** — **Tenant name and account shown**

  “Signed in · GetIAMAI”, with the account's sign-in name.

- **2.1.3 · P** — **Role displayed**

  “· Global Administrator”. The copy above recommends Global Reader, but no hint marks this sign-in as more privileged than needed.

- **2.1.4 · N/T** — **Sign in with another account**

  Not completed. It hands off to login.microsoftonline.com, which the automation browser can't operate and where credentials must not be entered. The regular sign-in redirect there worked.

- **2.1.5 · P** — **Sign out works and clears the session**

  Full Microsoft sign-out and return. Connect shows “no tenant connected” and the top nav is hidden. The plan record survived: after signing back in, Plan still showed *Started Sep 14, 2026*. Minor: the address keeps `?state=eyJpZCI6…`.

### 2.2 Baseline

- **2.2.1 · P** — **Name, author, policy count**

  “Jon Hope — Defense in Depth · 38 policies · pinned version”.

- **2.2.2 · F** — **Change baseline**

  Opens the operating system's file picker for a `.json` file at once, with no dialog, no explanation of what file, and no way back to the default. While the picker was open the tab stopped responding to screenshots until reload.

  **Fix:** Open a dialog: what a baseline package is, a link to How › Baseline packages, “Choose file…”, and “Keep Defense in Depth”.

- **2.2.3 · W** — **Source and version expands usefully**

  Shows the repo link and “Commit 90d9b89, read from that repository on Sep 7, 2026.” The lead sentence has no clear antecedent, and a commit hash means nothing to a tech.

  > IAMAI pins a reviewed version of it and tells you when he updates it.

- **2.2.4 · F** — **“Pinned version” explained**

  Not explained anywhere on Connect.

  **Fix:** “IAMAI uses a reviewed copy of the baseline from Sep 7, 2026. If Jon Hope changes it, you'll see the changes before they're used.”

### 2.3 Scan

- **2.3.1 · P** — **Scan again works**

  About 7 s, with live progress (“reading sign-in records, 1 page · 200 records · 5s”). Unexpected: when it finishes it jumps to the Plan page instead of staying on Connect.

- **2.3.2 · W** — **Scan timestamp readable and time zone correct**

  Relative only (“complete · yesterday”, “24 minutes ago”), with no absolute date, time, time zone or tooltip.

  **Fix:** “Scanned Sep 13, 7:42 PM MDT (24 minutes ago)”.

- **2.3.3 · P** — **IAMAI limitations**

  Honest and concrete: Direct Send printers leave no record, federation and third-party MFA aren't visible, quarterly jobs have no evidence yet, “a walk through the comms room beats any report”.

### 2.4 Plan tile

- **2.4.1 · P** — **Open the plan →**

  Navigates to Plan; rows render in about 40 ms when arriving from Connect.

- **2.4.2 · P** — **Step count, completed, scan age**

  “ready · 32 steps, 0 completed · from the scan yesterday”.

### 2.5 Content quality

- **2.5.1 · W** — **Any sentence confusing on first read**

  The sign-in paragraph recommends Global Reader and requires Global Administrator in the same breath. The setup page reuses the homepage hero as its H1. Before sign-in, “What the sample tenant produced: 30 active people · 31 steps · 3 weeks” sits where the user's own plan will appear.

  > Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can. It writes nothing. The first sign-in in a tenant needs an account that can grant consent (a Global Administrator, once); every sign-in after that can be Global Reader.

  **Fix:** “First time in this tenant: sign in as a Global Administrator to approve read-only access. After that, a Global Reader account is enough.”

- **2.5.2 · W** — **Internal terms or jargon**

  Unexplained: consent, PIM, pinned version, baseline (defined only inside the card), Direct Send, federation, least privilege.

- **2.5.3 · W** — **“What IAMAI asks for, and how to remove it”**

  Good: all 6 consent-screen permissions in Microsoft's wording, each with a plain meaning, plus a removal path. Missing: that approval is tenant-wide and adds an Enterprise application, and the Graph names (Policy.Read.All…) shown on How, so the two can be matched. The right-hand column is misaligned row to row. The removal path lacks “Entra ID ›” and the Properties tab.

## Part 3 — Plan · /planner/#/plan

### 3.1 Header tiles

- **3.1.1 · P** — **Steps tile**

  32, which equals Ready 19 + Up Next 6 + On Hold 7.

- **3.1.2 · P** — **Completed tile**

  0, correct for a tenant where no step is done.

- **3.1.3 · F** — **Projected finish: format, (i), “at pace”**

  The (i) button works and explains the length, but the date is misleading: it covers only unblocked work. The year sits on its own line with a separate comma, so screen readers hear “Sep 21 , 2026”. “at pace” is never defined.

  > What set the plan length
  > Once nothing is held, the plan is about 1 week because MFA registration for 3 people takes 1 week and nothing is enforced yet.

  **Fix:** “Sep 21, 2026 for 25 steps · 7 on hold, no date yet”.

- **3.1.4 · W** — **Started tile before starting**

  Shows “—” over “Started”, which could mean not started or unknown.

  **Fix:** “Not started”.

- **3.1.5 · W** — **Tiles balanced**

  Four fixed tiles fill about half the 1280 px width. Three hold a bottom-aligned number; Projected finish stacks five lines (day, year, icon, “at pace”, label), so the row looks uneven.

### 3.2 Plan controls

- **3.2.1 · F** — **Start the plan: what it does, confirmation, reversible**

  One click, with no confirmation and no text explaining what starting means. The Started tile became “Sep 14, 2026” and the Start date picker and button disappeared. No Undo, Reset or Not-started control appeared, and the start survives sign-out.

  **Fix:** A confirm dialog (“Starting fixes Sep 14 as day 1 and begins dating steps. You can change the start date in Plan settings.”) and a visible way back.

- **3.2.2 · W** — **Start date picker**

  A native date input (09/14/2026) that duplicates “Plan starts” in Plan settings: two controls for one fact. The date was not changed during the audit, to keep the schedule intact.

- **3.2.3 · W** — **Plan settings opens**

  Opens inline as a narrow panel (about 450 px) with the rest of the row empty. Save and Close sit at the very bottom, after the long mappings list.

- **3.2.3a · P** — **Plan starts date**

  Date input, 09/14/2026.

- **3.2.3b · P** — **First deployment date**

  09/15/2026, with an explanation: “Preparation begins on the start date; policies are first created, in report-only, on the first deployment day.”

- **3.2.3c · F** — **Eligible workdays**

  Missing space, a phrase that means “every day” the long way round, and not editable.

  > Eligible workdaysMonday to Friday and Saturday and Sunday

  **Fix:** “Eligible workdays: every day” with a day picker, or “Mon–Fri” as the default.

- **3.2.3d · W** — **Change freeze date pickers**

  Both inputs render empty (mm/dd/yyyy) and the “to” field wraps onto its own line. Not saved during the audit. The rule is clear: “No step enforces inside the freeze or on the last working day before it.”

- **3.2.3e · W** — **Time zone**

  A native select of 419 raw IANA IDs (Africa/Abidjan… Pacific/Wallis, including legacy Asia/Calcutta) with America/Denver selected. Nothing says where the default came from or what it affects.

- **3.2.3f · F** — **Emails signed as**

  A text field prefilled “IT” with no explanation. It's meant for the Email tab, which fails to load on 26 steps, and the 4 real templates don't use it.

  **Fix:** “Sign-off for the user emails in each step (for example: Contoso IT Team)”.

- **3.2.4 · P** — **How to use this plan →**

  Expands five plain bullets: preparation first, scheduling on workdays, waiting steps held, open a step to review, settings. Minor: styled as a link with an arrow that suggests leaving the page.

### 3.3 Baseline mappings (inside Plan settings)

- **3.3.1 · F** — **Group headings human-readable**

  All five headings are GUID fragments.

  > Group 62d67e66 · Group 5628ad67 · Group 2d25c298 · Group 8d0564e5 · Group cc7f9bb7

- **3.3.2 · F** — **Explains what each group is used for**

  Says how the baseline uses it (“leaves it out of 23 of its 38 policies”) and which steps name it, never what the group is (break-glass, passkey bootstrap, service accounts). The tenant already has a likely candidate, *SG - Entra - Passkey Bootstrap*, excluded from its MFA policies.

  **Fix:** Show the author's group name and purpose from the baseline repo, and suggest matches.

- **3.3.3 · P** — **“None needed here: leave it out” consequence**

  Explained per group: “the people it spared stay in scope, unless another exclusion in this tenant covers them.”

- **3.3.4 · N/T** — **“Use this tenant's own:” search**

  Present on every group. Not typed into, to avoid changing a mapping in the test plan. The step-level group and strength search did work: “MFA” in Authentication Strength returned 2 results.

- **3.3.5 · W** — **“The baseline's identifier for it”**

  “it” has no clear referent, and expanding shows only the full GUID (`62d67e66-2bc9-43cd-…`), which a tech can't use.

- **3.3.6 · W** — **Unmapped count, and obvious they block On Hold**

  5 unmapped groups, each ending “Not answered yet: the policies that name it are on hold.” The settings panel hides behind a small link, and On Hold rows don't point to it (only tiles inside steps do). One card miscounts: “names it in 2 of its 38 policies” lists one policy.

### 3.4 Tabs and filters

- **3.4.1 · P** — **Ready tab**

  19 rows, count matches.

- **3.4.2 · P** — **Up Next tab**

  6 rows, each state naming its dependency.

- **3.4.3 · W** — **On Hold tab and hold reasons**

  7 rows grouped under “Baseline conflict · 1 step” and “Baseline references an unmapped group · 6 steps”. The reasons are internal wording (see 3.7).

- **3.4.4 · F** — **Search steps**

  Searches only the open tab and never updates tab counts. From On Hold, “exclusions” answers “No steps match this search.” while *Create or Correct Exclusions Group* is in Ready.

  **Fix:** Search all tabs and show match counts on each tab.

- **3.4.5 · W** — **Work type filter**

  Filters within the tab (All work 7, Conditional Access 7, MFA & Authentication 0 on On Hold). Tab counts don't change. *Require MFA to Register a Device* isn't counted as MFA & Authentication.

- **3.4.6 · W** — **Show completed**

  Toggles (aria-pressed true). With 0 completed nothing visible changes and there's no “none yet” message.

- **3.4.7 · W** — **Show deferred**

  Same as 3.4.6: toggles, no feedback at 0.

### 3.5 Ready rows (19)

- **3.5.1 · W** — **State labels**

  “Ready · Decision” is clear. The other two aren't:

  - “Ready · Correct” plus a green “● Enforced” reads as “it's enforced, and correct”, when it means “an existing policy needs fixing”.
  - “Ready · Create” also labels reviews and checks that create nothing: Review Baseline Policies IAMAI Did Not Assess, Use Separate Accounts for Admin Work, Rename Policies Off the Naming Convention.

  **Fix:** “Fix existing policy”, “Create”, “Decide”, “Review”.

- **3.5.2 · W** — **Step names**

  Most name the action well (Require MFA for Everyone, Block Legacy Authentication, Define the Trusted Network). Confusing, awkward or jargon: “Create the Baseline's Authentication Strength”, “Create or Correct Allowed Countries Location”, “Block Authentication Transfer”, “Review Baseline Policies IAMAI Did Not Assess”, “Rename Policies Off the Naming Convention”, “Require Token Protection on Windows”.

- **3.5.3 · F** — **Impact column**

  All 9 enforced policies show “Not established”. Four preparation rows show an object type instead of an impact (“Passkey settings”, “Authentication strength”, “Trusted network”, “Country restrictions”), and 4 rows show “—”. Only 3 rows show people: 3, 1, and 29 in demo.

  **Fix:** Show people reached, or “Tenant setting” for configuration steps. Never show “Not established” without the next action.

- **3.5.4 · W** — **When column**

  Preparation rows show Sep 14, 2026. The 9 enforced policies and 2 cleanup reviews show an unexplained “—”, and “—” is also used for “no people”.

### 3.6 Up Next rows (6)

- **3.6.1 · P** — **State explains what it waits on**

  “Up Next · After Set Up Passkeys to Match the Baseline”, “After Create the Baseline's Authentication Strength”, “After Decide How Devices Are Managed”.

- **3.6.2 · W** — **Dependency clear from the row alone**

  The row names one dependency, but the step inside lists two or three: PIM waits on the exclusions group, authentication strength and emergency accounts. Impact is “Not established” on 5 of 6 and When is “—” on 5 of 6.

### 3.7 On Hold rows (7)

- **3.7.1 · W** — **Hold reason clear to a tech**

  “Baseline conflict” and “Baseline references an unmapped group” are author-speak. The conflict step's inside text is excellent (“Nothing is wrong in your tenant… There is nothing for you to do.”); the row says none of that.

- **3.7.2 · F** — **Tech knows how to unblock**

  Nothing on the row says “open Plan settings › Baseline mappings”, and the conflict row doesn't say “no action needed”.

  **Fix:** Row sub-line “Answer 1 question in Plan settings →” or “Waiting on the baseline author — no action”.

## Part 4 — Individual steps (all 32 opened)

Each checklist item is scored across all 32 steps, and every exception is named. Each step's own clarity rating and biggest fix are in the table at 4.11.

### 4.1 Header

- **4.1.1 · W** — **Step type label present and correct**

  Present on 30 of 32: Preparation ×6, Policy ×19, Check ×2, Campaign ×1, and Resolution ×1, a type not in the checklist. Missing on both cleanup steps (Review Baseline Policies IAMAI Did Not Assess, Rename Policies Off the Naming Convention). *Decide How Devices Are Managed* is labelled CHECK STEP but is a decision.

- **4.1.2 · W** — **Title clear**

  See 3.5.2 for the unclear names. Also: *Create and Enforce the MFA Registration Campaign* (a campaign is enabled, not enforced), and *Reset Passwords for Medium-Risk Users* (it also requires MFA).

- **4.1.3 · W** — **Badge matches state**

  Every chip matches its row. But the chip, the bar and the progress track use different words for one state: “Ready · Correct / Enforced” (chip), “Needs correction” (bar), all four stages filled (track). On Emergency Access Accounts the chip says “Ready · Create” while both tiles block.

- **4.1.4 · F** — **Progress bar shows the correct stage**

  On the 9 “Ready · Correct” policies every stage up to *Enforced* is marked reached, though each needs correction. Legacy Authentication's Entra tab says “switch it to Report-only before making changes”. New policies correctly show “Not deployed” as current.

  **Fix:** Show “Enforced · needs correction” with a warning marker on the last stage.

- **4.1.5 · P** — **Subtitle adds context**

  Present only on the paired preparation steps (“Done together with Create or Correct Exclusions Group: these accounts are the members of that group…”), where it earns its place.

### 4.2 Why

- **4.2.1 · P** — **Explains what the step does and why**

  Most are one clear sentence, for example “A stolen or guessed password on its own is how most accounts are taken over.” and “Token protection binds a session token to the device it was issued on…”.

- **4.2.2 · W** — **A tech with no Entra experience understands it**

  Some lines are aphorisms rather than explanations, and terms like device code, role activation, token and PIM go undefined.

  > A partner's password hygiene is not yours to control; the prompt at your door is. (Guests)
  > Linux, and any platform Entra cannot identify, is blocked; that is where the device rules leak. (Unsupported platforms)
  > Waiting for a risk to become high is waiting for the attacker to succeed. (Medium-risk users)
  > Microsoft sees leaked-credential lists and impossible travel before you do; this lets that signal act. (High-risk sign-ins)

- **4.2.3 · P** — **Learn → present and correct**

  Present on all 32. All 30 unique destinations return 200 and are on topic (for example policy-block-legacy-authentication, concept-token-protection, security-emergency-access). Exception: Review Baseline Policies IAMAI Did Not Assess links to the baseline's GitHub repo, not Learn.

- **4.2.4 · P** — **Learn opens a new tab**

  `target="_blank"` on every Learn and Microsoft Learn link.

- **4.2.5 · P** — **Text wraps cleanly**

  The inline “Learn →” sits at the end of the sentence at 1280 and 390 px, with no overflow.

### 4.3 Readiness tiles

- **4.3.1 · F** — **Icon matches tile state**

  Every non-satisfied tile uses “!”, including informational ones (“AFFECTED PEOPLE · Not established” on 23 steps, “SPECIAL CARE · Confirm who needs hands-on help”). “!” therefore doesn't mean blocking: Emergency Access Accounts has two “!” tiles under a “Ready now” bar. “✓” appears only on the “Clear — No blockers” tile (4 steps).

- **4.3.2 · W** — **Label readable, plain language**

  Uppercase labels like “PREREQUISITE · IN PROGRESS” wrap to two lines in the three-column grid. “BASELINE MAPPING”, “THRESHOLD” and “BASELINE DEFINITION” are internal. One label is ungrammatical: “PREREQUISITES · when 1 trusted location exist (now 0)”.

- **4.3.3 · F** — **Collapsed summary gives enough context, and expanding helps**

  Four tiles open to nothing: “PEOPLE WHO TRAVEL OR WORK ABROAD · Confirm” (Allowed Countries), “MAIL-SENDING DEVICES · Confirm” (Legacy Authentication), “PARTNER OR MSP ACCESS · Confirm whether partners access your tenant” (Guests), and the “trusted location exist” tile (Sign-in Method Registration).

- **4.3.4 · W** — **Expanded content understandable**

  The most common tile text, on 22 steps, is technical and gives no next action.

  > IAMAI cannot establish exactly who this reaches: this scan could not settle the policy's scope, so no count is shown.

- **4.3.5 · W** — **Prerequisite tiles say IN PROGRESS, COMPLETED or WAITING (not READY)**

  No “READY” anywhere, which is good. But every prerequisite reads “IN PROGRESS” even when untouched: Authentication Strength, Trusted Network and the device decision have not been started.

  **Fix:** Use WAITING or NOT STARTED until the prerequisite has a saved answer or a scan shows the object.

- **4.3.6 · P** — **Threshold tiles carry a context suffix**

  “33% MFA-ready”, “0% of admins phishing-resistant”, “0% of devices compliant”. The detail line starts lowercase: “device readiness is 0% today; enforcement waits for 80%.”

- **4.3.7 · W** — **Auto-expanded tiles appropriate**

  Policy steps open 2–4 expanded tiles, a long wall before the action. With 6 or more tiles they collapse under “Blocking items still closed: 7” and their text runs together without a space.

  > Map the baseline's reference under Plan settings, Baseline mappings, or leave it out there.Open Baseline mappings

### 4.4 Satisfied

- **4.4.1 · W** — **“N satisfied” meaningful, shows affected people**

  Appears on 3 steps (Decide How Devices Are Managed, MFA Registration Campaign, Use Separate Accounts for Admin Work). It expands to “AFFECTED PEOPLE · 3 active people · 2 admins”: a useful count, mislabelled as a satisfied check.

### 4.5 Readiness bar

- **4.5.1 · F** — **Bar text clear and consistent with tiles**

  “Ready now” with blocking tiles on Emergency Access Accounts and Allowed Countries. Policy bars say “Needs correction” and repeat the tile text word for word, except on Device Code, Legacy Authentication and Guests, where the bar has no paragraph. Up Next bars name one blocker and list others.

- **4.5.2 · W** — **“Why IAMAI says this” modal: who it touches, why it matters**

  Some are excellent. Countries shows “United States · 3 people · 320 sign-ins”, and Device plan names who uses phones. Many repeat “cannot establish exactly who this reaches”. “Why it matters” often speaks to engineers, the close button is labelled “Minimize”, and Medium-Risk Users refers to a step that doesn't exist.

  > The campaign is a rollout tool; IAMAI's proof ledger is the readiness authority.
  > Downstream policies need one tenant-local custom strength with the pinned combinations; the source tenant GUID is not portable.
  > IAMAI separates canonical configuration from behavioral proof.
  > Supersedes Remediate High-Risk Users once enforced; set that one to Off in Consolidate Overlapping Policies.

- **4.5.3 · F** — **Explanation paragraph free of internal terms**

  Flagged terms in bars, dialogs and paragraphs: “canonical” (Intune enrollment dialog), “retained member” (Medium-risk sign-ins), “pinned baseline” and “Every-time sign-in frequency” (High-risk sign-ins), “this policy names an object GetIAMAI does not have yet” (8 steps). Across all step text see 9.2.

- **4.5.4 · N/T** — **MFA Readiness link works**

  Present as “Check MFA Readiness →” / “MFA Readiness →” on 4 steps (href `#/readiness/step/<id>`). The Readiness page and its `/disabled` route were tested; these step-scoped links were not clicked.

### 4.6 Milestone and action column

- **4.6.1 · W** — **Date or “—”, and is “—” appropriate**

  20 of 32 steps show “NEXT MILESTONE · —” above an empty grey column (every enforced, Up Next and On Hold policy). The two cleanup steps have no column.

- **4.6.2 · W** — **Milestone sub-text specific**

  Specific where present: “Create and verify two emergency accounts”, “Decide phones and computers”, “Add your office and VPN IP addresses.” Absent on Set Up Passkeys (date only) and on all 20 dash columns.

- **4.6.3 · W** — **Explanation paragraph clear**

  Several are clear (countries, device code question). Emergency accounts is hard going.

  > IAMAI nominated these from names, roles and exclusions; a nomination is not a choice, so no account is emergency access until you choose it here and save.

- **4.6.4 · F** — **Inputs: labels, dropdown context**

  Several action columns are broken or unclear:

  - Legacy Authentication's radio text is a fragment: “None · Yes: add: ; the service-accounts group carries them”.
  - Trusted Network shows a “Trusted network” label and Save, with no field to enter IPs.
  - Guests shows “Partner tier” and Save, with no picker.
  - Device code offers “Choose… / None / Yes”, which doesn't say none of what.
  - Device plan's “Protect company apps only” needs “(Intune app protection, no enrollment)”.

- **4.6.5 · P** — **Search box works**

  Authentication Strength search for “MFA” lists “Passwordless MFA, Phishing-resistant MFA · 2 results”. The emergency-account and exclusions-group pickers render pre-selected nominees.

- **4.6.6 · W** — **Save present and visible**

  Present wherever there is an input, but also where there is nothing to save (Trusted Network, Guests).

- **4.6.7 · W** — **Visually consistent across steps**

  The first question label is an H5 and a second question on the same step is a styled div (Device plan, Countries, Legacy Authentication). Cleanup steps drop the column and use “Done” and “Close”.

### 4.7 Implementation

- **4.7.1 · F** — **Header message accurate for the state**

  Messages were accurate but always paired with a load error. Set Up Passkeys (Ready, no blockers) says “Implementation content withheld — This step's implementation content could not be projected safely, so no artifact is offered.”, then every tab shows the load error. Decide How Devices Are Managed says “Waiting on a decision” (accurate), then 5 load errors. Block the Admin Portals for Non-Admins says “Not enough information… The baseline defines this policy two ways.” (accurate), then 5 load errors. No step uses “No implementation needed”.

- **4.7.2 · F** — **“Content could not be loaded — report this at feedback@getiamai.com”**

  26 of 32 steps. Only the two cleanup steps, Sign-in Method Registration, Unsupported Platforms, Countries Not Allowed and Managed Device are free of it. Full list at 9.4.1.

- **4.7.3 · W** — **Right tabs present**

  All five tabs (Entra, PowerShell, JSON, AI Info, Email) render on all 30 non-cleanup steps, whether or not they have content. Unavailable tabs should be hidden.

### 4.7a Entra tab

- **4.7a.1 · F** — **Followable without another reference**

  Followable, with numbered and specific steps: Exclusions Group, Authentication Strength, Trusted Network, Medium-Risk Sign-ins, Intune Enrollment, Use Separate Accounts, Medium-Risk Users. Not followable: the six in Critical 4, plus Session limits (policy B named `‹unmanaged device session policy name›`) and Managed Device (`‹Intune compliance readiness›`).

  > Apply the IAMAI-resolved canonical conditions exactly; do not substitute source-tenant IDs or broaden/narrow the population.
  > Configure the canonical grant and session controls exactly as described in STEP.md.

- **4.7a.2 · W** — **Portal navigation path**

  Six variants across steps. Learn currently says “Entra ID › Conditional Access › Policies” and “Entra ID › Security › Authentication methods”.

  > Entra admin center → Conditional Access → Policies   (most policy steps)
  > Entra admin center → Protection → Conditional Access → Policies   (Legacy auth)
  > Entra ID > Conditional Access > Policies   (Registration, Platforms, Countries)
  > Entra admin center → Entra ID → Conditional Access   (PIM, Sessions, Countries location)
  > Entra admin center → Security → Authentication methods → Registration campaign   (Campaign)
  > Entra admin center → Authentication methods → Authentication strengths   (Auth strength)

- **4.7a.3 · W** — **Numbered steps vs prose**

  Numbered on most. Prose paragraphs on Token Protection, High-Risk Users and Session limits. Device Registration mixes numbered steps with its own “Done when…” paragraph inside the tab.

- **4.7a.4 · F** — **Internal terms**

  “canonical target”, “IAMAI-resolved”, “stable tenant policy identity”, “semantic mismatch(es)”, “canonical exclusions”, “owner-confirmed” (Emergency accounts ×2), “owner-approved countries supplied by IAMAI… stable ID becomes tenant truth” (Countries location), “canonical sessionControls target is null”, “blockOutsideTrusted”, “STEP.md”.

- **4.7a.5 · F** — **Correct, tenant-specific policy name**

  Wrong on Require MFA for Everyone (see Critical 1). Generic on Legacy Authentication (“find the existing policy named for legacy authentication blocking”; the tenant's is *Core - Block - Legacy Authentication*). Guests uses “find it by ID in Plan settings”, which has no IDs. Device Registration says “enter the IAMAI-resolved policy name” though the JSON names it. Managed Device says “Compliant device for Office 365” while targeting All resources.

  > Require MFA for Everyone — 2. Open the policy named Core - Allow - MFA for Admins (or find it by ID in Plan settings).

- **4.7a.6 · W** — **Copy and expand buttons**

  Expand opens a larger dialog with all tabs, which works. Copy runs but shows no “Copied” confirmation.

### 4.7b PowerShell tab

- **4.7b.1 · F** — **Preamble explaining the script**

  About two thirds of the 22 scripts start straight at a `param(` block, including all 9 “Correct” policies. The compact scripts carry a comment header (module, scopes, role) and a line like “Defines the script and runs it in Correct mode with IAMAI's values”. None warns that it writes (`Policy.ReadWrite.ConditionalAccess`), which a “read-only” product should say plainly.

- **4.7b.2 · F** — **Script looks correct (read, not run)**

  The generic script requires `-TargetPolicyJson`, and nothing on the page supplies a usable one (the JSON tab holds a placeholder). The compact scripts' final call passes `-ExcludeGroupIds '‹exclusions group›'`, which fails their own GUID check. Medium-Risk Users defaults `$PolicyId = '‹policy ID›'`.

- **4.7b.3 · F** — **Contradicts the Entra tab**

  Shorten Admin Sessions, Block Authentication Transfer and Block Device Code: Entra says leave it On. The script has `StageForCorrection` (moves to Report-only) and throws “Refusing access-affecting correction while policy is On.” Require MFA for Everyone is the reverse: Entra leaves it On and its script has no staging mode at all.

- **4.7b.4 · F** — **Could not be loaded**

  10 steps: Emergency accounts, Exclusions group, Passkeys, Auth strength, Trusted network, Device plan, Allowed countries, Separate admin accounts, MFA campaign, Admin portals.

### 4.7c JSON tab

- **4.7c.1 · W** — **Preamble explaining the payload**

  Only a method and URL line (for example `PATCH https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/58153371-…`), with no sentence on what it does or how to send it. Device Registration uses a relative `POST /identity/conditionalAccess/policies`.

- **4.7c.2 · F** — **Valid JSON**

  No `//` comments, and it parses. But 17 payloads are not valid Graph bodies:

  > {"conditions":"‹policy conditions›"}   (6 enforced policies)
  > "excludeGroups": "‹exclusions group›"   (string, must be an array — 7 steps)
  > {"displayName":"Core - Block - Unsupported platforms", …, "conditions":"‹policy conditions›","grantControls":"‹grant controls›","sessionControls":"‹session controls›"}

- **4.7c.3 · F** — **Could not be loaded**

  12 steps: the 10 in 4.7b.4 plus Guests MFA and Session limits.

### 4.7d AI Info tab

- **4.7d.1 · W** — **Useful to an AI assistant**

  The explainers are good (Auth strength, Trusted network, MFA for everyone, Token protection, Intune, Medium/High risk). Others are instructions from IAMAI's own pipeline.

  > Guest policy mismatches: pair.canonical. Explain the smallest corrections to the exact strong/mixed policy identities…
  > Policy 58153371-724c-45d0-8b87-b17639eb23a9 has these mismatches for Block Device Code Sign-in: conditions.canonical.

- **4.7d.2 · F** — **Internal terms**

  “canonical” (most), “pinned IAMAI destination” and “tenant-resolved” (Platforms, Countries, Managed device, Registration), “retained IAMAI baseline/package owns the desired semantics” (PIM, Sessions), “source-tenant IDs”, “tenant truth” (Exclusions group), “IAMAI tenant/product facts and saved owner decisions own tenant-specific truth” (Device registration).

- **4.7d.3 · P** — **“Contains tenant context…” banner present**

  Shown on every AI Info tab, including the three where content failed to load (and on a blank AI Info tab in the demo).

- **4.7d.4 · F** — **Could not be loaded**

  3 steps: Set Up Passkeys, Decide How Devices Are Managed, Block the Admin Portals.

### 4.7e Email tab

- **4.7e.1 · F** — **Template exists and is reasonable**

  Only 4 of 32 steps: Sign-in Method Registration, Unsupported Platforms, Countries Not Allowed, Managed Device. They are sensible but written in admin language for end users, and have no sign-off.

  > Depending on the tenant's resolved trusted-network design, method registration may require the trusted network or an MFA bootstrap path.

- **4.7e.2 · F** — **Could not be loaded**

  26 steps, including the steps that most need user comms: MFA for Everyone, MFA Registration Campaign, Legacy Authentication, Token Protection.

### 4.8 Links at the bottom of the step

- **4.8.1 · P** — **Microsoft Learn link**

  Same destination as “Learn →”; correct on all policy and preparation steps.

- **4.8.2 · W** — **Troubleshooting**

  A button (on 15 steps) that opens a dialog of CHECK / FIX / THEN cards. The idea is good; the wording is for engineers.

  > Read policyType on the resolved strength. · Change only the pinned combinations in a controlled window; use previousCombinations for rollback if required. · Do not create or mutate until IAMAI/owner resolves the canonical object.

- **4.8.3 · P** — **Cross-reference links go to the right step**

  Every “Open …” link targets a real step ID (for example `#/plan/s-prereq-exclusion-group`, `#/plan/s-prereq-auth-strength`, `#/plan/s-prereq-device-plan`).

- **4.8.4 · P** — **“Source checked [date]” recent**

  Sep 10–12, 2026 on 27 steps. Absent on Device plan, Admin portals and both cleanup steps.

### 4.9 Done when

- **4.9.1 · W** — **Specific to the step**

  Specific on Auth strength (“named ‘Modern MFA + TAP’ exists with exactly the five methods”), Countries location (“exactly United States”), Passkeys and Separate accounts. Generic boilerplate on 5 policies. Sign-in Method Registration is one sentence that says nothing.

  > The policy is enforced in GetIAMAI.

- **4.9.2 · W** — **Names the exact conditions**

  The emergency accounts condition uses undefined terms: “Every minimum safety check passes on the next scan. Each hardening recommendation passes, or is deferred to Cleanup.” Device Registration has two different Done-when texts, one inside its Entra tab.

- **4.9.3 · W** — **Says “in GetIAMAI”**

  On 22 Done-when lines. Here GetIAMAI is the test tenant's display name, so it's correct tenant substitution, but in this tenant it reads like the product name. Other tenants will see their own name.

  **Fix:** “…enforced in your tenant (GetIAMAI)”.

- **4.9.4 · W** — **Tech knows what to verify**

  Clear for configuration objects. For policies, “matches the baseline's target configuration” sends the tech back to a JSON tab that is a placeholder.

### 4.10 Footer buttons

- **4.10.1 · P** — **Defer this step**

  On all 23 policy and check steps, absent on preparation steps, which is the right split.

- **4.10.2 · W** — **Doesn't apply here**

  Only on Trusted Network and Guests MFA. It's missing where it plainly can apply: Token Protection (no Windows), Intune Enrollment (no Intune), Allowed Countries.

- **4.10.3 · P** — **Scan to update the plan**

  On all 32, bottom right.

- **4.10.4 · W** — **Buttons that shouldn't be there**

  Review Baseline Policies IAMAI Did Not Assess has 7 separate Save buttons plus Done and Close, and an empty “Done on” label. Defer appears on Block the Admin Portals, where there is nothing to defer.

### 4.11 Overall step quality: could a tech finish it without calling you?

Clarity from 1 (confusing) to 5 (crystal clear). Mean **2.6**. Only 7 of 32 could be handed to a tech and left alone.

| # | Step | Tab | Solo? | Clarity | Single biggest improvement |
| --- | --- | --- | --- | --- | --- |
| 1 | Create or Correct Emergency Access Accounts | Ready | No | 3 | Bar says “Ready now” while both account tiles block; make the state honest, and replace “owner-confirmed” with “the accounts you chose”. |
| 2 | Create or Correct Exclusions Group | Ready | Yes | 4 | Clear decision and good Entra steps. Remove the three failing tabs and “canonical… tenant truth” from AI Info. |
| 3 | Set Up Passkeys to Match the Baseline | Ready | No | 1 | Ready with no instructions at all. Ship the Entra walkthrough that the Done-when already describes (Passkey, Authenticator, TAP, AAGUID allow-list, attestation). |
| 4 | Create the Baseline's Authentication Strength | Ready | Yes | 4 | Good numbered steps. Fix the path to “Entra ID › Authentication methods › Authentication strengths”, and plain-English the Troubleshooting dialog. |
| 5 | Define the Trusted Network | Ready | Yes | 4 | Best plain-English guidance (“search ‘what is my IP’ from the office”). The action column has a Save but no IP field. |
| 6 | Decide How Devices Are Managed | Ready | No | 3 | Clear questions. Explain each option in a suffix, and replace 5 “could not be loaded” tabs with “Available after you answer”. |
| 7 | Create or Correct Allowed Countries Location | Ready | No | 3 | “Ready now” with a Confirm tile that expands to nothing. Entra says “owner-approved countries supplied by IAMAI… becomes tenant truth”; write “United States”. |
| 8 | Require MFA for Everyone | Ready | No | 1 | Names the wrong policy (MFA for Admins) and patches the admin policy's ID. Fix the match to *Core - Allow - MFA for Internal Users*. |
| 9 | Shorten Admin Sessions | Ready | No | 2 | Says “set to the baseline's interval” without the number, and PowerShell refuses to change an On policy while Entra says leave it On. |
| 10 | Require Phishing-Resistant MFA for Admins | Ready | No | 3 | “The full list is in the JSON channel”, but the JSON is `{"conditions":"‹policy conditions›"}`. List the roles in the Entra tab. |
| 11 | Block Authentication Transfer | Ready | No | 3 | Clear Entra steps. The PowerShell tab contradicts “leave it On”. |
| 12 | Block Device Code Sign-in | Ready | No | 3 | Good question tile, but answers “None / Yes” are ambiguous. AI Info is a pipeline message (“conditions.canonical”). |
| 13 | Block Legacy Authentication | Ready | No | 3 | Name the policy (*Core - Block - Legacy Authentication*) and fix the radio fragment “Yes: add: ; the service-accounts group carries them”. |
| 14 | Require MFA for Guests | Ready | No | 2 | “Open the strong-tier policy (find it by ID in Plan settings)”, but there are no IDs there. Name both policies, and add the missing partner picker. |
| 15 | Require Token Protection on Windows | Ready | No | 1 | Rewrite the Entra prose (“stable tenant policy identity”, “canonical exclusions”, “semantic mismatch(es)”) as numbered clicks. |
| 16 | Remediate High-Risk Users | Ready | No | 1 | Belongs On Hold (unmapped group, like its siblings). Entra says “Open the exact existing policy identified by IAMAI stable ID 0a8317a6…”; name the policy (*SG - Entra - Users - User Risk Policy*). |
| 17 | Review Baseline Policies IAMAI Did Not Assess | Ready | No | 2 | Seven “IAC - …” names with seven Saves and “create it from its JSON”, but no JSON link. Explain each in one line and use a single checklist. |
| 18 | Use Separate Accounts for Admin Work | Ready | Yes | 4 | Best Entra walkthrough in the product. The state “Ready · Create” is odd, and PowerShell, JSON and Email fail. |
| 19 | Rename Policies Off the Naming Convention | Ready | No | 3 | Explain the convention “Core - Scope - Action Target”. The suggested name “Core - Entra - Users User Risk Policy” itself looks off. |
| 20 | Create and Enforce the MFA Registration Campaign | Up Next | No | 3 | Good special-care list and TAP guidance in AI Info. Move that guidance into Entra, and fix the path (Entra ID › Security › Authentication methods › Registration campaign). |
| 21 | Challenge Medium-Risk Sign-ins | Up Next | Yes | 4 | Clean numbered steps. The JSON `excludeGroups` must be an array. |
| 22 | Require MFA at Every Role Activation | Up Next | No | 2 | Unfilled `‹authentication context name› (‹authentication context ID›)`, and no step creates the authentication context. |
| 23 | Challenge High-Risk Sign-ins | Up Next | No | 3 | Uses the placeholder `‹authentication strength name›` though step 4 names it “Modern MFA + TAP”. |
| 24 | Require a Fresh Sign-in for Intune Enrollment | Up Next | Yes | 4 | Clear. Offer “Doesn't apply here” for tenants without Intune. |
| 25 | Protect Sign-in Method Registration | Up Next | No | 1 | Entra: “blockOutsideTrusted means…”, “‹registration access control›”, “canonical sessionControls target is null”. Done when: “The policy is enforced in GetIAMAI.” |
| 26 | Block the Admin Portals for Non-Admins | On Hold | Yes | 4 | Excellent conflict explanation. Hide the 5 failing tabs and the Defer button; nothing is expected of the tech. |
| 27 | Limit How Long Sessions Last | On Hold | No | 2 | Policy B is named `‹unmanaged device session policy name›`, with “Exclude IAMAI's canonical groups and the resolved shared-device accounts”. |
| 28 | Block Unsupported Device Platforms | On Hold | No | 1 | “as described in STEP.md”: the platforms and grant are never stated. |
| 29 | Require MFA to Register a Device | On Hold | No | 2 | 8 tiles collapse to “Blocking items still closed: 7”, and the tab says “enter the IAMAI-resolved policy name” although the JSON names it. |
| 30 | Block Sign-ins From Countries Not Allowed | On Hold | No | 1 | Same STEP.md template as 28; the allowed-countries location is never referenced by name. |
| 31 | Require a Managed Device Outside the Office | On Hold | No | 2 | An Intune prerequisite paragraph with `‹Intune compliance readiness›`, the old name “hybrid Azure AD joined”, and “for Office 365” while it targets All resources. |
| 32 | Reset Passwords for Medium-Risk Users | On Hold | No | 3 | Clear Entra steps, but the “Why IAMAI says this” dialog points to a nonexistent “Consolidate Overlapping Policies”, and PowerShell defaults `$PolicyId='‹policy ID›'`. |

## Part 5 — MFA Readiness · /planner/#/readiness

### 5.1 Summary tiles

- **5.1.1 · W** — **Active people count**

  “1 of 3 is Ready.” The count is consistent with the scan: 3 active, and the feedback mailbox excluded as sign-in disabled. The Breakglass account counts as an active person and is held to the plan gate, because no emergency account has been confirmed yet. Nothing on the page explains that.

- **5.1.2 · W** — **Need proof / Need setup / Unknown make sense**

  “Need setup · No current qualifying method” is clear. “Need proof · Qualifying method, incomplete proof” is not: a tech would say “has a passkey, but hasn't used it on Android yet”.

- **5.1.3 · W** — **Plan gate “3 of 3 must be Ready” clear**

  “Plan gate · 3 of 3 must be Ready · 2 more · View step →”. “Gate” is internal, and the tile doesn't name the step that waits.

  **Fix:** “MFA enforcement waits until all 3 people are Ready — 2 to go. View step →”.

- **5.1.4 · P** — **Passkey rollout useful and clear**

  “3 of 3 have a passkey · None without”.

### 5.2 Table

- **5.2.1 · W** — **Column headers clear**

  Person, Role and Methods are clear. “Proof” and “Readiness” need a one-line legend; ✓ and ? per platform aren't explained on the page.

- **5.2.2 · P** — **Method, proof and next action obvious per person**

  Admin: Passkey · ✓ Windows · ? Android → Needs proof. Breakglass: ? Windows · ? Android → Needs proof. A third person: ✓ Windows → Ready.

- **5.2.3 · F** — **Action buttons (Test Android, Test Windows)**

  The label promises a test; the button opens a “Readiness detail” dialog and switches the filter URL to `#/readiness/all`. No tooltip. The dialog content itself is good.

  > WHY  Phishing-resistant proof: Passkey on Windows. IAMAI has also seen Admin use Android, with no phishing-resistant proof there.
  > NEXT  Complete one phishing-resistant sign-in from Android, then scan again.

  **Fix:** “What to do on Android →”.

- **5.2.4 · P** — **Search**

  Name “Break” → 1 row, method “passkey” → 3, platform “windows” → 3. No match shows “No people match this view.”

- **5.2.5 · P** — **Filter buttons**

  Needs action 2, Admins 2, No passkey 0 (empty message), Ready 1, All 3. The summary tiles also act as filters.

### 5.3 Footer

- **5.3.1 · W** — **“Not counted toward the 3 active people” explained**

  The link and the evidence window run together, and nothing says why disabled accounts don't count.

  > Not counted toward the 3 active people: 1 sign-in disabled sign-ins Aug 14 → Sep 13

- **5.3.2 · P** — **“1 sign-in disabled” link**

  Filters the table to “Sign-in disabled”: Feedback Mailbox, labelled “not a person”.

- **5.3.3 · P** — **“Every account and policy the scan read →”**

  Opens Inventory, “Everything the scan read”: Policies 8, People 4, Groups 2, Devices 1, plus tabs for locations, authentication, roles, apps, licensing and sign-ins, each exportable. It's useful for the admin. The policy table is dense but accurate, and it's the view that exposes the step 8 mismatch.

- **5.3.4 · W** — **Export CSV downloads and is useful**

  Downloads `iamai-mfa-readiness.csv` at once. Columns: Person, Sign-in address, Role, Methods, Proof, Readiness, Action. It exports only the current filter: 2 rows under the default “Needs action”, so the Ready person is missing. No tenant, scan date or evidence window in the file.

## Part 6 — Export · /planner/#/export

- **6.1 · P** — **Loads, and what's on it**

  Renders immediately. Four groups:

  - *The plan*: Print or save as PDF; Plan file with Save and Load.
  - *Doing the work*: a note explaining why JSON and PowerShell aren't here, Download every prompt, and 8 Copy prompt buttons.
  - *Timing*: Download calendar (ICS).
  - *For another tool*: 11 CSV buttons, and a Grounding bundle with an unredacted checkbox and a warning.

  Minor: the header tip ends “…does not depend on it.?”, where a help button reads as punctuation.

### 6.2 Value of each section

| Section | What it exports | Valuable to a tech running the plan? | Verdict |
| --- | --- | --- | --- |
| Print or save as PDF | Whole plan: one-page summary, phases, every step | Yes. The one export a tech would print and follow. Not opened, to avoid a blocking print dialog. | **Keep**, and make it the hero. It should carry each step's Entra instructions and Done when. |
| Plan file (Save / Load) | Steps, evidence, decisions, checkpoints as a file | Yes. It's the only way to keep state past the one-day session and move between machines. | **Keep, rename** to “Back up plan” and “Restore plan”, with the reason in one line. |
| Doing the work (note) | Nothing; explains an absence | No | **Remove.** Less is more. |
| Prompts for your own assistant | 8 prompts: announcement rewrite, MFA setup instructions, KB article, change request, quiz, pushback, translation, summary | Partly. MFA setup instructions, KB article and change request are useful. The single-step prompts are all pinned to one arbitrary step (Protect Sign-in Method Registration). | **Revamp.** Put per-step prompts on the step, keep 3 plan-level ones. |
| Calendar (ICS) | Scheduled steps with portal path and Done when | Somewhat. Good for an MSP scheduling client work. | **Keep**, lower on the page. |
| CSV (11 buttons) | Readiness plus 10 inventory tables | Rarely. It duplicates Inventory's own exports. Eleven buttons is the opposite of less is more. | **Revamp** into one “Download all tables (.zip)”. |
| Grounding bundle | Scan and plan as JSON, redacted by default | No. It's for integrators, and “grounding bundle” is jargon. | **Move** under “Advanced”. |

### 6.3 Missing exports

- **6.3.1 · F** — **A runbook a tech can print and follow**

  Print is the closest thing. There's no per-step printable page with Entra clicks, checks and Done when.

- **6.3.2 · F** — **Management summary**

  Nothing a client owner can read in two minutes: what changes, when, who is affected, risk.

- **6.3.3 · W** — **Readiness report as a document**

  CSV only, and filtered (5.3.4).

- **6.3.4 · F** — **Policy configurations as importable templates**

  Not offered. The per-step JSON is a placeholder on 17 steps.

- **6.3.5 · F** — **Before and after comparison**

  None, though IAMAI holds both the tenant policy and the baseline target. This is its most differentiating possible export.

## Part 7 — How it works · /planner/#/how

- **7.1.1 · P** — **Permissions table accurate and clear**

  The six delegated permissions (Policy.Read.All, Directory.Read.All, AuditLog.Read.All, RoleManagement.Read.Directory, UserAuthenticationMethod.Read.All, Reports.Read.All), each with what IAMAI reads. They match the six consent rows on Connect and the scopes in the sign-in request.

- **7.1.2 · P** — **Every API endpoint documented**

  23 endpoints in four tables (every load, every scan, sign-in records, after a baseline is picked), with API version, permission, failure mode and purpose. The three beta endpoints are disclosed.

- **7.1.3 · P** — **“Without it” column**

  States the consequence plainly, for example “No names, no counts and no populations: every step would be about nobody in particular.”

- **7.1.4 · W** — **Length and level of detail**

  About 21,000 characters and 12 tables; right for a security reviewer, too much for a tech. “Every check” lists Pilot group and Service accounts checks that don't appear in this tenant's plan. Jargon: “replay engine”, “intents”, “diff and roadmap”, “$batch of 20”. On a phone the tables are unreadable, with one word per line and 570 px of sideways scroll. The strong “Where it runs” disclosure (GitHub Pages, Cloudflare beacon) is buried near the end.

  **Fix:** Split into “Is it safe?” (permissions, where data goes, how to remove) and a technical reference.

- **7.2 · P** — **Every link resolves**

  44 links to 12 destinations, all 200 and on topic: Learn pages, CA Policy Analyzer repo, build commit c65d9f4. Minor: “Build c65d9f4, Sep 14, 2026” is dated tomorrow, a UTC date.

## Part 8 — Demo mode · /planner/?demo=1

- **8.1.1 · W** — **Sample data banner visible and clear**

  The words are clear: “Sample data · nothing here is from a real tenant · Initial scan / Follow-up scan · Leave the demo”. But it's a thin grey text strip, not gold, and easy to miss once scrolled.

- **8.1.2 · P** — **Initial / Follow-up toggle**

  Switches snapshots (31 steps · 2 completed · Ready 14 / Up Next 13 / On Hold 2 → 34 · 9 · 20 / 4 / 1) and back.

- **8.1.3 · P** — **Leave the demo**

  Goes to `/planner/#/connect` with the real session intact.

- **8.2 · F** — **Demo content matches production**

  Five steps opened: Emergency accounts, MFA for Everyone, Device code, Not-assessed review, Phishing-resistant admins. Same templates, different results:

  - MFA for Everyone names the correct policy (*Core - Grant - MFA for all users*) with a real JSON body. Production names the admin policy and shows a placeholder.
  - Block Device Code's Done when is completely different.
  - Demo still shows “canonical” and “owner-confirmed”, and “could not be loaded” on PowerShell, JSON and Email.
  - Phishing-resistant admins has a blank AI Info tab with no message.

  > Demo:       The policy has been in report-only for 3 days with no failures. Every active person in scope signed in at least once during those days. After enforcement, sign-in failures stay under 5% of the people affected for 72 hours.
  > Production: The policy is enforced in GetIAMAI and matches the baseline's target configuration, with the exclusions group applied and any device code sign-in workflows accounted for.

- **8.3 · P** — **Session handoff after leaving the demo**

  Production Plan loaded with real data, 19 rows, in 50 ms.

## Part 9 — Cross-cutting checks

### 9.1 Consistency

- **9.1.1 · W** — **Step type labels**

  There are five types, one of them (Resolution) not in the documented set, and two steps have no label (4.1.1).

- **9.1.2 · F** — **Readiness bar messages**

  The same situation reads differently from step to step:

  - “Ready now” appears both with and without blocking tiles.
  - “Needs correction” sometimes has an explanation paragraph (Everyone, Sessions, Admins, Transfer, Token, High-risk users) and sometimes doesn't (Device code, Legacy auth, Guests).

- **9.1.3 · W** — **Action column layouts**

  20 empty dash columns, two label styles, and no column on cleanup steps (4.6.7).

- **9.1.4 · P** — **Button placement**

  Defer is always bottom left and Scan always bottom right; Save sits under its inputs in the column. Cleanup steps are the exception (4.10.4).

### 9.2 Terminology (all 32 steps, not 10, including every tab and dialog)

| Term | Steps | Where |
| --- | --- | --- |
| `canonical` | 22 | Emergency accounts, Exclusions group, all 9 enforced policies, Medium-risk sign-ins, PIM, High-risk sign-ins, Intune, Registration, 5 On Hold policies (Entra, AI Info, PowerShell messages, dialogs) |
| `GetIAMAI` in body text | 30 | Tenant display name substitution (“enforced in GetIAMAI”, “an object GetIAMAI does not have yet”). Correct behaviour, but it reads as the product name in this tenant. |
| `IAMAI-resolved` | 9 | Token protection, High-risk users, PIM, High-risk sign-ins, Registration, Platforms, Device registration, Countries, Managed device |
| `tenant-resolved` | 4 | Registration, Platforms, Countries, Managed device (AI Info) |
| `source-tenant` | 3 | Registration, Platforms, Countries |
| `pinned IAMAI` | 3 | Platforms, Countries, Managed device |
| `retained baseline / retained IAMAI` | 3 | Token protection (PowerShell errors), PIM, Sessions |
| `owner-confirmed` | 2 | Emergency accounts (Entra ×2, AI Info), Exclusions group (AI Info) |
| `tenant truth` | 2 | Exclusions group (AI Info), Allowed countries (Entra) |
| `stable tenant` | 2 | Token protection (Entra), Sessions (AI Info) |
| `semantic mismatch` | 1 | Token protection (Entra) |
| `resolved target` | 1 | PIM |
| `owner-approved` | 1 | Allowed countries (Entra) |
| `STEP.md` | 2 | Platforms, Countries (Entra) |
| `profileOptInApproved`, `mismatch modules`, `conditions object` | 0 | No hits |

- **9.2.1 · F** — **Terminology overall**

  11 of the checklist's flagged terms occur, on 28 distinct steps.

### 9.3 Empty states

- **9.3.1 · F** — **No implementation content**

  An error (“could not be loaded — report this”) instead of an empty state (“Not needed for this step”) or a hidden tab.

- **9.3.2 · P** — **No readiness tiles**

  A single “✓ Clear — No blockers. Ready to proceed.” tile (Passkeys, Auth strength, Trusted network, Separate accounts), which is tidy. Cleanup steps have no Readiness section at all.

- **9.3.3 · W** — **No inputs in the action column**

  “NEXT MILESTONE · —” above a tall empty grey column on 20 steps.

- **9.3.4 · W** — **Graceful overall**

  The layouts don't break, but three empty patterns leave awkward space: the empty column, empty expanded tiles, and blank AI Info (demo).

### 9.4 Error states

- **9.4.1 · F** — **“Content could not be loaded”: 26 steps**

  Emergency accounts, Exclusions group, Passkeys, Auth strength, Trusted network, Device plan, Allowed countries, MFA for everyone, Admin sessions, Phishing-resistant admins, Auth transfer, Device code, Legacy auth, Guests MFA, Token protection, High-risk users, Separate admin accounts, MFA campaign, Medium-risk sign-ins, PIM activation, High-risk sign-ins, Intune enrollment, Admin portals, Session limits, Device registration, Medium-risk users. By tab: Email 26 · JSON 12 · PowerShell 10 · Entra 3 · AI Info 3.

- **9.4.2 · F** — **“Implementation content withheld”: 1 step**

  Set Up Passkeys. “Could not be projected safely, so no artifact is offered” is internal, offers no alternative, and contradicts the step's Ready state.

- **9.4.3 · P** — **“Waiting on a decision”: 1 step**

  Decide How Devices Are Managed: “Answer the question this step is waiting on first.”, with the questions right beside it. Adequate, apart from the tab errors below it.

### 9.5 Performance

- **9.5.1 · W** — **Connect → Plan after sign-in**

  In-app navigation: 38–50 ms. A direct load of `/planner/#/plan`: about 20 s to the first rows. One direct load showed no rows after 30 s. In a background tab Plan stayed on “Loading…” for more than 2 minutes, while MFA Readiness loaded normally.

- **9.5.2 · P** — **Open a step**

  About 30 ms from click to rendered step body, on all 32.

- **9.5.3 · P** — **Switch tabs**

  Ready → Up Next → On Hold: 2–3 ms each.

- **9.5.4 · F** — **Anything over 3 seconds**

  Yes: a direct Plan load (about 20 s) and Scan again (about 7 s for a 3-person tenant, acceptable with its progress text).

### 9.6 Security perception

- **9.6.1 · W** — **Would an MSP owner connect a client tenant?**

  The core story is strong: read-only scopes, no server, public MIT source, permissions with a removal path, honest limits. What makes them hesitate:

  - No privacy policy or terms.
  - No named legal entity or security contact.
  - Tenant-wide consent to read sign-in logs and authentication methods, with that scope never spelled out.
  - PowerShell tabs that request `Policy.ReadWrite.ConditionalAccess` with no “you run this, IAMAI never does” line.

- **9.6.2 · W** — **Read-only communicated throughout**

  Present on Home, Connect and How. Absent on Plan and on every step, which is exactly where write scripts appear.

- **9.6.3 · F** — **Privacy policy or terms**

  None linked; `/privacy` returns 404 and there is no `security.txt`. There should be. Even with no server, the site serves a Cloudflare beacon and handles client-tenant sign-in data in the browser.

- **9.6.4 · P** — **How page covers what is read and where it goes**

  “Where it runs” is explicit, including the Cloudflare page-load beacon IAMAI can't remove. The endpoint tables are complete.

### 9.7 Mobile and responsive (headless Chrome, device emulation)

- **9.7.1 · P** — **Tablet width (768 px)**

  Plan rows fold Impact and When under the state; the step's action column stacks below the body; no horizontal scroll.

- **9.7.2 · W** — **Phone width (390 px)**

  Usable but long: an open step is taller than 6,000 px. Tiles stack one per row, and the nav wraps “Light theme” onto a second line.

- **9.7.3 · W** — **Cut off, overlapping or unreachable**

  The page never scrolls sideways, but the How page tables overflow their container by 570 px with one-word columns, and the Readiness table header runs 234 px past the screen while rows stack as cards.

### 9.8 Light theme

- **9.8.1 · P** — **Homepage**

  Clean, with good contrast.

- **9.8.2 · P** — **Connect**

  Clean. Step circles, cards and the teal Open the plan button all read well.

- **9.8.3 · W** — **Plan with a step open**

  Colours are fine. The implementation preview box is about 110 px tall, so three lines of instructions show inside a scroll box. The empty grey action column is more visible in light mode.

- **9.8.4 · P** — **MFA Readiness**

  Tiles, chips and the ✓/? proof marks are all legible.

## Part 10 — GTM and positioning

### 10.1 A first-time visitor's questions

- **10.1.1 · W** — **What is this?**

  Answered by the subhead, not the headline (1.1.1).

- **10.1.2 · W** — **Is it safe?**

  Well argued on Home and How, undermined by the missing privacy policy (9.6.3).

- **10.1.3 · F** — **What does it cost?**

  Not stated anywhere. That it's free and MIT-licensed is only inferable from GitHub.

- **10.1.4 · W** — **How long does it take?**

  Connect says the scan takes “about a minute for a small tenant”, and before sign-in it shows a sample “3 weeks” rollout. The homepage says nothing about time.

- **10.1.5 · P** — **Can I try it without connecting?**

  Yes, via the hero button, with a two-snapshot sample tenant.

- **10.1.6 · P** — **Who made this?**

  The About section names Lachlan Robinette.

- **10.1.7 · P** — **Where's the source?**

  GitHub in the nav, the source section and the footer.

- **10.1.8 · W** — **How do I get help?**

  Email only. There are no docs, FAQ, Issues link or status notes.

### 10.2 Competitive positioning

- **10.2.1 · F** — **Explains how IAMAI differs from CIPP, Secure Score or a manual review**

  Nothing on the site. A visiting MSP owner will ask “we already have CIPP and Secure Score”.

  **Fix:** One short section: Secure Score says what's missing, CIPP deploys templates, IAMAI plans the rollout for this tenant (who breaks, in what order, with evidence). No write access needed.

### 10.3 Trust signals

- **10.3.1 · W** — **Present and missing**

  *Present:* read-only scopes, runs in the browser, no server or upload, public MIT source, build commit link, a Microsoft MVP's baseline (with a “not endorsed by Microsoft” disclaimer), full permission and endpoint list, removal path, honest limitations, Cloudflare beacon disclosure. *Missing:* Preview status, privacy policy, security contact, changelog, company identity, independent review. Plan placeholders for testimonials from pilot MSPs rather than faking them.

### 10.4 Feedback loop

- **10.4.1 · W** — **feedback@getiamai.com the only contact?**

  That plus LinkedIn, in the footer only.

- **10.4.2 · F** — **In-app feedback button**

  None. The 26 error messages ask the tech to email, with no link that carries the step ID or build.

- **10.4.3 · F** — **Report a bug from inside the planner**

  No mechanism.

  **Fix:** A “Report a problem with this step” mailto or GitHub-issue link, prefilled with step ID, tab and build, never tenant data.

---

**Not tested, with reasons:** Sign in with another account (Microsoft's sign-in page can't be automated, and credentials must not be entered). The mapping search in Plan settings, and Save on any decision (kept the test plan unchanged). The Print dialog, Load a plan file, and every Export download except the readiness CSV. Changing plan dates. The step-scoped MFA Readiness links.

Method: the production site at getiamai.com, build c65d9f4, on Sep 13, 2026. Each step was opened in the live app and its header, tiles (expanded), readiness bar, dialog, action column, all five implementation tabs, links, Done when and buttons were read in the page. Learn links were checked over HTTP for status and page title. Phone and tablet widths were captured with headless Chrome against the public pages and the demo.
