# UX review 01 — first end-to-end build

**Audience:** Claude Code and Lachlan. This is the thinking behind prompts 08–12.
Read it before running any of them. The test for every change: *would a
capable IT generalist with no Entra experience keep going, and trust what
they see?*

## 1. Voice — the single biggest trust fix

The app currently speaks in the first person as an AI ("I read your
tenant's real policies", "I work out everything else myself", "I'd have this
done by Nov 16", "Credit where due"). That reads as a chatbot, and chatbots
are not trusted with production tenants. Rules from now on:

- **IAMAI is the subject, or the sentence is imperative.** "IAMAI reads…",
  "Reads your tenant's…", "Pick the accounts…". Never "I", "I'd", "me", "myself".
- **State facts with numbers, no reassurance adjectives.** Not "Credit where
  due — these are done." but "10 goals are already in place."
- **One caveat, once.** "Predicted impact, confirmed in report-only" appears
  exactly once per page at most, as a footnote, not in every banner.
- **No developer vocabulary in user copy.** No "Lane B", "snapshot",
  "lambda", "beta", "rows", "ms", "config:", raw ISO timestamps, GUIDs.
- **Plain nouns.** "policy" not "CAP"; "sign-in records" not "sign-in evidence";
  "emergency access account" with "(break-glass)" on first use only.
- **Never promise what isn't built.** The Start page mentions "the email to
  send first" — comms templates don't exist yet. Remove until they do.
- **Contradictions are bugs.** "Only 100% of window-active users actually
  completed MFA — enforcement is largely untested here" appeared because
  copy templates weren't conditional. Every generated sentence needs a
  branch for the 0% / 100% / n=1 cases.

## 2. Top 20 improvements, ranked by what stops a novice

1. **Scan progress, not a log.** The collection list is a developer console.
   Replace with a single progress bar, a "what's happening now" line in plain
   language, and a collapsed "details" list with friendly labels.
2. **Inventory sub-pages after the scan.** Trust comes from seeing that the
   tool has the full picture: Policies, Locations, Authentication, People,
   Devices, Roles, Licensing, Apps, Sign-in records. Jon's analyzer earns
   trust exactly this way. Read-only tables, no analysis — the data as found.
3. **Info icons, not question marks.** The "?" reads as doubt about the
   number. Use an ⓘ glyph in muted colour with a hover/tap popover.
4. **Pickers that suggest before you type.** Empty state shows ranked
   candidates: names containing break-glass/emergency/admin/IT/svc, plus the
   inferred groups. Multi-select with chips; the list stays open until closed.
5. **Roadmap in 2–4 weeks, not 11.** Phases were scheduled serially with a
   7-day window each. Real rollouts create every policy in report-only on day
   one, observe in one shared window, then enforce in waves. See prompt 12.
6. **Print that works.** The PDF renders the on-screen flex layout as a
   narrow column. Print needs its own layout: cover, contents, phases as
   sections, every step expanded, JSON appendix.
7. **Step titles as plain imperatives.** "Create: Security-info registration
   requires a trusted context" → "Protect security-info registration" with a
   small kind badge (New policy / Change / Prerequisite / Verify).
8. **Dependencies enforced.** "Protect security-info registration" was Ready
   in Phase 0 while "Create a trusted named location" was still Ready — the
   first depends on the second. Blocked must mean blocked by a named step.
9. **Setup answers drive the plan.** Break-glass accounts were selected in
   Setup, yet the roadmap still says "Create two break-glass accounts" and
   marks the drill Done. Mapping answers are inputs to step generation.
10. **Classifier tightened.** Ad-hoc goals matched far too loosely
    ("delivered by 7 policies — consider consolidating" on a session goal
    that block policies can't deliver). Session goals match only candidates
    with session controls; ad-hoc signatures include apps and controls exactly.
11. **"Phase 8: From this baseline" goes away.** Baseline policies the
    catalogue didn't recognise were dumped at the end under raw names. Add the
    missing goals (all-users persistence, PIM reauthentication, Intune
    enrollment sign-in frequency, block downloads on unmanaged devices,
    medium-risk sign-ins and users) and give any remaining ad-hoc goal a
    generated plain title from its facts ("Require MFA for the Inforcer app").
12. **Vendor-specific baseline policies.** Jon's set includes Inforcer-specific
    policies. Tag them `vendor` in the index; they're not-applicable unless
    the vendor's service principal exists in the tenant. Pending the
    conversation with Jon about trimming them at source.
13. **Frameworks question needs an out.** Default is nothing selected, with
    "Not sure / none" as an explicit choice.
14. **Upload instructions page.** "Or upload a package" links to a page that
    says what a package is, three ways to make one, and what happens after
    upload. Nobody should have to guess the file format.
15. **Header overflow.** Tenant ID is clipped at the right edge. Tenant name
    primary, ID in a tooltip or on the Connect page only.
16. **Findings statements read like data dumps.** "for 0% of 4 — 3 get a
    weaker control than the floor (…applies but does not meet the floor
    (sign-in frequency ≤ 4h…))" → "Admin sessions last 7 days and persist;
    the baseline expects 4 hours and no persistence. 3 of 4 admins affected."
    Statements are for humans; the detail view holds the mechanics.
17. **Vibrancy.** The palette is muted. Reference sites use one vivid accent
    against deep navy, mono numerals for stats, and colour only where it
    means something. See prompt 08.
18. **Workload detection card.** Question 9 becomes a grid of workload
    cards with an icon, the evidence line, and a toggle — not a checkbox list.
19. **Every page answers "what now?"** Findings and Roadmap already have Next;
    inventory pages and Setup sections need the same, plus a persistent
    "where you are" stepper across the top on narrow screens.
20. **A visible "what this tool never does" line on every step page footer**
    — "Read-only · nothing leaves your browser" — because the novice's fear
    at every click is breaking something.

## 3. Bugs seen in the screenshots

- Summary sentence contradiction at 100% challenged rate (§1).
- "MFA via MFA 7 hours ago" fixed; keep the method-name mapping table complete.
- Guest goal statement "for 0% of 1" — n=1 phrasing.
- Findings "Housekeeping" false consolidation advice from loose ad-hoc matching.
- Roadmap break-glass steps contradict Setup answers.
- Registration-protection step not blocked by the location prerequisite.
- Print layout.
- Timeline durations: phases with all steps Done still occupy calendar time.

## 4. What "refined" means, concretely

- One accent colour, used for actions and the active step only.
- Status colours only on status chips and tiles — never on decorative elements.
- Numerals in a tabular/mono face at large sizes; labels in muted small caps.
- 12px radius cards with 1px borders; no gradients; no drop shadows heavier than 0 1px 2px.
- 8px spacing scale; page max width 1100px; tables full width with sticky headers.
- Inline SVG icons from one consistent set (stroke 1.5px), never emoji.
- Motion only for progress and expand/collapse, 150–200ms.
