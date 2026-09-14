# Consolidated correction batch

This batch starts at `1e2174dd`, is a local branch `preview-continuation` commit, and was bounded to the owner's five items. It made no push, merge, deployment, workflow run, tenant access or generated-script execution, and did not touch `C:\dev\iamai`.

## Commits
| Commit | Contents |
|---|---|
| **`aaba6d43113da4c0435b273047841705a8aba5fd`** | **Final tested code commit.** Items 1–4: code, package content, `content.json`, regenerated registry, `LIBRARY.json` and `home/index.html`, and all tests |
| next commit (docs only) | This report, `AI-COVERAGE.md`, and the updated `PUBLIC-COPY-REVIEW.md` |

The code is one commit, so the tested state and the committed state are the same thing. One difference: after the final full-suite run, one test helper in `riskDeviceCampaignContentSpecs.test.ts` had literal line breaks replaced with `\n` escapes. That file was rerun alone and passed 5/5. Nothing else changed.

## Completed items
1. **Public wording.**
   - Changes:
     - The trust title now reads "Your plan is built in your browser".
     - "What would break" and "predicted to affect" are gone from the home page, meta description, Connect heading and README.
     - The method sentence now says "IAMAI saves the sign-in details needed for its checks, leaving out phone numbers", in the permission copy and `SECURITY.md`. The saved summary does include credential metadata such as passkey ids, creation dates and Authenticator device details, and the wording no longer implies it holds only method types.
   - Kept unchanged: the hidden-risk positioning, Jon Hope attribution, the pinned-baseline disclosure and the Connect beta notice.
   - Every change is listed in `PUBLIC-COPY-REVIEW.md`.
2. **Session excluded accounts.**
   - A package can now declare that a resolved empty list is a value (META `resolvedEmptyBindings`). Only Limit How Long Sessions Last does, and only for `policy.target.excludeUsers`.
   - Resolved `[]` now draws every channel: JSON `"excludeUsers": []`, `-ExcludeUserIds @()`, and a line saying the target excludes no individual accounts.
   - A non-empty set is carried exactly. An unbound or `null` value still holds.
   - The exclusion groups stay required. The validator rejects an undeclared key.
   - Entra, AI Info, readiness and troubleshooting no longer make shared-device exclusions mandatory.
   - Policy targets and operations are unchanged, and no account or companion policy was added.
3. **AI Info grounding.**
   - One shared builder, `aiGrounding.ts`, appends **IAMAI FACTS FOR THIS STEP** to every package AI Info and forms the engine-fallback AI Info. It contains:
     - the step context the prompt pack uses;
     - findings, and tracked and existing policies;
     - on policy steps, the current policy with name, id, state, differing fields and removed exclusions, plus the intended target;
     - the people and accounts the step names, with ids where held, capped at 50 per list with a count of the rest.
   - Lines the package already says are skipped. Nothing is invented. An AI Info the package did not produce is not created.
   - Runtime paths and gaps are mapped in `AI-COVERAGE.md`.
4. **Emails and verification.**
   - The registration step separates reading settings back (a configuration check) from testing the registration steps with a test account (the workflow check). It says report-only results may not show registration attempts.
   - Seven Emails no longer describe planned or unverifiable work as done: device code, legacy auth, admins, MFA for everyone, guests, shared devices and Security Defaults.
   - The guest creation Email keeps its reader and trigger.
   - Sign-out and delete wording was not touched. `SECURITY.md` already separates Sign out from Forget this tenant.
5. **Limitations** are listed below.

## Checks (logs in `../logs/fg/`)
| Check | Exit | Result |
|---|---|---|
| Type check (`k-tsc-4.txt`) | 0 | no output |
| Full suite, first run (`k-full-1.txt`) | **1** | 2795 tests · 2785 pass · 8 fail · 2 skipped |
| Full suite, final (`k-full-2.txt`) | **0** | **2795 tests · 2793 pass · 0 fail · 2 skipped** |
| Registry, library index, home regeneration (`k-registry-2.txt`, `k-library-2.txt`, `k-home-1.txt`) | 0 | consistency asserted by `library.test.ts` and `home.test.ts` in the full suite |
| Build (`k-build-1.txt`) | 0 | chunk-size warning only |
| Content matrix vs previous batch (`k-matrix-1.txt`, `.diff`) | 0 | 3 rows change, all the session create in curated demo variants: preview (waiting on `excludeUsers`) → executable. No other channel change |
| Acceptance controls (`k-acceptance/`) | 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR |
| PowerShell parse only, rendered session scripts (`ps-ast-7.txt`, `ps-ast-51.txt`) | 0, 0 | PowerShell 7.6.6 and 5.1.26100.9444: 8 parses each, 0 errors. `ExcludeUserIds` folds to `[]` or to the exact ids |
| Responsive probe on built site (`k-probe.txt`, `.json`) | 0 | overflow 0 canonical and 0 production at every measured width, 1280 to 390 px |
| Change-scope lock, `1e2174dd..aaba6d4` | 0 | OK |

**The eight first-run failures, and the fix for each:**
- **Three tests pinned the empty-list defect itself** (`bindingInventory`, `previewExportNote`, `sessionLifetimeUnmanaged`). Each now asserts the corrected behaviour.
- **Three content-spec tests compared the whole AI Info to the package's words.** They now compare those words exactly and also require the facts section.
- **One source-shape pin** (`pilot`) was updated to the new call.
- **One vocabulary rule** caught my "Included users" label, now "Included people".
- **The same diagnosis added a cap:** long name lists are limited to 50 per list, so the briefing is never a thousand-name dump.

**Environment limitations:**
- The walk and smoke tests did not run locally; CI runs both. Their text pins for the Connect heading were updated.
- The probe measures page layout; it does not open a step's AI Info tab.
- No authenticated Microsoft session, no tenant, no live Graph call and no script execution.

## Before and after AI Info (synthetic samples)

"Before" is the package's own text. This batch did not change these packages' AI blocks, so it is exactly what the tab drew at `1e2174dd`. "After" is that text followed by the facts. Full text is in `../logs/fg/ai-before-after.txt`.

**Dormant Accounts, `demo` (a check, 3 accounts).**
- Before, the whole briefing was: "Review the dormant accounts IAMAI lists: … For each, help decide between disabling it, confirming it is in use … or blocking sign-in …". The assistant never saw which accounts.
- After, the same words, then:
  ```
  IAMAI FACTS FOR THIS STEP
  What follows is what IAMAI observed in this tenant's latest scan and what its plan proposes. It does not confirm that any change has been made.
  Disable or Confirm Dormant Accounts.
  Nobody has signed in to these accounts for 90 days, or ever; …
  Ready · Create
  Who this touches: 3 accounts
  What to do: … | Done when: … | If it goes wrong: …
  Accounts IAMAI observed:
  - MFP Reception · Mar 30, 2026 (id 000003eb-4887-48c4-8161-533e5b94cb54)
  - Sasha Walker · Nov 16, 2025 (id 000003f0-93f3-4f86-8685-438259635b32)
  - Kai Nguyen · May 16, 2026 (id 00000406-ff75-4933-8ea7-66c0eff29542)
  ```
- On the contrasting `messy` tenant, the same step lists its own 14 accounts.

**Block Legacy Authentication, `demo` (an enforced policy owed a correction, on hold).**
- Before: the package's correction text and "This change removes Core - Break glass from the policy's exclusions …". There was no policy id, no state and no reason for the hold.
- After, the same words, then:
  ```
  IAMAI FACTS FOR THIS STEP
  …
  On Hold · Baseline references an unmapped group
  Fix before continuing: Map the baseline's reference under Plan settings, Baseline mappings, … | Finish Create or Correct Emergency Access Accounts first.
  Done when: The policy is enforced and matches the baseline: …
  Policies IAMAI tracks for this step: Core - Block - Legacy authentication: Enforced, watched since Aug 28, 2026
  Current tenant policy: Core - Block - Legacy authentication (001e8481-136a-4fc6-87c0-08deaccfec22)
  Current state: Enforced
  Fields that differ from the target: conditions.users.excludeGroups
  Exclusions the correction removes: Core - Break glass
  Intended target:
  - Policy name: Core - Block - Legacy authentication
  ```

## UI preservation and output availability
- **Unchanged:** components, routes, navigation, tabs, controls and page contracts, and every policy target, operation and payload apart from the session exclusion fix.
- **More text:** AI Info carries the facts section. Some public and Email sentences changed.
- **One availability change, intended:** where the session target is settled with no excluded accounts, the create moves from a non-copyable preview to executable in all four channels.
- **No channel removed or added:** AI Info with facts only appears where AI Info already appeared. In the coverage inventory, 0 AI Infos were drawn without facts, and unavailable states are unchanged.

## Remaining limitations

**PowerShell modes still unavailable (item 5):**

| Package · mode | Why it is unavailable | Accurate alternatives | Needed to enable |
|---|---|---|---|
| PIM activation reauth · `EnforceCA` | The script enforces only with `-ReadinessApproved`, an attestation with no package prerequisite IAMAI can check | Entra `entra.enable-ca`, JSON `json.policy.enforce` | A checkable readiness prerequisite binding, and tenant validation of the authentication context |
| PIM activation reauth · per-role JSON (`json.pim.auth-context-rule`) | It repeats a request per role-management policy id, a shape the runtime does not project | Entra and PowerShell guidance for PIM settings | A supported multi-request shape, such as the guarded batch used for guests, plus validation against real PIM policy ids |
| User risk (high) · `Enforce` | It needs `-ReadinessApproved`, `-MfaRegistrationValidated` and `-GuestExternalScopeValidated`, and `-HybridUsersInScope` is a tenant fact IAMAI does not bind | Entra `entra.enforce`, JSON `json.enforce` | Checkable prerequisites for MFA-registration coverage and guest scope, a hybrid-user binding, and tenant validation |
| User risk (medium) · `Enforce` | It needs `-MfaRegistrationValidated`, and `-HybridPasswordWritebackValidated` where hybrid users are in scope | Entra `entra.enforce`, JSON `json.enforce` | The same registration evidence, a password-writeback check, and tenant validation |
| Session lifetime · `Create` | It also writes the unmanaged-device companion, which the pinned baseline does not contain | `CreateBrowser`, available | None: `CreateBrowser` is the correct mode |
| Session lifetime · `Enforce` | It needs `-ReadinessApproved`, and it also turns on the absent companion | Entra `entra.enforce`, JSON `json.browser.enforce` | A browser-only enforce mode and a checkable readiness prerequisite |

No approval parameter is passed to make any of these available.

**Confirmed, still open:** none known in this batch's scope.

**Unverified follow-ups:**
- **Registration flow:** how report-only behaves for registration (user-action) policies in a real tenant is unverified. The guidance now states that boundary.
- **Unexercised AI Info states:** most policy packages' partial, report-only and ready-to-enforce AI Info are not reached by any sample plan (`AI-COVERAGE.md`), and 9 registered packages are not reached at all.
- **Readiness tiles:** the compiler still withholds readiness tiles for several packages, session lifetime among them.
- **`SPEC.md` §4** still says "values stripped; never phone numbers". It is internal specification, not public copy.
- **Tenant behaviour:** large-tenant performance and live Graph behaviour are untested.

## Public-preview recommendation
**Suitable for a clearly labelled public preview after owner approval of the wording, not as a production-ready release.**

The reasons:
- The known confirmed defects from the release review are fixed and tested:
  - R01, session lifetime;
  - R02, overbroad claims;
  - R03, AI Info grounding;
  - R04, the guest Email;
  - R05, the registration evidence boundary, as wording.
- The final gate is green: tsc, full suite, build, matrix, acceptance, PowerShell parse and layout probe.
- Nothing in the batch executes against a tenant.

Before publishing:
- The owner should approve `PUBLIC-COPY-REVIEW.md`, which includes the new Connect heading.
- CI should run the walk and smoke tests on the pushed commit.

The preview label is warranted because:
- the unavailable PowerShell modes above remain;
- live-tenant behaviour is unverified;
- AI Info is grounded on every drawn path but checked only in representative states.
