# Seven things I did not fix, and why

Written 2026-09-21, alongside the batch that closed the rest of the second
gauntlet (`docs/qa/night/personas/SYNTHESIS.md`). Each of these is a real
finding with a diagnosis; none of them is mine to decide.

---

## 1. The cutover — ANSWERED, and one question left open

**Owner, 2026-09-21: security defaults do block device code flow.** Confirmed
against `learn.microsoft.com/entra/fundamentals/security-defaults` the same day,
which now carries a "Block device code flow" section of its own: "After security
defaults are enabled in your tenant, authentication requests that use device code
flow are blocked", and from 1 July 2026 every new tenant blocks it.

So the **content was right and the playbook was missing a row.** Fixed:

- §10.1 gains `s-prereq-security-defaults:start ← s-goal-block-device-code
  @ready-to-enforce [sd-enabled]`, and `dependency-data.json` is regenerated. The
  cutover now waits on four in a pinned-baseline plan, which is what the step has
  always told the reader.
- §11's cutover entry records what the six enforced protections are and how the
  pinned baseline's four steps cover them — `s-goal-mfa-all-users` reaches Azure
  management as All resources, which is why no separate Azure step is needed.
  `s-goal-azure-management-mfa` keeps its §10.1 row and generates nothing, being
  outside the pin.
- `dependencyData.test.ts` asserts the four, so the row cannot go missing again.

Before this, a plan could have turned security defaults off with the device-code
route left open behind it, and nothing would have held the cutover back.

### The question this opened, which is bigger

The repo holds **two opposite readings of the same silence**, and they have never
been reconciled:

- **Playbook V3** (cleared twice, most recently 2026-09-20): no Learn page
  forbids *creating* a Report-only policy while security defaults are on, so it
  is permitted. The gate therefore sits on `enforce`, and **every policy step in
  the plan instructs the reader to create in Report-only while security defaults
  are still on.**
- **`scripts/walkContent.mjs` C7**: a standing `mustNot` forbidding the product
  from ever saying "Report-only policies can exist while security defaults are
  on", because no Learn page says they may.

The engine acts on the first. The words are forbidden from stating it. And the
owner's reading, 2026-09-21, is the second and stronger one: "You can't create,
configure, or enable those while security defaults are in place."

Learn is explicit that security defaults must be **disabled to implement**
replacements, and silent on creation. I could not settle it from documentation,
and I am not going to settle it by preference, because of what each answer costs:

- **If creation under security defaults is permitted** (V3), today's design is
  right: build all four in Report-only, watch them, then cut over in one change
  window. That is the safest rollout available and it is what ships.
- **If it is not**, then for every tenant created since October 2019 — security
  defaults on by default — the report-only observation period is impossible. The
  cutover becomes: turn security defaults off, then create and enable four
  policies with the tenant unprotected in between, and no observation at all.
  That is a different product, and a far more dangerous day.

**Decision needed:** can a Report-only Conditional Access policy be created while
security defaults are enabled — yes or no? If no, the rollout shape needs
redesigning and it is not a wording change. I left the step's words exactly as
they were rather than assert either side.

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
