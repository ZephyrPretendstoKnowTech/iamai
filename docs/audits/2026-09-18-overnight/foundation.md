# Foundation audit: failing tests, dead code, Graph data (read-only)

Measured on main at 79b66fd8. HEAD moved to c9a538c7 during the audit (4057c574 and c9a538c7 are MFA Readiness copy/logic commits and touch none of the files below). No repository file was changed. The probes are in the session scratchpad, not in the repo.

## Why these failures piled up

These failures were never caught, and this is the underlying reason. **bb385cd0 (2026-09-16), "Deploy main independently of CI", took unit tests, smoke and the walk out of the path a push to main takes.**
- `ci.yml` now runs only on `pull_request` and `workflow_dispatch`.
- `deploy-pages.yml` only builds. That is why every recent run is "success" in about 21 seconds.
- The walk is in no workflow at all.
- The last `ci` run triggered by a push was c1cacf21, and it **failed**.

Everything below landed after that: the two overnight commits (cff043a2, 5028374a, ee613dcf) and prompts 60–62. CLAUDE.md still says "CI runs the walk on every push to main" and "Done means … CI green". Neither is true any more. That is an owner decision to revisit, not a code fix.

---

## A. Failing tests on main

Thirteen fail. I ran them with `node --test --test-isolation=none` in three batches of four files. Every test in the brief is included. "013.A", "D4", "detected candidate", "milestone head" and "passkey exclusion wins" all fail.

"TEST stale" means the product changed on purpose and the test was not updated. "CODE wrong" means the product regressed.

| # | Test (file:line) | Class | Commit | Surface |
|---|---|---|---|---|
| A1 | demo: every consumer resolves the same confirmed exclusions group (src/accountTruth.test.ts:171) | TEST stale, plus a CODE regression it hides | cff043a2 | Emergency Access Step 2 (exclusions group) |
| A2–A4 | methodReadiness.test.ts:44, :61, :75 | TEST fixture stale; CODE wrong according to Microsoft docs | 5028374a | Plan MFA readiness gates (methodPreparation) |
| A5 | passkey exclusion wins over All users (src/ui/surfaces/completionCorrections.test.ts:81) | TEST stale | 5028374a | Emergency Access Step 3 (passkey settings) |
| A6 | design 4: font-family/weight/size roles (src/ui/design-lint.test.ts:193) | CODE wrong | cff043a2, 5028374a | design CSS (EA Step 3 disclosure, task facts) |
| A7 | no surface is normalised onto another surface's breakpoint (src/ui/responsive.test.ts:94) | CODE wrong | cff043a2 | design CSS, shared step footer |
| A8 | implementation channels are one tab set over one panel (src/ui/accessibility.test.ts:407) | TEST stale | cff043a2 | Plan step UI |
| A9 | one milestone at the head of its action column (src/ui/surfaces/stepFamilies.test.ts:192) | TEST stale, plus a CODE rule breach | cff043a2 | Plan step UI / EA Step 2 rail |
| A10 | a detected candidate is not a persisted decision (stepFamilies.test.ts:432) | TEST stale | 5028374a (and 333aa3f4) | Plan step UI |
| A11 | 013.A: every artifact reads one step (src/ui/surfaces/artifactAlignment.test.ts:88) | CODE wrong | cff043a2 | EA Step 1 export (print, calendar, prompt) |
| A12 | D4: emergency findings stay in four topics (src/ui/surfaces/contentReview.test.ts:227) | TEST premise stale | c1cacf21 | EA Step 1 |
| A13 | the follow-up demo keeps a recorded drill at every UTC hour (src/ui/demo.test.ts:44) | TEST stale **and** CODE wrong (fixtures and 3 production callers) | 5028374a, ee613dcf | Demo; EA Step 4 / Cleanup validation |

### A1: demo exclusions group, `Core - Block - Device code flow is absent from the exclusions topic`
- **Evidence.** In cff043a2, `journeyGroupFindings` (src/roadmap/emergencyJourney.ts:352-373) changed shape. It now emits two items per policy, `label:'Mode'` and `label:'Group exclusion'`, and the policy name sits in `subjectLabel`. The test still matches `item.label === policy` and `value.includes('Group already excluded')`. demo-week2 passes only because it has no missing policy.
- **Fix, test.** Match `item.subjectLabel === policy && item.label === 'Group exclusion' && item.outcome !== 'pass'`.
- **Code regression under the same change.** src/ui/surfaces/emergencyImplementation.ts:187 still filters the old shape. The Step 2 **Entra** markdown's "Policies missing the group exclusion" list therefore prints `- Mode — On / - Group exclusion — Present / …` for every enabled policy, with no policy names (probe on demo and small). Export does not include it. It is the `portal` artifact text: the copy fallback at ContentStep.tsx:748, the Expand dialog and print.
  - Fix: `items.filter(i => i.label === 'Group exclusion' && i.outcome !== 'pass')` and bullet `${i.subjectLabel} — ${i.value}`.
  - This touches the Step 2 Entra text. That step was accepted live in prompt 60, so tell the owner, but this restores the intended content.

### A2–A4: methodReadiness (three tests: `readyIds` is `[]`, expected `['u-1']`)
- **Evidence.**
  - `methodAvailability.passkey` (src/roadmap/methodAvailability.ts:24-35) calls `emergencyPasskeyCompatibility`, which runs with `purpose='approval'`.
  - 5028374a added `if (purpose === 'approval' && typeof policy.isAttestationEnforced !== 'boolean') return unknown` at passkeyCompatibility.ts:85, plus key-level attestation matching.
  - The test fixture's Fido2 configuration has no `isAttestationEnforced`, so every key is `unknown`. The probe confirms this: with `isAttestationEnforced:false` the result is `eligible` and `readyIds` is `['u-1']`.
- **Classification.** The fixture is incomplete, because Graph always returns the field. But using *approval* purpose for "is this registered key usable now" is wrong according to Microsoft. Attestation is enforced only at registration, and keys registered earlier keep signing in (see C-A).
- **Minimal correct fix, engine.** Give `emergencyPasskeyCompatibility` a `purpose` argument. Have `methodAvailability.passkey` pass `'runtime'`. The three tests then pass unchanged.
  - If the owner prefers a test-only fix: add `isAttestationEnforced: false` to the `setup()` Fido2 row in methodReadiness.test.ts.
  - The engine fix changes Plan readiness-gate counts (more keys Ready instead of unknown). It does not change what Emergency Access approves. Flag it to the owner.

### A5: passkey exclusion wins over All users (`'unknown'` !== `'eligible'`)
- **Evidence.** The test sets `isAttestationEnforced:true`, and its key has no `attestationLevel`. Since 5028374a, `attestationMatch` returns null, so the result is unknown.
- **Fix, test.** Add `attestationLevel:'attested'` to the key at line 87. Graph returns `attestationLevel` on fido2AuthenticationMethod, and collectors.ts:352 reads it.
- Emergency Access *approval* legitimately needs attestation evidence. No code change.

### A6: design 4
- **Evidence.** src/ui/app.css has three literals:
  - :5182 `.passkey-model-disclosure > summary { font-weight: 600 }` (cff043a2)
  - :5184 `::before { font-size: 1.1em }`
  - :5195 `.emergency-task-facts dt { font-weight: 700 }` (5028374a)
- **Fix, CSS.** Use `font-weight: var(--weight-strong)` twice. Replace `1.1em` with a `--t-*` role, or drop it.
- No visible change beyond the rounding of the chevron.

### A7: 620px breakpoint (`src/ui/app.css still turns at the retired readiness pack's 620px`)
- **Evidence.** cff043a2 added `@media (max-width: 620px) { .step-footer-end { width:100% } .passkey-model-disclosure { width:100% } }` at app.css:5188.
- It also changes **every** step's footer (`.step-footer-end`), not only Emergency Access.
- :5197 adds an unapproved `@media (max-width: 44rem)` (704px) for `.emergency-task-facts`. The test only parses px, so it does not catch this one.
- **Fix, CSS.** Move both rules into the Plan pack's 650px block (the Plan widths are 940 and 650), or scope them to `.step[data-step-id='s-prereq-passkey-settings']`. Move 44rem to 650px.
- Check a decision, a policy and a completed step at 390 and 768, because the shared footer changes.

### A8: implementation channels regex
- **Evidence.** cff043a2 added `data-emergency-account-tasks={…}` between `className="impl-preview"` and `{...onePanelProps(base, tab)}` (ContentStep.tsx:791). The other assertions in the test still match.
- **Fix, test.** Use `/<div className="impl-preview"[^>]*\{\.\.\.onePanelProps\(base, tab\)\}>/`.

### A9: milestone head (`the action column is gated, or drawn twice`, 0 !== 1)
- **Evidence.** cff043a2 changed `<StepActionColumn rail={rail}>` to `rail={displayRail}`.
- **Fix, test.** Update the literal.
- **Code rule breach.** ContentStep.tsx:289 hard-codes an English rail sub-line for `s-prereq-exclusion-group`: "Select the group containing your emergency accounts for policy exclusions." That breaks the U3 rule (the rail sub-line is the package's words or nothing) and the rule that words come from content.json. The contract-level assertion passes only because the component composes the sub-line after the contract.
  - Fix: move the string to a content.json key and have the contract supply it, or delete it.
  - It is visible on EA Step 2 (accepted in prompt 60), so ask the owner.

### A10: detected candidate regex
- **Evidence.** `<Decision key={step.id} d={d} … stepId={step.id} ctx={ctx} />` (ContentStep.tsx:466). `key=` was added in 5028374a and the line was touched again in 333aa3f4.
- **Fix, test.** Use `/<Decision (?:key=\{step\.id\} )?d=\{d\} ex=\{ex\} saved=\{decision\} onDecide=\{onDecide\}/`.

### A11: 013.A (`small/s-prereq-break-glass: the artifact drops the screen's action`)
- **Evidence.**
  - The screen's action is `Select the accounts dedicated to emergency access, then save.`
  - stepExport.ts:343-345 (cff043a2) runs `lines.splice(0, lines.length, …emergencyAccountTasksText…)` for EMERGENCY_ACCOUNTS. That discards the action unshifted at :342.
  - The print, calendar and prompt pack therefore open with "Create an emergency account" and never say what the screen says.
- **Fix, code.** After the splice, re-apply `if (action.trim() && !lines.includes(action)) lines.unshift(action)`.
- This changes the Step 1 export's first line, not the screen.

### A12: D4 (`no fixture has an account with its minimum met and hardening open`)
- **Evidence.**
  - c1cacf21 narrowed the account step to `EMERGENCY_ACCOUNT_RULES` = {bg.count, permanentGa, cloudOnly, initialDomain, enabled} (src/validation/emergencyTiers.ts:31).
  - Only `bg.count` can be hardening, and only with one confirmed account.
  - Every fixture confirms two accounts. The probe shows `emergency.accounts[*].hardening = 0` and `checks.items = []` for demo, small, mid and demo-week2.
- **Fix, test.**
  - Either build the premise from `fixture('demo')` with `breakGlassUserIds` cut to one account (bg.count then becomes a set-level hardening line on the slot),
  - or, if the owner confirms the account step no longer carries hardening, retire D4 together with the now almost unreachable `'hardening'` slot state (stepContract.ts:949-975, ContentStep.tsx:415-418) and `hardeningOf`.

### A13: follow-up demo drill (`hour 0, account 000f4241…`)

It fails at every hour, for reasons that have nothing to do with time. The probe found three layers:
1. **Tenant rewrite (5028374a).** src/ui/demo.ts:73 rewrites `snapshot.tenantId` to `demo-sample-tenant`. It does not rewrite `signInEvidence[*].recoveryCandidates[*].resourceTenantId` (set at fixtures/index.ts:753). cleanupDone.ts:210 then rejects every candidate: "The event belongs to a different resource tenant."
2. **Evidence contract (ee613dcf).** `evidenceMatchesCurrentCandidate` (cleanupDone.ts:142-159) now requires all of these:
   - `context.signInSource.status==='ok'`
   - `evidence.schema===2`
   - `resourceTenantId`
   - `recoveryGeneration`
   - `candidateSetBasis`

   The demo's recorded drill evidence is schema 1 with none of these, and the test's context passes neither `signInSource` nor `candidateSetBasis`. Even with layer 1 fixed, all 192 probed hour/date combinations still fail. The follow-up demo's Cleanup recovery findings read "recovery-sign-ins: Evidence needed / recovery-confirmation: Verification needed". This came from probing `runFixture(...).schedule.cleanup`; I have not checked it on screen.
3. **Production callers broken by the same contract.** They build the context without `signInSource`/`candidateSetBasis`, so they can never pass:
   - src/validation/rules.ts:606 `bg.drilled` always fails "no recorded drill".
   - rules.ts:675 `bg.lastSignIn` reports any recent sign-in as unrecorded.
   - src/roadmap/manualWork.ts:267 is affected the same way.

   Only emergencyJourney.ts:407 and cleanupPhase.ts:162 pass the full context. This is a duplicate authority: one "drill recorded" answer is correct and the others are wrong.

- **Fix, engine.** Make one function take `(snapshot, mapping, groups, records, now)` and build the full `RecoveryEvidenceContext`, including `recoveryEvidenceSource(snapshot)` and `candidateSetBasis`. Have rules.ts, manualWork.ts and emergencyJourney.ts call it.
- **Fix, fixtures.** Emit schema-2 evidence with `resourceTenantId`, `recoveryGeneration` and `candidateSetBasis` in fixtures/index.ts ~745-760. demo.ts:89 must also map `resourceTenantId` (evidence and candidates) to `DEMO_TENANT_ID`.
- **Fix, test.** Assert through that one function, or through `journeyRecoveryFindings`, rather than hand-building the context.
- Surfaces: EA Step 4, Cleanup, the validation findings and the demo. Step 4 was accepted live, so its own path is right. The fix changes the validation rules and the demo, so ask the owner about the demo's intended Step 4 state.

### Time-dependent tests
- **demo.test.ts:44** is written as an every-UTC-hour test. At present it fails at all hours for the reasons in A13, not because of the clock.
- **Every test that goes through `demoTenant()`.** demo.ts:65 shifts the fixture by `Date.now()`, so the dates depend on the real clock across UTC and local day boundaries: holds, semanticIntegrity, baseline, demo, connectSignedOut, planTruth and readyWhen tests.
- **Tests that read the wall clock directly:**
  - src/ui/consistency.test.ts:23 (`now = new Date()`)
  - src/roadmap/plan.test.ts:20
  - src/ui/emergencyDiagnosticDev.test.ts:10 (a sign-in `createdDateTime` of now)
- **Timing-sensitive tests:** src/testing/transient.test.ts:131-135 (<5 s) and src/graph/collect/workerReasons.test.ts:30-33 (<30 s). These flake under load, not at particular hours.
- I did not run any of these at other clock times. No failure at a specific hour was observed.

---

## B. Dead code and duplicate authorities (prompts 60–62)

1. **`IntuneReading` / `snapshot.intune` / `ReadinessContext.whfb` and `platformSso`.**
   - **Evidence.** No collector writes `snapshot.intune`. The only `intune` hits in src/graph/collect are the capability key at registry.ts:11 and the type at types.ts:294-299 and :340. As a result, `whfb` and `platformSso` are always `'unknown'` in production (readinessContext.ts:101, :109-110).
   - **Readers:**
     - phishingResistant.ts:350-351 and :418-419 (the type and the empty context)
     - :460 (`whfb==='disabled'` gives notProvisioned; unreachable)
     - :461 (joined Windows `possible` is always `'unknown'`)
     - :470 (`platformSso==='configured'` gives Platform SSO; unreachable)
     - readinessSetup.ts:70-71 (`fail` and `whfb==='enabled'`; unreachable)
     - tests phishingResistant.test.ts:277 and :299, which set `whfb:'enabled'` and assert `possible:'yes'`, a state production cannot reach.
   - **Removal is safe.** Behaviour is identical if :461 becomes `possible:'unknown'`, :460 and :470 are deleted, and readinessSetup :70-71 keeps only the `seen`, `notSeen` and `noJoined` branches (the owner's 2026-09-18 rule).
   - **Content keys that become dead with it:**
     - `pages.readiness.panel.whyNot.notProvisioned` ("…turned off in Intune")
     - `pages.readiness.checks.windowsHello.{pass,fail,failText,unknown}`
     - `pages.readiness.options.platformSso` and the `SignInOption` value `'platformSso'`
   - The two tests must be rewritten to the reachable state. No approved behaviour changes.
   - One caveat: joined Windows staying `unknown` until Windows Hello is seen is the *current* behaviour. That is correct under "no Intune permission", but it caps Seamless.
2. **`readinessStatTitles`, `RE.readinessSummary`, `readinessAllWord`** (src/content/contentChecks.ts:80-82, 101-107).
   - Not dead. contentChecks uses them to check that the seven state titles exist, and `pages.readiness.summary` still matches the regex.
   - Their **consumer, the walk, is stale.** scripts/walk.mjs:629-718 queries elements the v3 page no longer renders:
     - `.readiness-summary .summary-stat` (expects exactly 3)
     - `table.datatable tbody tr` td[4]
     - `.progress-strip a`
     - `.toolbar .btn`
     - `.footer-note .ledger`
     - the route `#/readiness/notActive`
     - strings no content key has any more: "qualifying sign-in proof", "need setup or proof", "Show N without →"

     smoke.mjs:363 asserts those same elements are *absent*. The walk would P0 on MFA Readiness at every width. It is not visible today only because CI no longer runs it (see the top).
   - Fix: rewrite the walk's readiness block to the v3 anatomy, or delete it and rely on the readinessV3 and readinessAnatomy unit tests. Rename `readinessStatTitles` to `readinessStateTitles`.
3. **Readiness content keys no source reads.** I checked all 243 `pages.readiness` leaves and 9 `pages.app.readiness` leaves against src and scripts by key segment, then confirmed the hits by hand.
   - `pages.app.readiness.{lineNoRecords, lineNoPeople, showLabel, admin, lineNoRecordsLine, lineRecords}`: v2 ledger words. Only `lineNoRecordsReason`, `needsScan` and `scanLink` are read (App.tsx:361, MfaReadiness.tsx:619 and :644).
   - `pages.readiness.panel.afterStep3`: readinessCells.ts:202 uses `panel.step3[...]` and never the label.
   - The Intune-only keys listed in B1.
   - Removing them changes nothing on screen. `content.test.ts`'s orphan test treats `pages.readiness` as app-only, so it did not flag them.
4. **Retired readiness CSS in src/ui/app.css.**
   - `summary-stat`, `stat-k`, `stat-n`, `readiness-summary`, `progress-strip`, `rung-badge`, `proof-mark`, `readiness-table` and `person-row` are already gone.
   - Still present and rendered by nothing:
     - `.surface .ledger` and `.surface .ledger .quiet` (:3887-3895). No component renders `className="ledger"`, only `ledger-list`.
     - `td .not-person` (:3897). Removed from the component in 95228ecc.
   - Every other `.surface.readiness` class (`s-*`, `dev-word`, `state-dot`, `tiles-*`, `readiness-status-*`) is built dynamically and is live.
   - Safe to delete.
5. **Other dead code from 60–62.**
   - `RECOVERY_DRILL` (emergencyJourney.ts:35, c1cacf21) has no reader.
   - `explainedOf` and `platformsOf` (derive/mfaReadiness.ts, 95228ecc) are used only in-file, so the export can go.
   - `showWord` (readinessCells.ts:66) is read only by tests.
   - `GUEST_NOTE` (content/methodGuides.ts:62) has no reader.
   - The `emergencyImplementation.ts:187` `'Group already excluded'` filter is dead code that produces wrong output (A1).
   - Older dead exports turned up by the same scan, outside 60–62 (not triaged):
     - src/derive/sets.ts: `outstandingSteps`, `denyingSteps`, `heldBy`
     - src/derive/phases.ts: `cleanupLabel`
     - src/graph/collect/onDemand.ts: `resolveNames`, `searchGroups`
     - src/roadmap/consolidation.ts: `consolidationStages`, `compareCoverage`
     - many src/copy/* constants
6. **Duplicate authorities.**
   - (a) **Drill recorded.** rules.ts, manualWork.ts and emergencyJourney/cleanupPhase disagree (A13), and the first two are wrong.
   - (b) **Passkey usability.** `phishingResistant.passkeyAllowed` (tenant-wide merged profile, readinessContext.ts:27-40) and `passkeyCompatibility.policyCompatibility` (per person, per profile) answer the same question differently (C-B).
   - (c) **Phishing-resistant method sets.** strand.ts:28-35 and :111, mfaViability.ts:107-113 and phishingResistant.ts:76-84 disagree on `passKeySynced` and `microsoftAuthenticatorPasswordless` (C-E, C-F).
   - (d) **Migration null.** readinessSetup.ts:80 reads null as pass, while methodAvailability.ts:71 and rules.ts:576 read it as unknown (C-H).
7. **Superseded docs.**
   - docs/design/approved/reference/REFERENCE-MANIFEST.json:179-206 still records `iamai-mfa-readiness-final.html` as "the final MFA Readiness visual and interaction authority". It also cites `docs/design/approved/anatomy/mfa-readiness-v2.html`, which now lives in docs/design/superseded/. That conflicts with manifest.json:102-106 (v3). src/ui/surfaces/readinessAnatomy.test.ts:38 still reads the "final" reference.
   - docs/product/actionability/reference/contracts-and-walk.md:279, :288 and :699-705 still describe the v2 walk and smoke checks (summary-stat, progress-strip).
   - docs/audits/mfa-readiness-audit.md (prompt 61) is superseded by prompt 62.
   - docs/design/mfa-readiness-evidence-capability-audit.md: its Intune guidance was superseded by the no-Intune decision.
   - CLAUDE.md's CI and walk statements (see the top).
   - Mark these superseded or delete them. None governs approved behaviour except REFERENCE-MANIFEST, and for that one the owner should confirm v3 as the only authority.

---

## C. Graph data validation (learn.microsoft.com)

A research subagent checked these against the docs. I re-checked the key lines against the code myself.

**Confirmed mismatches**
- **C-A. Attestation treated as gating sign-in.**
  - Where: phishingResistant.ts:376 (`attestation && synced → 'no'`), and passkeyCompatibility.ts:66-72 and :84-91 under the default `'approval'` purpose. These are reached from methodAvailability.ts:31, emergencyJourney.ts:82 and manualWork.ts:263.
  - Microsoft: attestation is enforced only during registration, and users who registered earlier are not blocked from sign-in if it is turned on later (how-to-authentication-passkeys-fido2).
  - Risk: working synced or unattested passkeys are shown as blocked or unknown.
  - Fix: use runtime purpose for usability (A2–A4). Keep approval purpose for Emergency Access key approval as an explicit owner rule.
- **C-B. Passkey profiles merged tenant-wide, and `passkeyTypes` ignored for readiness** (readinessContext.ts:27-40, passkeySettings.ts:81-99 feeding `passkeyAllowed`).
  - The code merges every assigned profile for everyone. If any one profile is `isEnforced:false`, everyone reads as unrestricted. A block-list profile becomes `restriction:null`, so everyone reads as unknown. `passkeyTypes` (deviceBound/synced) is never checked.
  - Microsoft: a passkey must satisfy at least one profile *scoped to that user*, and synced passkeys cannot sign in if that profile disallows synced (how-to-synced-passkeys; fido2AuthenticationMethodConfiguration in v1.0).
  - Risk: a synced-passkey holder in a device-bound-only profile is shown Ready.
  - Fix: evaluate per person, the way passkeyCompatibility.ts:52-80 already does with runtime purpose, and add the type check to `passkeyAllowed`.
- **C-C. Windows Hello passkey AAGUID** (phishingResistant.ts:370, :377, :465-466; readinessContext.ts:91).
  - The code knows one AAGUID, `08987058-…`. Microsoft documents three: `08987058-cadc-4b81-b6e1-30de50dcbe96`, `9ddd1817-af5a-4672-a2b9-3e3dd95000a9` and `6028b017-b1d4-4c02-b4b3-afcdafc96bb2`.
  - They must be *explicitly* allowed in a profile, and they are incompatible with enforced attestation.
  - Risk: people on unjoined PCs are offered a "Windows Hello passkey" they cannot register when the profile is unrestricted, and "no" is shown when only the other AAGUIDs are listed.
  - Fix: use all three AAGUIDs, and return yes only when the allow list names one of them.
- **C-D. macOS Platform Credential is missing everywhere.**
  - Where: collectors.ts:314-324 (`platformCredentialAuthenticationMethod` becomes `'other'`), phishingResistant.ts:76-84 and :91-101 (no `macOsSecureEnclaveKey`, no "platform credential" match), strand.ts:29-36 and :112, and mfaViability.ts:107-113.
  - Microsoft: the phishing-resistant strength includes "Windows Hello for Business or platform credential". `platformCredentialAuthenticationMethod` is a v1.0 type and `macOsSecureEnclaveKey` is a documented method name. WebAuthn use requires allowing AAGUID `7FD635B3-2EF9-4542-8D9D-164F2C771EFC`.
  - Risk: Mac users on Platform SSO are shown with no phishing-resistant method, or as stranded.
  - Fix: map the type and method name to the windowsHello class and the `windowshelloforbusiness` combination.
- **C-E. `passKeySynced` excluded from `fido2` and from any tier.**
  - Where: strand.ts:111 uses `startsWith('passkeydevicebound')`, strand.ts:28-35 has the set, and mfaViability.ts:108 does the same.
  - phishingResistant.ts:77 does accept it, so the code disagrees with itself.
  - Risk: a synced-passkey holder is shown as having no MFA or as stranded.
  - Fix: `startsWith('passkey')`, case-insensitive, in both places.
- **C-F. `microsoftAuthenticatorPasswordless` counted as phishing-resistant** (strand.ts:34, used at :534 for the admin family).
  - Microsoft's strength table puts phone sign-in under MFA and Passwordless, not Phishing-resistant.
  - Risk: an admin with only phone sign-in is not flagged as stranded.
  - Fix: remove it from the set.
- **C-G. An empty sign-in `trustType` never becomes "none"** (laneBCore.ts:142-150, with phishingResistant.ts:464).
  - Microsoft: `deviceDetail.deviceId` is populated only for devices registered in Entra.
  - Risk: in any tenant with one joined Windows device, a personal, unregistered PC reads "join state unreported" and the person is shown Unknown instead of Needs a device.
  - Fix: when both `trustType` and `deviceId` are empty, return `'none'`.
- **C-H. `policyMigrationState` null.**
  - readinessSetup.ts:80 reads null or empty as **pass**. methodAvailability.ts:71 and rules.ts:576 read it as unknown.
  - Microsoft documents `preMigration` (spelled `premigration` in the v1.0 page), `migrationInProgress`, `migrationComplete` and `unknownFutureValue`. Null is not documented.
  - Risk: the setup rail says the migration is complete when that is unknown.
  - Fix: read null as unknown. This touches the approved MFA Readiness rail check, so ask the owner.
- **C-I. `defaultMfaMethod` is read from v1.0 but exists only in beta** (collectors.ts:183, :195). It is always null. Nothing uses it for decisions today. Drop it or read it from beta.

**Microsoft does not document the values, so I cannot confirm these**
- Sign-in `trustType` strings. The substring matching in laneBCore.ts:145-147 covers both "Azure AD …" and "Microsoft Entra …". Directory-style values (`AzureAd`, `ServerAd`, `Workplace`) would fall through to undefined; mapping them costs nothing.
- Sign-in `authenticationMethod` strings. Only "OATH verification code" is documented. The regex at phishingResistant.ts:94-99 covers the passkey, FIDO2, Windows Hello and certificate wordings, and an unrecognised string yields no proof, which is conservative. The Platform Credential gap is C-D.
- The recovery path compares against the exact string `'Passkey (FIDO2)'` (cleanupDone.ts:143, :209). This is safe: laneBCore.ts:318-333 normalises any detail matching `/passkey|fido|security key/i` to that label before storing it, so a newer Entra wording such as "Passkey (device-bound)" still verifies.
- `x509Certificate` in `methodsRegistered` is not in the documented enum. It is used at phishingResistant.ts:79 and :501, strand.ts:34 and :113-114, and mfaViability.ts:111.
- Directory `operatingSystem`. platforms.ts:11 uses the exact match `^(ios|android)$`. Commonly observed values such as `IPhone`, `IPad`, `AndroidForWork` and `AndroidEnterprise` would count as computers. Use a prefix match.

**Verified correct**
- `/devices` `trustType` values `AzureAd`, `ServerAd` and `Workplace` (readinessContext.ts:97).
- fido2 method fields `aaGuid`, `model`, `attestationLevel`, `passkeyType` and `createdDateTime`.
- The v1.0 `passkeyProfiles` and `defaultPasskeyProfile`. The legacy `keyRestrictions` and `isAttestationEnforced` are deprecated, with removal due in October 2027.
- Key restrictions apply at both registration and sign-in.
- `methodsRegistered` `passKey…` casing at phishingResistant.ts:77 and methodAvailability.ts:14.
- Authenticator `authenticationMode` values `any`, `push` and `deviceBasedPush`.
- `status.errorCode === 0`, `authenticationRequirement`, and the interactive-only filter.

---

## Changes that need owner approval

Emergency Access Steps 1–4 were accepted live in prompt 60, and MFA Readiness v3 is approved. These change what those steps or pages show:
- A1 code fix (Step 2 Entra text)
- A9 hard-coded rail sub-line (Step 2)
- A11 (Step 1 export's first line)
- A13 (demo Step 4 state; the validation-rule findings)
- A2–A4 engine fix (Plan gate counts)
- C-A, C-B, C-C, C-E, C-F, C-G, C-H (the MFA Readiness states and rail)
- A12 retiring the hardening slot
- the REFERENCE-MANIFEST authority change

These are test-only or design-lint/CSS fixes that change no approved behaviour: A1 test, A5, A6, A8, A9 test, A10, A12 test, and the dead-code removals in B1, B3 and B4.

A7 changes the shared step footer at phone width. Check it on a decision step, a policy step and a completed step.
