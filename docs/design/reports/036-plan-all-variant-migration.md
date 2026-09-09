# Task 036 — Plan all-variant migration

The last pack in the Plan restoration sequence. Tasks 033, 034 and 035 restored
the collapsed roadmap row, the attached expanded frame and the content anatomy
inside it. This task's subject is the sentence none of them could make:

> Every step the product can render goes through that grammar, and what differs
> between two steps is what production **means** by them — never a second
> presentation built for one of them.

Every claim below is labelled `CANONICAL REQUIREMENT`, `PRODUCTION SEMANTIC
REQUIREMENT`, `LANDED REPO FACT`, `ENGINEERING IMPLEMENTATION` or `UNRESOLVED`.
An implementation choice is not an owner decision because it landed.

**The governing rule, unchanged:** production code owns semantic truth; the
canonical HTML owns application anatomy and interaction structure; the brand
authority owns the skin. Where this document and the canonical file disagree,
the file wins.

---

## 1 — source and environment

| | |
|---|---|
| Task start HEAD | `a8f6dce18a43ff21b10f478808b3fc6333cdd0f4` |
| Branch | `main` (worked directly on `main`, no branch, no PR, no worktree) |
| Working tree at start | clean |
| Upstream authority | `docs/design/reports/030-…md`, `031-…md`, `032-…md`, `033-…md`, `034-…md` |
| Design-authority manifest | `docs/design/approved/manifest.json` — **unchanged** |

## 2 — canonical hash verification

`LANDED REPO FACT`.

| | |
|---|---|
| Path | `docs/design/approved/plan-step-v1.html` |
| Required | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| Measured | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| Bytes changed by this task | none |

`src/ui/design-authority.test.ts` re-checks all four packs against the manifest
and against their committed git blobs on every run, and passes.

---

## 3 — the pre-edit variant inventory

`LANDED REPO FACT`.

The prompt's five historical labels were used as investigation clues and then
discarded: they are one reading of a set that is larger. The inventory was built
by running the **whole engine** over every fixture and reducing each step to the
shape it renders at — kind, lifecycle, condition, outcome, action mode, track,
implementation, rail, findings, blockers, members, reach — rather than by
grepping for names.

Five states no single scan of a fixture can produce were derived rather than
assumed:

| State | How it is reached | Why it cannot be skipped |
|---|---|---|
| `needs-decision` | `noExclusionsAnswer(f)` | every committed fixture answers the exclusions question, so the state a real tenant starts in appears in no plain run |
| `review-required` | a second scan of an edited policy read against the first scan's record | it is a *difference* between two scans and does not exist in one |
| `set-aside` | `mapping.notApplicable[stepId]` | it is an operator action |
| **a goal the baseline implements with two policies** (`multiPolicy`) | the fixture read again with **none of the tenant's own Conditional Access** (`paired(f)`), then with one half of the pair deployed in report-only, then with that half edited between two scans | every fixture's tenant already delivers `guests-mfa` with a policy of its own, so on all of them the pair is *preserved* and never rendered apart — correction 1 |
| actionable implementation on the demo | `curatedFixture` / `asCuratedBaseline` | an unsettled source group holds the whole policy, so the demo's own baseline reaches almost none of the implementable shapes |

**Result: 41 distinct renderable shapes across 6 presentation kinds** (`policy`,
`object`, `blocker`, `check`, `campaign`, `ladder`), 5 lifecycle values
(including *none*), 5 conditions, and 8 action modes (`deploy`, `observe`,
`enforce`, `preserve`, `resolve`, `decide`, `verify`, `restore`). Six of the 41
are two-policy shapes, added by correction 1; the first pass reported 34 and
reached none of them.

The full list is not paraphrased here: it is `INVENTORY` in
`src/ui/surfaces/planVariants.test.ts`, recomputed from every fixture on every
test run and asserted equal. Prose rots; that list fails.

### 3.1 — what the inventory found, and what it means for migration

| Variant / case | Production semantic source | Collapsed path | Expanded path | On the restored grammar? | Migration needed |
|---|---|---|---|---|---|
| Implement (pack V1) | `implementationOffered` = `implementable` | `PlanRow` | `ContentStep` | yes (033–035) | none |
| Report-only observe (V2) | lifecycle `report-only`, healthy | `PlanRow` | `ContentStep` | yes | none |
| Review required (V3) | `heldForReview`, condition `review-required` | `PlanRow` | `ContentStep` | yes | none |
| **In place / preserve (V4)** | `isPreserved`, `Step.satisfiedBy` | `PlanRow` | `ContentStep` | **partial — no rail at all** | **the existing-implementation side block** |
| Baseline conflict (V5) | condition `baseline-conflict`, `state.conflictSource` | `PlanRow` | `ContentStep` | yes | none |
| Needs decision | condition `needs-decision`, Foundation C | `PlanRow` | `ContentStep` | yes | none |
| Blocked on a prerequisite | condition `blocked`, `contract.fix` | `PlanRow` | `ContentStep` | yes | none |
| Ready to enforce | lifecycle `ready-to-enforce` | `PlanRow` | `ContentStep` | yes | none |
| Enforced by this plan | lifecycle `enforced`, `satisfied` | `PlanRow` | `ContentStep` | yes | none |
| Set aside | `state.setAside` | `PlanRow` | `ContentStep` | yes | none |
| Preparation / object / blocker | `steps[].kind` `object` \| `blocker` | `PlanRow` | `ContentStep` | yes | none |
| Check, Campaign, Hardening rung | `steps[].kind` `check` \| `campaign` \| `ladder` | `PlanRow` | `ContentStep` | yes | none |
| **Two-policy goal (Foundation B members)** | `requiredMembers`, `contract.members`, `multiPolicy` | `PlanRow` | `ContentStep` → `PolicyMembers` | yes | none — but unproved by this file until correction 1 |
| Cleanup row | `CleanupPhase.rows` | `PlanRow` | `CleanupBody` | yes (034) | none |
| **Undated held group** | `undatedRows` | `PlanRow`, **under no heading** | `ContentStep` | **partial** | **the group's name** |

`LANDED REPO FACT`, and the headline finding of the inventory: **tasks 033–035
had already converged the composition.** There was no old card grammar, no
per-step panel and no second body left to rip out. `PlanRow` is the only row
markup in the product (`stepContract.test.ts` contract 12), `ContentStep` is the
only step body, and `CleanupBody` is the only Cleanup body — and it draws the
same `.step` frame, the same `StepHead` and the same `.step-main`.

So this task is not a demolition. It is (a) the two places the grammar was
genuinely incomplete, (b) the two sizes tasks 033 and 034 explicitly deferred to
036, and (c) the proof, which did not exist.

---

## 4 — what changed

### 4.1 The In-place variant's rail

`CANONICAL REQUIREMENT` — `docs/design/approved/plan-step-v1.html` V4 draws a
`.step-side` with **"Existing implementation"** over the tenant's own policy
name, and draws **no lifecycle track**. Production drew the track correctly
(`stepTrack` returns empty for `inPlace`) and drew **no rail at all**: the
In-place step has no dated milestone and no required policy members, so
`hasRail` was false and the pack's defining V4 block was simply absent.

Task 034 §10 deferred this with the reason "production has no truthful source
for them yet". `LANDED REPO FACT`: that reason was correct for the pack's
*Readiness* and *Current posture* lists and **wrong for this one**.
`Step.satisfiedBy` — the coverage result that decided the goal was satisfied —
already names the policy, and `stepContract.foundOf` was already reading it for
the main column's finding.

`ENGINEERING IMPLEMENTATION`:

- `ContractExisting = { names: string[]; together: boolean }` on the contract;
- `existingOf(step)` is the one reading, shared by the finding and the rail, so
  the two cannot name different policies;
- `StepRail` draws the block; `railBlocks()` / `hasRail()` moved from the
  component into `stepContract.ts`, because "does the frame lay out two columns"
  and "does the rail draw anything" must be one answer, and a predicate over the
  contract is contract logic.

`PRODUCTION SEMANTIC REQUIREMENT`, preserved exactly:

- one policy is named alone only where the classifier proved it covers the whole
  goal (`satisfiedBy.sufficient`);
- where two cover it between them, both are named and the sub-line says they do
  it together — naming the first would present a policy that does not cover the
  goal as the one that delivers it;
- where this scan classified no satisfying policy, `existing` is `null`, the
  unnamed sentence stands and **no rail block appears**. Nothing is invented to
  fill the column;
- the block never appears on a step the coverage authority did not call
  preserved.

Words: `pages.app.plan.stepContract.railExisting` / `railExistingKeep` /
`railExistingTogether` (new keys, named in the commit).

### 4.2 The undated held group is named

`LANDED REPO FACT` carried from task 033 §11 and 034 §10. The screen drew the
undated group — steps whose policy the plan cannot write yet, so they sit in no
wave — as a panel of rows under no heading, while `PrintPlan` has always named
the same rows **"Waiting on something else"**. A group of rows after the
numbered phases with nothing over it reads as a phase whose title failed to
render.

`ENGINEERING IMPLEMENTATION`: the words moved from `pages.app.print.held` to
`pages.app.plan.held` — one group, one name, one entry both surfaces read. The
`lead` stays print-only; on screen each row already says what holds it, in its
own date column. `docs/qa/page-contracts.json` gains the exact string (its own
rule: an allow list is updated when the strings a surface renders change), and
`floor.test.ts`'s closed-list guard was updated to expect it — reading it from
the content file rather than hardcoding, as it already does for the floor
heading.

### 4.3 The Plan's display size

`CANONICAL REQUIREMENT`, deferred by 033 §11 and 034 §10 to "036/039". The pack
sets `.hero h1{font:700 42px}`, 34px at its 940 breakpoint and 30px at its 650.
Task 031 landed the `.display` ramp and left each surface's size to its
restoration pack; Connect took `--d-3`. The Plan now takes **`--d-2` (42),
`--d-6` (34) at ≤940 and `--d-9` (30) at ≤650** — the pack's own three numbers,
as ramp tokens rather than px in a surface stylesheet.

### 4.4 The proof

`src/ui/surfaces/planVariants.test.ts` (new, 14 tests). It sweeps ~600 steps
across every fixture in five derivations, and asserts over **all of them at
once** rather than over named cases:

| § | What it proves |
|---|---|
| §1 | every canonical case is still reachable, and the 34-shape inventory is exactly what renders |
| §2 | the track is a projection of the lifecycle alone — proved *by construction*: the same step at each of the five conditions draws an identical track |
| §2b | the condition is unchanged when only the lifecycle is swapped, at every lifecycle value |
| §3 | the action-mode precedence is the authorities' own; every step has one action, one Why and a non-empty completion |
| §3b | `implementation.offered` equals `implementationOffered(step)`; nothing is offered with no operations; the two "no" (unwritable vs held) stay two; nothing is offered where the end state is unsettled |
| §3c | a preserved goal is never offered a creation; a policy the tenant already had draws no rollout; a set-aside step never advances |
| §4 | a blocked step lists its blockers or states the authority's reason; a step held for review keeps the condition |
| §4b | no empty finding card, no empty who line |
| §5 | the rail exists exactly when it has a block; the existing-implementation block's provenance is `satisfiedBy` and its together-ness matches its count |
| §5b | the pack still draws V4's block and still draws no V4 track; production now draws the block |
| §6 | one row, two bodies, both on the same frame; no `step.id`/`goalId`/`step.kind` presentation fork |
| §6a | Portal, JSON and PowerShell are gated on the contract's one answer; no policy body is composed in JSX |
| §6b | the collapsed row and the opened head never disagree about the state |
| §6c | the demo mounts the same Plan and builds no presentation of its own |

`ENGINEERING IMPLEMENTATION`: two assertions were **written wrong and corrected
against production**, and the corrections are the interesting part.

1. *"a preserved goal draws no track."* False. A goal the **tenant** already had
   (`inPlace`) draws none, because marking its stages reached would claim a
   rollout that did not happen. A goal **this plan** deployed and enforced
   (`satisfied`, `midflight`) keeps the rollout it actually had. The assertion
   now says the narrower, true thing.
2. *"a blocked step is never offered an implementation."* False, and the
   distinction is load-bearing: `blocked` is ordering — a prerequisite step in
   front of this one — and the policy behind it can still be writable.
   Flattening that into Foundation A's answer would either hide a usable
   artifact or claim the step may proceed. The assertion now covers
   `needs-decision` and `baseline-conflict` only, which are the two "the desired
   end state is not settled" answers, with the reason recorded in the test.

---

## 5 — what was deliberately NOT done

`PRODUCTION SEMANTIC REQUIREMENT`. The pack draws these; production has no
truthful source, and §9 of the prompt forbids inventing one.

| Pack element | Why not |
|---|---|
| V1/V2/V3 rail **"Readiness"** list ("Emergency access preserved", "No unresolved prerequisite", "12/12 admins observed") | it is a list of **passed** prerequisites. Production deliberately surfaces only what is outstanding (`contract.fix`), and building a passed-check list would be a new authority — and would re-introduce exactly the cleared clutter prompt §5 forbids |
| V4 rail **"Current posture"** ("Stronger authentication than baseline") | production has no structured strength-comparison fact. The classifier's verdict is *satisfied*, not *how much stronger* |
| V5 rail **"Implementation"** as a two-item danger list ("No Portal instructions", "No JSON or PowerShell artifact") | production has one answer, said once (`implementationNone`), and the main column already carries the reason. Splitting one answer into two list items to match a sample's box count is decoration |
| A `.step-sub` on most steps | no step sets `changeLine`; the zone exists and is empty rather than filled with the Why paragraph twice (carried from 034) |
| A lifecycle track on the baseline-conflict step | production's conflict step has `lifecycle: null`, so `stepTrack` already returns empty and the rendered result matches V5 exactly — for a semantic reason, not a cosmetic one |

`LANDED REPO FACT`: **no bespoke presentation branch was removed, because none
was found.** §6 of the test now asserts that no branch on `step.id`, `goalId` or
`step.kind` exists in `Plan.tsx`, `ContentStep.tsx` or `StepSections.tsx`, so
one cannot come back. The branches that remain — `cs.kind === 'policy'` for the
unavailable-reason read and the Doesn't-apply offer — are reads of the
**semantic** kind the content file assigns, not forks per step, and they are a
real distinction the shared contract does not flatten.

---

## 6 — accessibility

`LANDED REPO FACT`. No DOM was duplicated for a responsive layout; the rail is
one element that moves under the main column at ≤940 rather than a second copy,
which is unchanged from 034.

The one new element is the rail's existing-implementation block: a `.key-label`
and two paragraphs, in logical DOM order, carrying real text and no
pseudo-content. A tenant policy name is long, so `.metric-name` takes the
smaller step of the type ramp (the pack drops it a step for this block too) and
breaks inside a word rather than overflowing the 290px column — the same
`overflow-wrap: anywhere` treatment already given to UPNs, GUIDs and Graph
paths.

`src/ui/accessibility.test.ts` (56 assertions over the Plan's disclosure
semantics, focus and narrow layout) passes unchanged. `tokens.test.ts` proves
every colour the new block sets text in is AA on the surface it sits on; the
Plan's new display sizes are ramp tokens the same test already governs.

---

## 7 — Demo

`LANDED REPO FACT`. The demo mounts the same `Plan`, which opens the same
`ContentStep`. `src/ui/demo.ts` references no Plan component (§6c asserts it),
and the demo's own two snapshots are inside the variant sweep, so every
invariant in §2–§6 is asserted over them. No demo fact was changed to make a
screenshot easier: the In-place plate below is the demo's real
`s-goal-block-legacy-auth`, satisfied by the tenant's own
`Core - Block - Legacy authentication`.

---

## 8 — visual evidence

```text
docs/design/approved/rendered/plan/{1280,768,390}.png   canonical, unchanged
docs/screens/036/before/*.png     full production run before
docs/screens/036/after/*.png      full production run after
```

Both are full runs of `scripts/render-design.mjs --production`, at 1280 / 768 /
390 in both themes, so they carry the regression proof as well as the acceptance
evidence.

New in both sets, added by this task: **`plan-step-inplace`,
`plan-step-blocked`, `plan-step-conflict`, `plan-step-decision`,
`plan-step-review`**. Each opens roadmap rows until the opened step satisfies a
predicate about what it *contains* — a rail metric name, an attention panel with
a blocking list and no decision, a danger callout without a blocking list, a
decision label, a review-required condition — so the plate cannot silently be of
the wrong step, and the evidence survives a change to the demo fixture. The
driver now prints `NOT FOUND` when no row matched.

`plan-step-review` and the mutual exclusion of the blocked and decision
predicates are **correction 1**; see §12.

**Of the 84 plates shot in both runs, the 54 that differ are all Plan plates.**
Connect, Connect signed-out, MFA Readiness, Home and Export — 30 plates in both
themes at all three widths — are byte-identical. Nothing leaked out of the Plan.
(78 and 48 before correction 1 added the six `plan-step-review` plates.)

### The one that matters most

```text
render-design: NOT FOUND for docs/screens/036/before/plan-step-inplace-*.png
```

The **before** run could not find an In-place step with a rail, at any width, in
either theme, because there was none. The **after** run reports no `NOT FOUND`
at all. That line is the migration, stated by the tool rather than by this
document.

### Read off the plates

| Variant | 1280 | 768 | 390 |
|---|---|---|---|
| In place | rail carries `Core - Block - Legacy authentication` under "Existing implementation"; no track; What to do says "nothing to create" | rail under the main column | same, one column |
| Baseline conflict | danger callout above Why; no track; rail carries "Next milestone → the baseline defines this policy two ways" with **no date**; no findings, no Fix — truthfully sparse | collapses | collapses |
| Blocked | attention panel with the numbered blocking list, and no decision to answer | collapses | collapses |
| Needs decision | the same attention panel *and* the decision row under What to do: picker chips are a draft with a Save, never a confirmation | collapses | collapses |
| Review required (V3) | head reads "In place · Review required"; What IAMAI found carries the NEW EVIDENCE card ("the policy itself changed … what was watched before this is no longer what is deployed") beside EXISTING COVERAGE; the after plate also carries the In-place rail this task added, which the before plate does not | collapses | collapses |
| The board | the undated group is now headed "Waiting on something else"; the h1 is the pack's serif 42 | 34 | 30 |

`LANDED REPO FACT` — a capture artifact, not a defect: in a full-page
`captureBeyondViewport` shot the sticky topbar renders at its sticky offset and
overlays whatever is at that scroll position, which on the deep plates is the
roadmap row immediately above the opened step. `plan-step-light-1280.png`, where
the opened step is the first row, shows the row attached above the step with no
overlay. Task 034 §11 recorded the same behaviour.

---

## 9 — frozen authorities

`LANDED REPO FACT`. Nothing in this task edited:

baseline pins or snapshots · the classifier or goal map · Graph collection or
permissions · CA policy semantics · Foundations A/B/C/D's decisions · the
canonical/open policy operation · lifecycle or condition calculation ·
observation/history truth · detected / recommended / operator-confirmed ·
emergency-access semantics · MFA proof, rung or population truth ·
implementation applicability or safety · Plan ordering or business rules ·
Export JSON/PowerShell/Portal semantics · session / sign-out / forget · demo
fixture truth or isolation.

`stepContract.ts` gained a field and two predicates. It is Foundation D's
module, and every one of them is a **projection**: `existingOf` restates
`Step.satisfiedBy`, `railBlocks` restates what the contract already holds. No
new decision was added, and no existing one was moved.

---

## 10 — deferred, and why

| Deferred | Owner | Why not here |
|---|---|---|
| A rendered plate of the `needs-decision` **condition** (the unanswered exclusions group) | — | the demo fixture answers that question, and changing demo truth for a screenshot is forbidden (§14 of the prompt). The variant is proved at contract level over `small+unanswered/s-prereq-exclusion-group` and eight other plans in the sweep |
| The pack's Readiness / Current-posture / split-Implementation rail lists | — | §5 above: no truthful production source |
| MFA Readiness, Home, Export, How, Inventory | 037 / 038 / — | not this surface |
| Final responsive conformance across all approved surfaces | 039 | — |
| Cross-product convergence and legacy alias cleanup | 040 | — |
| Final approved-design and brand verification | 041 | — |

`planVariants.test.ts` and `planAnatomy.test.ts` both fail two ways on this
list: if production implements a deferred element early, and if the pack stops
drawing what production claims to have restored.

---

## 11 — validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 1939 pass, 0 fail, 2 skipped (correction 1: 1939 pass, 0 fail, 2 skipped — §7 and §7b added) |
| `npm run build:site` | built |
| `npm run smoke` | pass |
| `git diff --check` | clean |
| Design-authority integrity (`design-authority.test.ts`) | pass, four packs, hashes unchanged |
| Brand integrity (`src/brand/brand.test.ts`) | pass |
| Task-030 foundation (`foundation.test.ts`, `tokens.test.ts`) | pass |
| Pack 033/034/035 regressions (`planAnatomy.test.ts`) | pass, unchanged |
| Step Contract (`stepContract.test.ts`) | pass, 12 contracts |
| All-variant sweep (`planVariants.test.ts`) | pass, 16 tests, 41-shape inventory |
| Accessibility (`accessibility.test.ts`) | pass |
| Canonical + production render | `docs/screens/036/{before,after}` |

`npm run walk` was not run locally; the `deploy-pages` workflow owns the walk.

---

## 12 — correction 1

Two findings, both on the *proof* rather than on the product: the migration
itself is unchanged, the canonical Plan HTML is untouched and its hash is still
`1f1bda57…`.

### 12.1 The all-variant inventory omitted multi-policy steps

`LANDED REPO FACT`. Every one of the 34 shapes the first pass pinned ended in
`one-policy`. A goal the pinned baseline implements with **two** policies —
`guests-mfa` — is one step delivering two objects, each with its own name, its
own stage, its own observation history and its own review state (Foundation B,
`roadmap/tracking.ts` `requiredMembers`; rendered by `StepSections.tsx`
`PolicyMembers`). The sweep reached that path on **no** fixture, so a file whose
whole claim is "every shape the Plan can render" left the one rendering branch
that can *lose facts* unswept: a migration could have flattened the pair to its
deployed half and the gate would still have passed.

It was unreachable for a reason, and the reason is production's: on every
committed fixture the tenant already delivers `guests-mfa` with a policy of its
own, so the step is `preserved` and its pair is never rendered apart.

The fix is a third derived reading in the sweep — `paired(f)` in
`planVariants.test.ts` — which reads every fixture again with **none of the
tenant's own Conditional Access**, which is the ordinary greenfield shape, and
then twice more:

| Reading | What it makes true |
|---|---|
| `+no-ca` | both halves of the pair required, neither deployed |
| `+half-pair` | one half deployed in report-only, the other not built: two stages, two histories |
| `+half-pair+rescan` | that half edited by hand between two scans: **one** member held for review, the other not |

Nothing writes an observation: the third run's record is the second run's own,
exactly as `rescanned` already did it for a single-member step.

The inventory is now **41 shapes**, six of them `members`. The three cases are
also named in `CASES`, so §1 fails if any of them stops being reachable.

New `§7` asserts over **every** multi-policy variant in the sweep, not over a
named case: one member per required member in the baseline's order, distinct
keys, distinct labels, distinct names, distinct lines; each member's stage is
the tracking record's *for that key*, each member's review state is its own, and
each member's `since` is the observation recorded *for that key* — never the
step's aggregate and never the other half's. It then asserts the sweep actually
reaches a pair at two different stages and a pair with exactly one half held for
review, and that a member needing a look never leaves its step reading
`healthy`. (Which badge the step ends up wearing is the condition precedence's
answer — a blocked step outranks a held one — so `healthy` is the assertion, not
`review-required`.) `§7b` holds the renderer to the same one source.

`stepContract.test.ts` contract 8 already proved the canonical pair in depth;
what was missing was the *sweep*, and that is what this adds.

### 12.2 The blocked and decision plates were byte-identical

`LANDED REPO FACT`. The two capture predicates were not mutually exclusive: a
step waiting on a person also lists what is outstanding, so
`.callout` + `.blocking` matched the decision step, and the first row satisfying
both produced one step's picture under two names. All twelve plates (two
variants × two themes × three widths) were duplicates, in the before set as well
as the after set.

The blocked predicate is now the attention panel and its list **and no decision
row**; the decision predicate is unchanged. The two plate sets are now distinct
at every width in both themes.

And `plan-step-review` adds the one canonical variant that had no production
plate at all. It is not obtained by changing the sample tenant. The demo *is*
two scans of one org, and selecting the follow-up scan carries day one's record
into it, observations and all (`ui/demo.ts` `nextDemoRecord`), so the sample's
own progression renders a policy held for review. The driver waits for day one's
plan to record what it saw, puts the demo's snapshot bookkeeping back to what a
visitor who has not opened week two yet has, and presses the selector a visitor
presses; the one row it writes is the sample tenant's own (`ui/demoMode.ts`).
Without that reset the shot is order-dependent — the first pass writes a record
for the follow-up scan and every pass after it reads week two against week two's
own observations, which is a tenant nothing changed in.

Both plate sets were **re-shot end to end**: the after set from this tree, the
before set from a build of task 036's base commit `a8f6dce` in a separate
worktree, with the corrected script in both. All eighteen re-shot plates report
no `NOT FOUND` and all eighteen are distinct.

| Re-shot | before | after |
|---|---|---|
| `plan-step-blocked` × 2 themes × 3 widths | `a8f6dce` | this tree |
| `plan-step-decision` × 2 themes × 3 widths | `a8f6dce` | this tree |
| `plan-step-review` × 2 themes × 3 widths | `a8f6dce` | this tree |

### 12.3 What was deliberately not touched

- The `needs-decision` **condition** plate stays deferred for the reason §10
  gives: the demo answers that question, and demo truth is not changed for a
  screenshot. It is proved at contract level over nine plans in the sweep.
- No Foundation, no contract and no engine file changed. The correction is a
  test file, a capture script and this report.
