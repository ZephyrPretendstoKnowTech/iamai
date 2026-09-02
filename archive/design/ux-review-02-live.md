# UX review 02 — live pass, Aug 27 2026

Driven in Chrome against localhost:5173 on the GetIAMAI tenant, Start → Roadmap, one step expanded. Everything here is additional to ux-review-01 and to prompts 08–12; where an item is already covered there it is marked (→ NN).

## What works and must be kept
- The Setup validation on the break-glass pick is the best thing in the app: it found the account is not excluded from two policies, has no phishing-resistant method, shares an Authenticator device ("SM-S918U") with the operator's account, and that there is only one such account. That is the product.
- Step detail is complete: why, who, readiness, evidence, portal steps, JSON, PowerShell, done-when. The structure is right; the content needs the fixes below.
- Danger areas names the person and the exact portal path. Keep.

## Findings from the live pass

1. **Narrow widths clip instead of wrap.** Below ~1100px the main column overflows to the right. Content needs a max-width and wrapping; the sidebar collapse (→ 08) is separate from this.
2. **Stepper statuses lie.** With 0 of 9 Setup answers, Findings shows "done" and Roadmap "in progress". A step whose inputs are incomplete is "provisional", not done. Setup with zero answers is "not started"; with required answers missing it is "needs attention".
3. **Naming drift.** Sidebar says "Setup" and "Findings"; buttons say "Next: Mapping"; routes are #/mapping and #/coverage. One name per step everywhere the user can see it (routes may stay).
4. **Answering a Setup question collapses it and hides the validation.** The five findings above were invisible until the section was reopened. Keep the section open after an answer; when collapsed, show a count chip in the header ("5 to fix").
5. **Validation lines need a fix path.** Each finding should end in an action: a link to the plan step it generates, or the portal path. Raw ISO in "last successful sign-in 2026-07-24" (→ 09 dates rule).
6. **Roadmap portal steps leak GUIDs.** "Exclude groups: 895b3e04…, 4815e4bf…" are the baseline author's group ids. Unmapped references must render as the mapped tenant object's name, or as a placeholder that names the Setup question ("your exclusion group — Setup question 2"), never a GUID.
7. **Policy names are the baseline's, not the tenant's.** "ACME - GLOBAL - BLOCK - RegisterSecurityInfoRequirements - ExludeTrustedLocation" (typo included) is offered as the name to create. Detect the tenant's naming convention (70% share the "Core -" prefix per Housekeeping) and propose a name in that convention, with "from baseline: <original>" beneath.
8. **Overpromise.** "This policy applies to your own account. I checked your registered methods — you have a strong one. You will not lock yourself out." A block policy scoped to untrusted locations can lock the operator out of registering security info off-network. Replace with the evidence sentence: "Your account is in scope. In the last 30 days, <n> of your sign-ins would have been affected." First person removed (→ 09).
9. **Announcement templates are per goal, not global.** A registration-protection block step carries the generic "you may be asked to confirm sign-ins with Microsoft Authenticator" email. Steps that hit nobody (evidence shows zero affected) need no announcement; steps that do need one written for that goal.
10. **"Unblocked by: finish the Setup questions first"** should name the questions ("Setup questions 2 and 6").
11. **Evidence line copy.** "no goal-specific evidence for this step; see readiness" → say what was looked for and that none was found ("No sign-ins in the last 30 days matched this policy's conditions").
12. **Counts must agree across tabs.** Steps tab said 12/30 while the Overview said 11 of 31 earlier in the session; after any input change every tab recomputes from the same result.
13. **Scan completion copy.** "Using your scan from this minute" → "Scan completed just now · saved on this device".
14. **Print header date** is raw ("prepared 8/27/2026") (→ 09 dates rule, → 12 print).
15. **Picker after selection** rendered the chosen account as a chip but closed the list and the whole section (→ 11 picker; item 4 above for the section).
