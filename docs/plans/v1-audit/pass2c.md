# Pass 2C — cross-channel agreement, and the states nobody exercises

Audit of `C:\Dev\IAMAI` at `7f242c51`. Read-only: no file under `src/`, `docs/design/` or
`docs/implementation-content/` was modified.

## 1. What was compared, and how

43 packages carry a `CONTENT.md`. 28 of them build a Conditional Access policy in more than one
channel (27 `baseline-goal*` plus `s-shared-devices`); one of those, `s-goal-admin-portals-protected`,
carries no `entra`/`json`/`powershell` block at all by owner disposition, so **27 packages were
compared field by field**. The remaining 15 (prereq object steps, checks, the ladder, the drill)
write no policy and were not put through the policy-field comparison; they appear only where a
finding touches them.

Method, all mechanical and reproducible:

1. Every `@@IAMAI-BEGIN` block was parsed out of each `CONTENT.md`; the `json` bodies were parsed as
   JSON with bindings replaced by sentinels, and the PowerShell `Conditions`/`Grant`/`Session`
   builders were parsed with a small PowerShell-literal parser, then both flattened to
   `path = value` and diffed (scratch: `cmp.mjs`, `run1.mjs`).
2. Each package's `META.json` `baselineAuthority.memberStableId` was resolved against
   `baselines/jhope188-conditionalaccesspolicies.pinned.json` (pin `90d9b890`), and the JSON body's
   state, grant, session and every condition compared with the pinned member's (`run2.mjs`).
3. Each `projection` was expanded per state per channel, so a state where one channel offers work and
   another offers none, or something different, is visible (`run3.mjs`).
4. The Entra prose of all 27 was read in full against (2) and against the machine bodies.

Two families exist and the comparison differs for each:

- **Target-driven (13):** `admin-session`, `admins-phishing-resistant`, `azure-management-mfa`,
  `block-auth-transfer`, `block-device-code`, `block-legacy-auth`, `block-unsupported-platforms`,
  `geo-restriction`, `inforcer-mfa`, `mfa-all-users`, `mobile-app-protection`,
  `register-info-protected`, `require-managed-device`. The JSON body is
  `"conditions": {{json:policy.target.conditions}}` and the PowerShell takes the whole
  `-TargetPolicyJson` (binding `policy.target.json`), so JSON ≡ PowerShell **by construction**. The
  only authored surface is the Entra prose, and that is what was compared against the pin.
- **Bespoke (14):** every field is written out in both machine channels, so all three were compared.

Where a value is a binding on both sides it was treated as agreeing only when the same binding (or
its declared PowerShell parameter) fills it.

## 2. Cross-channel divergence

`agrees` = Entra prose, JSON body and PowerShell builder produce the same policy in every compared
field (population, guest/external types, roles, resources, every condition, grant controls and
operator, authentication strength, session controls, state).

| step | field | Entra says | JSON writes | PowerShell writes | the pin holds | sev |
|---|---|---|---|---|---|---|
| **s-goal-user-risk** | `grantControls.authenticationStrength` | "Grant: **Grant access > Require risk remediation**. **When Entra adds authentication strength**, select **{{authStrength.target.displayName}}**. Keep the relationship as AND." (`entra.create` step 5) | always `{"operator":"AND","builtInControls":["riskRemediation"],"authenticationStrength":{"id":…}}` | `function Grant{… operator='AND'; builtInControls=@('riskRemediation'); authenticationStrength=@{id=$AuthenticationStrengthId}}`, and `Assert-Canonical` throws `'Risk-remediation grant mismatch'` without it | `riskRemediation` AND `Modern MFA + TAP` (`42de22a7…`) | **4** |
| **s-goal-session-lifetime** | the second policy, in `partial` / `unmanaged.missing` | `entra.correct.unmanaged.missing`: "Create only the missing unmanaged-device component using **the Policy B procedure from this package**." No such procedure exists — "Policy B" occurs once in the whole file, in that sentence, and the only create procedure (`entra.create-set`) opens "**The baseline has one session policy for this step: the browser policy below.**" | `json.unmanaged.create`: a full POST — All users, All resources, `clientAppTypes:["all"]`, device filter exclude `device.isCompliant -eq True`, sign-in frequency 9 hours, `persistentBrowser never` | `powershell.run:CreateUnmanaged` → `New-One … (New-UnmanagedConditions) 9` | no member; `members[1].memberStableId: null`, "No companion stable member ID is surfaced … no ID is invented" | **4** |
| **s-goal-session-lifetime** | the interval, corrections | browser: "set Sign-in frequency to **the interval in the intended target**"; unmanaged: "set Sign-in frequency to **9 hours**" — literal on one component, bound on the other | 12 / 9 literal | 12 / 9 literal | browser 12h; unmanaged none | 2 |
| **s-goal-mfa-all-users** | `grantControls` | "Grant: **Require multifactor authentication**. Do not substitute an authentication strength." | literal `{"operator":"OR","builtInControls":["mfa"],…}` — **not** `{{json:policy.target.grantControls}}` | whole `policy.target.json`, i.e. the resolved target | `["mfa"]`, OR | 2 (latent) |
| **s-goal-admins-phishing-resistant** | `grantControls` | "Grant **Require authentication strength** and select the custom authentication strength resolved for this tenant." | literal `{"operator":"OR","builtInControls":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}}` | whole `policy.target.json` | strength `42de22a7…`, `builtInControls:[]`, OR | 2 (latent) |
| **s-goal-unmanaged-browser** | which policy to enable | "Set **one policy** to **On** at a time" (A, then B) | `json.enforce` is the bare body `{"state":"enabled"}` with **no method and no endpoint** — nothing says which policy | `EnforceA` / `EnforceB`, each reading back its own id | no member ids (`memberStableIds: []`) | 3 |
| s-goal-admin-session | — | — | — | — | — | agrees |
| s-goal-azure-management-mfa | — | — | — | — | — | agrees (pin not nameable, §3) |
| s-goal-block-auth-transfer | — | — | — | — | — | agrees |
| s-goal-block-device-code | — | — | — | — | — | agrees |
| s-goal-block-legacy-auth | — | — | — | — | — | agrees |
| s-goal-block-unsupported-platforms | — | — | — | — | — | agrees |
| s-goal-device-registration-mfa | — | — | — | — | — | agrees |
| s-goal-geo-restriction | — | — | — | — | — | agrees |
| s-goal-guests-mfa | — | — | — | — | — | agrees |
| s-goal-inforcer-mfa | — | — | — | — | — | agrees (pin not nameable, §3) |
| s-goal-intune-enrollment-reauth | — | — | — | — | — | agrees |
| s-goal-mobile-app-protection | — | — | — | — | — | agrees (pin not nameable, §3) |
| s-goal-pim-activation-reauth | — | — | — | — | — | agrees |
| s-goal-register-info-protected | — | — | — | — | — | agrees (pin not nameable, §3) |
| s-goal-require-managed-device | — | — | — | — | — | agrees |
| s-goal-service-accounts-trusted-network | — | — | — | — | — | agrees |
| s-goal-sign-in-risk | — | — | — | — | — | agrees |
| s-goal-sign-in-risk-medium | — | — | — | — | — | agrees |
| s-goal-token-protection | — | — | — | — | — | agrees |
| s-goal-user-risk-medium | — | — | — | — | — | agrees (the 2026-09-20 fix holds: all three write `passwordChange` + strength under AND) |
| s-goal-workload-identity-block | — | — | — | — | — | agrees |
| s-shared-devices | — | — | — | — | — | agrees |
| s-goal-admin-portals-protected | — | no channel | no channel | no channel | `fafaa50c…`, contradicted | not comparable |

### 2.1 Notes on the two severity-4 rows

**`s-goal-user-risk`.** The hedge is in `entra.create` only; the same package's `entra.correct.grant`
says flatly "Grant: select **Require risk remediation** with authentication strength
**{{authStrength.target.displayName}}** … Keep operator AND." So the package contradicts itself
between create and correct, and its create tab contradicts both machine tabs. An admin who reads
"when Entra adds authentication strength" as a future capability creates a policy whose grant is
`riskRemediation` alone; the PowerShell `Verify` then throws, and the Plan's next scan reads a
mismatch the admin was told to make. The resulting policy is weaker than the pin, not wider, but it
is the class the brief names first: three tabs, two answers.

**`s-goal-session-lifetime`.** The `missing` projection is safe — all three channels create the
browser policy only. The divergence is in `partial`, where the mismatch `unmanaged.missing`
projects `entra.correct.unmanaged.missing` + `json.unmanaged.create` + `CreateUnmanaged`. The Entra
reader is sent to a procedure that does not exist; the JSON and PowerShell readers create a second
policy that the Entra channel describes nowhere and that the pin has no member for. That policy
reaches **All users, All resources, every client app, every device that is not compliant**, with a
9-hour sign-in frequency and no persistent browser — materially broader than the browser policy the
Entra tab documents.

A related, lesser fact: the `Enforce` and `Create` PowerShell modes are declared in
`withheldModes` ("Enforce also turns on the unmanaged-device companion, which the pinned baseline has
no policy for"), yet `projection.readyToEnforce.powershell` still lists `powershell.run:Enforce`. The
PowerShell tab in `readyToEnforce` therefore lists a run that IAMAI declares it cannot call.

## 3. Package vs pin

No channel was found writing a *policy field* that contradicts the pinned member it names. What was
found is a gap in nameability and one pin-internal conflict.

| step | finding | sev |
|---|---|---|
| `s-goal-azure-management-mfa`, `s-goal-inforcer-mfa`, `s-goal-register-info-protected`, `s-goal-mobile-app-protection`, `s-goal-intune-enrollment-reauth`, `s-goal-unmanaged-browser`, `s-goal-session-lifetime` (unmanaged half), `s-goal-workload-identity-block` | `META.json` names **no resolvable pinned member**: either no `memberStableId`, or `memberStableIds: []`, or a member keyed by display name alone (`"IAC - APP - SESSION - IntuneEnrollment-SIFEveryTime"`, `"IAC - WORKLOAD - BLOCK - EntraConnectIDSync - ExcludeEntraConnectIP"`). **The channel-vs-pin comparison cannot be made for these eight**, by construction. The packages say so honestly — e.g. `"sourceStableIdStatus": "The retained source member is keyed by display name in the available pinned mapping; no source policy ID is invented."` — so this is a recorded limit, not a concealed one. It is listed because the brief asks where the comparison could not be made. | 2 |
| `s-goal-device-registration-mfa` | The pinned member `aeb49474…` carries a strength whose `allowedCombinations` are `[windowsHelloForBusiness, fido2, x509CertificateMultiFactor, temporaryAccessPassOneTime]`, while the same strength id `42de22a7…` on `s-goal-admins-phishing-resistant`, `s-goal-sign-in-risk` and `s-goal-pim-activation-reauth` lists `temporaryAccessPassMultiUse` as well. One strength id, two definitions inside one pin. Every channel here binds `authStrength.target.id`, so nothing diverges between tabs — but which combinations the admin is told the strength accepts depends on which policy's embedded copy is read. (`resolvePolicy.ts` already resolves this one way; noted so the pin conflict is on the record.) | 2 |
| `s-goal-admin-portals-protected` | Package has an owner-recorded contradiction (`"Acting on either interpretation would invent semantics or risk blocking intended administrators."`) and therefore no implementable channel at all. Correct behaviour; recorded for coverage. | — |

## 4. Failure-mode table

`Connect tile` = the tile-3 state chosen in `src/ui/surfaces/Connect.tsx:507`. Step readings were
produced by running the real producers (`runFixture` → `stepBodyOf` → `policySubjectsOf`), the same
path `scripts/tile-dump.mjs` uses.

| state | surface | what it shows today (quoted) | what it should show | sev |
|---|---|---|---|---|
| **A source read returns partial data** — `config.caPolicies.status = 'partial'` after a paged read stops early | Connect tile 3 | `"complete · {age}"`. Reproduced: `coreGaps(snapshot)` returns `[]` for a partial core read (`READ = new Set(['ok','partial'])`), so no gap banner. | "finished with gaps" treatment, or at minimum a named incomplete-source line: a partial policy list is not a read policy list. | 4 |
| same | Plan / step cards | With one of `small`'s three policies unseen, `s-goal-mfa-all-users` flips from `enforced / satisfied` to **`not-deployed`** and its card reads `Conditional Access policy \| Report-only \| "Finish the steps this one waits on first."` — i.e. once its prerequisite clears, the plan asks the admin to **create a policy that already exists and is enforced**. | The step should say the policy list was read only in part and refuse to call the goal Not deployed on an incomplete read. | 4 |
| same | Plan / `s-prereq-exclusion-group` | Does say it: `Policy exclusions \| The group is excluded from every enabled or report-only policy. \| "Missing scan evidence: Conditional Access policies."` | — (this is the behaviour the policy steps lack) | — |
| **Fewer permissions consented than asked for** — every core source reads, ten non-core sections refused 403 | Connect tile 3 | `"complete · {age}"`. Reproduced with `roleAssignments`, `roleAssignmentSchedules`, `authMethodsPolicy`, `namedLocations`, `authStrengths`, `pimEligibility`, `crossTenantAccess`, `deviceRegistrationPolicy`, `registrationDetails`, `devices` all at `status:'error'`: `coreGaps` = `[]`, so the gaps tile never draws. `unreadSources()` correctly names all ten — but `src/ui/actions.ts:114` computes it only when there is a core gap: `unread: found.length > 0 ? unreadSources(result) : []`. The ten unread sections are therefore **discarded before they reach the UI**. | The unread list should be carried and shown whatever `coreGaps` says; "complete" should be reserved for a scan that read everything it asked for. | 4 |
| same | Plan | Only two steps change state (`s-prereq-exclusion-group`, `s-prereq-trusted-location`). Several steps do show honest per-item words — `"Not fully read"`, `"Account or role data not fully read"`, `"Missing scan evidence: sign-in records"`, `"Some users' registered authentication methods were not readable."` — so this is not total silence at step level. | Connect's headline should match what the steps already admit. | — |
| **A policy the step expects has been deleted between scans** (and every `no-operation` case) | Plan / step card | Card heading `Conditional Access policy`, check word **`Enforced`**, reason `"This step has no policy for IAMAI to write in this plan. Scan Contoso Pty Ltd again to rebuild it."`, lane `On Hold`, state `Blocked / Enforced`. In `docs/qa/tile-dump.txt` this appears **18 times across every fixture including the shipped demo** (lines 953, 1391, 1486, 1505, 1840, 1950, 1984, 2390, 2481, 2500, 3109, 3217, 3236, 3688, 3707, 4034, 4129, 4148). | "Enforced" beside "no policy for IAMAI to write" is a contradiction a reader resolves as "this is on and fine". The stage word must not be `Enforced` when the reason is `no-operation`. | 4 |
| same | Plan / step card | The instruction `"Scan {tenant} again to rebuild it"` — but the cause on `s-goal-inforcer-mfa`, `s-goal-guests-mfa` and `s-goal-block-device-code` is that the goal has no writable operation in this plan, not a stale scan. Rescanning changes nothing, on every fixture, repeatedly. (`src/ui/surfaces/enforcedInPlaceRow.test.ts` already asserts a *neighbouring* case must not say this.) | Name what is actually missing, or say there is nothing to do. | 3 |
| **No Entra ID P1 or P2 licence** (`micro`) | Plan header | `"Conditional Access needs Entra ID P1, and this tenant does not have it. No Conditional Access policy can be created here; the steps below are the protections available without it."` and a 10-step free-tier ladder with no CA steps. | — handled well | — |
| same | Plan footer | `"Not licensed (21)"` with a row per goal and `"Nothing in the plan waits on these."` | — handled well | — |
| same | Plan footer, all tenants without Intune | `"Require a Managed Device Outside the Office and Require a Fresh Sign-in for Intune Enrollment: need an Intune Plan 1 licence this tenant does not **holds**; no device policy is offered…"` — reproduced on `micro`, `small`, `mid`, `huge`. The content key reads "does not hold"; `pluralise()` bends the verb. | "does not hold" | 1 |
| same | Implementation Tasks | The `notLicensed` **package state is never entered**: `src/content/implementation/states.ts:24` — "No step reaches `notLicensed`: the runtime never enters it." The `entra.not-licensed` / `ai.not-licensed` / `json.policy-a` content authored for it in 14 packages is dead. Licensing is handled solely by lifting the step out of the plan into the footer. | Either delete the dead blocks or reach the state; as written, a package claims a licence story it can never tell. | 2 |
| **Empty or near-empty tenant** (1 user, 0 policies, no licence) | Plan | Builds the same 10-step ladder without throwing; no division-by-zero, no percentage on an empty denominator. | — handled | — |
| same | Plan | No emergency-access step is generated for a no-P1 tenant (`s-prereq-break-glass` and `s-prereq-exclusion-group` are absent from `micro`). Defensible — no CA policy can lock anyone out — but a tenant on security defaults can still strand its only admin. Flagged as a judgement for the owner, not as a defect. | — | 2 |
| **Plan opened against a tenant it was not made for** | Export | `"This plan was made for {planTenant}, and you are connected to {current}. Nothing was loaded. Open it while connected to {madeFor}."`, and for a file with no tenant, `"This plan file does not say which tenant it was made for, so it cannot be loaded into {current} safely. Nothing was loaded."` The check runs before anything persists (`Export.tsx` `loadPlanInner`), and a baseline-source mismatch is refused separately. | — handled well | — |
| **A tenant policy display name containing `"`** | JSON tab, any state | `{{x}}` (as against `{{json:x}}`) inside a JSON body is substituted by `formatValue()`, which does **no JSON escaping**. Reproduced: `bindText('{"displayName":"{{policy.target.displayName}}"…', {…: 'Contoso "Admin" MFA'})` yields `{"displayName":"Contoso "Admin" MFA"…}` → `SyntaxError: Expected ',' or '}'`. Affected: `s-goal-pim-activation-reauth` (`json.context.upsert`, `json.policy.create`), `s-goal-session-lifetime` (`json.browser.create`, `json.unmanaged.create`), `s-shared-devices` (`json.create`). The PowerShell channel escapes correctly (`invocation.ts` `literal()`); the other 22 packages use `{{json:…}}` and are safe. | Use `{{json:…}}` for every value interpolated into JSON. | 3 |

## 5. FROZEN

Findings against frozen steps. Recorded, not to be applied.

**`s-prereq-break-glass`** and **`s-prereq-exclusion-group`** — unescaped `{{x}}` inside a JSON body,
the same defect as §4's last row: `json.group-membership` interpolates `{{emergency.target.userId}}`,
and `json.member.add` / `json.member.remove` interpolate `{{group.target.memberId}}` and
`{{group.current.id}}`. Both are GUID bindings, so the practical exposure is nil today; the pattern
is the one that breaks on a display name. Severity 1 as written, 3 if either binding ever carries
free text.

**`s-prereq-break-glass`, `s-prereq-exclusion-group`, `s-prereq-passkey-settings`** — their JSON
blocks declare no `method` and no `endpoint` (`json.role-assignment`, `json.group-membership`,
`json.group.create`, `json.member.add`, `json.member.remove`, `json.policy.patch-conditions`,
`json.fido2`, `json.tap`). Nine other non-frozen prerequisite packages do the same, so this is a
family habit rather than a frozen-step defect; it is listed under §6. Severity 2.

No divergence of policy fields was found in any frozen step: none of them builds a Conditional
Access policy in more than one channel except `s-prereq-exclusion-group`, whose
`json.policy.patch-conditions` carries only the resolved exclusions and agrees with its prose.

The four `s-direction-*` steps and the Verify Emergency Access cleanup row carry no implementation
package and produced no finding in this pass.

## 6. Patterns

1. **Literal where a binding exists.** The two latent divergences (`mfa-all-users`,
   `admins-phishing-resistant`) and the `session-lifetime` "9 hours" line all come from one habit:
   the same fact written as a literal in one channel and as a binding in another. They agree today
   only because the pin happens to match the literal. `drift.ts` catches a re-pin, but nothing
   catches a literal that stops matching the target the other channel is handed.
2. **The Entra channel is the only authored one, and it drifts alone.** In the target-driven family,
   JSON ≡ PowerShell by construction; every divergence in this pass is prose against machine. The
   `user-risk` hedge and the `session-lifetime` phantom "Policy B procedure" are both Entra-side, and
   neither could have been caught by comparing the machine channels to each other.
3. **A channel's projection and its own invocation disagree.** `session-lifetime` lists
   `powershell.run:Enforce` in `readyToEnforce` while its `withheldModes` says IAMAI cannot call it;
   `s-goal-unmanaged-browser` projects a JSON enforce body with no endpoint. Both are cases of the
   projection promising a channel that the channel cannot deliver.
4. **A read that half-worked is treated as a read that worked.** `'partial'` is a member of the
   "usable" set in at least nine places (`coreSections.ts`, `readinessContext.ts`,
   `readinessSetup.ts`, `smsRetirement.ts`, `direction.ts`, `evidence.ts`, `generate.ts`,
   `ladder.ts`, `methodReadiness.ts`), and nothing carries the partiality forward to the person. The
   worst outcome of that habit is the plan telling an admin to create a policy the tenant already
   enforces.
5. **The honest words exist but are not wired to the headline.** The step cards already say "Not
   fully read", "Missing scan evidence: …", "could not fully check this account". Connect, which is
   the surface a person judges the scan by, says "complete" through all of it, because the one line
   that would have carried the list is gated on a different condition.
6. **A word chosen for the lifecycle is reused where it is no longer true.** `Enforced` beside "no
   policy for IAMAI to write" is the same class of fault as a status word surviving the condition
   that earned it — the stage is computed from `state.lifecycle` without regard to the reason that
   made the step unavailable.
7. **Content authored for states the runtime cannot enter.** `notLicensed` blocks in 14 packages;
   `states.ts` already records the reconciliation, so the product knows. The cost is that a reviewer
   reading a package believes the licence case is covered in Implementation Tasks when it is not.

## 7. What could not be checked, and why

- **Eight packages against the pin** (§3 row 1): no resolvable stable member id, by the packages' own
  recorded decision not to invent one.
- **`s-goal-admin-portals-protected`**: no implementable channel exists.
- **Rendered screens**: everything here was produced from the source and from the product's own
  producers run in Node. Nothing was read off a browser; the walk, smoke and the full suite were not
  run, per the brief.
- **PowerShell execution**: no script was run. The comparison is of what each script's builders
  construct, read statically. Packages record the same limit themselves
  (`"powershellAst": "unavailable-in-authoring-container"`).
- **`micro`, `getiamai` and `huge` are absent from `docs/qa/tile-dump.txt`** — `micro` is the only
  no-licence, near-empty fixture, so the licence and empty-tenant states have no dumped card
  coverage. The readings in §4 for those states were generated for this pass, not taken from the dump.
