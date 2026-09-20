# V1 audit: the merged findings, ranked

Eight independent passes (`docs/plans/v1-audit/pass1a–pass4.md`) merged, deduplicated
and ordered: three over every Tasks Remaining card, three over every Implementation
Task and channel, one journey walkthrough, one claim-integrity pass. The pass files
are kept whole; this document is the ranking, and every row names the passes that
found it so a disagreement can be traced back.

**Status:** complete. Passes 1 and 2 are ranked in §1–§8; passes 3 and 4 are merged in
§9, including two of their findings that did not survive verification.

**How severity is judged** (`audit-method.md`): Nielsen 0–4 on frequency × impact ×
persistence, with one override — *anything that could lead an admin to build a policy
wider than intended, lock somebody out, or that overstates what IAMAI knows is a 4,
however rare it looks.*

**Verified independently** means I reproduced it myself against the current tree
before it went in this list, not that a pass asserted it. Rows without that mark rest
on the pass's own reproduction, which each pass was required to do.

---

## 1. Severity 4 — the policy-widening and lockout class

These are the only findings where the product could cause harm in a real tenant
rather than waste a reader's time.

### S4-1 · The Configure toggle is missing on two of seven conditions — **verified independently**

`conditionLines()` (`src/roadmap/portalLines.ts:198,237`) emits

> `Conditions → Locations → Include: Any location; Exclude: All trusted locations`
> `Conditions → Filter for devices → Exclude devices matching: device.systemLabels -contains "CloudPC" …`

with no `Configure: Yes`, while its five siblings — Client apps, Authentication
flows, Device platforms, sign-in risk, user risk — all carry it. A condition left at
**Configure: No** is not applied, so the policy reaches everything the condition was
meant to narrow.

**Reproduced:** 35 rendered lines, on `s-goal-register-info-protected`,
`s-goal-require-managed-device`, `s-goal-service-accounts-trusted-network` and
`s-goal-token-protection`, in the **Entra** and **AI Info** channels, across every
fixture.

**The precise shape of it.** The *authored* procedures are correct — they say
"set **Configure** to **Yes** … Left at **No** the network condition is not
configured". The fault is the **"Settings for This Action"** supplement that
`entraWithSettings` (`stepPackage.ts:419`) appends *underneath* that procedure from
the translator. So one screen states the condition twice, once correctly and once
without the toggle, and the supplement is the compact checklist an admin is likelier
to work from. The 2026-09-19 fix reached five conditions and missed these two.

**Fix:** one change in `conditionLines()` adding the toggle to both, plus four
authored blocks (§S4-2 below). Consequence sentences only where Microsoft documents
them — the owner's own recorded rule, which sign-in risk and user risk already follow.
**Effort: small. Blast radius: one function.**

*Found by 2A (F1, F2, D4, D6), 2B (pattern 3).*

### S4-2 · The `create` block names the toggle, the `correct` block drops it

Four authored blocks restate a toggled condition without `Configure`, in packages
whose own create procedure says it:

| package | block | condition |
|---|---|---|
| `s-goal-block-unsupported-platforms` | `entra.correct-conditions` | Device platforms |
| `s-goal-token-protection` | step 7 | Filter for devices |
| `s-goal-session-lifetime` | `entra.correct.unmanaged.*` | Device state |
| `s-goal-require-managed-device` | supplement | Network |

`s-goal-block-unsupported-platforms` is the worst: unconfigured device platforms on a
**Block access / All users / All resources** policy is the tenant, minus the
exclusions group. It renders in every fixture.

**Fix:** a `CONTENT.md` lint — any block naming a toggled condition must also match
`Configure` — which makes the class unrepeatable rather than fixing four instances.

*Found by 2A (F3, F4, F7), corroborated by 2B.*

### S4-3 · A card states a policy is live on a step that has no policy — **verified independently**

> check **`Enforced`** · completed checks `Report-only ; Ready to enforce ; Enforced`
> says *"This step has no policy for IAMAI to write in this plan. Scan Contoso Pty Ltd again to rebuild it."*

**Reproduced: 18 cards**, on `s-goal-block-device-code`, `s-goal-inforcer-mfa` and
`s-goal-guests-mfa`, **in every fixture including the shipped demo**.

An admin ticks "device code is blocked" off their list and has blocked nothing. IAMAI
asserts a tenant state it has not read — the one thing the product promises never to do.

**Fix:** with no policy member, draw no stage: check = the reason, completed = `[]`.
Never fall back to the last stage.

*Found independently by 1A, 1B, 1C and 2C — the only finding all four hit.*

### S4-4 · The check line means "the next stage" and "the current stage" in the same slot — **verified independently**

`policyTasks.ts` `title: satisfied ? here : next ?? here`. **Reproduced: 115 open
policy cards** whose check is a lifecycle stage word.

- `demo/s-goal-admins-phishing-resistant` — check **Ready to enforce**, state `Report-only · Blocked`
- `demo/s-goal-block-legacy-auth` — check **Enforced**, state `Needs correction / Enforced`, sentence *"Finish the steps this one waits on first."*

So **Enforced** appears over a policy sitting in report-only, and **Report-only** over
a policy never created, with nothing on the card marking which reading applies.

**Root cause, named the same way by all three tile passes:** the stage track outranks
the hold — the milestone is promoted to the check line regardless of
blocked / needs-correction / no-policy. Fixing this one line closes S4-3 and most of §2.

**Note against myself:** I extended this line earlier today when I added `card.check`.
I gave the open branch honest words and left the collision in place.

*Found by 1A, 1B, 1C.*

### S4-5 · "Completed checks" is the current lifecycle index redrawn, not a history

`stagesOf` marks every stage at or below the current index as completed. A policy
found **already enforced on the very first scan** lists all three stages as checks
somebody completed — with no date, no evidence and no actor. ~90 cards.

For the person who inherits a half-finished plan and must answer for it later, this is
the record of what happened, and it is fabricated.

**Fix:** `completed` from what the plan recorded, not from the current index; or drop
the list and say the stage plainly.

*Found by 1C (finding 2), 1A (§2.8 half).*

### S4-6 · A check that passes deletes its own evidence

`emergencyReadiness.ts` — `instruction: satisfied ? '' : direction ?? tile.note ?? ''`.
The moment a check passes, its note is blanked, and the notes that vanish are the
caveats:

> *"Mailbox licensing and business sign-ins are clues, not proof of dedicated use."*
> *"No office network is selected; location-based exceptions are not applied."*

~40 satisfied cards show a subject, a check and nothing else. The qualifier that made
the pass honest is exactly what is dropped.

**Fix:** one line. Highest benefit-to-effort ratio in the audit.

*Found by 1C (finding 4), 1B (pattern 3).*

### S4-7 · Connect says the scan is complete when a core source was only partly read — **verified independently**

`coreSections.ts:22` — `const READ = new Set(['ok', 'partial'])`.

A **partial** read of Conditional Access policies is counted as read, so Connect
reports complete and the plan is built from an incomplete policy list. Reproduced by
pass 2C on `small`: with one of three policies unseen, the enforced *Require MFA for
Everyone* flips to `not-deployed` — **the plan tells the admin to create a policy the
tenant already enforces.**

*Found by 2C.*

### S4-8 · The list of what could not be read is computed and then thrown away — **verified independently**

`src/ui/actions.ts:114`

```
unread: found.length > 0 ? unreadSources(result) : []
```

`unreadSources()` covers every config section and source and reports `partial` as
unread; `coreGaps()` covers only the core list and swallows `partial` (S4-7). So when
there is no *core* gap the whole unread list is discarded before it reaches the UI.
Pass 2C reproduced it with ten refused sections — all role reads, all method reads,
named locations, auth strengths — and Connect still said **complete**.

The two defects compound: S4-7 hides partial reads, S4-8 hides everything else.

**Fix:** compute `unread` unconditionally. One line.

*Found by 2C.*

### S4-9 · "No user impact" heads a dormant-account review — **verified independently**

**Reproduced: 8 cards**, `s-check-dormant-accounts`, every fixture. Satisfied, green
tick, no sentence, no action. It is `plan.impact.noUserImpact`, an Impact-**column**
word, reused as a card's check.

On a step titled *Disable or Confirm Dormant Accounts* it reads as IAMAI's assurance
that disabling these accounts hurts nobody. A dormant-looking service mailbox gets
disabled.

**Fix:** cards must not read `plan.impact.*`. State the evidence, or draw no people
card on a review step.

*Found by 1A.*

### S4-10 · Cross-channel divergence — `s-goal-session-lifetime`

The only package where the three channels build different policies, in four ways:

- Entra: *"The baseline has one session policy for this step"* · JSON ships **two**
  create bodies · PowerShell `'Create'` creates both. The second reaches **All users,
  All resources, every client app, every non-compliant device** and has **no pinned
  member** (`memberStableId: null`).
- Entra and AI Info defer to "the interval in the intended target"; JSON writes
  `{"type":"hours","value":12}` and PowerShell hardcodes `12` / `9`.
- `entra.correct.unmanaged.session` hardcodes **9 hours** in a package whose only
  pinned policy is 12.
- `entra.correct.unmanaged.missing` says *"using the **Policy B procedure** from this
  package"* — **no such procedure exists**; the phrase occurs once, in that sentence.

**Every other package agrees field for field.** Pass 2A compared 24, pass 2C compared
27 by a different method; both confirm the 2026-09-20 `s-goal-user-risk-medium` fix
holds and found no other divergence of this class.

*Found by 2A (D1, D2, D3), 2C (#2).*

### S4-11 · `s-goal-user-risk` — the Entra tab hedges a grant the other two always write

Entra: *"When Entra adds authentication strength, select …"*. JSON and PowerShell
**always** write `riskRemediation` + `authenticationStrength` under AND, and
PowerShell's `Assert-Canonical` throws without the strength. The same package's
`entra.correct.grant` states it flatly, so create and correct contradict each other
too. An admin following the Entra tab builds a weaker grant than the pin.

*Found by 2C (#1).*

### S4-12 · `s-goal-workload-identity-block` is named after the identity its own procedure forbids

Step title, task name and script header: *"Restrict the Entra Connect **Sync Account**
to Its Address"*. Its own Entra channel: *"Entra Connect Sync signs in as a user
account …, while Cloud Sync uses a provisioning service principal, and **only the
second can be this policy's target**."*

The owner already approved renaming this step for what the policy targets; the rename
has not reached the task name or the script header.

*Found by 2B (finding 1).*

### S4-13 · `s-verify-mfa` says both that IAMAI holds the snooze value and that it does not

`entra.campaign` step 5: *"**Days allowed to snooze**: the value your organization
approved, between 0 and 14; **IAMAI does not hold one**."*
`entra.configure` step 5: *"Set **Days allowed to snooze** to the **IAMAI-resolved
{{campaign.snoozeDurationInDays}} day(s)**."*

One of the two is false about what IAMAI knows.

*Found by 2B (finding 4).*

### S4-14 · A licence requirement stated as fact on six packages

`ai.not-licensed`: *"IAMAI marks **Shorten Admin Sessions** as not licensed … **so
this policy cannot be created or changed until that license is in place.**"*

Sibling packages say it honestly — *"needs licensing that **this scan did not
confirm**"* — and `mobile-app-protection` adds *"A product bundle name alone does not
confirm the service plans this step needs."* Pass 2C also found the `notLicensed`
package state **is never entered at runtime**, so this content in 14 packages is dead
as well as wrong.

*Found by 2B (finding 5), 2C.*

### S4-15 · The blast-radius card is satisfied and exact on a tenant whose reads failed

`hostile`, every policy step (24 cards): *"34 active people · 2 admins · 1 guest ·
covers 40 enabled"*, satisfied, no caveat — while other cards on the same snapshot say
*"Account or role data not fully read"* and *"Missing scan evidence: sign-in records"*.

*Found by 1C (finding 5).*

### S4-16 · The security-defaults warning warns about the wrong direction

`messy`: *"once these policies exist you cannot turn security defaults back on"* — the
direction that does not block the admin. Conditional Access policies **cannot be
enabled while security defaults are on**, so the plan's own first move ("Create the
policy in Report-only") is impossible until they are off, and nothing says so.
*Microsoft currency not fetched — confirm before rewording.*

*Found by 1B (finding 4).*

### S4-17 · Two policies with different triggers draw an identical card

`s-goal-sign-in-risk` vs `-medium`, and `s-goal-user-risk` vs `-medium` (`mid`): the
same three cards down to *"246 active people · 13 admins · 12 guests"*, differing only
in the grey policy-name line. `CA - Require - Password change for medium-risk users`
forces a password reset on a wider population than its high-risk sibling and the card
says nothing about it.

*Found by 1A.*

### S4-18 · Readiness reported two ways in one scan

`Threshold` cards read **"68% MFA-ready"** on one step and **"not measured"** on two
others of the same scan (`small`, `mid`, `large`, `midflight`).

*Found by 1B.*

---

## 2. Severity 3 — the classes, not the instances

Ranked by how many cards each class touches. These are one commit per class.

1. **The one-sentence slot is empty on 71% of cards** — 582 of 815 have no sentence;
   89 have neither sentence nor action. *(1A)*
2. **The subject is a category, not a thing** — `Conditional Access policy` ×137, 26 of
   them naming no policy at all; the `tiles.*` content block is a list of categories,
   all drawn as subjects. *(1A P2, 1B P4)*
3. **The action slot holds a caveat, a fragment or a machine label** — *"after:
   Identify the Inforcer application"*, *"Policy scope awaits: …"*, *"IAMAI cannot
   prove unobserved enrollment workflows are safe."* The slot the anatomy reserves for
   what to do says what IAMAI cannot do. *(1A P3, 1B P5)*
4. **The step bar does not read the lane** — *"Complete the next task shown for each
   item."* over 120 held renderings, over a step with **no tasks**, and over 5
   deferred steps. *(1A P7, 1B P6)*
5. **One warning repeated per fragment instead of per procedure** — 48 Entra blocks
   carry it up to 4 times; 78 carry the removed-exclusions line. *(2B)*
6. **Duplicate cards** — same subject twice differing only in capitals (`Trusted
   network` / `Trusted Network`, `Authentication strength` / `Authentication
   Strength`), two byte-identical cards on `s-prereq-allowed-countries` (hostile),
   two `Prerequisites` cards indistinguishable. *(1A, 1B)*
7. **Hardcoded numerals in conditionally-assembled fragments** — numbers jump 2 → 6
   across 6 packages. *(2B)*
8. **Step title reused as task name (17), email subject (58) and script header.** *(2B)*
9. **`{{x}}` is not JSON-escaped** — a display name containing `"` yields an
   unparseable body; 5 blocks. *(2C)*
10. **Blade names drift with authoring date** — three spellings of Locations/Network,
    two paths for Account enabled. *(2A P5)*
11. **The directory role is named on 5 of 346 Entra blocks.** No CA create block names
    Conditional Access Administrator; the PIM block never names Privileged Role
    Administrator. Emergency Access names it every time. *(2A P6)*
12. **Unknowns stated honestly then abandoned** — 28 *"Affected people · Not
    established"* with no way to establish them. *(1B P8)*

---

## 3. What the audit says to delete

The cheapest fix available, and the method says to prefer it.

- `ai.blocked` on ~20 policy packages — the step card already says it. *(2B)*
- `email.enforce` on the 12–13 packages where it is **byte-identical** to
  `email.rollout`. *(2B, verified by diff)*
- The duplicated `whyItMatters` key in 24 of 46 readiness blocks. *(2B)*
- The five `entra.correct.unmanaged.*` blocks in `s-goal-session-lifetime` (S4-10).
- `notLicensed` package content in 14 packages — the state is never entered. *(2C)*
- The `Conditional Access policy` card on `s-goal-admin-portals-protected`: one word,
  no sentence, no action, over a card that already explains the hold. *(1A)*
- The unused device-plan reason and tile words (already recorded by the owner).

---

## 4. Frozen — recorded, never applied

The four Establish Emergency Access steps and the four Direction steps. 1A found 7,
1B found 9 (one a severity 4), 1C found 8, 2A found 3. These belong in
`docs/plans/frozen-step-suggestions.md` and are not in scope for any fix pass.

The one worth the owner's eye: **1B's severity 4 against a frozen step** — see
`pass1b.md` FROZEN section.

---

## 5. Owner decisions this audit surfaces

1. **`s-goal-user-risk-medium` vs Microsoft.** All four channels now build `Require
   password change` **and** an authentication strength under "Require all selected
   controls". Learn says *"Require password change can't be used with other
   controls."* The pin wins by rule — but the step never says Microsoft's guidance
   differs, so an admin meeting Entra's refusal has no guidance. *(2A F9)*
2. **The pin records one authentication-strength id (`42de22a7…`) with two different
   `allowedCombinations`** — one of them lets a **multi-use TAP** satisfy every admin
   policy using that strength. Baseline data, not content. *(2A F13)*
3. **Four packages claim baseline authority for goals the pin does not hold**
   (`mobile-app-protection`, `unmanaged-browser`, `azure-management-mfa`,
   session-lifetime's `unmanaged` member). Delete for V1, or make each say the pin
   holds no such policy. *(2A P7)*
4. **Eight packages name no resolvable pinned member**, so no channel-vs-pin
   comparison is possible there. *(2C)*
5. **`s-prereq-per-user-mfa`'s check word.** "Still enforced" overstates a preview-only
   read; "Not in place" inverts (the states *are* in place — that is the problem).
   Neither is right. *(1B finding 5, against wording landed 2026-09-20)*

---

## 6. What the audit found sound

Worth recording, because a list of only faults misrepresents the product.

- **Cross-channel agreement holds everywhere but one package.** Two passes, two
  independent methods, 24 and 27 packages: Entra, JSON and PowerShell build the same
  policy on population, exclusions, resources, every condition, grant, operator,
  session and state.
- **No channel contradicts a pinned field.**
- **The no-P1 tenant is handled well** — explicit header line, 21-row Not licensed
  footer, the free-tier ladder.
- **The empty tenant does not crash and prints no empty-denominator percentage.**
- **A plan file from the wrong tenant is caught before anything persists**, with clear
  copy and a baseline-source check.
- `demo/s-goal-admins-phishing-resistant` is the one non-Emergency card in 815 that
  meets the owner's bar in full.

---

## 7. Coverage, and what no pass could check

- 274 step renderings, 815 cards, 947 authored channel blocks, 27 packages compared
  field by field, 10 Microsoft Learn pages fetched and dated 2026-09-20.
- **Not covered:** rendered layout at width (no pass ran the site, the walk or smoke);
  the live GetIAMAI tenant; PowerShell executed rather than read; the `micro`,
  `getiamai` and `huge` fixtures, which are absent from `tile-dump.txt`.
- **Two registry steps build in no fixture** (`s-goal-workload-identity-block`,
  `s-ladder-phone-access-restriction`), so nothing verifies how they render — the
  earlier audit's §2.9, still open.
- **The Verify Emergency Access cleanup row builds in no fixture either**, so one of
  the eight frozen steps has no card to audit.

---

## 8. Recommended order, if the owner wants one

1. **S4-8 then S4-7** — two lines, and together they restore the product's central
   promise on a tenant whose reads fail. A public beta meets this on day one.
2. **S4-1** — one function, closes the policy-widening class at the source.
3. **S4-4** — one line; closes S4-3 and most of §2 with it.
4. **S4-6** — one line; restores the caveats on ~40 satisfied cards.
5. **S4-2** — the lint, so the Configure class cannot come back a third time.
6. Everything else by the table above.

Items 1–4 are four lines of production code and would be the highest-value hour in
this audit. They are not started: the owner ranks this list first.

---

## 9. Passes 3 and 4

Both landed. `pass3.md` (journey, 22 findings) and `pass4.md` (claim integrity, 15)
are in `docs/plans/v1-audit/`. Their severity-4 material, merged into the ranking
above, is below. Two of their findings did not survive verification and are recorded
as such rather than deleted.

### S4-19 · WITHDRAWN — the plan's one date is deliberate, and I ranked it wrong

**This finding does not stand. I raised its severity on my own judgement and was
wrong; the correction matters more than the finding did.**

What the pass observed is true: every `createReportOnly` in every fixture lands on
`2026-08-31`, and the only future date in the step snapshots is that day. What it
concluded from that is not.

**Creating every report-only policy on one day is the design, and the reasoning is
recorded in `schedule.ts` with its own history:** a report-only policy affects nobody,
so it consumes no enforcement window and is not subject to the weekly cap. Because
every policy exists from that day, **every observation window runs concurrently** — the
enforcement tail does not pay for observation N times over. It used to create them a
day later and that was corrected precisely because it credited each window with a day
its policy did not yet exist.

**The plan's length is not one day and does scale**: `schedule.weeks` is 1 on `demo`,
2 on `mid`, 4 on `large`. The pass read `reportOnlyAt`, which is one day by design, and
the step snapshots' rail, where a *held* step reads "After prerequisites" rather than a
date — so the sample looked flat because the foundation gate holds most steps, which is
the owner's own rule working.

**"3 weeks · estimated rollout" is honest.** It is `planWeeks` (`derive/finish.ts`) —
the plan's own computed length — and the word *estimated* is applied by the code
exactly when the plan cannot yet commit to a finish. It is not a marketing figure over
a one-day plan.

**What remains, and it is small:** `schedule.weeks` and `planWeeks` are two numbers
measuring different things (the band preset, and the derived finish) and can differ on
one screen. Severity 1, and only if a reader ever sees both.

**The lesson for the rest of this list:** I promoted this to a 4 on the strength of a
strong-sounding pass summary without reading the producer. Every other rerank in this
document is the pass's own severity, not mine.

### S4-20 · Security defaults block the plan's own first move, and nothing says so

`messy` has `securityDefaults: [{isEnabled: true}]` and ~30 Conditional Access steps
offered. `s-prereq-security-defaults` is **On Hold**, behind a step that is itself On
Hold. Microsoft Learn, checked 2026-09-20: *"Organizations that choose to implement
Conditional Access policies that replace security defaults must disable security
defaults."*

So every CA step on the Ready tab is impossible until a held step completes, and no
surface says it. This is the same defect as **S4-16** seen from the journey rather
than from the card; they are one fix.

*Found by 3 and 1B independently.*

**Resolved 2026-09-20 — the copy, not the graph.** Verified against Microsoft
Learn on 2026-09-20: https://learn.microsoft.com/entra/fundamentals/security-defaults
(page updated 2026-07-01) says under *Disabling security defaults* —
"Organizations that choose to implement Conditional Access policies that replace
security defaults must disable security defaults" — and "After administrators
disable security defaults, organizations should immediately enable Conditional
Access policies to protect their organization." The report-only page
(https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-report-only,
updated 2026-06-01) still contains **no** sentence about security defaults, so
the playbook's V3 resolution stands: report-only *creation* is not restricted by
first-party documentation and the `sd-enabled` gate stays on `enforce`.

So the plan's sequencing — build the four replacements in report-only, turn
security defaults off, enforce them the same day — is what Learn describes, and
`s-prereq-security-defaults` being On Hold behind its replacements is that
sequencing working, not a deadlock. The audit's stronger reading ("every CA step
on the Ready tab is impossible") does not reproduce: on `messy` exactly one CA
goal is Ready, and it is Ready · Decision, not a create. What was genuinely wrong
was the step's own lead, which named only the direction that blocks nobody. It
now names both, and says which one the plan waits on.

### S4-21 · A tenant with no Entra ID P1 builds a full plan — the strongest structural finding

`coreGaps()` refuses to build a plan when Conditional Access policies, users or the
sign-in log could not be read. Pass 4 calls this a genuinely strong guard and killed
several of its own candidate findings on it.

**But it exempts a licence gate.** A tenant with no P1 therefore builds a complete
plan, and **no fixture covers that state** — `micro` writes `status:'insufficient'`
where the worker writes `'disabled'`, so the case has never been rendered. Correcting
that one field made **five overstatements fire at once**.

This is the day-one public-beta case, and it is untested. It compounds with S4-7 and
S4-8: the guard that would have caught it is the same one that swallows `partial` and
whose unread list is discarded.

*Found by 4.*

**Fixed 2026-09-20.** `micro` now carries the shape `worker.ts` leaves a no-P1
tenant — `signInEvidence` and `registrationDetails` `disabled` with the worker's
own licence sentence, `users` `partial` with `collectUsers`' sentence, no
`signInActivity` on any row, no records, no aggregates — and `micro` joined the
step-snapshot corpus, so the free-tier tenant is a committed, diffable record.
Four of the five overstatements are fixed (pass 4 findings 1, 2, 5, 13, and the
MFA Readiness half of 4); `derive/sets.ts activityKnown()` is the one reading of
"was this person's activity read at all", taken by both `notActiveUsers` and
`scoring/fromSnapshot.ts`.

**Three items the fixture exposed are still open**, all needing one file
(`src/roadmap/manualWork.ts`) that was reserved by another change:

1. **`evidenceRead` (`manualWork.ts:171`) treats a licence gate as unread.**
   `if (snapshot.sources.users?.status !== 'ok') return false`. Without P1 the
   directory read is `partial` forever, so every manual review on a free-tier
   tenant reads `verification: 'unread'`, keeps `confirmedAt: null`, and **can
   never be completed** — the plan is unfinishable on the day-one case. It should
   exempt a licence gate the way `coreSections.ts:39` does (`status === 'partial'
   && isLicenceGate(reason)`). Red test: `src/roadmap/structuralCorrections.test.ts`
   "guest review can finish while keeping guests".

2. **`manualWork.ts:274` reads "active" as "enabled".**
   `const activeIds = ids.filter(id => snapshot.users.find(u => u.id === id)?.accountEnabled)`
   — the ADMIN_SEPARATION branch eight lines above does it correctly against the
   active-people set. On `micro` this gives `s-ladder-global-admin-count`
   `population.active = 3` over a tenant whose active count is 0. Red tests:
   `src/derive/agreement.test.ts` "one denominator" and "micro: Today's tiles …".

3. **"0 active people" beyond MFA Readiness** (pass 4 finding 4) is unfixed on
   Connect's meta row (`content.json` `pages.connect.meta.people`), the Plan
   header (`content.json:3991`) and the ~15 step `who.lead` keys that render
   `{active} active people`. Each prints a counted zero where the scan took no
   count. The one-source fix is a `PeopleCounts` field for the people whose
   activity was not read, and a rendering per surface; it is a change of shape,
   not of wording, and it is not started.

### S4-22 · Nobody is named on anything

`StepDecision = { picked?, option?, answers?, at }` and `OwnerConfirmation = { at,
basis, … }`. Only a timestamp. Every decision, confirmation and completed check in the
plan is anonymous.

The inheritor scenario exists to find this: a person who must answer to an auditor six
months later has a plan full of ticks with no name against any of them. Pair it with
**S4-5** — completed checks fabricated from the current lifecycle index — and the
record is neither attributed nor true.

*Found by 3 and 1C independently.*

### S4-23 · MFA Readiness asserts a cause with no status check

`readinessCells.ts:137`: *"Nobody can be seamless yet: everyone signs in from a device
with no built-in option this tenant allows, such as a personal computer."* — rendered
with `counted = 0` and **zero device records**, one line under *"Readiness can't be
measured for {cohort}…"*. The sentence explains an absence the product has just said
it cannot measure.

*Found by 4.*

### S4-24 · The export loses every qualifier the screen keeps

`stepExport.ts:231` — `who: contract.who?.text ?? null`. Screen and print agree
throughout; the export drops the evidence lines. No print artifact states a source
failure, and the covered sign-in window reaches no export at all.

The comment at `whoBlocks.ts:18-21` asserting screen/export parity is **false**:
`whoEvidenceLines`' only non-test caller is the screen.

*Found by 4.*

### Unknown rounded to known — eleven sites

Pass 4's §2 lists them in full. The ones that reach a number a person acts on:
`notActiveUsers` and `sets.ts:172-180` rounding **"activity not read"** to
**dormant** — 10 of 10 users — under the instruction *"Disable it: … Account enabled:
No."*; `rolloutBucket` discarding the `activity: 'unknown'` that `mfaViability`
models correctly, producing **"0 active people"** on Connect, the Plan header and MFA
Readiness; and the dormant step's population overwritten at `generate.ts:2511`,
undoing what `generate.ts:1121` deliberately set. That last one is **S4-9** from the
other side — the same card, found by two passes on different evidence.

### Two findings that did not survive verification

The method says reproduce or drop, and it applies to the passes too.

- **Pass 4's finding 3 — dropped.** It claims the new `notInEntra` office-network
  answer is indistinguishable from `remote` at `generate.ts:1042`, giving *"Trusted
  Network — Everyone is remote"*, outcome `pass`, step In place. Run end to end
  through `legacyDecisionsOf` → `applyStepDecisions` → `runFixture`: `remote` gives
  satisfied `true` / *"Everyone is remote"* / `pass`; `notInEntra` gives satisfied
  **`false`** and no finding at all. They are distinguishable, because `notInEntra`
  leaves `wizardAnswered.trustedLocations` false.
- **The real defect next to it — kept, severity 2.** `notInEntra` produces **no
  configuration finding**, so on the step itself it is indistinguishable from *not
  having answered*. The person answered the question and the step does not
  acknowledge it. This is a gap in the change landed on 2026-09-20, not in the code
  that preceded it.

### Pass 3's twelve "asks twice" items

Recorded in `pass3.md` and not re-ranked here; the headline is that `ANSWERED_IN`
routes three questions to Direction, so *Block Legacy Authentication*, *Block Device
Code Sign-in* and *Require MFA for Guests* each read **"Needs a decision"** while
drawing the answered-in panel instead of a decision form — and `demo`'s **Needs your
input** tile counts those three twice.

### What pass 4 found sound

`coreSections.ts`'s no-plan gate; `mfaViability`'s activity modelling; MFA Readiness's
Evidence-read panel; `whoOf`'s refusal to write an unknown reach as a number;
`covers N enabled` travelling intact to all three artifacts; and the device-code line
*"…that does not prove nothing uses it"*, which pass 4 names as the model sentence for
the whole class.
