# V1 audit: the merged findings, ranked

Six independent passes (`docs/plans/v1-audit/pass1a–pass2c.md`) merged, deduplicated
and ordered. The pass files are kept whole; this document is the ranking, and every
row names the passes that found it so a disagreement can be traced back.

**Status:** passes 1 and 2 merged. Passes 3 (journey) and 4 (claim integrity) were
still running when this was written and are appended in §9 when they land.

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

*Appended when the journey audit and the claim-integrity pass land.*
