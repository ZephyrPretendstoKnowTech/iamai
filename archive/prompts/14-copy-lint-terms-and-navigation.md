# 14 — Copy lint, terminology, timezone, navigation fixes

Precondition: 13 committed. Read docs/design/ux-review-03.md §A8, §B, §C.

1. Copy lint as a test: fails the build on any user-facing string containing an em dash or en dash used as punctuation, first person (I, I'd, I'll, me, myself, "let's"), the constructions "not X, but Y" / "it's not … it's …", or the phrases "credit where due", "simply", "seamless", "robust". Replace em dashes with periods, commas, or colons. Run it over src/copy and every .tsx.
2. Terminology dictionary `src/copy/terms.ts` with the final labels from §A8; every chip, tile, legend entry, CSV header, and print label reads from it. Enum values unchanged. Legend redesigned as three labelled groups (MFA state, Activity, Method tier) with one-line definitions.
3. Findings headers: "Here's what's working" and "Here's what needs attention". Summary paragraph rewritten to the voice rules with the AI-isms removed.
4. Timezone: every rendered date/time uses the Setup timezone (default browser), including scan details, the readiness banner, validation lines, print header, and "fetched the gap since". A test asserts no ISO 8601 string is rendered anywhere.
5. Baseline load report per §B: show "46 policies · 27 security goals · Setup will ask N questions"; everything else under Technical details with author-facing wording.
6. Persist the loaded baseline (index id and commit) per tenant in IndexedDB; on reload, restore it and never show a dead end. The Roadmap and Findings prerequisite line, when a baseline is missing, links to the Baseline step with a proper sentence.
7. Sticky sidebar: position sticky within the viewport with its own scroll when taller than the window.
8. Roadmap deep links: every link to a step routes to #/roadmap/step/<id> and opens that step expanded; Findings link to the step for their goal; Setup validation findings link to the step they generate.
9. Sign-in record collection: show "Waiting for the first batch from Microsoft (about a minute)" with an indeterminate bar until the first page lands, then the counting bar.

Commit and push. Report the lint's first-run violation count before and after.
