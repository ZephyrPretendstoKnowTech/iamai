**Per-user MFA step (s-prereq-per-user-mfa, shown as 4.6): can it show only when needed, and should it be deleted?**

**Recommendation:** don't delete it. Make it show only when needed, keyed to each account's own per-user MFA state (not the migration state), and put that in v1.1. My estimate is 30–40 minutes, which is over the owner's 30-minute line. There's a second reason to wait: the change would not alter what Monday's demo visitors see. None of the fixtures, the demo included, carry per-user readings, so the demo shows the step as "Not fully read" whatever the rule is (see "Caveats" below). Keeping the step costs little: a real tenant whose accounts are all read and all Disabled already sees it as a Completed row.

**How it works today**
- **Always built:** `generate.ts:1363-1369` adds the step whenever Conditional Access is available, with no condition on the tenant's state.
- **The read:** `collectors.ts:562-606` reads each account's per-user state from beta `/users/{id}/authentication/requirements`, in batches of 20. `worker.ts:258-262` runs it on every page of the user list. It needs Policy.Read.All (`registry.ts:85`), and Microsoft Learn says the signed-in person must be Global Reader or Authentication Policy Administrator (https://learn.microsoft.com/en-us/graph/api/authentication-get?view=graph-rest-beta, "Permissions to read per-user MFA state").
- **Reliability:** it fails safe for each account. Every account starts as `unknown` before its request goes out (`collectors.ts:577`). A failed batch, a non-200 answer, an unrecognised value or a throttled request all stay `unknown` (`collectors.ts:569-571, 584-593, 599-603`). Only 401 and 5xx are retried. A 429 stays unknown until the next scan.
- **How the step judges it** (`manualWork.ts:370-382`):
  - All accounts read and none Enabled or Enforced: the step is satisfied and in place, so it shows as Completed.
  - Any account Enabled or Enforced: the step is open and names those accounts.
  - Anything else: a manual review, with the tile showing "Not fully read" (`manualWork.ts:318-340`).
- **Migration state:** it's read from the v1.0 methods policy, falling back to beta (`collectors.ts:108, 167-180`). The step only prints it as a readiness line (`generate.ts:1367`). The emergency-access check `bg.perUserMfaOff` judges it (`rules.ts:618-636`); if that read fails, the check says unknown, never pass.

**1. Can it appear only when needed?** Yes. The test already exists: users read `ok`, no account unknown, none Enabled or Enforced (`manualWork.ts:377`). Moving that into one shared function and building the step only when it's false gives exactly "present only if necessary". I checked this with a probe, since deleted:
- small, demo-week2 and messy, each given an all-Disabled reading: the step's lane is Completed today.
- Taking it out changed no other step's lane in `laneReadings`.
- Nothing lists it as a prerequisite in `dependency-data.json`. Its only edge is its own start condition, at 514-525.
- The service-accounts group step (`generate.ts:1222-1232`) sets the precedent for a step that is only built when a condition holds.

I'd leave out the migration state as a trigger:
- The step's own words say finishing the migration is not what finishes it (`content.json:4136, 4144`).
- Microsoft says "Individual user settings aren't migrated" (https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-methods-manage).
- The step would appear with an empty account list and nothing to do.
- An incomplete migration is already flagged by `bg.perUserMfaOff`.

I'd also not use the existing "Doesn't apply" footer to hide it. Its row reads "{stepTitle}: you said: {reason}" (`content.json:981`) and carries a Put back button (`PlanFooter.tsx:49-56`). Both would be false for something the scan read.

**2. When the read fails or is refused:** the step stays on the board. It is hidden only on a complete, clean read. Each of these keeps it shown as "Not fully read" with a manual review:
- an absent `perUserMfa` (older snapshots, `types.ts:313-314`)
- any account unknown
- a partial user list

A Security Reader operator is refused every per-account read, so the step always shows for them. That is the conservative outcome. However, `roles.ts:34` lists Security Reader as enough for Policy.Read.All, so the Connect page won't warn them in advance. Large tenants may see throttled accounts come back unknown, so the step can reappear on a clean tenant for that reason.

**3. What deleting it outright would lose**
- **The only per-account judgement:** it's the one place each account's state is judged (`rules.ts:624-627`, `copy/validation.ts:273-276`). The collector's output would be read and never shown.
- **The safety order:** "disable on the day Require MFA for Everyone enforces, not before" (`content.json:4134`) and the risk "Disabling per-user MFA before the policy enforces removes MFA for that person" (`content.json:4154`). The step's dependency edge goes with it (`dependency-data.json:514-525`).
- **Two warnings:** app passwords that bypass MFA (`content.json:4158`), and the old service settings' skip that makes intranet requests read as a trusted location (`content.json:4162`). The Enforced-versus-Conditional-Access conflict goes too (`content.json:4124`).
- **Size of the change:** the step is referenced in the content entry and the generated implementation registry (`registry.generated.json:21717`). `copy/validation.ts:17` looks up its title when the module loads, so removing the content entry would crash it. Other references: `stepGroups.ts:151`, `planBoard.ts:195`, `rowWho.ts:27`, `stepResources.ts:62`, `ladder.ts:50`, `manualWork.ts:270, 364, 370, 423`, `generate.ts:2864`, and about 12 test files. That's well over an hour, for a worse result.

**4. Build estimate for "show only when needed"**
- **Code, about 10 minutes:** export one function from `manualWork.ts` that returns the enabled and unknown accounts and whether the read is clean. Gate `generate.ts:1365` on it, and have `manualWork.ts:372-373` use it.
- **One unit test, 10–15 minutes**, with five cases:
  - clean read: no step
  - one Enforced: step shown and named
  - one unknown: step shown
  - `perUserMfa` absent: step shown
  - users partial: step shown
- **Fallout: none expected.** No fixture carries readings, so step snapshots and planVariants don't change. No test asserts the clean Completed case: I searched for its "delivered by" line and the tile's Disabled words.
- **Checks:** the two covering test files ran in about 10 seconds (69 passed). I didn't time `npm run verify -- --prepush`, which adds the build and smoke; I'd allow a few minutes. CI waiting time is on top.
- **Total: about 30–40 minutes.**

**Caveats**
- **The demo:** every fixture, including demo and getiamai, has no `perUserMfa`. So the demo shows "The scan read no per-user MFA state… all 38 accounts" as an open step, and the hide rule won't change that. Giving demo and demo-week2 readings means updating demo tests and snapshots, with the [snapshots] commit tag: another 30–45 minutes, also v1.1.
- **The check's wording:** once the step is hidden, the `bg.perUserMfaOff` explanation still names the step (`copy/validation.ts:276`, asserted by `howView.test.ts:100-116`). Rewording it is about 10 minutes.
- **The readiness line:** `generate.ts:1367` is inline English, not a `content.json` key, and still says per-user states "require a separate check in Entra" even though the scan now reads them.

Probes were written under `C:\Dev\IAMAI-q-flow\docs\qa\night\personas\` and deleted; git status is clean.