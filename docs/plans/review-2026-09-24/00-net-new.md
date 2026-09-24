# Net-new issues found while building 1.x–4.x

These fall outside the approved items, so none was fixed overnight. Each needs the owner's call: fix, drop, or park for v1.1.

## Section 1
1. **Leftover "Could not verify" status words.** They sit on 1.1–1.3 cards and appear only when a read fails (hostile and micro fixtures); 1.3 "Allow list not established" is the same kind of word on a normal read. A card needs some status, so the word can't simply go. Proposal: each card states what IAMAI holds, or the card is dropped in that state.
2. **Missing-evidence wording on 1.1.** 1.1 on a failed read shows "Missing scan evidence: registered sign-in methods". It comes from shared validation wording (copy/validation.ts, validation/rules.ts).
3. **1.3's card count and task count differ.** On mid the card reads "33 accounts to prepare" while the task says "would lock out 5 accounts". Both are right: all stranded accounts on the card, only the lock-outs in the task. They read as a contradiction.
4. **1.3 shown Completed while a task stays required.** This happens when the settings are applied but some passkeys can't be judged. The post-change check keeps "Prepare affected passkeys" required, a safety behaviour. Should that step read Completed?

## Section 2
5. **The SharePoint card has no evidence line on fixtures.** The fixtures' app summary shows use but their sign-in records hold none. Real tenants should show "{n} people signed in to SharePoint and OneDrive…". Confirm on a real tenant.
6. **Reopened with no line.** A saved service No reopened by app-summary use alone shows no evidence line. Same for a mail None or partner No reopened over a partial sign-in read. Keep the reopen (it brings back policies set aside) or require a line?
7. **Service names differ between line and label.** The evidence line uses the service's short name ("SharePoint and OneDrive"), not the card label ("…from outside the office"), because the count applies no location filter.
8. **The 2.3 computers note follows the saved phone answer until Approve.** Switch phones to Compliant on screen and the Unmanaged line stays until you approve.
9. **"Answer it in {step}." remains in held steps' AI Info channel.** Item 18 removed it from the tiles only.
10. **The deleted device code question leaves code behind:**
    - QUESTION_STEP.deviceCode;
    - deviceCodeWorkflowsOf;
    - the graphConditions 'device-code-workflows-exist' condition;
    - the dependency edge decision:device-code-workflows;
    - the demo-week2 fixture's saved answer;
    - the defaultEvidence key.
11. **The Plan's hard-coded save alert is not in content.json:** "Changes are still in this tab, but could not be saved…".
12. **An Inventory pattern matches too much.** /\bagents?\b/ in coverage/facetApps.ts matches "Microsoft Teams - Device Admin Agent".

## Section 4 and shared
13. **No fixture uses Graph's policy shape.** Graph returns full strength objects and empty fields, so the snapshots never exercise the live read path (the L1 bug hid there). Give one fixture Graph-shaped policies; its snapshots would change.
14. **4.4 shows "Not as asked · target resources differ"** before and after the decoder fix. This is a comparison with the baseline, not investigated.

## Section 3 (from the 3.x build)
15. **The printed plan shows "Tasks Remaining ✓ Clear No unresolved checks" on an open 3.1** (and on every task step in print). This predates the batch; it's for the Export/print walk.
16. **Stale procedure copies in the content folders** that nothing draws:
    - 3.4's entra.campaign, entra.run-workflow, email.* and troubleshooting blocks;
    - 3.3's five-minute line.
    Delete them so each step has one source.
17. **3.4's "Who this touches" count disagrees with its Impact.**
18. **3.4's Turn On Without Them picker offers the operator** (you).
19. **3.1's licence note says "this scan cannot tell…".** It shows only on tenants without Entra ID P1; Business Premium has P1.
20. **Held 3.6 with a trusted location already in Entra.** The task still reads as the create procedure ("Name: Core - Trusted - Head office"), and the milestone reads "Create the trusted network".
21. **3.7 with an unsaved group that also holds other accounts** still says Create until that group is saved. IAMAI doesn't guess which group is the service-accounts group.

## Section 4 (from the 4.x build)
22. **4.5's schedule.** With security defaults and per-user MFA both on, 4.4 and 4.6 are dated a week after 4.5 (small: 4.5 Est. Sep 9, 4.4 and 4.6 Est. Sep 16), although 4.5 turns them on in the same change. The scheduler causes it.
23. **4.5's prerequisite cards read "Require Phishing-Resistant MFA for Admins · Prerequisite · Waiting"** with no reason.
24. **4.5 with a failed security-defaults read** still says "Security defaults · On". Its Doesn't-apply body can't be opened from the footer.
25. **4.4's Satisfied readiness still counts the admin requirement once 4.3 is On** ("1 of 2 people").
26. **4.1 waits on the mail answer even when nobody used legacy authentication in 30 days.** It could proceed.
27. **4.2's old procedure text is still in its package CONTENT.md.** Nothing draws it.
28. **The correction lines for session and name (4.x item 45) can't be reached.** A 4-hour sign-in frequency raises no correction, and a renamed tagged policy is adopted under its new name.
