# Implementation-content package schema

What an implementation-content package is on disk, the TypeScript types the compiler and runtime read it through, and every rule `--validate-library` enforces. Extracted from the code at HEAD `4cde3e6`. Counts marked "library survey" come from reading every `META.json` and `CONTENT.md` under `docs/implementation-content/` at that HEAD.

## Sources

- `src/content/implementation/protocol.ts`
- `src/content/implementation/conditions.ts`
- `src/content/implementation/invocation.ts`
- `src/content/implementation/states.ts`
- `src/content/implementation/library.ts`
- `src/content/implementation/project.ts`
- `src/content/implementation/drift.ts`
- `src/content/implementation/provenance.ts`
- `src/content/implementation/README.md`
- `src/content/implementation/registry.generated.json` (top-level shape and key counts only)
- `src/content/implementation/library.test.ts` (test names only)
- `scripts/compile-implementation-content.mjs`
- `docs/authoring/compile-implementation-content.mjs` (an older standalone copy, see §1)
- `docs/authoring/IAMAI-Implementation-Content-Authoring-Guide-v2.5-Compact.md` (§4.4 and §5 only)
- `docs/implementation-content/LIBRARY.json` (top-level keys and the first package entry)
- `docs/implementation-content/*/META.json`, `*/CONTENT.md`, `*/STEP.md` (key and heading survey; one sample: `s-goal-session-lifetime`)
- `src/ui/surfaces/stepPackage.ts` (lines 1–130, plus the `packageStateOf` / `packageBindings` / `packageRuntime` signatures)
- `src/ui/surfaces/stepContract.ts` (grep: `cs.why`, `cs.doneWhen`, `cs.whatToDo`)
- `src/ui/surfaces/ContentStep.tsx` (grep: `learn`, `Decision`, `readinessSafely`, `troubleshootingSafely`, support line)
- `docs/design/content.json` (`steps[]` key survey only, never read whole)
- `docs/product/actionability/RUN-CONTEXT.md`
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (grep only)

---

## 1. Pipeline at a glance

| Stage | Code | Input | Output |
|---|---|---|---|
| Parse | `protocol.ts parseBlocks` (142) | `CONTENT.md` text | `Record<string, Block>` |
| Normalise | `protocol.ts normalizePackage` (388) | `PackageMeta` + blocks | the same package in the one shape the validator reads, plus a list of what was rewritten |
| Validate (strict) | `protocol.ts packageIssues` / `validatePackage` (496 / 491) | normalised package | issue sentences, each tagged with the smallest part it belongs to (`IssueLocus`) |
| Warn | `protocol.ts packageWarnings` (722) | normalised package | warnings (never failures) |
| Withhold (registry only) | `protocol.ts withholdInvalid` (875) | normalised package | package with every issue's part removed, up to 32 rounds |
| Compile library | `library.ts compileLibrary` (47) | every package folder | `registered` (a content step exists) and `notSteps` |
| Emit registry | `library.ts registryOf` (87), via `compile-implementation-content.mjs --registry` | compiled library | `registry.generated.json` |
| Regenerate manifest | `library.ts libraryIndexOf` (120), via `--library-index` | compiled library + current `LIBRARY.json` | `LIBRARY.json` with derived counts rewritten |
| Load at runtime | `stepPackage.ts` line 21 (`import registry from …registry.generated.json`) | registry | `PACKAGES`, `REVIEWS` |
| Project | `project.ts projectSafely` / `readinessSafely` / `troubleshootingSafely` | package + state + bindings | channel artifacts, readiness tiles, scenarios |

`library.ts` is Node-only (it imports `node:fs`). The product never imports it; it imports only the generated registry.

Two compilers exist. `scripts/compile-implementation-content.mjs` (237 lines) is the current one and shares `protocol.ts`. `docs/authoring/compile-implementation-content.mjs` (136 lines) is a standalone copy with its own parser. It has only `--lint`, `--list` and `--extract`, and no `--validate-library`, `--registry` or `--library-index`.

---

## 2. On-disk package layout

### 2.1 Library root

| Path | Read by | What it is |
|---|---|---|
| `docs/implementation-content/` | `library.ts LIBRARY_ROOT` (22) | Library root. |
| `docs/implementation-content/LIBRARY.json` | `--library-index` (read and rewritten), `library.test.ts` line 59 | Library manifest: `schemaVersion`, `authoringGuide`, `libraryRevision`, `coverage`, `packages[]`, `bindings[]`, `issues`, `technicalPrimitives`, `aggregate`, `validationLimitations`, `implementationCaveats`, `generationNotes`, `bindingRegistryPolicy`, `derivedBy`. **It is not an input to the registry.** `--registry` walks the package folders. `libraryIndexOf` regenerates `packages[].{contentBlocks, outputs, statesSupported, correctionModules, requiredBindings, optionalBindings, validationResult, strictValidationErrors, registered, provenance, review}`, the whole `bindings[]` inventory and `aggregate` from the packages. Other fields are kept as the author wrote them. |
| `docs/implementation-content/<step-id>/` or `<step-id>/<step-id>/` | `library.ts packageDirs` (32) | One package folder: the first folder, depth ≤ 3, that holds a `META.json`. Library survey: **14** packages sit at `<step-id>/META.json` and **32** one level deeper at `<step-id>/<step-id>/META.json`. |

### 2.2 Package folder

| File | Required | Compiled? | Maps to |
|---|---|---|---|
| `META.json` | yes; a folder without one is not a package | yes | `PackageMeta` (§3). Parsed with `JSON.parse`; a parse failure is `PackageError("META.json does not parse: …")` (`protocol.ts parseMeta` 887–893). |
| `CONTENT.md`, or the file `META.contentFile` names | yes | yes | `Record<string, Block>` (§4). Default name `CONTENT.md` (`library.ts` 52; compiler 131, 180). Library survey: all 46 name `CONTENT.md`. |
| `STEP.md` | by the authoring guide (§4.4, §5) | **no**: no code under `src/` or `scripts/` reads it | Author's statement of intent. Guide §5 heading order: Goal, Why this exists, Applies when, Do not show implementation when, Prerequisites, Owner decisions, Current-state inputs, Target state, Security-significant fields, Preserve, Do not do, State variants, Verification, Rollback / safe recovery, Limitations / unknowns, Source verification. |
| `META*.json` with another name (e.g. timestamped) | — | no | `--validate-library` counts the folder as a package and reports `no META.json (a timestamped META file needs its canonical name)` (compiler 83–84, 128). `library.ts packageDirs` ignores such a folder. |

### 2.3 Block delimiter grammar (`CONTENT.md`)

```
@@IAMAI-BEGIN {"id":"entra.create-set","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
…block body…
@@IAMAI-END
```

| Rule | Where | Failure (`PackageError`) |
|---|---|---|
| Line starts with `@@IAMAI-BEGIN ` (column one) and the rest is JSON | `protocol.ts` 148–155 | `invalid block metadata JSON at line <n>: <parser message>` |
| No `BEGIN` inside an open block | 149 | `nested block at line <n>` |
| Metadata has a non-empty string `id` | 156 | `block at line <n> has no string id` |
| `id` is unique in the file | 157 | `duplicate block id: <id>` |
| `@@IAMAI-END` is exactly the whole line, and a block is open | 161–162 | `orphan @@IAMAI-END at line <n>` |
| Every block is closed by end of file | 169 | `unterminated block: <id>` |
| Body text | 163 | Lines joined with `\n`, trailing whitespace trimmed, one `\n` appended. Text outside blocks is ignored. |

Bindings in a body: `{{binding}}` is text, `{{json:binding}}` is a whole JSON value (`protocol.ts BINDING` 133). Binding names match `[A-Za-z0-9_.-]+`. An endpoint uses single braces: `/policies/{policy.current.id}` (`project.ts bindEndpoint` 138).

### 2.4 Registry output (`registry.generated.json`)

| Key | Type | Written by | Read by |
|---|---|---|---|
| `$comment` | `string` | `registryOf` 89 | nobody |
| `packages` | `Record<stepId, CompiledPackage>`; `meta` keeps only `RUNTIME_META_KEYS` | `registryOf` 90, `runtimeMeta` 81 | `stepPackage.ts` 45 |
| `reviews` | `Record<stepId, Drift>` | `registryOf` 91 | `stepPackage.ts` 48; a package whose `status !== 'current'` is not applied (`implementationPackageFor` 76–79) |
| `provenance` | `Record<stepId, Provenance \| null>` | `registryOf` 92 | not found in runtime code (tests and `LIBRARY.json` only) |

At HEAD the registry holds 44 packages. The two `cleanup-*` packages reach no content step, so they land in `notSteps` and are not registered (`library.ts` 60–62).

---

## 3. `PackageMeta` (META.json)

Type: `protocol.ts` 52–70. It has an open index signature (`& Record<string, unknown>`), so any key type-checks.

"Req. (type)" is what the TypeScript type says. "Validated" is what `packageIssues` actually checks.

| Field | Type | Req. (type) | Emitted to registry | What the compiler / validator / runtime does with it |
|---|---|---|---|---|
| `stepId` | `string` | yes | yes | Not validated. The registry key. `contentStepForPackage(stepId)` decides whether the package is registered (`library.ts` 54). Duplicate content steps throw `two packages for content step <id>: <a>, <b>` (`library.ts` 65; `--registry` only). |
| `title` | `string` | no | yes | Not validated. Not found read by runtime code (the step's title comes from `content.json`). |
| `relationship` | `string` (index signature only; not a named field) | no | yes (`RUNTIME_META_KEYS`) | Not validated. `provenanceOf` reads it only for packages with no content step (`rollout-proof`, `baseline-source-review`) (`provenance.ts` 26). |
| `contentFile` | `string` | no | yes | Which file holds the blocks; default `CONTENT.md`. |
| `requiredBindings` | `string[]` | no | yes | Adds to the declared-binding vocabulary (`protocol.ts` 502). At runtime a missing required value refuses the block that names it (`project.ts bindText` 128). |
| `optionalBindings` | `string[]` | no | yes | Adds to the declared-binding vocabulary. At runtime a line naming a missing optional value is dropped whole (`project.ts bindText` 126–130). |
| `projection` | `Record<state, Record<string, unknown>>` | yes | yes (normalised, with parts withheld) | The per-state content selection (§5.3). Validated per state. A missing `projection` is tolerated as `{}`. |
| `supportBlocks` | `Record<'readiness' \| 'troubleshooting' \| string, string[]>` | no | yes | Names the JSON support-model blocks (§7, §9.3). Validated as lists of existing JSON blocks in the same channel. |
| `verifiedSources` | `VerifiedSource[]` (§8) | no | yes | Not validated structurally. It only feeds a warning. The runtime reads the `userFacing` entries (`project.ts` 539–554). |
| `prerequisites` | `Prerequisite[]` (§10) | no | yes | Validated. Gates a state's artifacts (`project.ts gatingPrerequisites` 176). |
| `observation` | `{ minDays?: number \| null }` | no | yes | Validated: `minDays` is a positive whole number of days, or null (`observation.minDays: a positive whole number of days, or null for the default`). The step's observation window (A1 §7; RUN-CONTEXT-A decision 5): read by `content/implementation/observation.ts` into `roadmap/schedule.ts observationDaysFor`, else 7 days (3 where nobody is affected). Added in A1a; no package authors it yet. |
| `baselineAuthority` | `{ pinCommit?: string; members?: { role: string; memberStableId: string \| null }[] } & Record<string, unknown>` | no | yes (whole object) | Not validated. `pinCommit`, `reviewedMembers` and `reviewedIdentities` feed `driftOf` (`library.ts` 58; compiler 157). `reviewedMembers` / `reviewedIdentities` are read through casts and are not named in the type. `members[].memberStableId` is read by `stepPackage.ts` 438–446 to match each role to the resolved policy operation, which is how per-member bindings are bound. Library survey: 45 of 46 have it, with more than 90 distinct authored sub-keys. |
| `email` | `{ block?: string; audience?: string; communicationTrigger?: string; purpose?: string } & Record<string, unknown>` | no | yes | Normalisation copies `audience` / `communicationTrigger` / `purpose` onto the email blocks it names (`block`, and `blocks[]`, which is read through a cast and not typed) (`protocol.ts` 366–374). The validator also accepts an email whose `META.email.block` names it with both fields (610). The projector falls back to it (`project.ts` 398–403). Authored `applicableStates` and `recommendation` are not read. |
| any other key | `unknown` | — | **no** | Not validated. Dropped from the registry by `runtimeMeta` (`library.ts` 79–84). Library survey, authoring-only keys: `schemaVersion`, `baseline`, `packagePath`, `sourceFiles`, `blockProtocol` (`"iamai-block-v1"`), `authoringScope`, `outputs` (per-channel booleans; one package writes a string for `json`), `microsoftSources` (26), `sources` (7), `validation`, `unresolvedIssues`, `family`, `implementationProfile`, `emailArtifacts`, `correctionModules`, `integrationGaps`, `mechanicalValidation`, and more. |

`CompiledPackage = { meta: PackageMeta; blocks: Record<string, Block> }` (72).

---

## 4. Blocks (`CONTENT.md`)

`Block = { meta: BlockMeta; text: string }`. `BlockMeta = { id: string; channel: string; states?: string[]; format?: string; kind?: string; invocation?: InvocationSpec } & Record<string, unknown>` (`protocol.ts` 29–30).

| Field | Type | Req. (type) | What it does |
|---|---|---|---|
| `id` | `string` | yes (parser) | Unique key. Projections and `supportBlocks` refer to blocks by id. |
| `channel` | `string`, one of `BLOCK_CHANNELS` = `entra`, `json`, `powershell`, `aiInfo`, `email`, `readiness`, `troubleshooting` (84) | yes (type) | Any other channel is `<id>: unsupported channel <c> (not a channel the runtime renders)` (510), and the block is withheld. Library survey: `manual` ×2. A projection may only draw a block into its own channel (599). |
| `states` | `string[]` | no | The states the block is authored for. A projection may draw a block only in a state it declares (600). Aliases are expanded by normalisation (§5.2). For support models, the runtime picks the first `supportBlocks` block that declares the state, else the first one (`project.ts supportModel` 571). |
| `format` | `string`: `markdown`, `json`, `json-template`, `powershell` (library survey) | no | `json` must parse (526). `json-template` must parse once each `{{json:…}}` is masked to `null` (532). Support models must be `json` or `json-template` (637). The JSON channel at runtime must be `json` / `json-template` (`project.ts` 366). |
| `kind` | `string`: `template`, `referenceOnly`, `sourceOnly`, `deployableAfterBinding` (library survey) | no | Only `deployableAfterBinding` changes behaviour. In `powershell` it requires `invocation`, a mode in every projection, and the invocation checks (601–606, 615–618). `states.ts stateCompatibility` also uses it to find deploying states. |
| `invocation` | `InvocationSpec` (§6.2) | required for `powershell` + `deployableAfterBinding` | Validated against the script's `param()` block. The runtime renders the script as a function plus one call per run. |
| `method` | `string` (index signature) | JSON channel at runtime | Not validated. The projector withholds a JSON block with no method or endpoint, and a `PATCH`/`PUT`/`DELETE` whose endpoint names no `{identity}` (`project.ts` 363–378). |
| `endpoint` | `string` (index signature) | JSON channel at runtime | Every `{binding}` in it must be declared (518–522). Bound at runtime; a missing value withholds the channel. |
| `repeatForBinding` | `string` (index signature) | no | Refused when the endpoint names a per-value variable (520). Library survey: ×1. |
| `audience`, `communicationTrigger`, `purpose` | `string` (index signature) | email: `audience` + `communicationTrigger` | See §6.5. |
| `trigger` | `string` (index signature) | no | Normalised to `communicationTrigger` (361–365). |
| `moduleRole`, `apiStability`, `recommendation` | authored | no | Not read (library survey: 8, 7, 4). |

---

## 5. States and per-state variants

### 5.1 Runtime states

`PACKAGE_STATES` (`protocol.ts` 80). The runtime chooses the state in `stepPackage.ts packageStateOf` (175). A package never chooses it.

| State | Runtime projects implementation? | Reached by step class (`states.ts RUNTIME_REACH` 26–30) |
|---|---|---|
| `missing` | yes | policy, object |
| `partial` | yes, only as a `composeByMismatch` composition | policy |
| `reportOnly` | yes | policy |
| `readyToEnforce` | yes | policy |
| `inPlace` | **no** (`project.ts NO_ACTION_STATES` 82) | policy, object, other |
| `blocked` | no | policy, object, other |
| `needsDecision` | no | policy, object, other |
| `sourceConflict` | no | policy, object, other |
| `notLicensed` | no | none; "the runtime never enters it" (`states.ts` 24–25) |

Step class comes from `content.json steps[].kind` (`states.ts stepClassOf` 33): `policy` → policy, `object` or `blocker` → object, anything else → other. A no-action state returns no channels whatever the package authors (`project.ts build` 271). Its readiness and troubleshooting still project.

### 5.2 Authored states that are not runtime states (`states.ts AUTHORED_STATES` 49–88)

| Disposition | Meaning | States |
|---|---|---|
| `alias` | Another name for a runtime state. Normalisation adds the runtime state to each block's `states` (`protocol.ts withAliases` 281, applied 406–409). It copies the projection to the runtime state unless the author already wrote that state (413–418). | `groupMissing`, `missingOrPartial` → `missing`; `notApplicable`, `decided`, `complete`, `disableConfirmed`, `keepConfirmed` → `inPlace`; `routeDecisionRequired`, `approvalRequired` → `needsDecision` |
| `hold` | Equivalent to `blocked`. Not copied; its content is never shown. | `verificationRequired`, `reviewRequired`, `prerequisiteRequired`, `configurePrerequisite`, `migrationRequired`, `actionRequired`, `credentialProofRequired`, `roleCutoverRequired`, `partnerTrustRequired`, `resourceMissing`, `contextMissing`, `pimSettingsPending`, `verificationPending`, `locationMissing`, `applyRequired`, `setupRequired` |
| `process` | An operational stage the runtime does not model. Never shown. | `due`, `failed`, `current`, `register`, `readyToDisable`, `readyToDisablePerUser`, `relayConnectorReady`, `approvedPendingApply`, `activeTrip`, `revertDue`, `campaignRunning`, `holdoutReview`, `ready` |
| none | Undefined. `stateCompatibility` reports `problem: 'undefined'`. | anything else |

`stateCompatibility` (132) also reports `problem: 'unsafe'`. That happens when an authored non-runtime state's `requires` gates on an object, and a reachable action state deploys a `deployableAfterBinding` block without requiring that object.

### 5.3 How a package authors different content per state

Per-state content is two things together:

1. **Block `states[]`**: which states a block is written for.
2. **`projection.<state>`**: which blocks each output channel draws in that state, in order.

Validation ties them: each reference must name an existing block, in the channel it is listed under, whose `states` include the projection's state (596–600).

`ProjectionRef = { block: string; mode?: string; corrections?: string[] }` (75). `refsOf` (188) accepts a plain id string, a `{ block, mode, corrections }` object, a single entry or a list, and the guide's singular `correction`.

**Keys a state projection may carry** (`PROJECTION_KEYS` 104):

| Key | Type | What it does |
|---|---|---|
| `entra`, `json`, `powershell`, `aiInfo`, `email` | `ProjectionRef \| ProjectionRef[]` | Blocks per output channel (`PROJECTION_CHANNELS` 87). |
| `requires` | `string[]` | Bindings the whole state needs. Each must be declared (565). At runtime a missing one holds every channel (`project.ts` 309–310). |
| `mode` | `'composeByMismatch'` (or `'compose'` before normalisation) | Anything else fails: `mode "<m>" is not a composition the runtime implements …` (564). |
| `sharedBefore`, `sharedAfter` | `Record<channel, ProjectionRef[]>` | Composition only. Drawn before / after the selected modules' refs, only in channels where a selected module draws something (`project.ts` 298–299). |
| `mismatches` | `Record<moduleId, MismatchModule>` | Composition only. At least one is required (572). |
| `mismatchBinding` | `string` | The binding the selected module ids are bound to. Otherwise the one `requires` entry ending `.semanticMismatches` (`mismatchBindingOf` 427). |
| `reason`, `appliesWhen` | prose | Inert documentation. |
| anything else | — | `projection.<state>: unsupported key <k>` (563). Library survey: `manual` ×4, `selector` ×2, `variants` ×2. `withholdOnce` drops the key alone when every ref under it is a block of that same channel name (the `manual` case), otherwise the whole state (810–815). |

**A mismatch module** (`MISMATCH_KEYS` 105):

| Key | Type | What it does |
|---|---|---|
| `entra`, `json`, `powershell`, `aiInfo`, `email` | refs | The module's own blocks. |
| `facts` | `string[]` of policy field paths under `conditions`, `grantControls`, `sessionControls` | Selected when a changed field equals a fact or sits under it (`project.ts covers` 180). |
| `select` | `Condition` | Selected when the condition holds. |
| `alongside` | `boolean` | With `select`: chosen only beside a `facts`-selected module (for the same `member`). |
| `member` | `string`, a role from the package's `policies.<family>.<role>.…` bindings (`memberRolesOf` 111) | Facts are read against `policies.<family>.<role>.current.changedFields` instead of the set's. |
| `requires` | `string[]` | Added to the state's `requires` when selected. |
| `appliesWhen` | prose | Inert. |
| `id` | `string` | Tolerated key. |

A changed field that no module covers holds the whole projection (`project.ts` 288–289). IAMAI supplies `policy.current.changedFields` (`CHANGED_FIELDS_BINDING` 95). It is always in the declared vocabulary.

**The guide's `compose` form** (`mode: 'compose'`, `modules: [{ id, … }]`, `sharedBefore` / `sharedAfter` as flat block lists) is rewritten by `normalizeProjection` (221–248) into `composeByMismatch`. Each list is grouped by the channel of the blocks it names. The emitted registry never contains `modules`.

**Decision-driven variants** (`selector` naming a `decision.*` binding, plus `variants.<name>.{requires, <channel>…}`) appear in `s-goal-sign-in-risk` (`missing`, `readyToEnforce`). No code reads `selector` or `variants`. They are unsupported keys, so the validator refuses them and `withholdInvalid` removes those states from the compiled package.

---

## 6. Implementation channels

Viewer tab order is `OUTPUT_ORDER` = Entra, PowerShell, JSON, AI Info, Email (`project.ts` 30; README §6). Every channel's artifact is a `ChannelArtifact` (`project.ts` 38–54):

| Field | Type | Meaning |
|---|---|---|
| `channel` | `OutputChannel` | One of the five. |
| `blocks` | `string[]` | Block ids drawn, each once. |
| `format` | `string` | The first block's format. |
| `text` | `string` | The bound text: what the preview shows and Copy copies. |
| `requests` | `{ method; endpoint }[]` | JSON channel only. |
| `mode`, `corrections`, `runs` | `string \| null`, `string[]`, `ScriptRun[]` | PowerShell only. |
| `communication` | `{ audience; trigger; purpose } \| null` | Email only. |

A channel that cannot bind, or whose output does not hold together, is withheld on its own and listed in `Projection.degraded`. If every value-bearing channel is withheld, all channels are (`project.ts` 434–452).

### 6.1 Entra portal (`entra`)

| Aspect | Value |
|---|---|
| Block `format` / `kind` | `markdown` / `template` (library survey: 342 blocks) |
| Compile-time checks | the generic block checks only (channel, declared bindings) |
| Runtime | `bindText`: text bindings, optional-line drop, the `[omit this line when unavailable]` marker removed; any leftover `{{…}}` withholds the channel (`UNRESOLVED` 111, check at 339) |

### 6.2 PowerShell (`powershell`)

| Aspect | Value |
|---|---|
| Block `format` / `kind` | `powershell` / `deployableAfterBinding` (also `template`, `referenceOnly`) |
| Projection | Every ref to a `deployableAfterBinding` block must carry `mode` (602). `corrections` need `invocation.correctionsParameter` (603). A mode listed in `withheldModes` is refused with its reason (605). |
| Runtime | `renderInvocation` (`invocation.ts` 115) emits `function <name> { <script> }` plus one call per run. A switch is passed only for a satisfied prerequisite. A missing binding refuses the whole artifact. |

`InvocationSpec` (`invocation.ts` 32–45):

| Field | Type | Required | What the validator does |
|---|---|---|---|
| `function` | `string` | no (default `Invoke-IAMAIStep`) | not checked |
| `modeParameter` | `string` | yes | must be a `param()` name (85) |
| `correctionsParameter` | `string` | no | must be a `param()` name (86) |
| `parameters` | `Record<paramName, InvocationParameter>` | yes (type) | each key must be a `param()` name (88); each needs non-empty `modes` (89) |
| `withheldModes` | `Record<mode, reason>` | no | each reason a non-empty string (97) |

`InvocationParameter` (22–30): `binding?: string` (must be declared unless `switch`, 92); `switch?: true` with `prerequisite?: string` (must be a declared prerequisite, 91); `modes: string[]` (required). Every mandatory `param()` except `modeParameter` must have an entry (95). `scriptParameters` (52) finds `param()` names and treats `[Parameter(… Mandatory …)]` as mandatory.

### 6.3 JSON (`json`)

| Aspect | Value |
|---|---|
| Block `format` | `json` or `json-template`; plus `method` and `endpoint` in block meta |
| Compile-time checks | JSON parse / masked parse (526–537), endpoint bindings declared (518–522) |
| Runtime | A JSON-channel block that is not a JSON body, or has no method/endpoint, or is a `PATCH`/`PUT`/`DELETE` with no `{id}` in its endpoint, is withheld (`project.ts` 363–378). Blocks that go to the same method and endpoint merge into one body. Two blocks setting one top-level field differently, or bodies for different requests, withhold the channel (413–430). |

### 6.4 AI Info (`aiInfo`)

| Aspect | Value |
|---|---|
| Block `format` / `kind` | `markdown` / `template` (library survey: 230 blocks) |
| Compile-time / runtime | same as Entra. The viewer adds the AI warning on this tab (README §6). No AI-specific field exists. |

### 6.5 Email (`email`)

| Aspect | Value |
|---|---|
| Block `format` | `markdown` |
| Required metadata | `audience` and `communicationTrigger`, on the block or in `META.email` for that block. Otherwise: `projection.<state>.<path>: an Email declares its audience and communicationTrigger (guide §26.6)` (607–611), and that channel of that state is withheld. |
| Normalisation | `trigger` → `communicationTrigger`. Values from `META.email` for the blocks it names. A block with exactly one state and no trigger gets one from `TRIGGER_BY_STATE` (264): `missing` → `before-report-only`, `partial` → `before-correction`, `reportOnly` → `during-report-only`, `readyToEnforce` → `before-enforcement`, `inPlace` → `after-enforcement`, otherwise `during-<kebab-state>`. `audience` is never inferred. |
| Runtime | `communication = { audience, trigger, purpose }` (`project.ts` 397–404). |

---

## 7. Readiness items (`supportBlocks.readiness`)

There is no named TypeScript type for the authored model; `project.ts` reads it through `Record<string, unknown>` casts. The shape below is what `readinessModelIssues` (`protocol.ts` 659) validates and `packageReadiness` (`project.ts` 628) reads.

| Path | Type | Required | What it does |
|---|---|---|---|
| (block) | `format: json \| json-template`, `channel: readiness`, listed in `supportBlocks.readiness` | yes | A `json-template` is bound with no required set; if it fails to bind, there is no readiness (`project.ts` 574–577). |
| `tiles` | array | yes (662) | Missing → the whole support entry is withheld. |
| `tiles[].id` | `string` | yes (668) | Tile id. |
| `tiles[].label` or `tiles[].gate` | `string` | one of them (669) | Tile heading (`label ?? gate`). |
| `tiles[].gateKey` | `string` | no (670) | The runtime tile that states the same fact and answers instead (`stepPackage.ts mergeReadiness`). |
| `tiles[].confirms` | `string[]` of prerequisite ids | no (671–673) | Prerequisites a person can confirm from this tile. Only those gating the current state are offered (`project.ts` 637). |
| `tiles[].rules` | non-empty array (675) | yes | The first rule whose `if` holds is the tile. A tile with no holding rule is hidden. |
| `tiles[].rules[].if` | `Condition` | yes (680–681) | Machine condition (§7.1). |
| `tiles[].rules[].result` | `'Ready' \| 'Review required' \| 'Unknown' \| 'Blocked' \| 'Not applicable'` (`READINESS_RESULTS` 98) | yes (678) | Tile result. |
| `tiles[].rules[].line` | `string` | yes (679) | Tile line. |
| `conclusions` | `Record<key, string>` | no | Conclusion texts. |
| `conclusionByState` | `Record<PackageState, key>` | no | Each key must be a runtime state (691) whose value names a string in `conclusions` (692). |
| `whyIamAISaysThis.sections.whyItMatters` | `string` | no | Rendered under the readiness evidence as "why it matters" (`project.ts` 653; `ContentStep.tsx` 656–659). |
| `whyIamAISaysThis.sections.unknownCannotProve` | `string[]` | no | `PackageReadiness.unknowns`. |
| `whyIamAISaysThis.sections.microsoftReferences` | `string[]` of `verifiedSources[].id` | no | `PackageReadiness.references` (user-facing sources only). |

Normalisation (`normalizeReadiness` 315–356):

- `whyIamaiSaysThis` or `whyIAMAI` becomes `whyIamAISaysThis.sections`. Only `whyItMatters` and `unknown` / `unknownRule` are carried; other sub-keys authored in that object (e.g. `microsoftReferences`, `readyWhen`) are not.
- Top-level `nextSafeAction`, `safeNow` and `safeToEnforce` become `conclusions`, with `conclusionByState` set for the block's runtime states (`nextSafeAction` all; `safeNow` → `missing`, `partial`, `reportOnly`; `safeToEnforce` → `readyToEnforce`).
- A tile with no `rules` whose string `result` equals or starts with a `READINESS_RESULTS` word becomes one rule `{ if: { state: <block's runtime states> }, result, line }`.

Library survey: 132 tiles; 4 author `rules`, 111 author a string `result`. Authored keys `evidenceSource`, `results`, `why`, `readyWhen`, `blockedWhen`, `unknownWhen`, `notApplicableWhen`, `resultSource`, `requiredInput`, `optionalInput` and `sourceType` are not read.

Projected output type `PackageReadinessTile = { id; gate; result; line; gateKey: string | null; confirm: { prerequisites: string[]; satisfied: boolean } | null }` and `PackageReadiness = { tiles; conclusion; whyItMatters; unknowns; references }` (`project.ts` 602–620).

### 7.1 Machine conditions (`conditions.ts`)

`Condition` (18–28). Exactly one operator per object.

| Operator | Shape | Holds when | Validation message (at 77–101) |
|---|---|---|---|
| `state` | `string[]` | the current state is listed | `…state: every entry must be a projected state` (entries must be `PACKAGE_STATES`) |
| `present` / `absent` | `binding` | the binding is (not) present: not null or undefined, not blank, not `[]` | `…present: "<b>" is not a declared binding` |
| `equals` | `[binding, value]` | present and JSON-equal | `…equals: [binding, value]` or undeclared binding |
| `in` | `[binding, value[]]` | present and JSON-equal to one | `…in: [binding, [values]]` or undeclared binding |
| `confirmed` | `prerequisiteId` | satisfied now | `…confirmed: "<id>" is not a declared prerequisite` |
| `baselineCommit` | 40-hex commit | equals the build's pin | `…baselineCommit: a full 40-character commit` |
| `all` / `any` | non-empty `Condition[]` | every / some | `…all: a non-empty list` |
| `not` | `Condition` | negation | recursive |
| (shape) | — | — | `<at>: a condition is an object with one operator`; `<at>: unknown condition [keys] (operators: …)` |

---

## 8. Verified sources

`VerifiedSource` (`protocol.ts` 32–42):

| Field | Type | Req. (type) | What reads it |
|---|---|---|---|
| `id` | `string` | yes | `sourceById` (`project.ts` 541), used by scenario `sources[]` and readiness `sections.microsoftReferences`. |
| `authority` | `string` | no | not read |
| `title` | `string` | yes | Carried into `TroubleshootingScenario.sources` / `PackageReadiness.references` for rendering. |
| `url` | `string` | yes | Same. |
| `purpose` | `string` | no | not read |
| `checkedOn` | `string` (`YYYY-MM-DD`) | yes | `sourceUpdatedOn`: the latest date over every entry that matches `^\d{4}-\d{2}-\d{2}$`, user-facing or not (A4, decision 10), or null. Shown as `Source checked <date>` (`stepPackage.ts packageSourceLine`). |
| `userFacing` | `boolean` | no | Only `=== true` entries are ever shown as references (539); every entry dates the `Source checked` line. |
| `priority` | `string` | no | not read |
| `audience` | `string[]` | no | not read |

No rule validates this structure. The only check is the warning `verifiedSources: none is userFacing, so no source date and no reference is shown` (729). Library survey (A4, 2026-09-12): 13 of 46 packages author `verifiedSources`, every entry with a `checkedOn` (11 of the 44 registered; 5 registered packages have a `userFacing: true` entry), so the line renders on all 13. Other packages put sources under `microsoftSources` or `sources`, which nothing reads.

---

## 9. Why, Learn and Troubleshooting links, Done when, input and decision blocks

**Why, Done when, the Microsoft Learn link and the Decision block are not package fields.** They come from the step's content entry (`docs/design/content.json steps[]`: 59 entries; keys include `why`, `learn`, `doneWhen`, `decision`, `whatToDo`).

### 9.1 Where each opened-step element comes from

| Element | Source | Field / type | Reader |
|---|---|---|---|
| Why | `content.json` | `steps[].why: string` (44 of 59) | `stepContract.ts` 743 (`fillText(cs.why, ex)`, else `step.why`) |
| Package "why it matters" (readiness evidence) | package | readiness `whyIamAISaysThis.sections.whyItMatters` (§7) | `project.ts` 653 → `ContentStep.tsx` 656–659 |
| STEP.md "## Why this exists" | package | Markdown heading | not compiled |
| Done when | `content.json` | `steps[].doneWhen: string[]` (59 of 59), with `{policyDoneWhen}` / `{changeDoneWhen}` tokens | `doneWhen.ts doneWhenTemplates` via `stepContract.ts doneWhenOf` 673/681 → `ContentStep.tsx` 579 |
| STEP.md "## Verification" | package | Markdown heading | not compiled |
| Microsoft Learn link | `content.json` | `steps[].learn: { url: string }` (59 of 59) | `ContentStep.tsx` 276, 449; support line 861–875 (label `W.learn` = "Microsoft Learn") |
| Troubleshooting link | package | `supportBlocks.troubleshooting` scenarios for the state (§9.3) | `troubleshootingSafely` (`ContentStep.tsx` 327); link on the support line |
| Source checked line | package | `verifiedSources[].checkedOn` (§8) | `packageSourceLine` → `ContentStep.tsx` 445 |
| Decision (owner choice UI) | `content.json` | `steps[].decision` (43 of 59; keys e.g. `label`, `help`, `pickerRow`, `save`, `multi`, `applies`) | `ContentStep.tsx` 355 (`decides`), 545, `Decision` 977 |

### 9.2 Inputs and decisions inside a package

| Concept | How a package expresses it | Compiled / read |
|---|---|---|
| Input values | `requiredBindings` / `optionalBindings`, then `{{binding}}` / `{{json:binding}}` in bodies, `{binding}` in endpoints, `invocation.parameters.*.binding` | Yes. Values are supplied only by `stepPackage.ts packageBindings` (320), which binds values IAMAI already holds. |
| Engine-supplied inputs | `policy.current.changedFields`, `policies.<family>.<role>.current.changedFields`, the selected-module binding | Supplied by IAMAI, never declared by a package (`CHANGED_FIELDS_BINDING` 95). |
| Owner confirmations | `prerequisites[]` plus readiness `tiles[].confirms` | Yes (§10). Persisted in `PlanDecisions.confirmations` (README §2). |
| Decision-routed content | `projection.<state>.selector` + `variants` | **Unsupported**. Refused as unsupported keys and withheld. |
| Decision bindings | `decision.*` names in the binding lists (e.g. `decision.signInRisk.firstEnforcementMode` in the `LIBRARY.json` inventory) | Declared like any binding. No code under `src/ui/` names a `decision.` binding, so `packageBindings` appears not to supply them (a grep, not a full trace), and any line or state that requires one stays unbound. |
| STEP.md "## Owner decisions", "## Current-state inputs" | Markdown headings (37 and 36 of 46) | not compiled |

There is no `input` or `decision` block channel. `BLOCK_CHANNELS` has none.

### 9.3 Troubleshooting scenarios (`supportBlocks.troubleshooting`)

Validated by `troubleshootingModelIssues` (698); read by `troubleshootingFor` (`project.ts` 582). Output type `TroubleshootingScenario` (`project.ts` 556–566).

| Path | Type | Required | What it does |
|---|---|---|---|
| `scenarios` | array | yes (701) | missing → support entry withheld |
| `scenarios[].id` | `string` | yes (707) | |
| `scenarios[].title` | `string` | yes (708) | normalised from `symptom` when absent (308–312; `symptom` is then deleted) |
| `scenarios[].states` | non-empty `string[]` of runtime states | yes (709, 712) | Only scenarios listing the current state are shown. Normalised from the block's `states` when absent, aliases expanded. A non-runtime state is dropped from the list alone (`entryState` locus). |
| `scenarios[].symptom` | `string` | no | `symptom` (empty when normalised into title) |
| `likelyCauses`, `check`, `fix`, `doNot`, `then` | `string[]` | no; if present must be lists (714–716) | A single string is normalised to a one-item list (291–296). |
| `sources` | `string[]` of verified-source ids | no; list | Normalised from `sourceIds`. Only user-facing sources resolve. |
| `classification`, `channels` | authored | no | not read |

---

## 10. Prerequisites

`Prerequisite = { id: string; class: string; binding?: string; requiredBefore?: string; evidence?: Condition; invalidatedBy?: string[] }` (`protocol.ts` 50).

| Field | Type | Required | What it does |
|---|---|---|---|
| `id` | `string` | yes (545), unique (546) | Vocabulary for `confirmed`, `tiles[].confirms`, `invocation` switches. |
| `class` | `string` | yes (545) | Not otherwise read. Library survey values: `human-validation`, `IAMAI-confirmed`, `IAMAI-confirmed-for-existing-object-states`. |
| `binding` | `string` | no | Not validated. Not found read in non-test code. |
| `requiredBefore` | `"<state>-><state>"`, both `PACKAGE_STATES` | no (548–551) | Gates that source state's artifacts until satisfied (`project.ts` 279–280). |
| `evidence` | `Condition` | no (552) | A tenant fact that satisfies it without a confirmation (`prerequisiteStatus` 529). |
| `invalidatedBy` | `string[]` of declared bindings | no (553) | A confirmation's basis is an FNV-1a hash of these values; it stops counting when they change (`prerequisiteBasis` 510). |

If a prerequisite is withheld, the state its `requiredBefore` gates is withheld too, or every state when `requiredBefore` is present but unreadable (`withholdOnce` 799–806).

---

## 11. Where types and emitted output disagree

| # | Type says | Compiler / registry actually does |
|---|---|---|
| 1 | `PackageMeta` has no named `relationship` | `RUNTIME_META_KEYS` emits it, and `provenanceOf` reads it (index signature only). |
| 2 | `baselineAuthority` types only `pinCommit` and `members` | `reviewedMembers` and `reviewedIdentities` drive `driftOf` through casts. The whole authored object (dozens of untyped keys) is emitted. |
| 3 | `email` types `block`, `audience`, `communicationTrigger`, `purpose` | `blocks[]` is read (cast). `applicableStates` and `recommendation` are emitted but unread. |
| 4 | `BlockMeta` names `id`, `channel`, `states`, `format`, `kind`, `invocation` | `method`, `endpoint`, `audience`, `communicationTrigger`, `purpose` and `repeatForBinding` are read from the index signature. |
| 5 | `stepId: string` and `projection` are required | Neither is validated. `withholdInvalid` falls back to `'package'`, and `packageIssues` to `{}`. |
| 6 | `VerifiedSource.checkedOn: string`, `title`, `url` required | Nothing validates them. A non-date `checkedOn` is silently skipped by `sourceUpdatedOn`. |
| 7 | `Prerequisite.binding` typed | Not validated, not read. |
| 8 | Readiness and troubleshooting models have no TS type | Validated structurally in `protocol.ts` and read through casts in `project.ts`. Authored keys outside §7/§9.3 are emitted in block text but unread. |
| 9 | `Block.text` is "the block body" | In the registry: (a) block `meta.states` gains alias runtime states; (b) email `trigger` becomes `communicationTrigger` and META.email values are copied in; (c) readiness and troubleshooting JSON is re-serialised by `editModel` (`JSON.stringify(…, 2)`) with normalised and withheld entries, so the emitted text is not the authored text. |
| 10 | A projection may use `mode: 'compose'` + `modules` (guide) | The registry only ever has `composeByMismatch` + `mismatches`. |
| 11 | `conditions.ts` message says "every entry must be a projected state" | The vocabulary is `PACKAGE_STATES` (`protocol.ts` 505), not the package's projected states. |
| 12 | `META.outputs` declares channels per package | Not read. `LIBRARY.json packages[].outputs` is regenerated from block channels, and one authored `outputs.json` is a string, not a boolean. |

---

## 12. Validation rules (`compile-implementation-content.mjs --validate-library`)

### 12.1 What the mode does (`scripts/compile-implementation-content.mjs` 76–176)

| Step | Line | Behaviour |
|---|---|---|
| Root | 77 | `args[1]` if it does not start with `--`, else `docs/implementation-content`, resolved against the working directory. |
| Pin | 78 | Reads `baselines/jhope188-conditionalaccesspolicies.pinned.json` `.commit`. A read or parse failure is `ERROR: <file>: <message>` and exit 1 (`readJson` 24). |
| Discovery | 80–88 | A folder is a package if it holds `META.json`, **or** any `META*.json` (83–84). Recursion depth ≤ 3. |
| Per package | 125–135 | Missing `META.json`, META parse, CONTENT parse (§12.2); then `normalizePackage`, `validatePackage` (§12.3), `packageWarnings` (§12.4). |
| Summary | 136–145 | `implementation library: <n> packages · <p> pass production validation · <f> fail`, then per feature family: packages · errors · feature [class] (§12.6). |
| Normalisation report | 146–148 | Counts of each rewrite `normalizePackage` noted. |
| Pin report | 149–151 | Packages whose `baselineAuthority.pinCommit` differs from the build pin. |
| Re-pin review | 153–163 | `driftOf` per package that reaches a content step: `current` / `reviewNeeded` / `held`, identity fallbacks, renames, target matches. |
| Passing list | 164 | `passing: <ids>` |
| State reconciliation | 167–172 | `stateCompatibility`: counts of holds / aliases / process stages / undefined / unsafe, each problem, and states authored only under an alias. |
| `--json <out>` | 173–174 | Writes `{ pinned, results[{package, errors, warnings, pin, normalized}], byFeature }`. |
| Exit | 175 | **Always `process.exit(0)`**, whatever fails. Only the pin-file read can exit 1. |

It does **not**: withhold parts (`withholdInvalid`), filter by content step (the `cleanup-*` packages are validated too), check duplicate content steps (`library.ts` 65), parse PowerShell AST, or bind JSON with `--bindings`. The last two are `--lint` only (compiler 187–221).

### 12.2 Package discovery and parse rules

| Rule | Where | Failure message (in `errors[]`) |
|---|---|---|
| Folder with a `META*.json` but no `META.json` | compiler 128 | `no META.json (a timestamped META file needs its canonical name)` |
| `META.json` parses as JSON | compiler 130 | `META.json does not parse: <message>` |
| Content file (`meta.contentFile \|\| 'CONTENT.md'`) exists and parses | compiler 131 → `protocol.ts parseBlocks` 142–170 | `CONTENT.md: <message>`, where `<message>` is one of: `nested block at line <n>`, `invalid block metadata JSON at line <n>: …`, `block at line <n> has no string id`, `duplicate block id: <id>`, `orphan @@IAMAI-END at line <n>`, `unterminated block: <id>`. A missing file surfaces as the fs error message. The prefix is `CONTENT.md:` even when `contentFile` names another file. |

### 12.3 Strict validation (`protocol.ts packageIssues` 496–657)

Declared-binding vocabulary = `requiredBindings` ∪ `optionalBindings` ∪ `policy.current.changedFields` (502). Prerequisite vocabulary = `prerequisites[].id` (504). State vocabulary = `PACKAGE_STATES` (505).

**Blocks** (507–538), locus `block`:

| # | Rule | Line | Message |
|---|---|---|---|
| B1 | `channel` ∈ `BLOCK_CHANNELS` | 510 | `<id>: unsupported channel <c> (not a channel the runtime renders)` |
| B2 | Every `{{binding}}` / `{{json:binding}}` in the body is declared | 511 | `<id>: undeclared binding <b>` |
| B3 | Every `{binding}` in `endpoint` is declared; with `repeatForBinding` | 518–522 | `<id>: a request repeated for each value of <r> (repeatForBinding, per-value <v>) is not a request shape the runtime projects` |
| B4 | Every `{binding}` in `endpoint` is declared; without `repeatForBinding` | 521 | `<id>: endpoint names undeclared binding <b>` |
| B5 | `format: json` parses | 524–530 | `<id>: invalid JSON: <message>` |
| B6 | `format: json-template` parses with `{{json:…}}` masked to `null` | 531–537 | `<id>: template is not JSON-shaped after masking: <message>` |
| B7 | `powershell` + `deployableAfterBinding` declares a sound invocation | 615–618 → `invocation.ts invocationErrors` 79–99 | `<id>.invocation: a deployable PowerShell block declares its invocation` (80); `….modeParameter: not a parameter of the script` (85); `….correctionsParameter: not a parameter of the script` (86); `….parameters.<n>: not a parameter of the script` (88); `….parameters.<n>: modes` (89); `….parameters.<n>: a switch attests a declared prerequisite` (91); `….parameters.<n>: binding "<b>" is not declared` (92); `<id>.invocation: mandatory parameter <p> has no invocation` (95); `….withheldModes: each withheld mode names its reason` (97) |

**Prerequisites** (540–554), locus `prerequisite`:

| # | Rule | Line | Message |
|---|---|---|---|
| P1 | Has string `id` and `class` (other checks skipped if not) | 545 | `prerequisites[<i>]: an id and a class` |
| P2 | `id` unique | 546 | `prerequisites[<i>]: duplicate id <id>` |
| P3 | `requiredBefore` is `<state>-><state>` over `PACKAGE_STATES` | 548–551 | `prerequisites[<i>].requiredBefore: <state>-><state>` |
| P4 | `evidence` is a sound condition | 552 | `conditionErrors` messages at `prerequisites[<i>].evidence` (§7.1) |
| P5 | `invalidatedBy[]` entries declared | 553 | `prerequisites[<i>].invalidatedBy: undeclared binding <b>` |

**State projections** (556–613):

| # | Rule | Line | Locus | Message |
|---|---|---|---|---|
| S1 | Projection value is an object (other checks skipped if not) | 559–562 | state | `projection.<s>: an object` |
| S2 | Every key ∈ `PROJECTION_KEYS` | 563 | key | `projection.<s>: unsupported key <k>` |
| S3 | `mode` absent or `composeByMismatch` (after normalisation) | 564 | state | `projection.<s>: mode "<m>" is not a composition the runtime implements (authoring guide v2.5 defines composeByMismatch and compose)` |
| S4 | `requires[]` declared | 565 | state | `projection.<s>.requires: undeclared binding <b>` |
| S5 | `partial` has a mode | 566 | state | `projection.partial: a correction is composed from the engine's changed fields (composeByMismatch, or compose with modules), so only the corrections that apply are shown` |
| S6 | A composed projection names its mismatch binding | 568–569 | state | `projection.<s>: a composed projection names the binding its selected modules are bound to (mismatchBinding, or one requires entry ending .semanticMismatches)` |
| S7 | That binding is declared | 570 | state | `projection.<s>.mismatchBinding: undeclared binding <b>` |
| S8 | `mismatches` is a non-empty object | 571–572 | state | `projection.<s>: a composed projection has at least one mismatch module` |
| M1 | Module is an object (other checks skipped if not) | 576–579 | module | `projection.<s>.mismatches.<id>: an object` |
| M2 | Module keys ∈ `MISMATCH_KEYS` | 580 | module | `projection.<s>.mismatches.<id>: unsupported key <k>` |
| M3 | `facts[]` are strings under `conditions` / `grantControls` / `sessionControls` | 581–584 | module | `projection.<s>.mismatches.<id>.facts: policy field paths under conditions, grantControls, sessionControls` |
| M4 | `select` is a sound condition | 585 | module | `conditionErrors` messages at `….select` |
| M5 | `alongside` is boolean | 586 | module | `projection.<s>.mismatches.<id>.alongside: true or false` |
| M6 | `member` is a role from `policies.<family>.<role>.…` bindings | 587 | module | `projection.<s>.mismatches.<id>.member: a role the package's policies.<family>.<role> bindings name` |
| M7 | Module has `facts` or `select` | 588 | module | `projection.<s>.mismatches.<id>: IAMAI cannot select this module (it declares no facts and no select condition)` |
| M8 | Module `requires[]` declared | 589 | module | `projection.<s>.mismatches.<id>.requires: undeclared binding <b>` |
| R1 | Every referenced block exists (top level, `sharedBefore`, `sharedAfter`, each module) | 594–597 | channel | `projection.<s><path>: missing block <id>` |
| R2 | Block is in the channel it is listed under | 599 | channel | `projection.<s><path>: <id> is a <c> block` |
| R3 | Block declares the state | 600 | channel | `projection.<s><path>: <id> does not declare state <s>` |
| R4 | A deployable script ref has `mode` | 602 | channel | `projection.<s><path>: a deployable script is projected in a mode` |
| R5 | `corrections` need `invocation.correctionsParameter` | 603 | channel | `projection.<s><path>: corrections need the invocation's correctionsParameter` |
| R6 | `mode` is not in `invocation.withheldModes` | 604–605 | channel | `projection.<s><path>: mode <m> is withheld by its invocation: <reason>` |
| R7 | Email ref has audience + trigger (block, or `META.email` for that block) | 607–611 | channel | `projection.<s><path>: an Email declares its audience and communicationTrigger (guide §26.6)` |

**Support models** (620–655), locus `support` (whole) or `entry` / `entryState` / `conclusion`:

| # | Rule | Line | Message |
|---|---|---|---|
| U1 | `supportBlocks.<c>` is an array | 622–624 | `supportBlocks.<c>: a list of block ids` |
| U2 | Each id exists | 629–631 | `supportBlocks.<c>: missing block <id>` |
| U3 | Block is in channel `<c>` | 633–635 | `supportBlocks.<c>: <id> is a <c2> block` |
| U4 | Format is `json` / `json-template` | 637–639 | `<id>: a support model is JSON the runtime reads, not <format \| prose>` |
| U5 | Parses (template masked) | 641–646 | `<id>: does not parse as JSON: <message>` |
| U6 | Is a JSON object | 648–650 | `<id>: a support model is a JSON object` |
| RD1 | readiness `tiles` is a list | 662 | `<id>.tiles: a list` |
| RD2 | tile has `id` | 668 | `<id>.tiles[<i>]: an id` |
| RD3 | tile has `label` or `gate` | 669 | `<id>.tiles[<i>]: a label or gate` |
| RD4 | `gateKey` is a string | 670 | `<id>.tiles[<i>].gateKey: a runtime tile key` |
| RD5 | each `confirms` entry is a declared prerequisite | 671–673 | `<id>.tiles[<i>].confirms: "<c>" is not a declared prerequisite` |
| RD6 | `rules` is a non-empty list | 675 | `<id>.tiles[<i>].rules: at least one rule` |
| RD7 | rule `result` ∈ `READINESS_RESULTS` | 678 | `<id>.tiles[<i>].rules[<j>].result: one of Ready, Review required, Unknown, Blocked, Not applicable` |
| RD8 | rule `line` is a string | 679 | `<id>.tiles[<i>].rules[<j>].line: the authored line` |
| RD9 | rule has `if` | 680 | `<id>.tiles[<i>].rules[<j>]: no machine condition (if), so the runtime can never select it` |
| RD10 | `if` is a sound condition | 681 | `conditionErrors` messages at `….rules[<j>].if` |
| RD11 | `conclusionByState` is an object | 687 | `<id>.conclusionByState: an object` |
| RD12 | its keys are runtime states | 691 | `<id>.conclusionByState.<s>: not a runtime state` |
| RD13 | its values name a string conclusion | 692 | `<id>.conclusionByState.<s>: "<k>" is not a conclusion` |
| T1 | troubleshooting `scenarios` is a list | 701 | `<id>.scenarios: a list` |
| T2 | scenario has `id` | 707 | `<id>.scenarios[<i>]: an id` |
| T3 | scenario has `title` | 708 | `<id>.scenarios[<i>]: a title` |
| T4 | `states` is a non-empty list | 709 | `<id>.scenarios[<i>].states: the states it applies to (guide §30.5)` |
| T5 | each state is a runtime state | 711–713 | `<id>.scenarios[<i>].states: "<s>" is not a runtime state` |
| T6 | `likelyCauses`, `check`, `fix`, `doNot`, `then`, `sources` are lists when present | 714–716 | `<id>.scenarios[<i>].<key>: a list` |

**Condition grammar** (applies inside P4, M4, RD10): `conditions.ts conditionErrors` 76–104, messages in §7.1.

### 12.4 Warnings (`protocol.ts packageWarnings` 722–731)

These go into `results[].warnings` in the `--json` file only; the console summary does not print them.

| Rule | Line | Message |
|---|---|---|
| A projected state is not a runtime state | 725 | `projection.<s>: IAMAI's runtime never enters this state, so it is never shown` |
| A runtime state has no projection | 727 | `projection.<s>: no projection, so the step shows no implementation in that state` |
| No `userFacing: true` verified source | 729 | `verifiedSources: none is userFacing, so no source date and no reference is shown` |

### 12.5 Reported findings that never fail

| Finding | Code | Output |
|---|---|---|
| Authored against another pin | compiler 150–151 | `<n> authored against a baseline pin other than <pin8>; …` |
| Re-pin drift | `drift.ts driftOf` 111 (via compiler 154–163) | `semantic re-pin review against <pin8>: <c> current · <r> review needed · <h> held`, plus per-package lines. `held` = a reviewed member was removed; `reviewNeeded` = one changed, or no `reviewedMembers` while the step maps to members. |
| Identity by display name | compiler 162 | `identity by display name, then by target (no stable id in the pin): …` |
| Authored-state reconciliation | `states.ts stateCompatibility` 132 (via compiler 167–172) | `undefined: <pkg>.<state>: <state> is neither a runtime state nor reconciled with one`; `unsafe: <pkg>.<state>: <action> deploys without <objects>, which <state> gates on`; `authored only under an alias, so the runtime shows nothing there: …` |

### 12.6 Feature classification of errors (compiler 92–123)

The first matching regex names the family. This is reporting only.

| Regex | Feature | Class |
|---|---|---|
| `/unsupported channel/` | channel the runtime does not render (manual) | intentional validator rule |
| `/mode .* is not a composition/` | projection mode not in the authoring guide (selectByBinding) | intentional/unsupported package model |
| `/mismatches\.name\.canonical: IAMAI cannot select/` | name.canonical correction module | owner decision (name.canonical) |
| `/cannot select this module/` | correction module with no machine facts or select condition | later scope: a correction IAMAI holds no facts for |
| `/names the binding its selected modules/` | composed projection without a mismatch binding | genuine remaining defect |
| `/is withheld by its invocation/` | script mode withheld: an attestation or value shape IAMAI cannot supply | authoring exception |
| `/invocation\|mandatory parameter/` | PowerShell invocation missing or out of step with the script | genuine remaining defect |
| `/a support model is JSON\|does not parse as JSON/` | support model that is prose or does not parse | intentional/unsupported package model |
| `/no machine condition\|\.rules\[\d+\]\.result\|\.rules: at least one\|\.tiles: a list\|\.tiles\[\d+\]: (an id\|a label)/` | readiness tile whose result is a tenant fact, a sentence or a prose rule | intentional/unsupported package model (the runtime owns tenant facts) |
| `/\.scenarios\[\d+\]\.states: ".*" is not a runtime state/` | troubleshooting scenario names a stage the runtime never enters (that stage alone is dropped) | intentional validator rule |
| `/\.scenarios/` | troubleshooting scenario without states, title or list fields | later authoring |
| `/Email declares/` | Email without audience or trigger | later authoring |
| `/repeatForBinding/` | request repeated once per list value (repeatForBinding) | intentional/unsupported package model |
| `/undeclared binding/` | undeclared binding | genuine remaining defect |
| `/unsupported key/` | unsupported projection key | intentional/unsupported package model |
| `/missing block\|is a \w+ block\|does not declare state/` | projection names a block that does not fit | genuine remaining defect |
| `/projected in a mode\|corrections need/` | script projected without a mode | genuine remaining defect |
| `/a correction is composed from the engine/` | Partial that is not composed from changed fields | later authoring |
| `/prerequisites/` | prerequisite shape | genuine remaining defect |
| `/META\.json does not parse\|CONTENT\.md\|no META\.json/` | package does not parse | genuine remaining defect |
| (none) | other | unclassified |
| override (117–122) | On a non-policy step (`stepClassOf(kind) !== 'policy'`), a `projection.partial…` error in the mismatch-binding or no-facts family is reclassified as "object correction the runtime never enters (no update is resolved for a non-policy object)" | later scope (B2): non-policy object corrections |

Rule order matters. `/invocation|mandatory parameter/` sits before `/undeclared binding/`, so an invocation's undeclared binding counts as an invocation defect. `/unsupported key/` sits after `/\.scenarios/`.

### 12.7 What the registry build enforces on top (for contrast)

| Rule | Where | Effect |
|---|---|---|
| Parts with issues are withheld, round by round, up to 32 rounds | `protocol.ts withholdInvalid` 875–885 | `PackageError("<stepId>: its invalid parts could not be withheld")` if it has not converged |
| Only packages that reach a content step are registered | `library.ts` 54, 60–62 | the others go to `notSteps` |
| One package per content step | `library.ts` 64–65 | `two packages for content step <id>: <a>, <b>` |
| Registry equals the library compiled | `library.test.ts` 48–49 | `registry.generated.json drifted from docs/implementation-content: run scripts/compile-implementation-content.mjs --registry` |
| `LIBRARY.json` derived facts equal the library | `library.test.ts` 59 | test failure |
