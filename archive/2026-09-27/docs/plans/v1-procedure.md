# The procedure to V1

Written 2026-09-19 with the owner. It covers how IAMAI goes from "Establish Emergency Access, MFA Readiness, Connect, Export, How and Home are done" to every step and the tool ready for a public V1. The plan is meant to be executed in parts, in order, and never skipped around.

---

## 1. Where we are, and why progress has felt slow

**Done, to the V1 standard:**
- **Establish Emergency Access (4 steps):** accepted live on 18 September.
- **MFA Readiness:** v3, audited and fixed on 19 September.
- **Connect, Export, How and Home:** in place. Their connections to the rest get checked in phase 4.

**Not done:** about 35 other step kinds.
- Policy goals.
- Tenant decisions.
- The objects policies need.
- The MFA campaign and cutovers.
- Account hygiene.
- Cleanup rows.

**Why.** Since 1 August there have been 958 commits: numbered prompts, correction batches, content reviews and audits. Nearly all of them worked *horizontally*, touching every step for one concern at a time (content, lanes, tiles, bars, exports). Each pass improved something everywhere and finished nothing anywhere. Decisions were often made mid-implementation, so later passes reopened earlier ones.

Emergency Access is the exception. It was taken *vertically*, as four steps:
1. designed as one outcome;
2. decided with the owner before building;
3. built;
4. verified on a real tenant;
5. then left alone.

It is the only part that feels finished.

**The one rule of this plan:** from here, work is vertical. A group of steps is designed, decided, built, verified and frozen before the next group starts. A frozen step is reopened only for a real bug or an external change (Microsoft or the baseline), never for design, order or function.

---

## 2. Platform or redesign? Keep the platform, redesign the steps

**Keep** (the platform, mostly right, months of hard-won work):
- **Collection:** the Graph reads, the evidence lanes, targeted reads, schema 10.
- **The pinned baseline pipeline:** pin, interpretation, goal map, translator.
- **The actionability engine:** dependency data, lanes, readiness gates, holds.
- **The content system:** `content.json`, implementation packages, the withholding compiler.
- **The design system and approved packs:** tokens, primitives, anatomy.
- **The test infrastructure:** fixtures, the semantic corpus, step snapshots, smoke.
- **Finished surfaces:** Emergency Access, MFA Readiness, Connect, Export, How, Home.

**Redesign** (every remaining step, from the ground up):
- What the step asks, what it checks, how it reads, and where it sits in the order.
- Its existing authored content and research are *input*: facts, links and wording to reuse where right. They are not a shape to preserve.
- The generic step template gave 35 steps that are each "fine" and none that are finished. The Emergency Access pattern is the template now.

**Rewrite where the platform fights the design.** Where a step's new design needs something the engine can't express, the engine changes. The known cases are hard-coded Emergency Access ids, answer storage tied to step ids, and the rail and heading literals in `ContentStep`. That happens once, in phase 2, as the Step Kit. It is never patched step by step.

---

## 3. The V1 standard (the bar every step must meet)

Taken from Establish Emergency Access. A step is V1-ready only when all of these are true.

1. **One outcome.** The step owns one result the admin can name ("the service accounts group exists with exactly these members"). Its checks belong to that outcome and to no other step.
2. **Decided before built.** An approved spec (§5) covers what it asks, what it checks, every piece of wording, and every edge case. No open decision remains; anything unanswered is settled by an explicit, recorded assumption.
3. **Completion from what the scan sees.** Done means the tenant shows it. The admin never ticks a box, except for the few things no scan can see: intent answers, and manual evidence such as a tested handover.
4. **Durable.** A re-scan reopens the step only when something real changed. An unread source suspends the result; it never fails it.
5. **Direction, not state.** Questions ask where the tenant is going. The scan pre-suggests the current state, and the admin can choose either way. Nothing is hidden on evidence alone.
6. **One anatomy:**
   - About this Step
   - Tasks Remaining (subject tiles: N checks remaining → the next check → one action)
   - Implementation Tasks (persistent procedures; Entra, PowerShell, JSON and AI Info where they apply)
   - Completion Criteria
7. **Words from content.** Every string comes from `content.json`, is plain, and is under the sentence limits. The same fact reads the same on the screen, in the export, in print and in the prompt pack.
8. **Safe by construction.**
   - Report-only first.
   - The emergency exclusions group on every policy.
   - Never a lockout path.
   - Never a write scope.
   - Strictness helped, never required.
9. **Correct against Microsoft.** Every technical claim is checked against current Microsoft Learn and dated in the spec: methods, user actions, strengths, licence needs.
10. **Verified four ways:**
    - unit tests for each acceptance item;
    - a snapshot of the rendered step;
    - the demo at desktop and phone widths;
    - a real tenant (GetIAMAI, report-only only).
11. **Signed off and frozen.** The owner accepts it live, and it is recorded in the step register (§7).

---

## 4. The phases

Each phase ends with something the owner can check. Nothing starts until the phase before it is signed off.

### Phase 0: Trustworthy foundation (1–2 sessions)
- Run type checking and unit tests on every push to main, without blocking the deploy. Since bb385cd0 a push runs no tests, and the suite went red unnoticed.
- Clear the 5 red tests: decide their three questions (Plan gate passkey usability, the unreachable hardening slot, the demo drill evidence format), or record them as known.
- Freeze the baseline pin (`90d9b89`) for V1. A re-pin during V1 work is a deliberate, owner-approved event.
- Fix `CLAUDE.md` so it describes the real CI and walk.

**Done when:** a push shows green or red the same day, and the tree is green.

### Phase 1: The V1 map (2–3 sessions; research and decisions, no code)
- **The step map.** Every current step kind gets a disposition, with a reason:
  - **keep** (redesign it);
  - **merge** into another step;
  - **split** into more than one;
  - **fold** into a policy's tasks, as objects the policy needs;
  - **defer** past V1;
  - **retire**.

  Candidates already known: fold the object-making steps (trusted network, countries, service accounts group, authentication strength) into the first policy wave that needs them; retire `cleanup-notAssessed`, the hidden travel step and the free-tier ladder; move Baseline mappings to "ignored by default".
- **The order.**
  1. Establish Emergency Access.
  2. Decide Your Tenant's Direction.
  3. The policy waves:
     1. Close the doors nobody should use.
     2. Protect admins.
     3. Protect sign-up.
     4. MFA for everyone.
     5. Where people sign in from.
     6. Devices.
     7. Risk.
     8. Sessions and hardening.
  4. Ongoing: account hygiene and Cleanup.
- **The applicability model.** Each step declares what makes it apply (a Direction answer, a licence, an object). An answer can skip a step, tighten it or reshape it.
- **Baseline assumptions.** A decision for each of Jon's open questions, taken as the most likely reading and recorded (see `docs/baselines/jhope188-conditionalaccesspolicies/implementation-review-2026-09-19.md`). His later answers only confirm or flip them.
- **Research:**
  - Microsoft's current guidance for each policy family: the SMS and voice retirement, passkeys by default, baseline scopes, authentication strengths for external users, the device registration action.
  - How comparable tools order a rollout.
  - Two or three real admins' walk-throughs of the current Plan, if they're available.

**Done when:** the owner approves one page listing every V1 step, its group, its order, what makes it apply, and what's deferred.

### Phase 2: The Step Kit (3–4 sessions)
Turn what Emergency Access built by hand into shared parts, so every later group is built from them.
- **One group registry:** key, words, ordered members, pinned, and the completion rule. This replaces the Emergency Access ids hard-coded across `planBoard`, `ContentStep` and `planLanes`.
- **The anatomy as components,** with its headings as content keys.
- **Subject tiles** and the "N checks remaining → next check → one action" pattern, generalised from Emergency Access.
- **Implementation Tasks as data,** reusing the Emergency Access task model.
- **The completion contract:** findings → pass/fail/unknown → step state, with re-scan durability built in.
- **An answer-storage alias table,** so moving a question never loses a saved answer.
- **The acceptance harness:**
  - a per-step test template (every acceptance item → one test);
  - a snapshot;
  - a demo check at two widths;
  - a live report-only check script.
- **The spec template** (§5).
- **Proof:** Emergency Access re-expressed on the kit with *no visible change*. Every existing Emergency Access test and snapshot passes unchanged.

**Done when:** Emergency Access runs on the kit identically, and the kit's parts are documented.

### Phase 3: Decide Your Tenant's Direction (2–3 sessions)
The first new group built on the kit.
- **Three steps, about 30 minutes, decisions only:**
  - Confirm What You Use;
  - Decide How People and Devices Sign In;
  - Decide Where People Sign In From.
- The scan pre-suggests; the admin adjusts and approves. For "what you use", the suggestion is the current state. For security direction, it's the baseline's recommendation, with the current state as context.
- Its answers drive applicability for everything after it.

**Done when:** it meets the V1 standard, and answering it visibly prunes the plan on the demo and on GetIAMAI.

### Phase 4: The connected core (2 sessions)
- Audit Home → Connect → Establish Emergency Access → Direction → MFA Readiness → Export and How as one experience:
  - hand-offs;
  - one number for one fact everywhere;
  - progress in the Plan header and on Connect;
  - dates never in the past;
  - desktop and phone widths;
  - print and export.
- Fix, then freeze.

**Done when:** a new admin can go from sign-in to a pruned plan with no dead ends, verified on the demo and on GetIAMAI.

### Phases 5.1–5.8: The policy waves (2–4 sessions each)
Each wave is one vertical slice, going through the per-step procedure (§6) together:

| Wave | Steps | Notes |
|---|---|---|
| 5.1 Close the doors | Block legacy auth, device code, authentication transfer, unsupported platforms | Exception questions come from Direction; a "no" tightens. |
| 5.2 Protect admins | Operator passkey → authentication strength → admins phishing-resistant MFA, admin sessions, admin portals, Azure management MFA, PIM re-auth (P2) | Decide multi-use TAP; Admin Portal with admin roles excluded. |
| 5.3 Protect sign-up | Protect sign-in method registration, Require MFA to register a device | Before the MFA push. Device setting caveat (Microsoft Learn). |
| 5.4 MFA for everyone | The MFA campaign (with MFA Readiness), MFA for everyone, MFA for guests, then the Security Defaults and per-user MFA cutovers as its tasks | The guest strength must be one external users can meet. |
| 5.5 Where people sign in from | Countries (folds the countries location), service accounts on the trusted network (folds the group and the trusted network), Entra Connect sync account | Applies per Direction. |
| 5.6 Devices | Require a managed device, Intune enrollment re-auth, mobile app protection, shared devices | Applies per the device direction. |
| 5.7 Risk (P2) | High and medium sign-in risk, high and medium user risk | Licence-gated. |
| 5.8 Sessions and hardening | Session length for everyone, token protection | Known app limitations stated. |

**Done when:** each wave is signed off live and frozen before the next starts.

### Phase 6: Ongoing and Cleanup (2 sessions)
- Account hygiene: dormant accounts, separate admin accounts.
- The Cleanup rows: Emergency Access follow-ups (harden, alert), naming, consolidation.
- The after-enforcement life: drift, re-scan after enforcement, enforced states.

### Phase 7: V1 release (2–3 sessions)
- **Full end-to-end runs** on three tenants: a clean one, a messy one, and an MSP-managed one.
- **Reviews:**
  - security and privacy (read-only, no telemetry, exports redacted);
  - accessibility;
  - performance at 25,000 users.
- **Surfaces kept in step:** Home, How and the public documents match what shipped; the SMS retirement card goes in as the launch hook, if approved.
- **Release checklist and launch.**

**Rough size:** about 30–40 working sessions. The waves are the bulk. Phases 0–4 (about 12 sessions) produce a coherent, shareable core, which could be a public beta, before the policy waves.

---

## 5. The spec template (one per step, reviewed once)

1. **Outcome:** one sentence the admin could say when it's done.
2. **Applies when:** the Direction answers, licence, objects and baseline source.
3. **Microsoft facts:** each technical claim with its Learn page and the date checked.
4. **Baseline reading:** Jon's policy, our interpretation, and any recorded assumption.
5. **What it asks:** decisions, with the suggestion source for each.
6. **What it checks:** each finding with its pass, fail and unknown meaning, the subject it's about, and the one action that fixes it.
7. **Tasks:** the implementation procedures per channel.
8. **Completion criteria.**
9. **Edge cases:** none of the thing, one, many, unread, partially enforced, changed after completion.
10. **Words:** every string, as content keys.
11. **Acceptance:** the numbered checks that become the tests.
12. **Mockup:** only where the anatomy needs something new.

---

## 6. The per-step procedure (the repeatable unit)

1. **Research:** Microsoft Learn, the baseline, the current step's content and code.
2. **Spec,** using the template, for the whole wave together.
3. **Owner review.** One session per wave: approve, or change the spec. Decisions end here.
4. **Build on the kit.** Only what the spec says.
5. **Acceptance tests,** one per acceptance item, plus a snapshot.
6. **Verify:** the demo at two widths; GetIAMAI report-only; export and print compared.
7. **Owner sign-off live.**
8. **Freeze:** record it in the step register. After this, only bugs and external changes.

---

## 7. The step register

`docs/plans/v1-step-register.md` (created in phase 1) holds one line per V1 step: its group and order, its state (not started, spec, approved, built, verified, frozen), its spec's location, and its sign-off date. It is the single view of how far from V1 we are, and it replaces counting prompts.

---

## 8. What changes about how we work

- **Vertical, not horizontal.** No more passes across all steps.
- **Decisions before code.** An open question stops the spec, not the build.
- **One wave per review.** Fewer, bigger owner sessions, each ending with every decision for that wave made.
- **Frozen means frozen.** A new idea for a frozen step goes on a post-V1 list, not into the step.
- **Every push tested.** Nothing finished can quietly break.
