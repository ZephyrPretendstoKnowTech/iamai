# Stage 2 audit — IAMAI Planner at f643973

The rebuild (46–50.1) is closed: every surface has a contract the build enforces, the
legacy pages and stylesheet are gone, the plan is derived from the snapshot on every
load, the demo runs the finished product with a week-two view, CI is green. This audit
treats that product as if another team built it, walked on GetIAMAI and on the demo,
as the four personas the second-stage directive names.

Verdict in one line: **day one is excellent; week two barely exists; the product knows
more than it says.**

## Phase 1 — Observe

Strong
- The story on one page: header line → assumptions → dated waves → rows → the step
  under its row. A first-time user can say what the tool does and what to do next
  without training. The contract keeps it that way.
- Evidence-named lines on steps ("1 person registered but unproven (Lachlan
  Robinette), one MFA sign-in before Sep 27") — the differentiator, and now live for
  16 of the 22 lockout scenarios.
- Trust chain inside every step: conclusion → why → who, named → do it → done when →
  rollback, with the catalogue behind More. Both themes hold.
- Do it is real for every step, including check steps; the JSON never lies (placeholder
  caption).

Weak, by persona
- **Executive / client.** "How are we doing?" and "Are we improving?" have no surface.
  The header line answers "how far" (7 in place of 31, 3 weeks) but nothing answers
  "since last time". The printed page 1 exists but reads as a cover, not a page a
  client is walked through. The demo's week-two view moves five numbers; on screen it
  reads as almost the same plan.
- **IAM leader.** Prioritisation is visible (waves, dates) but its *reasons* are in
  More. Nothing says the one thing the engine knows best: "sorting out emergency
  access unblocks 20 steps". Waves are named by control family (Sessions, Devices),
  which is the implementer's frame, not the leader's (protect everyone → protect
  admins → devices → sessions).
- **Implementer.** Strong. Gaps: a missing goal's step says why in one sentence but not
  the gap in baseline terms (partly steps do: "expire every 168h, wants 4h"); the
  emergency-access create action still lacks the passkey clause on a tenant with one
  existing account (the clause lives on the zero-account variant only).
- **First-time user.** Strong, with one exposed seam: on Today, tiles are counts with
  no consequence — "2 registered, unproven" does not say "holds 3 steps". And the
  first click on Sign in is unreliable from the review tooling; a human test is needed
  to know whether users see it.

Housekeeping has become the footer's junk drawer: 14 lines on GetIAMAI, 11 of them the
identical "also in the baseline, not assessed" shape.

## Phase 2 — Diagnose

A. **The product optimises the first render and has no second-render design.** Rings,
   checkpoints and tracking exist in the engine; their only surface is a status word
   changing. Root cause: 46–50 defined "done" as the day-one page.
B. **Synthesis is implicit.** Dependencies, leverage, cohorts and thresholds are all
   computed and all rendered per row; nothing rolls them up into a sentence a person
   would say ("these 20 wait on one thing"; "these 3 people gate 5 steps").
C. **The client artifact was built last, from a cover template.** The MSP's real
   deliverable — the thing shown in a QBR — was treated as an export option.
D. **The footer accepts anything nobody else wanted.** Five unlike kinds share one
   list.

## Phase 3 — Reimagine (no new surfaces)

1. **Since last scan.** After a second scan exists, the Plan header and Today gain one
   line from the snapshot diff: "Since Aug 24: 2 steps enforced · 3 people proved MFA ·
   1 new account · finish unchanged". The plan file keeps a compact summary of the
   previous snapshot so the diff survives reloads. This is the progress surface; it is
   one line, and it is the executive's answer.
2. **Leverage line.** On any step that clears blockers: "Clearing this unblocks 20
   steps" as the second sentence of Why; the wave header's "after emergency access"
   links to that step. Cheapest aha in the product.
3. **The posture page.** Print page 1 designed as the page a client is walked through:
   what is protected today (in place, plain names), what changes in the next three
   weeks (waves, one line each), what needs their people (the named asks: "2 people
   register a method"), since last time. The same page is the top of Export on screen,
   so it can be screen-shared without printing.
4. **Today → Plan.** Each tile carries "holds N steps"; clicking a tile filters the
   table and lists the steps it gates.
5. **Footer.** Two collapsed lines: "Also in the baseline, not assessed (11)" and
   "Tidy-ups (3)".
6. **Wave vocabulary.** Named by purpose from a fixed set — Foundations · Protect
   everyone · Protect admins · Devices · Sessions and risk — with the family names
   inside the step. Dates stay; Now/Next/Later would lose them.
7. **Gap line on missing goals.** "Baseline: <control>. Tenant: nothing" in the same
   place partly steps show theirs.
8. **Small fixes.** Passkey clause on both create variants; a fallback on Sign in when
   MSAL fails to warm ("Try again"); the demo's week-two snapshot made to show what the
   report promised (two report-only rows, one enforced) so the story reads on screen.

## Phase 4 — Prioritise

- **P0** — A: items 1 and 2. Without them the product answers "where am I" and never
  "am I getting there"; with them it answers both on the same line.
- **P1** — C and D: items 3, 4, 5. The client page is the deliverable; the tile links
  close the last "so what" seam; the footer roll-up is hygiene that reads as trust.
- **P2** — items 6, 7. Frame and completeness.
- **P3** — nothing pending; the design lint and contract hold the visual bar.
- **Now, regardless** — item 8.

Proposed sequence: 51 = P0 + item 8 · 52 = P1 · 53 = P2. Each with a target-state v2
delta and contract edits from the reviewer first, then the executor, then the walk.
