# V1 resolution: making the machine agree with the words

What this closes: the V1 audit (`v1-audit-findings.md`, 24 severity-4 findings, 12
severity-3 classes) and the five simulated administrators who used the tool end to end
(104 defects, 23 of them severity 4). The two overlap heavily; this is the deduplicated
list, ordered by what it unblocks.

**The constraint (owner, 2026-09-21): no new tab, no new section.** Every item below
lands in a card, a task, a sentence, or a dependency edge that already exists. Where
something must appear earlier than it does, it is reordered, not added.

**The goal, stated precisely.** Four personas finish satisfied. **Jordan does not finish** —
he is stopped, and understands why. If the impatient admin still rates it 5/5 at the end
of this work, the safety claim has not been fixed.

---

## The one sentence under all of it

> **The prose is good. The machine underneath does not agree with it.**

Every persona praised the writing. Every persona was failed by a status word, a schedule,
a who-line or a dependency. That is what this plan repairs. It changes almost no prose.

---

## Phase 1 — The safety inversions

Nothing else matters until these are true. Each is a rule, not an instance.

### R1 · No step reads Completed while the evidence on its own card contradicts it
*Require MFA for Everyone* renders `Completed / In place` beside a card reading
**"6 active people"** on a 122-person tenant. The status word does not read the evidence.
**Rule:** a goal whose resolved population is a minority of enabled accounts cannot be
Completed, and the denominator (`covers N of M enabled`) renders in every state — today it
is suppressed in exactly the state that would expose the problem.
*Unblocks: Sam. Closes: audit S4-15, S4-18, persona Sam-1.*

### R2 · Enforcing early must not erase the emergency-access hold
Creating a policy **in report-only as instructed** leaves the step On Hold behind "Finish
Prepare Emergency Access Accounts first". Creating it **switched on** marks it Completed
and deletes the hold. The gate is erased by the act it guards against, and the board
rewards the dangerous path.
**Rule:** the emergency-access gate is a property of the tenant, not of the policy's
lifecycle. An enforced policy that skipped its observation window is not Completed; it is
a correction.
*Unblocks: Jordan (by stopping him). Closes: persona Jordan-1, Jordan-2.*

### R3 · Move the guard into the path people take
The PowerShell channel already hard-codes `enabledForReportingButNotEnforced` on create and
refuses enforcement on four named conditions. The JSON channel ships report-only with every
narrowing condition intact. **The portal procedure — the path a portal-fluent admin always
takes — has none of it**, and relies on one sentence in step 5.
**Rule:** whatever the script refuses to do, the portal procedure must refuse in words, at
the point of action, not as a preamble.
*Unblocks: Jordan. Closes: persona Jordan-3, Jordan-6.*

### R4 · A claim that cannot be filled says so
*"Nobody used a legacy protocol since Jul 29, 2026"* — two steps after the product named
three accounts that do. The who-line's variable was undefined and it **fell through to its
own negation**. Same mechanism behind the zero-guest tenant naming a real employee, and
the security-defaults step describing protections that are off.
**Rule:** an unfilled claim renders as "IAMAI could not resolve this", never as its
negation. Priya: *"I can work with 'I don't know'. I can't work with a confident 'no'."*
*Unblocks: Priya. Closes: audit S4-14, three of Priya's four severity-4s.*

### R5 · A stage is not claimed for a policy that does not exist
`factOf` returns "Enforced" from the lifecycle alone. On two steps with **no policy at
all**, the header still asserts Enforced. The card was fixed; the header was not.
*Closes: audit S4-3 remainder.*

---

## Phase 2 — Completion: the things that stop people

### R6 · The hardware is the step's first task, not a surprise at line 5
Two of five personas lost days to security keys the product never asks them to buy.
Marcus abandoned at *"Connect the approved YubiKey"*; Nadia lost three of eleven days.
**Change:** "Obtain two security keys" becomes the **first Implementation Task** on
Establish Emergency Access, with models and rough cost. Existing structure, reordered.
*Unblocks: Marcus, Nadia.*

### R7 · Passkey routing: Authenticator first, hardware where it is genuinely safest
**Owner, 2026-09-21.** Team and operator passkeys route to **Microsoft Authenticator**
first — everyone has a phone, no purchase, no lead time. YubiKey where available.
**Emergency access keeps the hardware key, and the step says why**: a break-glass
credential must not depend on one person's phone, and it belongs in a safe.
*Unblocks: Marcus, and removes a purchase from every path except break-glass.*

### R8 · Prepare Your Team for MFA comes off the passkey chain
It has no real dependency on break-glass passkeys, yet sits On Hold behind them for
Marcus's entire journey — the one step he is genuinely good at, and the only one that
moves the readiness gate every policy waits on.
*Unblocks: Marcus, Nadia, Sam.*

### R9 · State the difference
Seven steps say *"compare their assignments, conditions, access controls and current state
with the configuration listed on this step"* — and list no configuration. **Not one
sentence in 38 steps states a difference between an observed policy and the baseline.**
This caused 8 of Sam's 18 deferrals.
**The data already exists**: `coverage.ts` computes structured defects
(`conditions-narrower`, `apps-narrower`, `guest-types-narrower`) with sentences naming the
policy and the dimension. It is computed and never rendered on the step.
**Change:** render it on the card that already exists. Policy, field, tenant value,
baseline value, and whether the tenant's is narrower, broader or merely different.
*Unblocks: Sam. This is the single highest-value item for completion rate.*

### R10 · The security-defaults cutover is scheduled in the window its own words describe
The prose is correct and the best writing in the product: *"Turn them off on the day
Require MFA for Everyone enforces, and not before."* The schedule puts the step in wave 0
while the policies its Done-when names enforce a week later, and two of the four are never
scheduled at all. Following the dates gives forty people a week with no MFA.
*Unblocks: Nadia. Closes: audit S4-16/S4-20.*

---

## Phase 3 — Accuracy, then deletion

### R11 · One evidence join, one person
"Noor Nguyen" is flagged as an active legacy-protocol sender in one step and dormant-90-days
two steps away. One bad join produced three severity-4 outcomes: an overstated claim, an
exclusion wider than intended, and a proposed Block for an account that should not have one.

### R12 · Stop learning conventions from dead policies
The naming detector read 24 abandoned `Old - Disabled N` policies and now proposes 16 new
objects as `Old - …`, with the sentence *"which follows the convention your tenant already
uses."*

### R13 · Delete what cannot be reached or is duplicated
~20 dead `ai.blocked` blocks, 13 byte-identical `email.enforce` blocks, `notLicensed`
content in 16 packages the runtime never enters, the duplicated `whyItMatters` key in 24 of
46 readiness blocks. **Every one is surface that can be wrong and has to be maintained.**
Deleting serves the no-new-stuff constraint rather than fighting it.

### R14 · The severity-3 classes from the audit
71% of cards carry no sentence; the subject is a category not a thing; the action slot
holds caveats instead of actions; the step bar does not read the lane. One commit per class.

### R15 · A tenant that cannot use Conditional Access is told so, and gets no plan
**Owner, 2026-09-20: Entra ID P1 is the real minimum, and a half-baked opinion is worse
than none.** Today a tenant with no P1 still builds a plan — `coreGaps` returns empty and
ten steps are generated for a tenant that cannot create a Conditional Access policy at all.

**Rule:** a scan has three outcomes, not two. **Complete** → plan. **Gaps** → no plan,
"these sections could not be read with this account". **Not licensed** → no plan, and a
different message, because telling somebody to go and get more permissions when the real
problem is their licence sends them down the wrong road.

The free-tier ladder stays in the tree, dormant and reversible — the owner wants to
compare later, not delete now.
*Closes: a commitment made on 2026-09-20 and not kept.*

### R16 · The security review
Step 6 of `v1-audit-plan.md`, and the only pass that has never run. Its own session,
against the final tree, with an adversarial frame rather than a quality one: what a hostile
baseline file, a hostile tenant response or a malicious link in content could do; what the
export and the prompt pack leak; the Graph scopes actually requested; the CSP and the
absence of a server; what a stranger's tenant data touches on this machine.
**It runs last, against what ships, and it gates the public link.**

### R17 · Triage the persona defects one at a time
The five persona files hold **104 defects**; the rules above name about twenty. Most of the
remainder fold into a rule, but nobody has checked which. Walk `*-defects.md` and mark each
row: closed by rule N, still open, or not reproducible. **A rule that closes nothing is a
rule written for a defect that was never there.**

Also outstanding and unowned: 40 of 42 package `META.json` files record a stale
`baselineAuthority.pinCommit` (a second source for the pin); two registry steps build in no
fixture, so nothing verifies how they render; and `micro`, `getiamai` and `huge` are absent
from the card dump.

---

## How we know it worked

The harness is the acceptance test, and it is repeatable:

1. **Re-run all five personas** against the fixed tree.
2. **Four must reach the end**: Marcus builds policies, Sam defers fewer than three steps,
   Nadia completes the cutover, Priya's trust ledger has no severity-4 entry.
3. **Jordan must be stopped**: he cannot enforce without the observation window, cannot
   erase the emergency-access hold, and cannot produce a tenant-wide block from a default
   toggle. His rating should fall, and that is the success condition.
4. **No new tab or section** exists that did not exist before.
5. **Smoke and the walk run against the no-P1 fixture**, which neither has seen.
6. **The security review has run** against the tree that ships.

---

## Sequencing

Phase 1 is the safety claim and, with R15 and R16, gates a public link. Phase 2 is the completion rate and is
what makes the tool worth using twice. Phase 3 is accuracy and subtraction, and can follow
the launch.

Nothing in this plan is a new feature.
