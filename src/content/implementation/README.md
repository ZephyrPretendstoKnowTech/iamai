# Implementation content: package → Plan step

One pipeline turns an authored implementation-content package into the
Implementation viewer, the Readiness tiles, the Troubleshooting dialog and the
source line of a Plan step. Only `s-goal-device-registration-mfa` is active.

## 1. Package (authored, not edited for integration)

`docs/implementation-content/<step-id>/`

- `STEP.md` owns intent.
- `META.json` owns projection per semantic state, the bindings, the outputs,
  `verifiedSources` and `supportBlocks`.
- `CONTENT.md` owns the blocks (`@@IAMAI-BEGIN {json}` … `@@IAMAI-END`).

## 2. Compile (existing CLI, extended)

`scripts/compile-implementation-content.mjs` parses and validates packages with
the shared protocol module (`protocol.ts`: `parseBlocks`, `validatePackage`,
`compilePackage`). The same checks run in the tests, so the CLI and the runtime
cannot disagree.

Validation fails on a nested, duplicate, unterminated or orphan block; invalid
block metadata; an unsupported channel; an undeclared binding; unparseable
JSON or JSON template; an unknown projection key; a projected block that does
not exist, is in another channel or does not declare the state; or a missing
support block.

Emit the runtime registry (only the packages named on the command line):

```
node scripts/compile-implementation-content.mjs --registry src/content/implementation/registry.generated.json docs/implementation-content/s-goal-device-registration-mfa
```

`pilot.test.ts` fails when `registry.generated.json` differs from a fresh
compile of the package, or when it holds any other package.

## 3. Runtime adapter (`src/ui/surfaces/stepPackage.ts`)

- `implementationPackageFor(step.id)`: the package is found by step id only.
- `packageStateOf(step, contract)`: the package state comes from the lifecycle
  engine (Step.state, the Step Contract, Foundation A operations). The package
  never decides the state.
- `packageBindings(step, ctx, contract)`: only values IAMAI already holds, with
  no new tenant read. Anything it cannot bind is absent.
- `mergeReadiness(runtime, packageReadiness)`: runtime tiles keep their place.
  Package tiles fill the remaining room.

## 4. Projection (`project.ts`, pure, no clock)

- `projectImplementation(pkg, state, bindings)` reads the META projection for
  the state. Partial composes sharedBefore, then the blocks for each id in
  `policy.current.semanticMismatches`, then sharedAfter, deduped by block id.
- Bindings are resolved per line. An absent optional value drops its line. An
  absent required value, an unknown mismatch id or an invalid artifact holds
  the whole projection, so there is no deployable content. No raw placeholder
  survives.
- `packageReadiness` evaluates `readiness.model`. A tile is Ready only when its
  authored rule has its evidence (a required input present, a single baseline
  rule). An unobserved input is Unknown, and a state-scoped human check is
  Review required.
- `troubleshootingFor` returns `troubleshooting.model` scenarios for the state.
- `sourceUpdatedOn` returns the latest `verifiedSources[].checkedOn` of the
  user-facing sources, never the build, deploy or browser time.

## 5. Viewer (`ContentStep.tsx` `Implementation`)

The tabs follow the projected channels in the order Entra | PowerShell | JSON |
AI Info | Email. Preview, Expand and Copy all read the same artifact text.
Copy goes through the existing export/redaction guard. The AI warning shows on
AI Info. The support row under the viewer holds the channel note (PowerShell
mode, JSON request), Troubleshooting and the source line. A step without a
package renders exactly as before.

## Review harness (dev server only; not a build input)

`dev-pilot.html?state=readyToEnforce|reportOnly|missing|fixture[&print=1]`
renders the real fixture step moved to a state (`src/testing/pilotFixture.ts`)
through ContentStep. The fixture supplies state and bindings. The package
supplies every word.
