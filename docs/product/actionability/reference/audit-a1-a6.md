# Audit A1–A6 — IAMAI Whole-Product Audit (live `b61aac5`)

## Sources
- Claude Code session transcript `C:\Users\Owner\.claude\projects\C--Dev-IAMAI\7f57a0aa-ef35-49d1-8384-8a61d20ea245.jsonl`: the assistant message timestamped `2026-09-12T03:08:04.748Z` (13,527 characters). This is outside the repository and is not one of the memory files.
- Cross-checked against: `docs/product/actionability/RUN-CONTEXT.md` (A3 line, expected starting HEAD `b61aac5`), `docs/product/actionability/SEGMENTS.md` (S1 "Policy ownership / drift safety (A1–A6)"), `docs/product/actionability/BLOCKED.md` (S0/S1/S5 entries recording A3 as absent).

## Provenance and edits
- This is the audit RUN-CONTEXT calls A3. It numbers the drift and coverage findings A1–A6 and audits live `b61aac5`, which RUN-CONTEXT gives as S1's starting HEAD.
- It was **not** found in the repo (working tree, every local and remote branch tip, the seven stashes, the agent worktrees, `docs/product/actionability/logs/`), in `C:\Dev\IAMAI-walk`, `C:\Dev\IAMAI-Content` or `C:\iamai`, or in any memory file under `C:\Users\Owner\.claude\projects\*\memory\`. The memory file RUN-CONTEXT points to (`iamai-audit-2026-09-11-plan-library.md`) covers a different audit, of `9a30372`, and its findings are unnumbered. The audit was found only by searching session transcripts (`*.jsonl`). `archive/` was not searched (CLAUDE.md).
- The text below is copied verbatim with one exception. The Evidence cell of **D1** named the owner's real tenant identities (a UPN, a person's name and a device model). CLAUDE.md forbids committing tenant-derived data, so those three values are replaced with `<redacted: tenant-derived>`. Nothing else is changed.

---

# IAMAI Whole-Product Audit: live `b61aac5`

## EXECUTIVE VERDICT

**MAJOR CORRECTION REQUIRED.** The pages themselves are close to finished:
- Home, Connect, Plan, MFA Readiness, Export and Print read as one product.
- No surface overflows horizontally at 390–1280 px.
- The security posture is sound.
- Schedule dates agree across the Plan row, the rail and the calendar.

But the engine mishandles **policy drift**, and one path is unsafe. If a tenant's MFA-for-all policy drifts, IAMAI plans a "correction" that rewrites a *different* goal's admin-only policy to All users. That is held today only by the 90% MFA readiness gate, so it becomes executable once the gate is met. The same family silently drops goals, proposes duplicate policies, and reports drifted policies as In place. It is one bounded engine family, but it is core trust, so this is more than polish.

## FINDINGS

**A · Drift and coverage truth (engine)**

| ID | Sev | Surface | Finding | Evidence | Correction direction |
|---|---|---|---|---|---|
| A1 | **P0** | Plan / Implementation | When the MFA-for-all policy drifts, the correction targets another goal's policy | demo-week2 with references answered, MFA-for-all grant set to `compliantDevice`: the update targets `001e8483` "Core - Grant - Admins phishing-resistant" (includeRoles: Global Admin). The body sets `includeUsers:["All"], includeRoles:[]`. Confirmed by re-running the probe. Cause: `generate.ts:1386-1391` falls back to `candidates.find(c => c.contribution !== 'disabled')`. Also triggered by platform and clientApps drift | Only correct a policy the goal itself owns and no other goal claims as its satisfier. Otherwise hold with an explanation |
| A2 | P1 | Plan | A goal vanishes when its policy excludes a group the scan can't resolve | Adding one unknown GUID to `excludeGroups` removed legacy-auth, auth-transfer, token-protection and mfa-all-users (28 steps → 27; the goal appears nowhere). Reproduced myself. Cause: `coverage.ts:615` sets status `unknown`, and `generate.ts:1226` skips unknown goals | Keep the step with a "can't verify exclusion" hold. Never drop a baseline goal |
| A3 | P1 | Plan | Drift outside exclusions re-creates the policy as a duplicate | Legacy-auth grant or clientApps drift: tracking is dropped and an executable create of "Core - Block - Legacy authentication (2)" is offered. Include-scope drift: row "Ready" and offered, but Implementation is empty. Cause: `coverage.ts:367 matchesSignature` | Report a tracked or name-matched policy that no longer matches as drifted (review or correct), never as missing |
| A4 | P1 | Plan | Location or platform drift on an enforced block policy dead-ends | The row says "Held · until a scan rebuilds this step", the update body is empty, and rescanning can't clear it | Express the change as a conditions correction, or state plainly that it can't be corrected automatically |
| A5 | P1 | Plan | Drift on report-only policies is ignored, even at enforcement | token-protection with `excludeLocations: AllTrusted` added still reads "Ready to enforce" with executable `{state:"enabled"}` | Compare conditions before offering enforcement |
| A6 | P1 | Plan | An ordinary person excluded from MFA-for-all still reads In place | Adding `user4` to `excludeUsers` gives coverage `inPlace`. Legacy-auth treats the same drift as a correction. I observed this myself too | Count an unauthorised exclusion as a coverage gap |

**B · State-word agreement across surfaces**

| ID | Sev | Surface | Finding | Evidence | Correction direction |
|---|---|---|---|---|---|
| B1 | P1 | Calendar / prompts / bundle | Export state lines contradict the Plan's word | Live Plan "Needs attention" exports as "Healthy" (break-glass, exclusion group). "Enforced · Needs correction" exports as "Enforced · Blocked". Every "Ready" exports as "Healthy". Cause: `artifactLines.ts stateLine` reads the lifecycle stage instead of the Plan state | Export the badge (`badgeLabel`), with a test asserting export line = badge |
| B2 | P1 | Opened step (live) | "In place" hides a review-required condition | Follow-up legacy-auth: badge "In place", Done when "Already satisfied", but Readiness "NEW EVIDENCE · Review required (the policy itself changed)" and rail "Held · Keep what is already doing this" | Badge "Enforced · Review required" per the approved grammar; rail gives the review action |
| B3 | P1 | Opened step (live) | Fix before continuing contradicts an executable action | Device Registration (Initial): Fix says "Finish Emergency Access Accounts first", yet Implementation is executable and the rail reads "Create in report-only on Sep 15" | State that the blocker holds enforcement, not report-only creation |
| B4 | P2 | Rail (live) | The next-milestone sub-line is a diagnostic sentence | Follow-up auth-transfer rail: "this plan does not record which policy it watched before Sep 12…" | Rail shows the milestone; the observation belongs in Readiness evidence |

**C · Implementation content**

| ID | Sev | Surface | Finding | Evidence | Correction direction |
|---|---|---|---|---|---|
| C1 | P1 | JSON channel | 26 packages' JSON has no method or endpoint, so Copy gives a bare body | Includes the proven executable legacy-auth correction (`requests: []`, no request line shown) | Author `method` + `endpoint` per block; show the request only when it's declared |
| C2 | P1 | Readiness | About 88 of the 127 withheld tiles are real pre-enforcement human checks, so steps reach "Ready to enforce" without them | Token Protection (compatibility, registration), user-risk (writeback, MFA registration), workload (egress), passkey (irreversible opt-in) | Split the family; author these as `confirms` prerequisites (Device Registration model) |
| C3 | P2 | Implementation (live) | PowerShell silently disappears in Ready to enforce | Token Protection shows Entra/JSON/AI Info/Email; the withheld Enforce script gets no note | Show a withheld-channel note with the reason |
| C4 | P2 | Package coverage | Sign-in Risk silently loses its Missing and Ready-to-enforce projections; 11 legacy-auth-family packages lose readiness and troubleshooting (prose models) | Validator/probe | Name these packages in the validator line; author JSON models |
| C5 | P2 | Copy (live) | Awkward generated phrases | Emergency Access: "IAMAI does not hold emergency account"; rail "Make the object this step names." | Content keys |

**D · Public hygiene and maintainer signals**

| ID | Sev | Surface | Finding | Evidence | Correction direction |
|---|---|---|---|---|---|
| D1 | P1 | Public bundle | Owner's real tenant identities ship in content examples | `<redacted: tenant-derived>` (a UPN), `<redacted: tenant-derived>` (a person's name) as operator/admin/guest, device `<redacted: tenant-derived>`, in the live `inventory-*.js` via `content.json steps.example`. CLAUDE.md forbids tenant-derived data | Replace with synthetic values, or keep review examples out of the runtime bundle |
| D2 | P2 | Walk signal | About 180 of 222 P1 findings are stale allow-list entries or unchanged sentence-length notes, which can hide a real regression | `docs/qa/page-contracts.json` lacks Email tab, Troubleshooting, row names, readiness chips | Refresh the page contracts |
| D3 | P2 | LIBRARY.json / CI | `status: SELF-VERIFIED` beside 1/46 strict; the PowerShell parse never runs in CI or the registry build | LIBRARY.json; the compile script | Derive status from validation; parse scripts in CI |
| D4 | P2 | README | "package files are never edited" is false (12 package-editing commits) | `src/content/implementation/README.md` lines 19, 221 | Correct the doc |
| D5 | P2 | Calendar | Some ICS lines exceed 75 octets | demo: 15 of 191 lines, max 81 octets | Fold by UTF-8 bytes |
| D6 | P2 | Accessibility | Row accessible names run together | "Needs attentionCreate or Correct…nextConfiguration onlySep 14, 2026" | Add separators or `aria-label` |
| D7 | P2 | Plan content | Leads render with nothing under them | MFA campaign "For the people chosen above (in person):" ×3; Guests Entra lead | Hide the lead when its list is empty |

Checked and not defects:
- **Date shift:** the claimed one-day row/calendar shift west of UTC did not reproduce live in America/Denver (row Sep 15 = ICS 2026-09-15).
- **Connect tile:** "1 already in place" vs Plan "3" is this browser's saved demo answers; the untouched sample has 1.

## P1 CLASSIFICATION

The log's "86 → 96" counts surface groups. The findings behind them went from 191 to 222, and all 31 new ones are newly surfaced valid content.

| Group | Count | Class |
|---|---|---|
| Plan row buttons outside allow list | 43 | Stale (rows gained WHEN/Impact) |
| MFA Readiness chips and links | 27 | Stale |
| Step Email tab | 18 | Newly surfaced valid content |
| Step Troubleshooting button | 14 (13 new) | Newly surfaced valid content |
| Step Close buttons and summaries | 11 | Stale |
| Export headings, Connect demo controls | 8 | Stale |
| Sentence over 25 words | 94 | Intentional copy under a strict rule |
| Lead with nothing under it | 4 | Genuine (D7) |
| Emergency Access prose budget, 544 words | 1 | Genuine density (P2) |
| Export row length | 1 | Intentional |
| Throttled first load, 5.4 s | 1 | Genuine performance, known |

No P0 in the last four deploys, and no regression.

## OWNER DECISIONS
1. **register-info** final target.
2. **Admin Portal** semantic conflict. Note that the live step title "Block the Admin Portals for Non-Admins" presupposes the README reading; the design pack titles it "Resolve the Admin Portal Baseline Conflict".
3. **name.canonical.**
4. **Five withheld Email audiences.** The UI simply omits the tab; nothing looks broken.
5. **Future dependency/actionability ordering.**
6. **New: human pre-enforcement checks (C2).** Should steps be allowed to reach Ready to enforce while control-specific human checks are unmodelled, or must those gate enforcement the way Device Registration does?
7. **New: owner identities in examples (D1).** Whether the owner's own tenant identities are acceptable in shipped content examples.

## VALIDATOR / LIBRARY ASSESSMENT
"1/46 strict" overstates breakage. Every family is classified, withheld parts never ship (the PIM per-policy request is absent from the live bundle), and the registry and LIBRARY.json are drift-tested. The signals still mislead in four places:
- **C2:** real enforcement checks are labelled "runtime owns tenant facts".
- **C4:** one-line family counts hide packages losing whole states.
- **D3:** LIBRARY.json's `SELF-VERIFIED` fields.
- **D2:** a walk P1 count dominated by stale allow-lists.

Only C1 and C2 are material product gaps. PIM, object corrections and the withheld Emails fail safely.

## CURRENT PRODUCT STRENGTHS
- **Security:**
  - The runtime is read-only: six read scopes; POSTs are `$batch` GETs and `getByIds` only.
  - The bundle stays on its host allowlist (6/6), CSP is set, and framing is blocked.
  - No secrets ship, and no source-tenant id is used as a target.
- **Schedule:**
  - Every dated row falls inside its phase window.
  - Row = rail = ICS for scheduled steps, and waiting steps are undated.
  - No false "Held" appears on a scheduled step.
  - Gated creates keep their report-only day, while missing objects, decisions, conflicts and the escape hatch hold creation.
- **Implementation:**
  - No executable artifact appears where `executableNow` is false.
  - Previews are always flagged.
  - No unresolved bindings.
- **Calendar and print:**
  - Calendar summaries use the Plan's words.
  - Print carries no repeated boilerplate.
- **Admin Portal:** clear. Resolution eyebrow, Deferred rail, "Do not deploy" box, review note and both pins.
- **MFA Readiness:**
  - Counts agree: 7 + 2 + 20 + 1 = 30; the passkey strip reads 7 have one, 22 without, 1 unread; the plan gate is 27.
  - Windows Hello is classified consistently.
  - Unread people are counted and shown as Unknown.
- **Pages:**
  - Home and Connect are polished, with complete metadata.
  - Header counts add up (31 and 34), and there are no console errors.
  - No overflow at 1280, 768, breakpoint edges or 390 px on all four approved surfaces.

## FINAL CORRECTION QUEUE
1. **Drift and coverage truth (A1–A6).** Correction target ownership, unknown-coverage steps kept, drift reported as review/correct rather than create or In place, conditions compared before enforcement. A1 first.
2. **One state word everywhere (B1–B4).** Export state line = badge; In place vs review-required badge and rail; Fix wording that separates creation from enforcement; rail sub-line.
3. **Implementation completeness (C1, C3).** JSON request metadata; withheld-channel note. Plus C2 once the owner decides.
4. **Bundle hygiene (D1).** Synthetic example identities.
5. **Maintainer signals and small polish (D2–D7, C4, C5).** Page contracts, LIBRARY.json status and PowerShell parse in CI, README, ICS folding, row accessible names, dangling leads, copy.

## DEFER UNTIL ORDERING REDESIGN
- Dates on decision rows that come from the phase day (row "Aug 31" vs rail "Needs decision").
- Dated milestones on work held behind cross-step prerequisites (for example legacy-auth "Sep 22 · Change the existing policy" behind Emergency Access).
- Which step the MFA Readiness "Plan gate · View step" link lands on.
- The Needs attention / Up next filters and group presentation.

No repository files were modified. The three read-only forks and the probe's headless Chrome are stopped, and my browser tab is closed with the demo restored to the Initial scan.
