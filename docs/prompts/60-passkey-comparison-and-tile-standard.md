# Prompt 60 — Passkey comparison fix and the Tasks Remaining tile standard

Read `docs/EMERGENCY-ACCESS-HANDOFF.md` before you start. Its approved interaction
and writing rules govern everything below. Nothing here authorises a new readiness
tile design, a new Methodology section, added permissions, or any product area
outside Establish Emergency Access.

Work in parts, in order. Commit after each part. Run the focused gauntlet at the
end of every part, not only at the end of the prompt. Do not push while the tree
is red.

Part 1 is a correctness fix that currently blocks live acceptance of Step 4. It
lands and deploys before Parts 2–4 are worth reviewing.

---

## Part 1 — Approved-model comparison is order-sensitive (P0, blocks Step 4)

### The defect

`src/ui/surfaces/emergencyPasskeyTasks.ts:12`

```ts
const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
```

`keyRestrictions.aaGuids` is an unordered set. Microsoft Graph returns its members
in arbitrary order. `JSON.stringify` on an array is order-sensitive, so when the
tenant's allow list and IAMAI's intended list contain exactly the same AAGUIDs in
a different sequence, `sameValue` returns false, the row survives the filter at
line 61, and the UI renders a change where none exists.

Observed on the live GetIAMAI tenant. The Approved models row rendered:

```
Microsoft Authenticator — Android (de1e552d-db1d-4423-a619-566b625cdc84),
Microsoft Authenticator — iOS (90a3ccdf-635c-4729-a248-9b709135078f),
YubiKey 5 Series (19083c3d-8383-4b18-bc03-8f1c9ab2fd1b),
YubiKey 5 Series with NFC (a25342c0-3cdc-4414-8e46-f4807fca511c)
  →
YubiKey 5 Series (19083c3d-...), Microsoft Authenticator — iOS (90a3ccdf-...),
YubiKey 5 Series with NFC (a25342c0-...), Microsoft Authenticator — Android (de1e552d-...)
```

Identical sets. Different order. Presented as work remaining.

### Why it blocks Step 4

`automaticRecoveryPreparationStates` in `src/roadmap/cleanupDone.ts` gates the
shared preparation state on `passkey.state !== 'inPlace'`. If the models row can
never reconcile, Step 3 never reaches `inPlace`, no preparation baseline is ever
written by `reconcileAutomaticRecovery`, and no account can ever be verified in
Step 4 regardless of how the tenant is configured or how correctly the owner runs
the sign-in drill.

### The fix

Compare set-valued fields as sets, not as ordered arrays.

`recoveryAccountBasis` in `src/roadmap/cleanupDone.ts` already does this correctly
for `approvedModelIntent` (lowercases and sorts before comparison). Apply the same
discipline here rather than inventing a second convention.

Requirements:

- Introduce a comparison that, for array values, normalises entries to lowercase
  trimmed strings, removes duplicates, sorts, and then compares. Non-array values
  keep their current comparison behaviour.
- Apply it wherever a set-valued passkey field is compared for equality in
  `emergencyPasskeyTasks.ts`, including the `rows` filter (line ~61), the profile
  comparison at line ~108, and the `comparisonFields` path at line ~135.
- Audit the `Storage` row in the same pass. `passkeyTypes` is a comma-separated
  string in some reads and an array in others; it is also an unordered set and it
  must not report a change when the same types are present in a different order or
  a different serialisation.
- Do not change which fields are compared, the intended-value builder, or any
  display formatting in this part. Only equality.

### Tests

Add focused tests that fail before the change and pass after:

- Two identical AAGUID sets in different order produce no Approved models row.
- The same set with different letter casing produces no row.
- A genuinely different set (one AAGUID added, one removed) still produces a row,
  and the rendered value names the correct before and after entries.
- `passkeyTypes` equality is order-insensitive and serialisation-insensitive.
- Extra AAGUIDs present in the tenant but absent from `requiredModels()` do not by
  themselves produce a row, since the underlying check is a subset check.

### Naming gap, record only

`PASSKEY_DEFAULT_MODELS` has no entry for the Windows Hello AAGUIDs, so a tenant
that allow-lists them renders them as `Existing approved model (9ddd1817-…)`. Do
not add Windows Hello models to the default set in this prompt. Note the gap in
the handoff's remaining-work list and move on.

---

## Part 2 — The Tasks Remaining tile standard

Every Tasks Remaining tile across the four Establish Emergency Access steps is
currently laid out differently. Define one standard and apply it to all four. This
is presentation only: do not change what any check evaluates, what any step gates
on, or which findings are produced.

### The standard

Derive it from the Step 1 account tile, which is the best of the four today. It is
the reference implementation.

- One tile per subject. Step 1's subject is an account; Step 2's is the group;
  Step 3's is a settings area; Step 4's is a verification concern.
- A tile shows, in this order: subject label, subject identity, the single
  highest-priority remaining action with its short instruction, then a collapsed
  `Completed checks · N` disclosure.
- A subject with nothing remaining collapses under a `Satisfied · N` group, as
  Step 1 already does.
- Tile heading text appears once. It must not be rendered as both a collapsed
  summary and again as expanded body content.
- Long identifiers wrap at sensible boundaries. Apply `overflow-wrap: anywhere`
  or the equivalent to UPN and identifier cells so a value like
  `Breakglass@GoldenTestIAMAI.onmicrosoft.com` does not break mid-word across
  three lines in a narrow column.
- A tile does not repeat a list that is already rendered elsewhere on the same
  screen.
- No new tile types, no new warnings, no attestation or confirmation controls.

### Per-step defects the standard must resolve

**Step 2, `s-prereq-exclusion-group`.** The Exclusions Group tile renders its
heading and its body sentence twice, once as the collapsed summary and again as
expanded content. Render once.

**Step 3, `s-prereq-passkey-settings`.** The prerequisite row reads
`Prepare Emergency Access Accounts. Finish Prepare Emergency Access Accounts first.`
State the prerequisite once.

**Step 4, `cleanup-drill`.** Two defects. The per-account sign-in list appears in
the Sign-in Evidence tile and again inside the Verify emergency sign-in
implementation task on the same screen; render it once, in the tile. And the
Configuration tile grows tall enough to dominate the step with only two accounts
and four approved models, because it enumerates every configuration finding
inline. Show the highest-priority finding per subject with the remainder behind a
disclosure, consistent with the standard above.

---

## Part 3 — Implementation task restructure, Steps 1 and 3

### Step 1, `s-prereq-break-glass`

Two defects in the passkey setup task.

The task renders an AAGUID line above the instructions
(`Microsoft Authenticator — Android    AAGUID: de1e552d-…`). Remove it. The AAGUID
is already stated in Step 3 and in the approved-models disclosure; repeating it
here is noise.

The task names every selected emergency account regardless of which accounts
actually need the work. With Breakglass already holding an approved passkey and
Breakglass2 needing one, the task still instructs the reader to repeat the
procedure for both. Name only the subset of selected accounts whose relevant
check is currently failing. If every selected account passes, the task remains
available but states that no account currently needs it.

### Step 3, `s-prereq-passkey-settings`

The protections task currently prints the full intended configuration as a block,
then gives navigation steps, then says "Apply only the changed values above."
Invert it. Navigate the reader to the blade first, then have each value applied
inline at the point of action.

Target shape:

```
1. Keep your working administrator session open. Open
   Entra ID → Authentication methods → Policies → Passkey (FIDO2).
2. Open Default passkey profile.
3. Set Passkey types to Device-bound.
4. Select Target specific AAGUIDs and set Behavior to Allow.
5. Select + Add AAGUID → Microsoft Authenticator, then Save.
6. Select + Add AAGUID → Enter AAGUID, enter
   19083c3d-8383-4b18-bc03-8f1c9ab2fd1b (YubiKey 5 Series), then Save.
7. Select + Add AAGUID → Enter AAGUID, enter
   a25342c0-3cdc-4414-8e46-f4807fca511c (YubiKey 5 Series with NFC), then Save.
8. Return to IAMAI and select Scan to update the plan.
```

Rules for generating it:

- The portal's Add AAGUID control offers provider entries (Microsoft Authenticator,
  Windows Hello) alongside manual entry. Where every AAGUID of a provider that
  IAMAI requires is covered by that provider entry, instruct the provider
  selection rather than manual GUID entry. Otherwise instruct manual entry and
  give the GUID at the point of typing.
- Each Add AAGUID entry is its own save in the portal. Emit one numbered step per
  entry, each ending in Save.
- Emit only steps for values that differ from the observed current configuration.
  A satisfied value produces no step.
- An AAGUID appears at the point where it is typed, never as a header block.
- Do not instruct Windows Hello in this prompt. IAMAI has no Windows Hello entry
  in `PASSKEY_DEFAULT_MODELS`, and the portal warns that attestation is not
  supported with Windows Hello passkeys. Out of scope; recorded in Part 1.

Also clean the Step 3 Methodology block. It is approved and stays, but it
currently restates facts the tile above it already shows. Keep only what explains
why the settings matter and how the checks differ from each other. Do not add a
Methodology section anywhere else.

---

## Part 4 — Step 1 dedicated-account signal

`src/copy/validation.ts` carries a signal that fires when a selected emergency
account has populated personal profile fields or is the account currently signed
in to IAMAI. It renders only in Step 4's Configuration tile.

Surface it in Step 1, where the account selection is actually made. The handoff's
own rule is to keep a check in the step that owns the change; account suitability
is a selection-time concern.

Constraints:

- It is a note, not a blocker. It must not fail a check, gate the step, prevent a
  save, or change any readiness outcome.
- Wording stays as it is today. It describes signals and explicitly states they do
  not prove daily use.
- It continues to render in Step 4 as it does now. This adds a surface, it does not
  move one.
- No confirmation control, no attestation, no new tile.

---

## Verification

Run after every part:

```powershell
node --test --test-isolation=none `
  src/roadmap/cleanupDone.test.ts `
  src/roadmap/emergencyJourney.test.ts `
  src/ui/surfaces/emergencyPasskeyTasks.test.ts `
  src/ui/surfaces/emergencyNextSteps.test.ts `
  src/ui/surfaces/cleanupExports.test.ts `
  src/roadmap/cleanupPhase.test.ts `
  src/graph/collect/laneBCore.test.ts `
  src/ui/emergencyDiagnosticDev.test.ts
npx tsc --noEmit
npm run build:site
git diff --check
```

Every command must pass before the part is committed.

## Deploy

Push the reviewed commits to `main` without force. `deploy-pages.yml` checks out
that exact SHA, installs locked dependencies, builds and deploys Pages. Main
deploys independently of the full PR CI suite.

Pushing is not deployment confirmation. Verify the deployment run's head SHA
matches your commit, then fetch the served planner entry and confirm the built
asset returns HTTP 200. Local and Linux build hashes differ; check production
against the deployment's own build output, never against your local hash.

## Boundaries

- Read-only against Entra. Never change tenant policies, settings or credentials
  to make a check pass.
- Do not redesign readiness tiles beyond the standard defined in Part 2.
- Do not touch MFA Readiness, the Plan board, Export, or any step outside
  Establish Emergency Access.
- Do not add a Methodology section anywhere it does not already exist.
- Do not alter the automatic verification evidence lifecycle in
  `reconcileAutomaticRecovery`, beyond the equality fix in Part 1.
- If a part cannot be completed as written, stop and record why. Do not
  substitute a different change.

## Update the handoff

When all four parts are green and deployed, update
`docs/EMERGENCY-ACCESS-HANDOFF.md`:

- Record the order-sensitive comparison defect and its fix.
- Record the Windows Hello naming gap in `PASSKEY_DEFAULT_MODELS` as open work.
- Record that the Step 2 governance diagnostic is reachable only in a DEV build
  with `?dev=1`, so that remaining-work item runs against a local dev server
  signed in to the real tenant, not against production.
- Leave every "still unvalidated" boundary exactly as it is. Real Step 4 owner
  acceptance remains unperformed until the owner performs it.
