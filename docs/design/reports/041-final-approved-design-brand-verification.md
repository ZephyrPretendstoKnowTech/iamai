# 041 — Final approved-design + brand verification

Task 041, 2026-09-09. The closing verification pass of the visual-restoration program,
packs 030–040.

It answers one question with evidence:

> Did production actually converge on the approved application designs and the final IAMAI
> brand, without changing technical truth, manufacturing owner decisions, or leaving material
> visual drift behind?

**Short answer: yes, for the seven surfaces in scope.** One defect was found and corrected —
the repository's own authority records had been left behind by the packs that superseded
them, so two machine-readable authority files and three documents stated that no surface had
been restored, months after all four were. Two tests were actively pinning that falsehood in
place. Nothing else in this task changed a pixel, a word, or a semantic.

This report is a scoped conformance audit. It is not a product-correctness audit, not a
standards certification, and not an approval — approval comes from the independent reviewer.

---

## 1. Authority

### 1.1 Canonical approved HTML — read, not edited

Verified byte-for-byte at task start and again at the end. All four are unchanged.

| Surface | Canonical path | SHA-256 |
|---|---|---|
| Home | `docs/design/approved/home-v2.html` | `88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50` |
| Connect | `docs/design/approved/connect-v3.html` | `903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b` |
| Plan + step | `docs/design/approved/plan-step-v1.html` | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| MFA Readiness | `docs/design/approved/mfa-readiness-v2.html` | `12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512` |

Held by `src/ui/design-authority.test.ts` and `src/ui/convergence.test.ts`, each of which
re-hashes the files at test time.

### 1.2 Brand authority

`docs/brand/brand-manifest.json` is the machine copy; `docs/brand/iamai-brand-contract.md`
is the human record; `docs/design/brand-decisions.md` is the decision record.
`src/brand/brand.test.ts` fails when any two of them disagree — which is how the one defect
below was caught a second time, from a different direction.

### 1.3 Semantic authority

Production code. Untouched by this task and by the restoration program: the engine, the
pinned baseline and its interpretation, Graph collection and permissions, Conditional Access
semantics, canonical operation, lifecycle and condition, observation history, the
detected/recommended/operator-confirmed distinction, emergency access, MFA proof/rung/
readiness, population semantics, the Step Contract, implementation eligibility, Export's
technical semantics, Inventory's population semantics, How's runtime permission authority,
and session/sign-out/forget.

### 1.4 Precedence

```text
production technical/content truth
  ↑ outranks
approved HTML application architecture
  ↑ outranks
approved brand skin
```

Generated branding-application previews are **not** in this chain and have no authority for
layout, architecture, placement, hierarchy, copy, data model, metrics, workflow, interaction
or responsive behaviour.

### 1.5 Owner decision vs engineering implementation

What follows is `OWNER DECISION` and is not this task's to move: the four approved HTML packs
as visual authority; the brand palette (Mineral Teal / Deep Mineral), the three IBM Plex
roles, Guided Route variant 2 as the mark, and the absence of a tagline; the product
hierarchy Home → Connect → Plan → MFA Readiness → Export with How supporting; the read-only
product boundary.

What follows is `ENGINEERING IMPLEMENTATION` and is **not** described anywhere in this report
as owner-approved, however long it has been in the tree: the pack decomposition into tasks
030–040; the supporting/derived token names and the `--d-1…--d-15` display ramp mechanics;
the exact SVG coordinates of the master mark; motion durations and radius values; helper,
component and CSS class names; the route widths chosen for Export/How/Inventory (1040/1040/
1240 — widths the product already resolved, reused by content role); the decision to reach
Inventory from MFA Readiness rather than from primary navigation.

---

## 2. Audit matrix

`RE` = rendered evidence. All production plates are at `docs/screens/041/` and all canonical
plates at `docs/design/approved/rendered/`, at 1280 / 768 / 390, light and dark for
production.

| Surface | Authority | Route | Visual authority level | RE widths | Light/dark | Desktop | Responsive | Brand | Semantic risk | Copy authority | Material findings |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | `home-v2.html` | `/` (static, `dist/index.html`) | canonical pack | 1280/768/390 | both | conformant | conformant, probed at 760/560 ±1 | conformant | none — page reads no tenant | `content.json` `pages.home` | none |
| Connect | `connect-v3.html` | `#/connect` | canonical pack | 1280/768/390, signed-out and demo | both | conformant | conformant, probed at 760 ±1 | conformant | none | `content.json` | none |
| Plan | `plan-step-v1.html` | `#/plan`, `#/plan/<id>` | canonical pack | 1280/768/390 × 8 step variants | both | conformant | conformant, probed at 940/650 ±1 | conformant | none | `content.json` | none |
| MFA Readiness | `mfa-readiness-v2.html` | `#/readiness` | canonical pack | 1280/768/390 | both | conformant | conformant, probed at 900/620 ±1 | conformant | none | `content.json` | none |
| Export | none — convergence only | `#/export` | established system | 1280/768/390 | both | converged | usable | conformant | none | `content.json` | none |
| How | none — convergence only | `#/how` | established system | 1280/768/390 | both | converged | usable | conformant | none | generated from registries | none |
| Inventory | none — convergence only | `#/inventory` | established system | 1280/768/390, plus People tab | both | converged | usable | conformant | none | `content.json` | none |

The production set is uniform: 17 shots x 2 themes x 3 widths = 102 plates, plus the
responsive readings. Dark-theme conformance also rests on the shared token layer, which
`src/ui/tokens.test.ts` asserts is AA for every colour the pages set text in, in both themes.

---

## 3. Per-surface verification

### 3.1 Home — CONFORMANT

Compared with `home-v2.html` at 1280/768/390. Every canonical relationship is present and in
the canonical order: public header (lockup, How it works, GitHub, the way into the product);
eyebrow over a 50px serif display; lead; primary `Open IAMAI` beside secondary
`Try it with sample data`; the meta row of three claims; the 1.5fr/.8fr product section with
Reads / Compares / Plans as label rows and the baseline in the bordered side rail; the
catches as label-and-explanation rows; the trust row of three; About as a paragraph with its
links left to the footer; the footer with the product name left and three links right; and
the pack's own 760 and 560 collapses.

- Public Home stays distinct from the planner shell. `src/home.test.ts` asserts no signed-in
  tab and no `Account`/`Sign in`/`Sign out` reaches the public header.
- Brand: the Guided Route mark in the lockup, IBM Plex Serif display / Sans interface, no
  tagline under the wordmark.
- No card wall — the page is hairline rows and one bordered rail.
- Public claims are technically accurate: `Read-only`, `Runs in your browser`,
  `Source is public`, each expanded truthfully in the trust row.
- About says **Built by Lachlan Robinette**, which is true. The generated previews' *Built by
  Jon Hope* appears nowhere (§5).
- Production copy is richer than the pack's placeholder prose and is not penalised for it:
  packs do not own copy. No claim was weakened; the three trust statements keep nuance the
  pack's placeholder drops.

Production adds a theme control to the public header, which the mock does not draw. That is a
real product control, not decoration — `ENGINEERING IMPLEMENTATION`, and consistent with the
shell.

### 3.2 Connect — CONFORMANT

Compared with `connect-v3.html`, in both the signed-out state and the demo state.

Present: heading hierarchy (eyebrow, serif display, lead); the status strip; **one contiguous
staged flow** — a single panel with steps 1/2/3 separated by hairlines, not three independent
cards; numbered state with the current step marked by a word (`NEXT`) as well as a colour;
in-row actions on the right of the row they belong to; the baseline card with its
`Source and version` disclosure; the `IAMAI limitations` disclosure; and the Plan-ready
destination as a **separate** panel outside the flow. `connectAnatomy.test.ts` asserts the
flow/destination split and the destination's `minmax(0,1fr) auto` grid against the pack's own
bytes, both directions.

Semantics unchanged: authentication and session behaviour is task 015's, the scan is not
simplified, and the tenant/baseline identity on screen is the package's own name and pinned
version. No old separate-card flow remains; there is exactly one `<header className="app">`
in the tree and no surface builds a second.

The planner navigation renders only when signed in. That is deliberate and not a hidden
action: signed out, Connect *is* the product, and the public site's own header carries How
and the source. `ENGINEERING IMPLEMENTATION`.

### 3.3 Plan — CONFORMANT, collapsed and expanded, across every variant

`plan-step-v1.html` is a design *specification* pack with eight sections, not a single page,
so conformance is per-relationship rather than per-screenshot.

**Collapsed.** The roadmap board renders phase panels of hairline-separated rows; each row is
the pack's four zones — state word, title with its quiet reason beneath, who it touches,
when — with the meta and date right-aligned exactly as the pack declares. The row is the
expansion affordance and says so (`role`, `aria-expanded`). It collapses at the pack's 940.

**Expanded.** The opened step attaches to the row that opened it as its top edge, not as a
block indented under it. Present: the head with kind eyebrow, serif title and state; the
four-stage lifecycle track (Not deployed → Report-only → Ready to enforce → Enforced) with
the *current* stage drawn as the stage it is; the main column beside the step's own 290px
rail; Why; What IAMAI found; Who this touches; What to do with Portal/JSON/PowerShell as one
tab set with all three always offered; Fix before continuing; Dates; Done when; More; and the
sticky Plan shell. The rail moves below the main column at 940 rather than disappearing, and
`planAnatomy.test.ts` asserts that as an absence — no narrow rule may hide it.

**Variants.** Eight distinct step states were rendered from the demo tenant by finding a row
that satisfies a predicate rather than naming a step, so the evidence survives a fixture
change: `plan-step`, `plan-step-lifecycle`, `plan-step-findings`, `plan-step-inplace`,
`plan-step-blocked`, `plan-step-conflict`, `plan-step-decision`, `plan-step-review`. That
covers implement, preserve/in-place, remediate/blocker, decide, baseline-conflict/resolution
and review-required. The blocked and decision predicates mutually exclude each other, so the
two plates prove two states rather than one state twice. No variant renders old bespoke UI.

Non-policy and supporting steps are not given a fake lifecycle: the rail and track render
from the Step Contract, and a step with no lifecycle draws none. Portal/JSON/PowerShell are
the Step Contract's own answers via `stepExport.ts`, not re-derived for presentation.

### 3.4 MFA Readiness — CONFORMANT

Compared with `mfa-readiness-v2.html` at 1280/768/390.

Present: eyebrow over serif display; one **integrated summary panel** — a dominant cell
stating the answer in a sentence, then three counts as cells of the same panel, not four
cards; one supporting callout beneath it; search with the filters as pills; the six-zone
person table; the footer note. The six zones are Account / Role / Strongest method / Proof /
Readiness / Next step.

The first column is labelled **Account** where the pack's placeholder says *Person*. That is
production being more truthful, not drift: the table also carries emergency-access accounts,
service accounts and a shared device, which are not persons — and the footer note says so.
Copy is production's authority.

Explicitly verified:

- **No second rung or readiness engine.** `MfaReadiness.tsx` imports `READINESS_GROUPS`,
  `actionable`, `readinessView` from `derive/mfaReadiness.ts` and the `Rung` type from
  `derive/ladder.ts`; `readinessCells.ts` maps a rung to *words* only. There is no threshold
  comparison, no counting and no scoring in the view.
- **Registration is not proof.** The Proof column carries the evidence sentence
  (`signed in during the evidence window, never challenged for MFA`,
  `MFA via Passkey (device-bound) 16 days ago`), and `demo.test.ts` asserts generic MFA
  evidence does not prove a passkey.
- **Population semantics unchanged.** The summary counts active people; emergency-access,
  service, shared-device and inactive accounts stay visible with `not a person` / `not active`
  and are excluded from the denominator, which the footer note states as a count.
- Readiness is never colour-only: every badge carries the rung number and the group's word
  inside the shared pill outline.
- The table is a real `<table>` at every width. Below 900 the head is *clipped* rather than
  `display:none`, so it stays in the accessibility tree, and the visible stacked-cell key is a
  real DOM element (`.cell-key`), `aria-hidden`, not `::before` content.

**Rung prominence is not an invented owner decision.** The page counts the three
`mfaReadiness` groupings, and the five-rung ladder shows as a per-row badge with its title in
a tooltip. That split is the state task 037 landed and task 041 did not change. §6 records it
as the one unresolved owner choice, with options, rather than settling it here.

### 3.5 Export — CONVERGED

No canonical mockup exists and none was invented. Export uses the shared shell, the display
ramp's smallest page rung, the shared controls, `--code-surface` for code, the shared panel
table, the shared disclosure and status roles, both themes and a 1040 route width matched to
its document role. Its six artifacts are now hairline-separated rows inside one panel per
group — Connect's own approved flow anatomy — instead of an auto-filling grid that left a
half-width box beside an empty half.

Technical content is untouched: the JSON, the PowerShell, the Portal guidance, the canonical
operations, the ICS, the plan file round-trip, the CSVs, the prompt pack, the grounding bundle
and its redaction warning, and the print layout. `exportGuard` still redacts by default and
the unredacted checkbox still carries its warning.

Task 040's convergence had one hole, fixed at the base commit `bbe8fc0` immediately before
this task: two Export fallback branches did not carry the `export` surface class, so the route
rendered a 26px heading without a usable scan and 30px a moment later. Verified fixed;
`convergence.test.ts` now states the general rule.

### 3.6 How — CONVERGED

Supporting/secondary hierarchy, readable prose measure separate from the route width, the
current typography, the shared panel tables, callouts and disclosures, both themes, usable at
390.

The load-bearing check: **runtime-derived technical truth remains authoritative.** The
permissions table is `scopeRows()` over `GRAPH_SCOPES` and `copy/permissions.ts`; the reads
tables are `COLLECTOR_REGISTRY`; the checks tables are `validation/rules.ts`. There is no
second hand-written permission list anywhere, and no rewritten security claim — a permission
IAMAI stops asking for disappears from the page because the registry changed, not because
someone edited a table. A Graph permission name does not break mid-word; a Graph path does,
with a floor.

### 3.7 Inventory — CONVERGED

Operational and table-oriented, at the widest route in the product (1240) because it holds
the densest tenant data. Nine tabs with counts, per-table search and filters, the shared
uppercase key head inside one bordered panel, long tenant objects contained where they are
rather than by breaking all prose, badges carrying words, empty and no-result distinguished,
both themes, usable at 390. It was **not** converted to cards.

No change to population, filtering semantics, object identity, evidence/provenance or Graph
collection. Inventory is reached from MFA Readiness and is deliberately not in primary
navigation; adding it would be an IA decision no authority supplies.

---

## 4. Findings

### Finding 1 — the repository's authority records stated that no surface had been restored

**Finding.** `docs/design/approved/manifest.json` recorded `implementationState:
"restoration-pending"` for all four governed surfaces, and `docs/brand/brand-manifest.json`
recorded `production.pageCompositionRestored: false`, months after pack 032 restored Connect,
033–036 restored Plan, 037 restored MFA Readiness and 038 restored Home. Three documents
restated the stale value in prose (`authority-reconciliation.md` §9.4,
`brand-decisions.md`, `iamai-brand-contract.md` §12's current-state table and §3's closing
paragraph). Two tests — `design-authority.test.ts:190` and `foundation.test.ts:236` — asserted
the stale value, so the falsehood was not merely uncorrected, it was **enforced**: a pack that
updated the record correctly would have failed CI.

**Evidence.** Base commit `bbe8fc05`:

```console
$ grep -c '"implementationState": "restoration-pending"' docs/design/approved/manifest.json
4
$ python -c "import json;print(json.load(open('docs/brand/brand-manifest.json'))['production']['pageCompositionRestored'])"
False
$ git log --oneline --format='%h %s' | grep -E '^(8c4ef95|8b29999|1eaff04|57b9f84)' | cut -c1-90
```

against commits `1eaff04` (Connect), `57b9f84`…`efabde1` (Plan), `8b29999` (MFA Readiness),
`8c4ef95` (Home), each of which restored its surface.

**User impact.** None on screen. The impact is on anyone reading the repository to decide what
is left to do: the machine-readable design authority — the file every restoration pack is
required to read first — said the entire program was outstanding. A future task reading it
would either redo landed work or distrust the authority chain.

**Severity.** FUNCTIONAL. **Confidence.** Certain — the values, the tests pinning them and the
commits contradicting them are all in the tree.

**Recommended fix / what was done.** Set `implementationState: "restored"` on all four
records, add `restorationVerifiedBy`/`restorationVerifiedOn`/`restorationReport`, set
`pageCompositionRestored: true` with `pageCompositionRestoredBy: "031-040"`, update the two
tests to assert the new truth, and make the three prose documents defer to the manifest
instead of restating it — the CLAUDE.md rule that a fact with two sources loses one.

`productionAssumedConformant` was **deliberately left `false` on every surface.** It does not
mean "not restored yet"; it means conformance is *evidenced, never assumed*. The two-sided
anatomy tests read the canonical bytes at test time and the rendered comparison is shot per
task, and the commit after this one could regress a surface without touching the manifest.
Flipping it to `true` would have been this task certifying its own audit as repository fact
before any reviewer saw it. Both tests now assert it stays `false`, with the reason written
where the assertion is.

**Files/surfaces.** `docs/design/approved/manifest.json`, `docs/brand/brand-manifest.json`,
`docs/brand/iamai-brand-contract.md`, `docs/design/brand-decisions.md`,
`docs/design/authority-reconciliation.md`, `src/ui/design-authority.test.ts`,
`src/ui/foundation.test.ts`.

**How to prove fixed.** `node --test --test-isolation=none src/ui/design-authority.test.ts
src/ui/foundation.test.ts src/brand/brand.test.ts src/ui/finalVerification.test.ts` — and the
new cross-file guard in `finalVerification.test.ts` fails if the design manifest and the brand
manifest ever tell different stories again.

**Classification.** `LANDED REPO FACT` (the restoration landed; the record did not follow).

**Correction 1 (after review).** The fix above set the two flags and left one of the same two
files answering the question twice: `brand-manifest.json`'s `typography.appliedNote` still read
"What typography does NOT yet do is compose a page … a surface expresses the display ramp when
its restoration pack (031-038) lands", in the present tense, beside the
`pageCompositionRestored: true` this task had just written. A reader of the machine brand
authority could still conclude the display ramp was unapplied surface by surface. The note now
tells task 030's history in the past tense and defers the current state to the flag rather than
restating it, and a new guard in `finalVerification.test.ts` sweeps every string in both
machine authorities for present- or future-tense claims that page composition, the display ramp
or a restoration pack is still to come. The flags agreeing with each other was not enough while
prose in the same file disagreed with both.

### Finding 2 — Connect's ready destination compresses the pack's eyebrow into its meta line

**Finding.** The pack's Plan-ready destination is eyebrow (`PLAN READY`) / display heading /
lead / meta row. In the plan-ready state production renders heading + inline state meta /
lead, folding the eyebrow's state into the meta. In the signed-out state it renders the
canonical stat row in full.

**Evidence.** `docs/screens/041/connect-dark-1280.png` against
`docs/design/approved/rendered/connect/1280.png`; and
`docs/screens/041/connect-signedout-light-1280.png`, which does carry the four-stat row.

**User impact.** Negligible. Every canonical element — labelled title, lead, facts, action —
is present; only the state label's position differs, and production's meta carries *more*
(scan recency).

**Severity.** CLEANUP. **Confidence.** High. Deliberately not corrected: adding a `PLAN READY`
eyebrow means writing a new copy string, and packs do not own copy, so the fix would be an
invented product decision rather than a restoration.

**Files/surfaces.** `src/ui/surfaces/Connect.tsx`, `#/connect`.
**How to prove fixed.** Only meaningful after an owner copy decision.

**Classification.** `UNRESOLVED` (bounded, low value).

### Finding 3 — restoration packs 035 and 037–040 left no report under `docs/design/reports/`

**Finding.** The directory holds reports for 030, 031, 032, 033, 034 and 036 only. Packs 035,
037, 038, 039 and 040 recorded their reasoning in commit messages instead.

**Evidence.** `ls docs/design/reports/`.

**User impact.** None on screen. Those commit messages are unusually complete, so the
reasoning is not lost, only harder to find.

**Severity.** CLEANUP. **Confidence.** Certain. Not corrected: back-filling five reports from
commit messages would create a second, weaker record of facts the commits already hold.

**Classification.** `ENGINEERING IMPLEMENTATION`.

### Deferred to the post-restoration program

None found by this task. Every issue above is either within the visual-restoration program or
cosmetic. This task deliberately did not open data-accuracy, rescan-durability,
operator-decision-durability, Learn-link, Portal/JSON/PowerShell deep-correctness,
baseline-portability, large-tenant-scale or stale-evidence audits — those belong to the
separate post-restoration program and are out of this contract's scope, so the absence of
findings in them is **not** a claim that they are clean.

---

## 5. Contamination and copy-authority sweep

Searched every text file the product ships or generates — `src/**`, `home/**`,
`docs/design/content.json`, `index.html`, `scripts/build-home.ts` — for each forbidden line.

| Searched for | Result |
|---|---|
| `Built by Jon Hope` | absent from every product source; present only in the tests that forbid it |
| `PLAN PROGRESS ACHIEVE`, `FROM HERE TO WHAT'S NEXT`, `IDENTITY ROADMAP`, `PLAN WITH EVIDENCE`, `GUIDED PROGRESSION`, `PEOPLE + AI + A BRIGHTER TOMORROW` | absent |
| any tagline beside the wordmark | none; `brand.tagline` is `null` and the lockup is mark + `IAMAI` |
| generated founder narrative | absent; About credits Lachlan Robinette, which is true |
| generated preview page architecture | none; every governed surface's authority path matches `docs/design/approved/*.html` |
| visible `Today` primary concept | absent from navigation and page contracts; `#/today` survives only as a redirect to `#/readiness`, which is correct for a bookmark |
| remote font CDN | none; nine IBM Plex `.woff2` served locally, rewritten to `/planner/fonts/` for the public page by `assemble-site.mjs` |
| false Graph / read-only / write claims | none; How generates its permission and read tables from the registries the code runs from |
| "IAMAI applies changes automatically" | no such claim; every step's action is Portal steps, JSON or PowerShell the operator runs |
| evidence claimed stronger than proven | no; unknown stays unknown — MFA Readiness keeps unreadable methods in their own sentence rather than counting them as actionable (`e2e232b`) |

Jon Hope is named on How, Connect and Home as the **baseline's author**, with a link to his
own project. That is a fact about whose Conditional Access baseline IAMAI reads and it stays;
`Built by Jon Hope` is a claim about who built this product and is forbidden. The new guard in
`src/ui/finalVerification.test.ts` holds both halves at once.

---

## 6. Brand verification

| Required | Verified |
|---|---|
| IBM Plex Serif | display/H1/editorial heading role, weight 700, staged face `IBMPlexSerif-Bold-Latin1.woff2` |
| IBM Plex Sans | body/interface 400, strong/label/control 600, wordmark 700 |
| IBM Plex Mono | identifiers, JSON, PowerShell, Graph paths, code — 400 staged |
| Mineral Teal | light theme, `src/ui/tokens.ts` holds §2's values byte for byte |
| Deep Mineral | dark theme, same |
| Guided Route mark | variant 2, in the planner shell lockup, on public Home, and as the favicon |
| local fonts only | nine `.woff2` in `public/fonts`, SHA-256-recorded in `font-provenance.md` |
| no CDN | swept across `index.html`, `home/`, `src/`, `public/`, `docs/brand/` |
| no old Inter/Georgia dependency | Georgia survives only as a fallback *after* IBM Plex Serif in the stack; Inter appears only in comments describing the packs, which are dark Inter mockups |
| one master, one derivation path | `iamai-guided-route-master.svg` → `scripts/brandDerive.ts` → every other asset; the test re-derives and compares |
| no hand-redrawn logo variant | the master forbids `text`, `image`, gradients, filters and external refs, and no second drawing exists |
| no tagline | `brand.tagline: null`, six forbidden lines swept |
| brand ≠ success | teal is identity/navigation/focus; green is tenant state. Design lint rule 5 is stated on the roles themselves |

Not treated as owner decisions and not asserted as such anywhere above: the exact SVG
coordinates, the supporting/derived token names, the radius triple, the motion bands.

---

## 7. Navigation / IA

Header, in order, exactly once each: `Connect · Plan · MFA Readiness · Export · How`. The
active tab carries `aria-current="page"` and an accent underline — shape as well as colour.
Tabs that need a scan are `aria-disabled` with the disabled ink rather than looking live and
doing nothing; Connect and How hold no tenant data and work before the first scan.

Public flow: Home → Connect → Plan → MFA Readiness → Export. Signed-in emphasis after
connect/scan: Plan → MFA Readiness → Export, with Connect's own destination panel handing off
to the Plan. How is supporting. Today is not a visible product concept anywhere. Inventory is
reached from MFA Readiness's footer link, not from primary navigation.

Nothing was added to or removed from navigation by this task.

---

## 8. Token / theme integrity

- One source of truth: `src/ui/tokens.ts` → `scripts/gen-tokens.mjs` → `src/ui/tokens.css`.
  `tokens.test.ts` re-renders and fails on a byte of drift.
- Light and dark roles are complete and symmetric.
- Semantic colours stay distinct from brand; design lint rule 5 now names the canonical roles
  rather than the retired aliases, which is strictly stricter than before task 040.
- No second theme system. The home page's `theme.css` is generated from the same tokens.
- **No legacy alias layer remains.** Task 040 migrated all 329 references onto canonical names
  and deleted the compatibility layer, promoting the four `color-mix` tints that were hiding
  in it to a derived family under one formula. There is therefore no retained compatibility
  layer to document.
- No hard-coded old-paper palette leak: design lint rule 1 forbids a colour literal outside
  `tokens.css`.
- Contrast: `tokens.test.ts` asserts AA (4.5:1) for every reading pair, for ink on brand, for
  every derived text colour on every surface text sits on, and for every colour the pages
  actually set text in — over 100 declarations, in both themes.

---

## 9. Accessibility regression status

A product regression check, not a standards audit and not a certification.

Verified present and passing: semantic landmarks with one primary `<nav>` and one banner;
headings in order with no surface building a second header; every click handler on a native
control or an element made operable by keyboard; the shared controls native rather than ARIA
imitations; a visible `:focus-visible` that survives a mode painting no box-shadows, with no
later reset erasing it, on the home sheet too; forced-colors handling; reduced-motion
handling; real `<table>` elements with `<th scope="col">` that survive the display swap;
tablist keyboard behaviour with named panels; every expand/collapse on a keyboard-reachable
control that names what it opens; focus returned to the opener when the readiness guidance and
Plan settings close; every status a word, not only a coloured dot; an active filter marked by
shape as well as colour; the rung badge's title reachable by assistive technology; long tenant
objects contained without breaking ordinary prose; wide regions scrolling inside themselves;
no pseudo-content-only table labels; and no duplicate desktop/mobile control pair creating
repeated state — the narrow layouts move one DOM element rather than rendering a second.

No accessibility regression was introduced by tasks 030–040 that this pass could find, and
none was introduced by this task, which changed no rendering code.

---

## 10. Responsive verification

`scripts/responsive-probe.mjs` re-measured the live layout of the canonical HTML and of the
built application, at 1280 / 768 / 390 **and at every canonical breakpoint ±1** — Home
760/560, Connect 760, Plan 940/650, MFA Readiness 900/620 — confirming task 039 held after
task 040's shared changes. Readings at `docs/screens/041/responsive-probe.json`.

**Horizontal page overflow: zero, in canonical and in production, at all 32 probed widths.**

The only elements the probe found hidden anywhere are correct ones: Home's `firstLink` hides
identically in canonical and production; the canonical readiness table head uses
`display:none` at its seven narrow widths where production clips it instead, keeping it in
the accessibility tree; and production's stacked-cell key is hidden at exactly the two widths
above 900 where the column head is on screen. No primary action, Plan rail, MFA field, Connect
action or Home product entry disappears at any width, and neither theme diverges structurally.

---

## 11. Demo verification

Demo remains synthetic, isolated, non-authoritative and visually identical to production.
`demo.test.ts` asserts the sample tenant loads nothing that can sign in or read a tenant,
makes no network call, is entered by URL rather than a stored flag, offers no Microsoft
sign-in or sign-out, and that there is **one** plan generator which no demo file calls or
copies. `responsive.test.ts` asserts Demo inherits the responsive result instead of carrying
its own; `connectAnatomy.test.ts` asserts `demoMode.ts` draws no Connect anatomy of its own.
The only demo-specific CSS is the banner that says it is a demo.

No fixture truth was altered by this task.

---

## 12. Technical-truth freeze

This task changed **no** production runtime code. The diff is two JSON authority records,
three documents, two test files updated to assert the new truth, one new test file, and
rendered evidence. Baseline pins and snapshots, the classifier and mapping, Graph collection
and permissions, CA semantics, canonical/open policy operation, lifecycle, condition,
observation history, the detected/recommended/operator-confirmed distinction, emergency
access, MFA proof/rung/readiness, population semantics, the Step Contract, implementation
eligibility, Export's technical semantics, Inventory's semantics, How's runtime authority,
session/sign-out/forget and Demo isolation are all untouched.

---

## 13. Render evidence

```console
# canonical — the four approved packs at 1280/768/390 (12 plates)
node scripts/render-design.mjs --canonical
#   -> docs/design/approved/rendered/<surface>/<width>.png

# production — 17 shots x 2 themes x 3 widths (102 plates)
node scripts/render-design.mjs --production --out docs/screens/041
#   -> docs/screens/041/<shot>-<theme>-<width>.png

# responsive readings, canonical vs production, at every breakpoint +/-1
node scripts/responsive-probe.mjs --json docs/screens/041/responsive-probe.json
```

Production shots: `home`, `connect`, `connect-signedout`, `plan`, `plan-step`,
`plan-step-lifecycle`, `plan-step-findings`, `plan-step-inplace`, `plan-step-blocked`,
`plan-step-conflict`, `plan-step-decision`, `plan-step-review`, `readiness`, `export`, `how`,
`inventory`, `inventory-people`.

The canonical HTML is the authority; a PNG is derived reference only. Nothing regenerates a
pack from an image and the renderer opens the canonical files read-only.

---

## 14. Final conformance summary

| Dimension | Verdict |
|---|---|
| Approved-design conformance | **Conformant** for Home, Connect, Plan (collapsed, expanded, all eight variants) and MFA Readiness, against the four canonical files at their recorded hashes, verified by two-sided anatomy tests plus rendered comparison at 1280/768/390. |
| Brand conformance | **Conformant.** Three IBM Plex roles from local faces, Mineral Teal / Deep Mineral, Guided Route variant 2 from one master and one derivation path, no tagline, no CDN, brand held apart from success. |
| Responsive conformance | **Conformant.** Zero horizontal overflow at 32 probed widths; task 039's result held after task 040. |
| Accessibility regression status | **No regression found** within this pass's scope. This is a product regression check, not a standards audit, and no certification is claimed. |
| Technical-truth preservation | **Preserved.** No production runtime code changed by this task; no restoration-induced semantic drift found. |
| Demo reuse | **Production-derived.** One plan generator, no demo visual fork, no demo-only responsive CSS. |
| Non-canonical surface convergence | **Converged.** Export, How and Inventory use the established system with their technical roles intact; no anatomy was invented for any of them. |
| Deferred post-restoration audit items | **None raised by this task.** The post-restoration program's areas were not opened here, so this is not a claim that they are clean. |
| Unresolved owner decisions | **One** — MFA rung prominence (§15). One low-value cosmetic item (Finding 2). |

The visual-restoration program is complete enough, on this evidence, to stop redesign work
and begin the separate post-restoration product-audit program. That is a recommendation to
the reviewer, not an approval.

---

## 15. Unresolved owner decision — MFA rung prominence

Raised rather than settled, because it is a subjective product-hierarchy choice no authority
in the chain supplies.

**Decision.** Should the five-rung MFA ladder be a first-class element of MFA Readiness, or
remain a per-row badge behind the three readiness groupings?

**Evidence.** `mfa-readiness-v2.html` draws a summary of three counts and a `READINESS` column
of status pills; it never draws a five-rung ladder, because the pack was authored for the
question "who still needs a passkey". The five rungs are nonetheless real product truth
(`derive/ladder.ts`), Connect's Plan tile links here filtered to a rung, and `#/readiness/rung-3`
still works. Task 037 resolved the tension by counting the groupings and showing the rung as a
numbered badge with its title in a tooltip. That is a defensible reading of the pack; it is
not a decision the pack makes.

**Affected surfaces.** MFA Readiness (`#/readiness`), and Connect's Plan tile which links into
it.

**Option A — keep it as it is.** The three groupings answer the page's stated question; the
rung stays a per-row badge and a filter. Cost: an operator who thinks in rungs must read the
badge column or arrive by a filtered link. Benefit: no change, the pack's summary anatomy is
preserved exactly, and nothing new is invented.

**Option B — give the rung a declared secondary presence**, e.g. a rung distribution in the
existing filter strip. Cost: adds an element the approved pack does not draw, so it needs
owner sign-off as a pack amendment; risks re-creating the tiled ladder page task 037 replaced.
Benefit: the five-rung model becomes visible without a filtered link.

**Tradeoff.** A is conservative and pack-faithful; B is more informative but is a new design
element on a governed surface, which only the owner can authorise. **Recommendation: A.** The
pack is explicit about this surface's question, task 037's split already keeps rung truth
reachable and honest, and B would put an unapproved element on a canonical surface to solve a
problem no evidence shows an operator having.

---

## 16. Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm test` | pass — 2002 tests |
| `npm run build:site` | pass |
| `npm run smoke` | pass |
| `node scripts/render-design.mjs --canonical` | 12 plates |
| `node scripts/render-design.mjs --production --out docs/screens/041` | 102 plates |
| `node scripts/responsive-probe.mjs` | zero overflow at 32 widths |
| `git diff --check` | clean |
| `git status --short` | clean |

`npm run walk` is owned by the `deploy-pages` workflow and was not run locally.

Focused suites re-run during the work: `design-authority.test.ts`, `foundation.test.ts`,
`brand.test.ts`, `finalVerification.test.ts`, `convergence.test.ts`, `primitives.test.ts`,
`responsive.test.ts`, `tokens.test.ts`, `accessibility.test.ts`, `home.test.ts`,
`connectAnatomy.test.ts`, `planAnatomy.test.ts`, `readinessAnatomy.test.ts`,
`planVariants.test.ts`, `demo.test.ts`, `publicTrust.test.ts`.

## Authority update, Sep 10, 2026

The owner updated the Plan authority in place. `docs/design/approved/anatomy/plan-step-v1.html`
is now `43de0a7cb9eae37ddf08eeebd829dcd13ed00200ca42e412cbbbfb875df6ae39` (it was
`1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` when this report was written).
The update integrates Readiness and Implementation into every canonical variant, makes the right
rail Next milestone only, and drops What IAMAI found, Who this touches and More from the opened step.
The conformance recorded above is for the earlier bytes; Plan conformance to the updated file is
evidenced by `planAnatomy.test.ts`, which reads the updated file two-sided, and by that change's
rendered comparison.
