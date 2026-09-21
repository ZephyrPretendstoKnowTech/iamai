# Six things I did not fix, and why

Written 2026-09-21, alongside the batch that closed the rest of the second
gauntlet (`docs/qa/night/personas/SYNTHESIS.md`). Each of these is a real
finding with a diagnosis; none of them is mine to decide.

---

## 1. The cutover names four replacement policies; the graph carries three

`pages.plan` names **Require MFA for Everyone, Block Legacy Authentication,
Block Device Code Sign-in and Require Phishing-Resistant MFA for Admins** as the
policies that take over from security defaults.
`src/actionability/dependency-data.json` carries `ready-to-enforce` edges from
`s-prereq-security-defaults` to **three** of them — `s-goal-block-device-code`
is not there — sourced `ms-doc`, table 10.1.

So the plan tells the administrator to check four policies and holds the cutover
on three. One of the two is wrong and I will not guess which: the answer is a
statement about what Microsoft's security defaults actually do, and the pinned
sources are the authority.

**What I did instead:** the procedure's first line asserted that all four "have
been in report-only with no failures", which is false on any tenant where one of
them is already enforced — Sam's had three enforced since May. It now says to
check each one, and that any one *not already enforced* must have run in
report-only with no failures first. True in every state, and it decides nothing.

**Decision needed:** is device-code blocking part of what security defaults do?

---

## 2. Nine of eleven fixtures run a baseline that never ships

Only `demo` and `demo-week2` use the pinned 38-policy baseline. The rest use an
8-policy synthetic one. Findings about mechanics hold; findings about policy
content do not, and three of Marcus's severity 4s were withdrawn for this.

Related and separate: `evidenceAggregates.byCountry` is hard-coded to
`{ AU: <everyone> }` in `src/roadmap/fixtures/index.ts` while `signInEvidence`
gives four per cent of people `['AU', 'NZ']`. The **product** derives both from
one set of sign-in rows (`graph/collect/laneBCore.ts`), so they always agree on a
real tenant — but it means the multi-country case is never exercised, and
Priya's "the basis says AU while the tile says NZ" reproduces only in fixtures.

**Not fixed because:** making the aggregate honest changes the allowed-countries
reading on every synthetic fixture, two days before a beta.

**Decision needed:** is this worth doing before or after launch?

---

## 3. A policy enforced short of its readiness reads Completed with the gate gone

Sam, severity 4: "the tenant locked out with a green tick". Enforce the admin
policy while one admin of six can satisfy it and the 100% gate vanishes; the
step reads Completed and Done-when becomes "the scan found the assessed
configuration in place".

**Attempted three times, each breaking a different invariant** (scheduling;
"waiting is exactly held"; "nothing that enforces is offered while a readiness
prerequisite is unmet"). The lesson from those three: this is a fact about a
*finished* rollout and must not reuse `readinessGate`, which is machinery for
*holding an unfinished one*. It needs its own render-time path from
`step.readiness`.

**Decision needed:** what should a finished-but-short step read? "Enforced, and
1 of 6 admins can satisfy it" is the honest sentence; it needs your word before
it becomes a fourth attempt.

---

## 4. Inforcer has no gloss and no Learn link

It is the one hard term on the Direction questions with neither, and it is the
one entry in "Confirm the Services You Use" that is not a Microsoft product.
Every option beside it is self-identifying to an administrator.

**Not fixed because:** both available fixes — describing the product, or linking
to its site — are outward-facing claims about a third party, from a tool that
already names its baseline's author as working there.

**Decision needed:** a one-line description, a link, or leave it.

---

## 5. The JSON channel's plan tag

Priya, severity 4: PowerShell create scripts now carry the plan tag in the
description; **8 of 9 JSON create tabs still do not**. The fix needs
`policy.target.description` declared as a binding, which changes every package's
inventory and about thirty assertions.

`src/content/implementation/planTag.test.ts` guards it: it fails if the gap
grows **or becomes inconsistent**, because half-tagged is worse than untagged.

**Decision needed:** before launch, or after?

---

## 6. "Threshold · not measured" beside a sibling reading a percentage

Two steps in one scan: `s-goal-register-info-protected` reads "68% MFA-ready",
`s-goal-admin-portals-protected` reads "not measured". Both are true — the
second's target policy accepts a method set the scan cannot resolve for nine
people, so the percentage would be a guess — but on one screen they read as a
contradiction.

**Partly addressed:** both forms now carry the reading behind them ("19 of 28
people have a registered method allowed by the target policies"), so the numbers
agree even when the headline words do not.

**Decision needed:** should an unresolvable method set state a floor ("at least
68%, and nine people's compatibility is unknown") instead of "not measured"?

---

## 7. A policy name that resolves on the pin and reads as a gloss without it

`s-goal-all-users-no-persistence` renders `1. Name: ` + the literal sentence
"the browser-session policy named in this step" on six of the eight snapshotted
fixtures. On `demo` and `demo-week2` — the only two that run the pinned baseline
— it renders the actual name, `Core - Session - Non-persistent browser sessions`.

The cause is `memberBindings` in `src/ui/surfaces/stepPackage.ts`: a member's
`target.displayName` comes from the resolved operation's body, and where that
body carries no name the binding is unset and `stepResources.ts` substitutes the
reference's gloss. The step's own proposed name is on `step.naming.proposed` the
whole time — `policy.target.displayName` already falls back to it one function
away.

**Not fixed because:** the fallback is safe for a one-member step and wrong for a
pair, where the second member's name is `policyPairNames`', and the binding layer
is what forty-four packages and the pin guard stand on. It is also invisible on
the baseline that ships, which is why it survived this long.

**This is a fix, not a decision** — it is here so it is not lost. It belongs with
item 2: a synthetic baseline hid it.
