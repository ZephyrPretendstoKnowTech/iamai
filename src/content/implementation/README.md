# Implementation content: package → Plan step

One pipeline turns an authored implementation-content package into the
Implementation viewer, the Readiness tiles, the owner confirmations, the
Troubleshooting dialog and the source line of a Plan step.

Registered and active: **every package in `docs/implementation-content/` that
describes a Plan content step** (44 of 46; the two `cleanup-*` packages describe
Cleanup rows, which are not content steps). Each is compiled with the parts the
runtime cannot project safely withheld (§3).

The library was authored against baseline pin `8461e0f2`; this build pins
`90d9b890` (`baselines/*.pinned.json`). The packages apply anyway (owner
decision, 2026-09-11): the source line names the authored pin beside the build's
(`stepPackage.ts packageSourceLine`), the request bodies bind the policy
Foundation A resolved from the build's pin, and a block the author scoped with a
`baselineCommit` condition stays scoped to its own pin.

## 1. Package (authored, not edited for integration)

`docs/implementation-content/<step-id>/`

- `STEP.md` owns intent.
- `META.json` owns the projection per semantic state, the bindings, the
  outputs, `verifiedSources`, `supportBlocks` and `prerequisites`.
- `CONTENT.md` owns the blocks (`@@IAMAI-BEGIN {json}` … `@@IAMAI-END`).

The prose (`when`, `appliesWhen`, every rule line and block body) is the
author's. It is never read as logic. What the runtime evaluates is the
structured fields below.

## 2. Runtime contract

A package that passes `validatePackage` is one the runtime can project safely.
Everything the runtime reads is validated, and a feature it does not implement
is an error (`protocol.ts`). A feature the guide allows but the runtime never
reaches, such as a custom state, is a warning.

### States

The runtime enters `missing`, `partial`, `reportOnly`, `readyToEnforce`,
`inPlace`, `blocked`, `needsDecision`, `sourceConflict` and `notLicensed`
(`stepPackage.ts packageStateOf`). Order:

1. Set aside gives no state.
2. `sourceConflict`.
3. `needsDecision`.
4. `blocked` when nothing is to be implemented now. The exception is the owner's
   held report-only creation (`stepContract.ts implementationIsCurrent`).
5. `inPlace`.
6. `partial` whenever an update changes material fields of the tenant's policy,
   whatever the lifecycle.
7. `readyToEnforce`, `reportOnly`.
8. `missing` for a create.

`inPlace`, `blocked`, `needsDecision`, `sourceConflict` and `notLicensed` have
nothing to implement now: their projection is empty whatever the package
authors for them (`project.ts NO_ACTION_STATES`), and the step shows its own
no-action box. A package state the runtime never enters (`verificationRequired`,
`campaignRunning`, …) is never shown.

A state the package projects nothing for does not throw, and the step keeps the
channels the engine builds (`stepPackage.ts packageDrawsImplementation`). A held
projection is the package's and shows its hold.

### Machine conditions (`conditions.ts`)

The operators are:

- `state`, `present`, `absent`, `equals`, `in`
- `confirmed` (a prerequisite satisfied now)
- `baselineCommit`
- `all`, `any`, `not`

Each condition object has exactly one operator. Bindings, prerequisites and
states must be declared.

### Readiness (`supportBlocks.readiness`, JSON or JSON template)

- `tiles[]`: `id`, `label` or `gate`, `rules[]`.
  - Each rule has `if` (a condition), `result` (Ready | Review required |
    Unknown | Blocked | Not applicable) and `line`.
  - The first rule whose `if` holds is the tile. A tile none of whose rules
    holds is not shown.
- `gateKey`: the runtime tile that states the same fact, which answers instead.
- `confirms[]`: the prerequisites a person confirms from this tile.
- `conclusionByState`: `{ state: conclusionKey }` into `conclusions`.

### Prerequisites and owner confirmations

`META.prerequisites[]`: `id`, `class`, `requiredBefore: "<state>-><state>"`,
plus two optional fields:

- `evidence`: a condition, the tenant fact that satisfies the prerequisite
  without anybody's word.
- `invalidatedBy[]`: the bindings a confirmation is given against.

A prerequisite gates the artifacts of its `requiredBefore` state. They are held
until every one of them is satisfied, by evidence or by a confirmation whose
basis (a hash of the `invalidatedBy` values) still matches.

Confirmations persist in the plan record and the plan file
(`PlanDecisions.confirmations`, `roadmap/decisions.ts`). They stop counting
when their values change, and are never asked again for unchanged facts.

### Partial composition

- `mode: "composeByMismatch"` (the guide's `compose` + `modules` is normalised
  into it, `protocol.ts normalizeProjection`). A Partial that is not composed
  cannot choose the corrections that apply, and is an error.
- `mismatches.<id>` carries its channel refs and one of:
  - `facts[]`: policy field paths under `conditions`, `grantControls` or
    `sessionControls`;
  - `select` (a condition), optionally `alongside: true`.
- IAMAI supplies `policy.current.changedFields`: the leaf fields its update
  changes (`roadmap/changedFields.ts`).
- A module is selected when one of its facts covers a changed field, or when
  its `select` holds (beside another selected module, if `alongside`).
- A changed field no module covers holds the whole projection.
- The selected module ids are bound to the projection's `mismatchBinding`.

### PowerShell invocation

A `deployableAfterBinding` PowerShell block declares
`invocation: { modeParameter, correctionsParameter?, parameters: { Name: { binding | switch + prerequisite, modes[] } } }`.
It is validated against the script's own `param()` block (`invocation.ts`).

The artifact the viewer shows and Copy copies is the script, defined once as a
function, then called once per projected run with IAMAI's values. A switch is
passed only for a satisfied prerequisite.

`withheldModes: { Mode: reason }` names a mode IAMAI cannot call: one the script
runs only with an attestation the package declares no prerequisite for, or with a
value in a shape IAMAI does not hold. A projection that runs it is withheld for
that state, with the reason, rather than shown as a call that would throw.

### JSON requests

Blocks that send to the same method and endpoint are merged into one request
body. Two blocks setting one field, or bodies for different requests, hold the
projection.

### Email

Email blocks declare `audience` and `communicationTrigger` (on the block or
`META.email`). An audience is never guessed.

### Troubleshooting

`scenarios[]` declare `id`, `title` and `states[]`.

### Normalisation (`protocol.ts normalizePackage`)

The library was authored in several shapes of one schema. Before validation each
is rewritten into the shape above, structure only, every sentence the author's:

- Email: `trigger` is `communicationTrigger`; `META.email.blocks` declares each
  listed block; an Email authored for exactly one state is sent for that state
  (`missing` → `before-report-only`, `readyToEnforce` → `before-enforcement`).
- Troubleshooting: a sentence where a list is read is a one-item list,
  `sourceIds` is `sources`, a scenario without states takes its block's, and a
  scenario without a title is titled by its symptom (shown once).
- Readiness: `whyIamaiSaysThis` / `whyIAMAI` become the evidence sections;
  `nextSafeAction`, `safeNow` and `safeToEnforce` become conclusions for the states
  each answers; a tile whose written result opens with a result
  (`Unknown until tested`) is that result in its block's states. A tile whose
  result is a binding or any other sentence is still refused: the runtime owns
  tenant facts.
- A state authored under an alias (`states.ts`, `groupMissing`) is content for
  its runtime state, unless the author wrote that state too.

The validator prints what it normalised and classifies every family it still
refuses.

## 3. Compile and validate

The existing CLI and the runtime share `protocol.ts`:

```
node scripts/compile-implementation-content.mjs <package-dir> --lint
node scripts/compile-implementation-content.mjs --validate-library docs/implementation-content [--json out.json]
node scripts/compile-implementation-content.mjs --registry src/content/implementation/registry.generated.json
```

`--validate-library` runs strict validation over every package and groups the
failures by feature: the list of authored gaps.

`--registry` compiles the whole library (`library.ts`). A package is registered
when its step id reaches a content entry the way a plan step does
(`stepTitle.ts contentStepForPackage`), so a merged goal or an aliased step
reaches the package its entry names. Every validation issue names the smallest
part it belongs to (`protocol.ts packageIssues`), and the build takes that part
out, round after round, until the package validates (`withholdInvalid`):

- a block, and with it every channel that projects it;
- one channel of one state (an Email with no audience, a script with no mode);
- a correction module IAMAI cannot select, so the change it would have covered
  holds Partial;
- a projection key the runtime does not read: alone where it is a channel the
  viewer does not render (`manual`), otherwise the whole state;
- a prerequisite it cannot read, with the state whose transition it gates;
- a readiness tile, a troubleshooting scenario, a conclusion, or a support model
  that is prose.

Taking a part out only ever takes away what a step shows. The package files are
never edited; the compiler prints what it withheld per package.
`library.test.ts` fails when the registry drifts from the library.

## 4. Runtime adapter (`src/ui/surfaces/stepPackage.ts`)

- `implementationPackageFor(step)` returns the package for the content entry the
  step's title comes from.
- `packageStateOf(step, contract, snapshot)` maps the lifecycle engine's truth
  to a package state. The package never decides the state.
- `packageBindings(...)` binds only values IAMAI already holds, including the
  resolved target's `policy.target.conditions`, `grantControls`,
  `sessionControls` and `authStrength.target.id`, `policy.current.changedFields` and
  `tenant.deviceRegistration.multiFactorAuthConfiguration` (read with
  `Policy.Read.All`; unknown where the role cannot read it).
- `packageRuntime(...)` reports every prerequisite's standing.
- `mergeReadiness(...)`: runtime tiles keep their places, `gateKey` tiles give
  way, and a confirmation the next transition waits on is shown first.

## 5. Projection (`project.ts`, pure, no clock)

`projectSafely`, `readinessSafely` and `troubleshootingSafely` never throw. A
fault holds the implementation, and the step still renders its lifecycle,
readiness and a truthful no-action box. The fault is reported to the console.

## 6. Viewer (`ContentStep.tsx` `Implementation`)

- Tabs, in order: Entra | PowerShell | JSON | AI Info | Email.
- Preview, Expand and Copy all read the same artifact text.
- Copy uses the `implementation-artifact` disposition (`exportGuard.ts`), so a
  copied body or script keeps its tenant ids and Microsoft constants.
- The AI warning shows on AI Info.
- A held projection shows a no-action box for its reason: confirmations
  pending, correction not covered, package fault, or missing value.

## Review harness (dev server only; not a build input)

`/planner/dev/pilot.html?state=readyToEnforce|reportOnly|missing|fixture[&print=1]`
renders the real fixture step, moved to a state
(`src/testing/pilotFixture.ts`), through ContentStep. It is rendered as a build
pinned to the pilot's own baseline would render it, and says so on the page.
Confirmations recorded there live only in that page.
