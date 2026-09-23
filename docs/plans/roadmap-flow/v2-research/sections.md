**Recommendation: keep 8 sections and keep the §3 and §5 membership as proposed. Rename four sections, reuse four existing names, and consolidate nothing further.** Every candidate that would shrink §3 or §5 loses a gate, a report-only boundary or a Ready row, or it makes one step too demanding. The shrinking the owner wants mostly comes from decisions 5 to 7 already, plus decision 6 on tenants where everyone works remotely. A second probe script, `rf-probe2.ts`, was also written and deleted.

Paths are relative to `C:\Dev\IAMAI-q-flow` (a433ab41). "Proposal" means `C:\Dev\IAMAI\docs\plans\roadmap-flow\v1-proposal-full.md`. The counts come from a probe I wrote at `docs/qa/night/personas/rf-probe.ts` and deleted afterwards; `git status` is clean. It runs `runFixture` → `customerPlanSteps` → `boardOf` (`src/ui/surfaces/planBoard.ts:357`), maps each row to the proposal's Stage 2 membership, then applies Stages 3 and 4 (the Direction, countries and risk merges; Turn Off Security Defaults goes to Doesn't apply when it was never seen on; the trusted network goes to Doesn't apply when the office network answer is "remote").

## 1. Names

**Existing titles** (`docs/design/content.json:2773-2813`). In all ten, `completedTitle` is the same as `title`. None has been renamed since it was added (`git log -G'"completedTitle"'` finds only the four commits below).

| key | title | added |
|---|---|---|
| emergencyAccess | Establish Emergency Access (:2775) | db2d1070, 2026-09-19 |
| direction | Decide Your Tenant's Direction (:2779) | acfcfa7c, 2026-09-19 |
| closeDoors | Close the Doors Nobody Should Use (:2787) | 96147c5f, 2026-09-19 |
| protectAdmins | Protect Your Administrators (:2791) | 96147c5f |
| mfaEveryone | Turn On MFA for Everyone (:2795) | 96147c5f |
| whereSignIn | Control Where People Sign In From (:2799) | 96147c5f |
| devices | Require Healthy Devices (:2803) | 96147c5f |
| riskAndSessions | Respond to Risk and Limit Sessions (:2807) | 96147c5f |
| ongoing | Ongoing Checks and Cleanup (:2811) | 96147c5f |
| prepareObjects | Prepare the Groups and Locations (:2783) | 74a817b2, 2026-09-20 |

The earlier wave names are at `docs/plans/v1-step-map.md:55-65`, for example "Close the doors nobody should use" and "Protect sign-up".

**The convention they follow:**
- Title Case, starting with an imperative verb: Establish, Decide, Prepare, Close, Protect, Turn On, Control, Require, Respond, Limit.
- A technical object, 3 to 6 words.
- Two jobs may be joined by "and" ("Respond to Risk and Limit Sessions").
- The one exception is the catch-all, "Ongoing Checks and Cleanup", which is a noun phrase.
- Step titles use the same verbs (`src/roadmap/direction.ts:5-8`).

**Proposed titles** (`completedTitle` stays equal to `title`):

| § | Title | Source |
|---|---|---|
| 1 | Establish Emergency Access | Reused (:2775) |
| 2 | **Define Your Rollout Scope** | New (candidates below) |
| 3 | Prepare Accounts and Objects | New. A minimal edit of "Prepare the Groups and Locations", which no longer fits: after the countries merge, and on remote tenants, §3 holds no location. |
| 4 | Turn On MFA for Everyone | Reused (:2795). Security defaults are MFA for users and admins plus a legacy-authentication block (https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults), and §4 holds the four policies that replace them (proposal:170). Legacy authentication and device code are the two ways past MFA. If the owner prefers a new name: "Turn On the Core Protections". |
| 5 | Extend MFA Coverage | New. The proposal's "…and Respond to Risk" would name rows that no P1 tenant shows: §5 has no risk rows on any P1 run (see part 2). |
| 6 | Close the Doors Nobody Should Use | Reused (:2787). It is the proposal's own rationale: "block something nobody should legitimately use" (proposal:218). |
| 7 | Limit Sessions and Require Healthy Devices | Both halves are existing wording (:2807, :2803), in the section's own order (7.1–7.2 sessions first). If the owner prefers a new name: "Secure Devices and Sessions". |
| 8 | Ongoing Checks and Cleanup | Reused (:2811) |

That is four new titles against the proposal's five. The keys that retire are protectAdmins, whereSignIn, devices, riskAndSessions and prepareObjects.

**Section 2, three candidates:**
1. **Define Your Rollout Scope (recommended).** It names what the answers do: they decide which rows exist and which accounts are carved out (proposal:112, 123). It is technical, has no "Tenant's", and its verb already heads the step Define the Trusted Network.
2. **Confirm How Your Tenant Works.** It matches the section's own rule (proposal:112) and the way the scan pre-fills each answer for you to approve (`direction.ts:10-12`). But it repeats the verb of its first step, "Confirm What You Use".
3. **Set Your Rollout Direction.** The smallest change, and it keeps the wording "Waiting on your direction" (content.json:2825) consistent. But it keeps the abstract word the owner found flat.

With candidate 1 or 2, content.json:2825 is the only other place users see the word "direction", and it should change too (for example to "Waiting on your answers").

## 2. Rows in practice

All runs below are after the proposal's Stages 3–4, with Emergency Access and Direction settled.

| Scenario | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Rows |
|---|---|---|---|---|---|---|---|---|---|
| Full list in the proposal | 4 | 3 | 7 | 6 | 8 | 5 | 9 | 5+ | — |
| P1 getiamai, Intune on, strength not yet made, remote | 4 | 3 | 5 | 5 | 3 | 3 | 5 | 2 | 30 |
| P1 small, Intune on, strength not yet made | 4 | 3 | 6 | 5 | 3 | 4 | 5 | 3 | 33 |
| P1 demo (the Business Premium shape: Intune, hybrid, office network, 2 service accounts; pinned baseline) | 4 | 3 | 7 | 5 | 3 | 4 | 6 | 3 | 35 |
| P1 messy (security defaults on) | 4 | 3 | 5 | 6 | 3 | 3 | 3 | 3 | 30 |
| P2 mid (P1 and P2 licences), Intune on, strength not yet made | 4 | 3 | 6 | 5 | 6 | 4 | 6 | 3 | 37 |
| P2 huge | 4 | 3 | 5 | 5 | 6 | 3 | 3 | 3 | 32 |

How the scenarios were built:
- Fixture specs: `src/roadmap/fixtures/index.ts:1098-1122`. P2 licensing: :211-216. Only the demo derives through the shipped pinned baseline (:812); every other run was re-based on `pinnedPackage()`.
- The "Intune on, strength not yet made" variants add the Intune capability and apply `strengthMissing` (:130).

**§3 is heavy in practice.** It has 5 to 7 rows on every tenant and is the largest section on every P1 tenant.
- Five rows are always there: dormant accounts, separate admin accounts, your own passkey, the campaign and the authentication strength.
- The trusted network appears only when the office network answer is not "remote". That was only demo; every other run read "remote".
- The service accounts group appears only when 2.2 names service accounts (small, demo, mid).
- On a new tenant almost all of §3 is open at once: 5 of 5 on getiamai and 6 of 6 on mid.

**§5 is heavy only in the full list.**
- It is 3 rows on every P1 tenant: registration, device registration, guests.
- It is 6 rows on P2, after the risk merge.
- Five of its eight listed rows are P2-only or conditional, and Inforcer read Doesn't apply on every settled run.

The proposal's "your plan" row (proposal:276) shows §5 = 6, which is the P2 shape. It can't be reproduced from the getiamai fixture: that gives 30 rows today and 26 after the proposal on its own curated baseline, or 32 and 28 on the pinned baseline.

## 3. Consolidation candidates

| Candidate | What the admin gains | What is lost | Verdict |
|---|---|---|---|
| Fold Register Your Own Passkey into Prepare Your Team for MFA | One fewer row. The campaign's start is the passkey's only consumer (`dependency-data.json:455`), and the operator is already in the campaign's people on getiamai, mid, demo and messy (probe). | The follow-up list can mark any unready person, the operator included (`src/roadmap/followUp.ts:35-38`, `generate.ts:2611-2617`), so the operator's own proof would become waivable. Today it is a hard prerequisite nobody can mark away. It would also put a one-person check (`generate.ts:1326-1331`) inside the plan's longest step, together with its own registration troubleshooting (`docs/plans/protect-admins-spec.md:80-140`). | **No** (only possible with a new owner rule that the operator can't be marked) |
| Merge Dormant Accounts with Separate Admin Accounts | One fewer row. Nothing in the graph waits on either step. | Different people and different actions: dormant accounts / admins are 9/1 on getiamai, 14/6 on messy, 33/14 on mid. The merged step would complete only when the slower job does. The campaign reads the dormant rule (`generate.ts:2618-2623`), and the admin policies link to the separate-accounts step (proposal:370). | **No** |
| Move the service accounts group next to its consumers | Nothing net: rows move, they don't disappear. | It has two consumers: 4.1's turn-on (`dependency-data.json:1628`) and 6.4 (:1904). In §6, 4.1 would wait on a step drawn below it. In §4, an object sits in a policy section, against the owner's 2026-09-20 rule (`src/roadmap/stepGroups.ts:86-92`). In 2.2, it breaks Direction's rule that nothing changes in Entra (`direction.ts:1-3`, `docs/plans/step-redundancy-analysis.md:596`). | **No** |
| Move the trusted network next to its consumers, or fold it into 5.1 | Nothing. Decision 6 already removes the row on remote tenants. | It has four consumers across §5, §6 and §7 (`dependency-data.json:1700, 1916, 1760, 479`). Folding fails the one-reader test the countries merge rests on (proposal:294, 330), and the object would never be made if 5.1 were deferred. | **No** |
| Move the authentication strength into §4 or into 4.3 | Nothing net. | It is needed to create 8 policies in §4 and §5 (`dependency-data.json:1496, 2072`…). | **No** |
| Merge 5.1 Protect Sign-in Method Registration with 5.2 Require MFA to Register a Device | One fewer row. | Only 5.1 waits on the trusted network, on Configure Passkey Authentication (which turns TAP on) and on the campaign (:1700, :1724, :1736). Only 5.2 waits on the exclusions group and a source-group mapping (:1676, :2240). Their gates differ: 5.1 has a 75% threshold plus TAP, people without a method and the trusted network; 5.2 has a 74% threshold plus enrollment workflows (`docs/qa/step-snapshots/mid/s-goal-*.json` tiles). On demo, 5.1 is Ready · Create while 5.2 is On Hold, so one row would be half ready and half held. The merged step would carry two thresholds and six checks. An earlier audit already said keep (`step-redundancy-analysis.md:510-519`). | **No** |
| Move PIM (5.4) into §4, or fold it into 4.3 | One fewer row on P2 tenants only. | PIM's turn-on waits on security defaults being off (:861). Above 4.5 that is a wait on a step below it. Inside 4.3, Turn Off Security Defaults, which waits on exactly the four core policies (:527-563), would also wait on a P2-only policy. | **No** |
| Move risk out of §5, or fold guests into 4.4 | — | Risk would need a 9th section or a home that doesn't fit (proposal alternatives 8 and 9). Guests in 4.4 would make the security-defaults hand-off wait on guest readiness. | **No** |
| 8 sections to 7, by merging §5 and §6 | One fewer heading. | That section would be 6–7 rows on P1 and 9–10 on P2 (mid 6+4), the largest in the plan, and it would mix "require MFA" with "block". Merging §4 with §6 gives 8–10 rows and §4 stops being the four core policies. Merging among §1–§3 conflicts with their anatomy (`stepGroups.ts:17-32`) or with Direction's rule. | **No** |

**Is 8 too many?** 8 is the fewest sections where no section passes 7 rows on any run. After the first sitting, §1 and §2 collapse to one line each, so a working admin sees six open headings.

**A correction to the proposal.** Line 204 says 5.2 does not wait on the campaign. It does, through its readiness gate: on getiamai and mid (Intune on) the gate's route is Prepare Your Team for MFA, and the mid snapshot reads "when MFA readiness reaches 90% (now 74%)" (`docs/qa/step-snapshots/mid/s-goal-device-registration-mfa.json:4`). The order doesn't change, because the campaign is in §3.

**Housekeeping.** My two probes were deleted. Eight probes from earlier runs are still in `C:\Dev\IAMAI-q-flow\docs\qa\night\personas\`; they are not mine and I did not touch them.