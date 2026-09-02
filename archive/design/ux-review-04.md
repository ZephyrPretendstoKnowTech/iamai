# UX review 04 — post night-run (prompts 14 to 18)

The night run landed: terminology, scoring badges, pace bands, inventory tabs, and the
teal system are all in. This review covers what the build showed afterwards. Prompt 21
implements it.

## 1. The honesty problem (highest priority)

The Readiness tiles say "0 To verify" and "100% Challenged rate", and Findings says
"100% active users MFA-ready", while the same page shows 8 users with no MFA method.
Every one of those numbers is defensible on its own definition and the combination is
still wrong, because the reader takes away "this tenant is ready" when it is not.

The rule from here on: no headline metric may be computed over a filtered population
without naming that filter in the tile itself, and any metric that reaches 100% while a
gap exists elsewhere on the page must be replaced or paired.

Replace the two rollout tiles with these four, all computed over **all enabled users**,
not just active ones:

- **MFA proven in the last 30 days** — users with a successful MFA sign-in inside the
  collected window, as a percentage of enabled users, with the count.
- **No MFA method** — enabled users with no MFA-capable method, count and percentage,
  clickable to the filtered list.
- **Registered but unproven** — enabled users with a method but no MFA success in the
  window (never prompted plus possibly broken).
- **To set up before enforcement** — the sum of "No MFA method" and "Registered but
  unproven", which is what the verification campaign has to work through.

Every one of those tiles is a link that filters the table to exactly those users, and
each carries a one-line definition naming the population and the window. Delete
"Challenged rate" as a headline; it survives only inside the definition text of "MFA
proven".

Findings summary must use the same four numbers, and the sentence "enforcement is well
tested here" is removed entirely: enforcement is tested when report-only evidence says
so, never inferred from a challenged rate.

## 2. The contradiction it caused

Roadmap Overview reads "no verification campaign needed" and then, three lines later,
"Most clear once the verification campaign in phase 2 lands". The first sentence comes
from the active-user readiness gate (4 of 4 active users ready), the second from the
blocked-step reasons. With the §1 metrics the campaign is needed: 8 users have no
method. The verification campaign is required whenever "To set up before enforcement"
is greater than zero, and the pacing model must include its window when it is.

## 3. Layout and space

- The app is pinned to a narrow column with a large empty right margin. Content should
  centre in the viewport and use it: max width 1440px, centred, with 32px gutters, and
  tables allowed to use the full width of that container.
- Filter chips overlap the table below them and the search field is clipped
  ("Search name or sign-in ac"). The filter bar needs its own row with wrapping, a
  minimum search width of 280px, and 16px of clearance above the table.
- Inventory tables squeeze columns to the point that headers break mid-word
  ("USE RS", "APP S") and the Devices table needs horizontal scrolling for six columns.
  Give tables sensible minimum column widths, let long text wrap rather than the header,
  and drop the inner scrollbars where the container can simply be wider.
- Info popovers are clipped by their container and by the window edge. They must render
  in a portal at the top layer, flip when they would overflow, and never be cut off.

## 4. Grouping and sorting

With Group by = Domain, changing Sort by has no effect. Sorting must apply inside each
group, the two controls are independent, and the choice persists for the session.

## 5. Roadmap usability

- A "Hide completed" toggle on Steps and Timeline, defaulting to hidden once more than a
  third of steps are done, with the count still visible ("9 completed, hidden").
- Every step states why it is in its current state: Done shows the evidence that
  satisfied it ("Delivered by Core - Block - Legacy Authentication, enabled"), Blocked
  shows the named blocker, Ready shows what was checked to clear it. One line, always
  present.
- "Create two break-glass accounts" still appears although Setup has break-glass
  accounts confirmed, and the drill shows Done without evidence. Setup answers must feed
  step generation, and a Done step needs a stated reason or it is not Done.
- The Roadmap is the last step; it should not offer "Next: Scan". Replace with
  "Re-scan to update progress" as a secondary action.

## 6. Names and small things

- Findings still names baseline policies verbatim, typo included
  ("ACME - GLOBAL - BLOCK - RegisterSecurityInfoRequirements - ExludeTrustedLocation").
  Show the proposed tenant-convention name first, with the baseline's own name in
  smaller text beneath.
- "apply the baseline policy to Office 365" in the fix-first list is not a sentence a
  user can act on; every fix-first item uses its goal title.
- Policies table still shows "133 roles"; render "All admin roles (133)" when the set
  covers the admin catalogue.
- Inventory appears both as a tab under Scan and as a Reference link in the sidebar.
  Keep the tab; remove the sidebar duplicate.
- The Devices tooltip is cut off mid-word, which §3 fixes, and the Authenticator column
  needs a wider default.
