# 21 — Honest metrics, layout, grouping, roadmap usability

Precondition: 20 committed. Read docs/design/ux-review-04.md in full; section numbers below refer to it.

## A. Metrics (§1, §2)

1. Replace the Rollout tiles with the four defined in §1: MFA proven in the last 30 days, No MFA method, Registered but unproven, To set up before enforcement. All are computed over enabled users, not active users. Each shows a count and a percentage, is clickable to filter the table to exactly that population, and carries a definition naming the population and the window.
2. Delete "Challenged rate" as a tile; keep its explanation inside the "MFA proven" definition only.
3. Add a lint-style unit test: any headline percentage computed over a filtered population must have the filter named in its label. Encode this as a test over the tile definitions, not as a convention.
4. Findings summary uses the same four numbers. Remove the sentence "enforcement is well tested here" and any inference of enforcement testing from the challenged rate; enforcement is only called tested when report-only evidence supports it.
5. The verification campaign is required whenever "To set up before enforcement" is greater than zero. Fix the Overview contradiction: the campaign sentence, the blocked-step reasons, and the pace calculation all read from that one number. Add a test that fails if the Overview text says no campaign is needed while any enabled user lacks a proven method.

## B. Layout (§3)

6. App container: centred, max width 1440px, 32px gutters, tables free to use the full container width. Verify at 1280, 1440, 1920 that there is no large empty margin and no clipped content.
7. Filter bar: its own wrapping row above every table, search field minimum 280px and never clipped, 16px clearance to the table.
8. Tables: per-column minimum widths so headers never break mid-word; long values wrap; remove inner horizontal scrollbars wherever the container can be wider; Devices "Authenticator registrations" column gets a wider default.
9. Info popovers and tooltips render in a portal at the top layer, flip on collision with the viewport edge, and are never clipped by a parent. Apply to every InfoTip, badge tip, and table tooltip.

## C. Grouping and sorting (§4)

10. Sorting applies within groups when Group by is active; the two controls are independent; the selection persists for the session. Tests for group-on plus each sort option.

## D. Roadmap (§5)

11. "Hide completed" toggle on Steps and Timeline, defaulting to on when more than a third of steps are Done, with the hidden count shown.
12. Every step shows a one-line state reason: Done names the evidence that satisfied it, Blocked names the blocker, Ready names what was checked. A step cannot be Done without a stated reason; add a test.
13. Setup answers feed step generation: with break-glass accounts confirmed, no "create break-glass accounts" step is produced, and the drill step derives from those accounts' last sign-in.
14. Remove "Next: Scan" from the Roadmap; replace with a secondary "Re-scan to update progress" action.

## E. Names and cleanup (§6)

15. Proposed policy names use the tenant's naming convention, with the baseline's own name in smaller text beneath, everywhere a policy is proposed (Findings, steps, print).
16. Fix-first items in the Findings summary use goal titles, never fragments like "apply the baseline policy to Office 365".
17. Policies table renders "All admin roles (N)" when the role set covers the admin catalogue.
18. Remove the duplicate Inventory link from the sidebar Reference group; the Scan tab is the single entry point.

Run npm test and vite build, commit in logical chunks listing the pages touched, and push. Then take a screenshot of Readiness, Findings grouped by Domain sorted by Effort, and the Roadmap Steps tab with completed hidden, and save them under docs/screens/21/.
