# 04 — Guided flow, start page, design refresh, copy fixes

Precondition: 03-app-shell.md is committed.

## A. Navigation becomes a guided journey

1. Reorder the flow and make it a stepper: Start → Connect → Baseline → Scan → Mapping → Coverage → Roadmap. "Licensing guide" and "What IAMAI reads" move to a secondary "Reference" group below the steps.
2. Every step shows a status badge: not started / in progress / done / needs attention. A step's page opens with a one-line "what this step does", a "what it needs" line with links to unmet prerequisites, and ends with a primary **Next: <step name>** button. Placeholder pages are gone; a page with nothing to show explains what to do first and links there.
3. Scan is its own step (the current Readiness scan button lives here, with the live section list). Readiness becomes a results page under Scan; Coverage and Roadmap read from the last scan and say "based on the scan from <relative time> — Re-scan" at the top.
4. The header shows the tenant display name from /organization as the primary line and the tenant ID in small text beneath. Same on the Connect page: "Signed in to **<tenant name>** as <UPN>" with the ID secondary.

## B. Start page (new first step)

Design it like a product page, not a document. Sections, in order, each a full-width band with generous spacing:
- Hero: headline "Turn your Conditional Access baseline into a rollout plan that won't lock anyone out." One-sentence subhead about IAMAI hardening what the tenant already has. Primary button "Get started" → Connect.
- How it works: four cards with an icon each — Connect (read-only sign-in), Choose a baseline, Scan and see readiness, Follow the roadmap.
- What you'll need: Global Administrator or Global Reader account; Entra ID P1 for sign-in evidence (works without it, with less evidence); about ten minutes for the first scan.
- What IAMAI reads and why: three short bullets and a link to the What IAMAI reads page.
- What it never does: no changes to your tenant, ever; nothing leaves your browser (no server); no account required with us. Replace every occurrence of "review the code, then connect" with: "IAMAI runs entirely in your browser and only reads. The source is public so anyone can verify that." with a link to the repo.
- Footer band.

## C. Design refresh

Replace the palette with a professional navy/blue system, dark by default with a light theme toggle (print always light):
- Dark: background #0B1220, surface #111A2E, raised surface #16213A, border #24304A, text #E2E8F0, muted text #94A3B8, accent #3B82F6, accent-hover #60A5FA, success #22C55E, warning #F59E0B, danger #EF4444, info #38BDF8.
- Light: background #F8FAFC, surface #FFFFFF, border #E2E8F0, text #0F172A, muted #475569, same accent and status colours.
Cards with 1px borders and 12px radius, no heavy shadows, consistent 8px spacing scale, tables with row hover and sticky headers, status chips using the status colours with readable text on both themes. Type: system sans-serif stack, 15px base, clear hierarchy (28/20/16/14).

## D. Footer

Footer text: "Follow me here: **Lachlan Robinette**" where the name links to https://www.linkedin.com/in/lachlanrobinette/, followed by a separate "GitHub" link to https://github.com/ZephyrPretendstoKnowTech and a "Source" link to https://github.com/ZephyrPretendstoKnowTech/iamai. No other personal links. Use the same three URLs wherever the Start page or What IAMAI reads page links to the source or the author.

## E. Baseline page copy and structure

1. Top: an "About this baseline" card — name, author with link, repository link, version shown as "snapshot from <date>" with the commit in small monospace on a second line, a one-paragraph goal/description, policy count, licence tiers it targets. Read these from new optional fields on BaselineIndex: `author`, `authorUrl`, `repoUrl`, `description`, `goal`, `tiers`. Fill them for the Jon Hope index.
2. The load report becomes user language: "46 policies ready to compare", "2 policies in the source can't be used yet (they were exported without targets) — this doesn't affect your plan", "1 choice you'll make in Mapping (two styles of the same policy)", "48 things to map to your tenant — Mapping handles this". Everything else (files considered, duplicates, parse errors, the note about lab state) goes under a collapsed "Technical details" section.
3. Add to SPEC.md §7: every baseline source must supply the About fields above; sources without them show "no description provided".

## F. Readiness page fixes

1. The reason "MFA via MFA 3 hours ago" is a bug: map mfaDetail.authMethod to a plain name (Microsoft Authenticator notification, Authenticator passwordless, FIDO2 security key, Windows Hello, text message, phone call, software OTP, hardware OTP); when absent say "MFA completed 3 hours ago".
2. The evidence banner formats dates in the browser locale and never shows raw ISO strings; while Lane B runs it shows "Collecting sign-in evidence — this can take several minutes on larger tenants. Covered back to <date> so far." with elapsed time.
3. Group the tiles under three small headings: MFA state, Activity, Rollout. Each tile has a "?" with its definition; the legend stays collapsed.
4. Keep everything else from prompt 03.

Commit and push. Then tell me which files changed.
