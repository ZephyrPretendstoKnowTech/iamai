# 31 — Pre-share audit: privacy, security, honesty, and first-run

Precondition: 29 and 30 committed. This is the last prompt before the tool is shown to
anyone outside the project. It is an audit that fixes what it finds, and it produces
`docs/qa/pre-share-audit.md` recording every check, its result, and what changed.

Nothing here adds a feature. If a fix is larger than this prompt, record it in
`docs/qa/pre-share-blockers.md` with one line of impact and stop rather than half-doing it.

## Part 1 — Nothing leaves the browser (the claim that must be true)

1. Prove the claim mechanically, not by inspection: add a test that fails the build if any
   source file references a network destination outside `graph.microsoft.com`,
   `login.microsoftonline.com`, and `raw.githubusercontent.com`. No analytics, no fonts
   from a CDN, no error reporting, no telemetry, no beacons, no third-party scripts.
2. Verify the built bundle contains no `<script src>` or `@import` pointing at a remote
   host, and no source maps referencing local paths that leak the developer's machine.
3. Run the app with the network blocked after a scan and confirm every page after Scan
   works: Findings, Roadmap, exports, print. Record the result.
4. Confirm the redaction rules on every export path: diagnostics, grounding bundle
   (default), change record, activity log, CSVs. Write a test that runs each export over a
   fixture containing UPNs, display names, tenant id, IP addresses, and device names, and
   asserts what appears in each output. The redacted grounding bundle must contain none of
   them.
5. Confirm the unredacted grounding bundle is behind an explicit action with the warning
   text, and that the warning names what the file contains.

## Part 2 — Secrets, storage, and the repo

6. Scan the working tree for tenant-derived data: UPNs, tenant ids, user object ids,
   device names, IP addresses, in committed files including docs, fixtures, screenshots,
   and test data. Replace with placeholders. Report anything found rather than rewriting
   history.
7. Confirm no client secret, certificate, or token exists anywhere in the repo or the
   build. Confirm the client id is the only Entra identifier in the source and that it is
   safe to publish (it is, for a SPA, but state it in SECURITY.md).
8. IndexedDB: confirm "Forget this tenant" clears every store for that tenant, including
   the plan, the log, the cache, and the MSAL account. Test it by scanning, forgetting, and
   asserting the databases are empty.
9. Add `SECURITY.md`: what the app reads, what it stores locally, what it never does, how
   to revoke access (delete the enterprise app), how to report a problem, and the fact that
   the client id is public by design.
10. Add a `LICENSE` if the repo still lacks one, and confirm the baseline attribution is
    correct and visible: source repo, author, commit, and that policy content is fetched
    live rather than redistributed.

## Part 3 — Honesty pass

11. Every claim the UI makes must be checkable. Walk the Start page, Connect page, What
    IAMAI reads, the Prompt pack, and the footer, and for each factual sentence confirm the
    code does what it says. List each claim and its evidence in the audit doc. Fix or
    remove anything unverifiable.
12. Confirm no page implies Microsoft endorsement, and that the no-AI statement is accurate
    given the prompt-pack feature.
13. Confirm every number on Progress, Findings, and the Roadmap header agrees, with the
    existing agreement tests extended to cover the new comms and log surfaces.
14. Confirm the tool never says a step is done, safe, or verified without naming the
    evidence.

## Part 4 — First-run and failure paths

15. Run the whole flow in a clean browser profile against a tenant with no prior state:
    Start to Roadmap, then print, then save and reload a plan. Record timings and anything
    confusing.
16. Run it with `?dev=1&fail=1` and confirm every degraded state reads clearly and no page
    breaks.
17. Run it against the unlicensed tenant (no Entra ID P1) end to end. Confirm: sign-in
    records and registration report degrade with a plain reason, the plan still generates
    from configuration and directory data, the free-tier ladder appears, and nothing
    crashes or shows an empty page. This is the most likely first-visitor scenario after a
    public post and it has never been exercised.
18. Confirm the app behaves when the user signs in with an account that is not a Global
    Administrator (a Global Reader, and a non-admin): sections degrade with a plain reason
    naming the missing role, and the tool says what to ask for.
19. Confirm behaviour on a tenant with zero Conditional Access policies: Findings, plan,
    and comms all render sensibly rather than as a wall of "missing".

## Part 5 — Accessibility and performance final pass

20. Keyboard-only walk of the whole flow: every control reachable, visible focus, Escape
    closes overlays, no trap. Fix what fails.
21. Screen-reader labels on every interactive element, tables with associated headers,
    status conveyed by text as well as colour.
22. Both themes at 360, 768, 1024, 1440, 1920: no clipping, no horizontal scroll, no
    unreadable contrast. Screenshots of the four widest-impact pages at 360 and 1440 in
    both themes under `docs/screens/31/`.
23. Longest main-thread task under 200 ms on Findings, Roadmap Progress, Roadmap Plan, and
    Inventory People, measured on the `large` fixture. Record the figures.

## Part 6 — Deployment readiness

24. Confirm the GitHub Pages build works from a clean checkout and that the app functions
    from a subpath (`/iamai/`), including hash routing, the baseline index fetch, and the
    MSAL redirect URI. This is the single most likely thing to break on first publish.
25. Produce a `docs/RELEASE-CHECKLIST.md` listing what a human must do before publishing:
    add the Pages redirect URI to the app registration, set the publisher domain, confirm
    the repo is public, confirm the scrub in Part 2, and take the first-run screenshots.

## Finishing

Run npm test and vite build. Commit by part. Push. The audit document is the deliverable:
every check, its result, and what changed. Report anything that belongs in
pre-share-blockers.md.
