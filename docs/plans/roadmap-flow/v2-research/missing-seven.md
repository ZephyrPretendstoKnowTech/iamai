**Answer to C: no, not all seven.** Two are genuinely missing. The other five are left out for a reason, but none of those reasons is visible anywhere in the plan.

- **Genuinely missing:** RiskyUsers-RegisterSecurityInfo is a standing control with nothing like it in the plan. EAM High-Risk Users is needed on tenants that use an external MFA provider.
- **Incident-response kill switches:** the two ZTCA policies. The owner already decided on 19 Sep that they go in a "lockdown kit", which isn't built yet.
- **Already covered by plan steps:** the two passkey policies.
- **Conflicts with IAMAI's emergency-access design:** BreakGlass-TrustedLocations.

**Why none of them shows today (a defect, not a decision).** Two rules disagree about these policies:
- The goal map uses a strict rule and leaves all seven unclaimed (`src/coverage/goalIdentity.ts:171-179, 296`).
- The coverage check uses a looser pattern match (`src/coverage/coverage.ts:182-186`). All seven match some goal's pattern, so they are never listed as "not assessed" (`coverage.ts:210-212`).
- Review rows are built only from that "not assessed" list (`src/roadmap/workflows.ts:87-89`), so no row appears.

Two records say this was meant to be different:
- The owner decided on 2026-09-01 that the break-glass policy "becomes a not-assessed Cleanup row" (commit 3f4027c2; `src/baseline/validators.ts:26-29`).
- The pin report lists all seven as Cleanup rows (`docs/baselines/jhope188-conditionalaccesspolicies/90d9b890c4b9af2ac4bc02d97c06bf8900064b4c.md:85-99`).

The test at `src/coverage/baselineFidelity.test.ts:44-61` only checks how the goal map groups the policies, not what the plan shows.

I checked this with probes on the pinned 38-policy baseline, then deleted them. On small (P1), mid (P2) and huge (P2), the plan lists 6 policies as not assessed and shows 4 review rows. None of the seven is named in any step. demo gave the same result.

---

### 1. RiskyUsers-RegisterSecurityInfo (`768858bd`, pinned.json:1645-1692)
- **What it does:** blocks the "register security information" action for users at high or medium user risk. It applies to all users except the exclusions group, and is report-only. The README says it stops an attacker in a compromised risky account from adding their own sign-in methods, and that it needs P2 (`Updated/Documentation/IAC - P2 - GLOBAL - BLOCK - RiskyUsers - RegisterSecurityInfo/README.md:8` at 90d9b89).
- **Why it's left out:**
  - The strict rule never lets a block policy implement a grant goal (`goalIdentity.ts:124-127`). "Protect Sign-in Method Registration" is an MFA grant goal (`data/goals.json:346`). "Remediate Risky Users" needs all resources and a password-change grant (`goals.json:1169`).
  - No decision was recorded. The review table's notes column for it is "—" (`implementation-review-2026-09-19.md:114`).
- **Jon's intent:** a standing control, listed under his P2 policies (repo `README.md:254`).
- **Recommendation: build it as a step in v1.1** (about 2–3 h).
  - Put it in section 5, directly after 5.7 Remediate Risky Users, with its own title, e.g. "Block Risky Users From Registering Sign-in Methods". It needs Entra ID P2.
  - The work: a new goal, a re-pin of the goal map (an owner-approved event), and the `goalMap.test.ts:48` count going from 23 to 24.
  - Turn it on after 4.4 Require MFA for Everyone. A risky user with no method yet can't register one and needs an admin to clear the risk.
  - **v1.0:** a footer row until then.

### 2. EAM High-Risk Users (`bb6a814e`, pinned.json:1693-1747)
- **What it does:** covers only the external-authentication group (`8d0564e5`) at high user risk. It requires built-in MFA and risk remediation together, plus sign-in every time. Jon has it **enabled**.
- **Jon's intent:** a companion to High-Risk Users, for people using an external MFA provider (such as Duo) who can't satisfy the custom strength. The two groups must match exactly (README `…EAM - High-Risk Users - Risk Remediation/README.md:12-14, 63`).
- **Why it's left out:**
  - Its user scope is a group, not "all users" (`goalIdentity.ts:54-62, 175`).
  - Recorded as "External authentication customers only" (`implementation-review-2026-09-19.md:115`).
  - The owner approved retiring the external-methods Direction question (`v1-proposal-full.md:42, 296`; `v1-owner-review.md:8`).
- **Recommendation: v1.0 footer row. v1.1 (about 2 h):** add it as a second policy in 5.7, only when external methods are detected. The scan already reads this (`src/roadmap/direction.ts:128-129`), so keep that detection when the question is retired.
- **Not verified:** how 5.7 treats the external-methods group today (`interpretation.json:169-181`).

### 3–4. The two ZTCA AllApps policies (`2dd84b12`, pinned.json:2125-2190; `8417ec17`, pinned.json:2191-2236)
- **What they do:** block all apps for all users.
  - The Intune one blocks only devices that aren't compliant, domain-joined or registered, and only outside trusted locations.
  - The Global one blocks everyone except three groups.
- **Jon's intent:** incident-response kill switches, not standing controls.
  - His HEAD commit 8af3b118ad (2026-09-19) adds a disclaimer to both READMEs saying so.
  - His chat answer on 19 Sep says the same (`implementation-review-2026-09-19.md:201-206`).
- **Why they're left out:** no catalogue goal is a block on everything.
- **Owner decision:** "Prepare Your Lockdown Policies" becomes its own group at the end, created and never switched on (`docs/plans/v1-step-map.md:69-75`). It is low priority (`weekend-launch.md:35`) and not built. The Admin Portal block, the third ZTCA policy, is currently hidden (`src/ui/surfaces/customerPlanSteps.ts:5`).
- **Recommendation: v1.0 footer row** ("an incident-response kill switch, not a standing control"). **v1.1 (about 3–4 h):** build the lockdown kit with all three ZTCA policies and a runbook. One owner question is still open: create them in Report-only or Off (`v1-step-map.md:115`).

### 5. MFA-Passkey - UserRegistration (`30a1edce`, pinned.json:907-977)
- **What it does, as exported:** requires the custom strength for a pilot group registering a device (the register-device action, not register-security-info), on iOS only. The README says it is meant to protect security-info registration.
- **Jon's answer:** "That was a mistake… register info, not device" (`implementation-review-2026-09-19.md:214`).
  - His HEAD README is corrected (`readme-refresh-2026-09-19.md:61-65`).
  - The HEAD policy JSON is **not** corrected: it still has register-device (line 12) and iOS (line 46).
- **Why it's left out:** its scope is a group (`goalIdentity.ts:175`).
- **Already covered:** the corrected intent is 5.1 Protect Sign-in Method Registration (`src/roadmap/floor.ts:17`). The exported shape is a subset of 5.2 Require MFA to Register a Device.
- **Recommendation: leave it out, covered by 5.1 and 5.2. v1.0 footer row** naming 5.1.
- **v1.1 re-pin note:** Jon's corrected policy still won't map automatically. The 5.1 goal's template requires a location condition (`goals.json:346`; `goalIdentity.ts:97-98, 177`).

### 6. MFA-Passkeys - ADM-Users (`a53c4c2b`, pinned.json:978-1039)
- **What it does:** requires the "Modern MFA + TAP" strength on all apps for group `5f96c57d`. That group is confirmed as "all admin users", dynamic (`readme-refresh-2026-09-19.md:42, 101`).
- **Already covered:** MFA-AllAdmins, the policy behind 4.3 Require Phishing-Resistant MFA for Admins, uses the same strength (pinned.json:666). It targets admin roles instead of a group.
- **Why it's left out:** a group scope versus role scope (`goalIdentity.ts:56, 175`). Recorded as "Overlaps with MFA-AllAdmins" (`implementation-review-2026-09-19.md:47, 113`), and the plan was to drop both passkey groups (`readme-refresh-2026-09-19.md:7`).
- **Recommendation: leave it out, covered by 4.3. v1.0 footer row** naming 4.3.

### 7. BreakGlass-TrustedLocations (`1588fdc7`, pinned.json:507-577)
- **What it does:** targets one emergency account by user ID and excludes the other by ID. Outside Jon's trusted location it requires the custom strength, which includes TAP. It doesn't block. Jon's naming guide calls it "Breakglass policy for TOTP Account" (`README.md:213`).
- **Conflicts with IAMAI:**
  - Our rule is that emergency accounts are excluded through the exclusions group, never named.
  - Microsoft says to exclude emergency accounts from policies that restrict sign-in (https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#conditional-access-considerations).
  - The review recorded it as not implemented because IAMAI has its own four-step emergency access (`implementation-review-2026-09-19.md:148-151`).
- **Recommendation: leave it out, covered by section 1 Establish Emergency Access.** A **v1.0 footer row** also delivers what the owner decided on 2026-09-01.

---

**v1.0 build (decision C):** one footer group, "In the baseline, not in this plan", holding all seven.
- **Effort:** about 30–40 min: the list logic, content keys (new, say so in the commit), the section in `PlanFooter.tsx`, and a test that every pinned policy is shown somewhere. That is at or over the 30-minute bar. Adding the printed line is v1.1 (about 15 min), so screen and print differ until then.
- **Why not review rows:** switching `coverage.ts:210-212` to goal-map membership would turn all seven into manual review steps. `v1-step-map.md:94` replaces review rows with real steps.
- **Watch out:** a list built as "not in the goal map" also picks up the Countries NoExclusions variant, which the plan skips on purpose (`generate.ts:1067, 1571`). It needs an eighth reason or a filter.

**Draft reasons, which need the owner's eye:**
1. RiskyUsers: "Blocks people flagged as risky from adding sign-in methods. Needs Entra ID P2. Not in this plan yet."
2. EAM: "A version of Remediate Risky Users for people who sign in with an external MFA provider such as Duo. Only needed if you use one."
3–4. ZTCA: "An emergency lockdown switch for a major breach, built ahead and kept off. Not a day-to-day control."
5. UserRegistration: "Jon's export targets device registration on iPhones only, which he confirmed was a mistake. What it was meant to do is 5.1."
6. ADM-Users: "The same requirement as 4.3, aimed at a group of admin accounts instead of admin roles."
7. BreakGlass: "Limits one emergency account outside the office network. This plan keeps emergency accounts out of every policy instead (section 1)."

**Two other things I noticed:**
- `baselines/jhope188-conditionalaccesspolicies.interpretation.json:139-147` still says nothing names group `5628ad67`. The pinned EAM README calls it "Break-glass" (line 32), and `readme-refresh-2026-09-19.md:40` confirms it. This is outside the question.
- `C:\Dev\IAMAI-q-small` has uncommitted edits I didn't make, in `content.json`, `render.ts`, `notLicensed.ts` and its test, `PlanFooter.tsx` and `PrintPlan.tsx`. The footer group touches those same files, so build it after that change lands.

I wrote nothing tracked. The probes under `docs/qa/night/personas/` are deleted, and Jon's READMEs were fetched into the scratchpad only.