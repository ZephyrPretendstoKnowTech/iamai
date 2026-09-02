# UX review 05 — full walkthrough, Aug 28 2026

Driven in Chrome against localhost:5173 on GetIAMAI after prompt 21: every step, every
tab, every reference page, a fresh scan, Setup answered, both themes. Numbered items are
implemented by prompt 22.

## Part 1 — Correctness (fix first; these make the tool wrong, not just ugly)

1. **Answering Setup destroys the results.** Before answering, coverage read 7 goals in
place. After answering question 1 (break-glass = Breakglass) and question 2 ("the
exclusion group doesn't exist yet"), coverage read **0 in place, 11 partly, 17 missing**,
and the Roadmap went from 9 of 33 steps done to 1 of 32. Every one of those goals now
says "Not covered: excluded by the group Breakglass Exclusion (1)". The tenant has a
group named *Breakglass Exclusion* whose only member is the confirmed break-glass
account, and excluding it is correct, deliberate practice. Answering the questions must
never reduce coverage for exclusions the answers themselves justify.
   Required behaviour: a group whose members are all confirmed break-glass accounts is an
   expected exclusion, whether or not question 2 has been answered; question 2 must
   auto-suggest that group (it currently suggests nothing and offers only "doesn't exist
   yet"); and "expected exclusion" status is decided by membership, not by which question
   was answered.

2. **The plan now tells the user to build policies they already have.** Wave 1 lists
"Legacy protocols blocked", "Device-code flow blocked", "Authentication transfer blocked"
as Ready new-policy steps. All three exist and are enabled in the tenant. This follows
from item 1 and must be re-verified after it is fixed.

3. **"Fix first" recommends things that are already in force** for the same reason:
"legacy protocols blocked; device-code flow blocked".

4. **Admin counts disagree across the app.** The same admin population is reported as 4
admins (step "Who is affected"), 3 of 4 admins (Findings), 1 of 3 admins hold a
phishing-resistant method (step Readiness), and 33% readiness (blocked reason) versus 75%
implied by Findings. One admin set, one number, everywhere.

5. **A step claims there are no sign-in records while 219 were collected.** "No sign-in
records are available to say how many of your sign-ins would have been affected" appears
on a step in a tenant whose scan covers Jul 29 to Aug 28 with 219 records. Either the
lookup is keyed wrong or the fallback copy fires when the count for that user is zero:
say "none of your sign-ins in the last 30 days would have been affected" when that is
what the data shows.

6. **The role list in portal steps is unusable and partly unresolved.** "Today the policy
includes:" prints 133 role names in a single paragraph, including nine unresolved ids
(9c094953…, 2b499bcd…, 10dae51f…, a92aed5d…, 2af84b1e…, a0b1b346…, c34f683f…). Collapse
to "All 133 directory roles (show list)" and resolve the ids; anything still unresolved
is named once as "Unknown role", never as a bare id fragment.

7. **Inventory → Roles still shows "Unknown role (id …)" twice.** The role-template
catalogue does not cover ids that come from role assignments to first-party service
principals. Resolve via the directory-role object itself, and if that fails, label the
row by its holder ("Role used by Microsoft Office 365 Portal") rather than an id.

8. **Baseline is not restored on reload.** The scan persisted across a browser restart;
the baseline did not, so the Baseline step showed "Load this baseline" again while
Findings and Roadmap sat behind their prerequisite. Persist the baseline selection with
the scan.

9. **Goal counts disagree between pages.** Baseline says "33 security goals"; Findings
totals 28. Name them differently or count them the same: "33 goals in the baseline, 28
apply to this tenant" is the honest version, and the difference should be visible.

10. **Guest MFA statement is wrong in substance.** "Guests satisfy MFA: the current policy
requires MFA; the baseline expects passwordless sign-in. The only guest affected." The
tenant's guest policy does require MFA; the goal is met at the catalogue floor and only
falls short of the baseline's raised floor. Statements must distinguish "does not meet the
goal" from "does not meet the baseline's stricter version of the goal".

11. **Ad-hoc goals have no scores and unusable titles.** "Control access to Office 365",
"Block access to Office 365 SharePoint Online", "Require a managed device for all apps"
carry no Value/Effort/Disruption badges and read like fragments. Generate titles from the
policy's own facts and score every goal, including ad-hoc ones.

12. **Two goals duplicate each other.** "Office apps require a compliant or joined device"
and "Require a managed device for all apps" are the same intent from two baseline
policies; likewise "Unmanaged devices cannot download" and "Control access to Office 365".
Merge on intent before display.

13. **Sign-in record counts disagree with activity counts** without explanation: Readiness
says 4 active users, Inventory → Sign-in records says 3 distinct users. Both are right
(90-day activity versus the 30-day record window); say so in the tooltip.

14. **Timeline says "13 steps waiting on Setup" while Setup shows every question
answered.** After item 1 is fixed, re-check; if any step still waits on Setup, name the
question.

## Part 2 — Copy and clarity

15. Roadmap Overview builds one sentence out of fourteen goal names ending in "extend
it." Break into a short sentence plus a list of at most five, with "and N more".
16. "Longer than the small band's 4 weeks (5 weeks)" repeats itself; say "one week longer
than a typical small tenant, because the verification campaign needs two weeks".
17. "Blocked by: Blocked until 'Create the policy exclusions group' is done" still double-
prefixes, and the same blocker appears twice on one step (header line and Blocked-by
line). Print once.
18. A raw URL is pasted into the Why paragraph ("…admin contexts.: https://learn.microsoft
.com/…"). Make it a named link on its own line.
19. Scan → Details reads "Licences. 3 found", "People. 12 found" — a full stop mid-phrase.
Use "Licences: 3" or "3 licences".
20. "full available history inside the 30-day window (retention may be shorter)" nests
parentheses inside a parenthesis. Say "the last 30 days, or less if the tenant keeps
fewer".
21. Findings subtitle "what's working, what needs attention, and why" duplicates the tab
labels immediately beneath it. Cut it.
22. The Findings summary says "None of the 28 security goals are in place yet" and then
"11 goals partly" — for a novice, "partly" needs the one-line meaning attached.
23. Setup question 3's title is an instruction ("add any that are missing") while the rest
are questions. Make it a question, with the instruction as the helper line.
24. "31 baseline references resolved automatically" needs an InfoTip saying what a
reference is.
25. Authentication inventory shows raw method names "deviceBasedPush",
"temporaryAccessPassOneTime", "temporaryAccessPassMultiUse", "VerifiableCredentials" among
friendly names. Map all of them.
26. "Campaign: enabled" (registration campaign) needs a label a novice can read:
"Authenticator registration campaign: on".
27. Licensing guide lists "Service principals restricted" under "reference only" with no
explanation of what the user would gain by licensing it; one line per reference-only goal.
28. The free-tier ladder is a list of ten titles with no descriptions and no link into the
plan; each needs one sentence and, where applicable, a link to the step.
29. Baseline page: "155 files in this baseline" counts files, not policies, next to "46
policies" on the next card. Say "155 files, 46 usable policies".
30. Footer reads "Made by Lachlan Robinette"; the agreed wording is "Follow me here:".
31. Connect page bullets mention "not even report-only policies" before the reader knows
what report-only means. Move that clause to a tooltip.
32. Step "Done when" includes "The signed-in account has a strong method registered. IAMAI
checks this." — mixed tense and an unnecessary sentence; state the check as a criterion.

## Part 3 — Layout, interaction, accessibility

33. Sidebar step links have no accessible names in the accessibility tree (they render as
bare links). Screen readers announce nothing. Same for the theme toggle's state.
34. Inventory tables still use inner horizontal scrollbars at 1600px; the container has
room. "What IAMAI reads" wraps "v1.0" into "v1." + "0" in the API column.
35. The Devices table needs its Authenticator column widened; its tooltip is still
clipped at the table edge.
36. Findings badges (Value/Effort/Disruption) have two InfoTip icons side by side with no
labels; one tip explaining all three is enough.
37. Group by / Sort by controls appear twice on the page (once per tab panel) and each
keeps its own state, so switching tabs silently changes the sort. One control, shared.
38. Timeline entries are links but the wave headings are not; make the whole row a target.
39. The Roadmap Steps tab count badge reads "1/32" with no label; add "steps done".
40. Long tables have no sticky header when scrolling inside them.
41. The page keeps its scroll position when switching Roadmap tabs, so the user lands
mid-content. Reset to the top of the tab panel.
42. Screenshot capture repeatedly timed out on this build, which points at a long
main-thread task (likely the 133-role render and the full step list). Profile and split
the work; a page that blocks the renderer for seconds will feel broken on a real tenant.
43. Light theme: the sidebar's active-step indicator and the "done" chips lose contrast
against the pale background; check both themes against AA.
44. No visible focus ring on the tab controls when navigating by keyboard.
45. There is no "back to top" or in-page anchor list on the long Findings and Roadmap
pages.

## Part 4 — Value and trust

46. Every "Missing" finding names the baseline's policy ("the baseline's policy for it is
IAC - P2 - GLOBAL - GRANT - Medium-Risk Sign-Ins") but never the proposed name in the
tenant's own convention, which prompt 21 asked for. Show the proposed name first.
47. Baseline policy names still carry the author's typo ("ExludeTrustedLocation") and two
different prefixes (ACME, IAC) in the same list, which reads as sloppiness in this tool.
Normalise for display: show the intent, keep the source name in the detail view.
48. "Unmanaged-device browser sessions are limited is in report-only via Grant - Defender
for Cloud Apps Test (30 days, failures not measured)" — "failures not measured" is the
most important part and is buried in parentheses; say what to do about it.
49. Danger areas shows a count of 1 with no summary on the tab itself; give it a one-line
lead so the user knows whether to look.
50. Nothing in the app says how old the sign-in evidence can be before it stops being
useful; the scan-age warning promised in prompt 20 is not visible on Findings or Roadmap.
51. Print and Save plan were not exercised in this pass; verify both after item 1 is
fixed, since every number they carry is currently wrong.
