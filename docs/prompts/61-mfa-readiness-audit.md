# Prompt 61 — MFA Readiness audit: what the page should be rebuilt around

Read `docs/EMERGENCY-ACCESS-HANDOFF.md` ("Approved interaction and writing rules"
and "Prompt 60 corrections") before you start. Its rules are the standard this
audit measures MFA Readiness against.

This is an audit, not a rebuild. Change no code, no copy and no tests. The only
file you write is the report named under **Output**.

## Why

MFA Readiness (`#/readiness`) is the person-level diagnostic behind the plan's
MFA steps. It is due for a rebuild. Before anyone designs it, we need to know
what value the page has to deliver, what it can truthfully show, and what it
should stop showing.

The Establish Emergency Access work (prompt 60 and its follow-ups) settled rules
that now apply across the product:

- **Judge outcomes, not stored flags.** A check passes on what actually happens
  (who can sign in, with what), not on a raw setting value.
- **Every failing check names something the admin can see and change.** If no
  visible action can make a check pass, the product must not require it.
- **Unknown is not false or true.** A collection gap is IAMAI's to diagnose, and
  it is shown as unknown, never as a pass or a failure.
- **Show the next check, not every finding.** Satisfied items collapse.
  Instructions are inline: each value and name sits in the step that uses it.
- **Consistent for every tenant.** Nothing may work only because of how one
  tenant (GetIAMAI, two active people) happens to look.

## Read first (once, no repository survey)

- Surface: `src/ui/surfaces/MfaReadiness.tsx`, `src/ui/surfaces/readinessCells.ts`,
  `src/ui/surfaces/MfaHandoff.tsx`
- Readiness model: `src/derive/mfaReadiness.ts`, `src/derive/stepMfaReadiness.ts`
- Evidence and scoring: `src/scoring/phishingResistant.ts` (the one readiness
  state), `src/scoring/mfaViability.ts`, `src/scoring/mfaHistory.ts`
- Approved design pack (anatomy only, never copy or truth):
  `archive/design/mfa-readiness-v2.html` (superseded by v3, archived 2026-09-19)
- The plan step that hands over to this page: `s-verify-mfa` (grep its id)

Earlier findings (memory: Step 6 MFA evidence audit, Step 7 MFA readiness):
proof is per sign-in, per method and per OS family, within the 30-day sign-in
window, with no history beyond it. `phishingResistant.ts` holds the one
readiness state, and the readiness gates count only Ready. Check that each still
holds before you rely on it.

## Questions the audit must answer

1. **Who uses the page, and for which decision?** Name the decision it should
   support, for example "Can I enforce MFA, or phishing-resistant MFA, for this
   group today, and who stops me?". List everything on the page that does not
   serve that decision.
2. **What is true versus claimed?** For every number, status, label and person
   list on the page, give its evidence source (sign-in logs, registration
   details, authentication methods, licence gates, the 30-day window), and say
   where the page shows unknown as known or treats a stored flag as the outcome.
3. **Is each shortfall actionable?** For every "not ready" reason, name the
   visible action that resolves it (the user registers a method, the admin
   changes a policy) or state that none exists.
4. **Overlap with the Plan.** Which answers already live in plan steps (for
   example `s-verify-mfa`, the MFA policy steps, the emergency steps)? The
   rebuilt page must not repeat or contradict them.
5. **One-tenant assumptions.** What behaves differently at scale? Run the
   `small`, `demo`, `mid`, `large` and `huge` fixtures (`src/roadmap/fixtures`)
   and note anything that only reads well on a tiny tenant: counts, lists,
   paging, "everyone ready".
6. **Observed pass on a real tenant.** Open MFA Readiness live on GetIAMAI. Use
   Claude in Chrome; the owner's admin session is already signed in there, and
   the built-in browser pane cannot do the passkey sign-in. Compare what the
   page states against the tenant as scanned. Scanning is read-only and allowed.
   Never change tenant settings.

## Output

Write `docs/audits/mfa-readiness-audit.md` with:

1. **Decision and user**: the one decision the page should support, in a
   sentence.
2. **Keep**: what the page shows that is true, actionable and serves that
   decision.
3. **Cut**: what should go, with the reason (duplicate of the Plan, not
   actionable, not serving the decision, noise at scale).
4. **Fix before rebuild**: truth defects, meaning places where the page claims
   more than its evidence, shows unknown as known, or judges a flag rather than
   an outcome. Give file:line and the observed or fixture evidence for each.
5. **Cannot prove**: what IAMAI cannot establish with its current read-only
   permissions and data windows, and how the page should say so.
6. **Rebuild outline**: the page's sections in order, each with the question it
   answers and the evidence behind it. No visual design; anatomy follows the
   approved pack.
7. **Owner decisions needed**: questions only the owner can settle, each with a
   recommendation.

Rank the findings within each section by user impact. Mark each finding as
**observed** (live or fixture evidence you saw) or **inferred** (from code
reading).

## Boundaries

- Read-only, against both the tenant and the repository. No code, copy or test
  changes; the report is the only file written.
- Do not run the full test suite, smoke or the walk. Run individual test files
  only where they answer a question.
- Do not read `archive/`, and do not read `content.json` whole; grep the key you
  need.
- Commit the report with a plain message. Pushing to `main` redeploys Pages, so
  follow the owner's release procedure (in memory) if you push.
