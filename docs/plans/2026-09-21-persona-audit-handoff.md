# Handoff — ground-zero persona audit

Written 2026-09-21. Self-contained: a new chat needs this file and the repo.
Everything about the personas is transcribed here in §4, because the auditing
agents **must not read the files it came from** (see §5).

---

## 1. Where the code is

`main` is at `93e17330`. CI and deploy-pages are both green on it. The working
tree is clean except for one stash, described in §3.

### Landed today (2026-09-21)

| commit | what |
|---|---|
| `0357a429` | A readiness gate that waits for a number now names what moves it — the campaign step on this plan, or Intune for device readiness. |
| `9992d0ce` | A number the scan could not read now names the source, the recorded failure reason, the permission that reads it and the licence it needs. |
| `9a67fe8c` | A step whose policy would reach wider than its own name says so **before** you create it. Disclosure only — no operation changes. |
| `93e17330` | Two words the copy lint bans, and one exact-sentence test that needed the new clause. |

All three substantive fixes share one root cause, and it is the recurring shape
of this codebase's defects: **the engine computes the right answer and throws it
away before it reaches the page.** Expect the next audit's findings to be mostly
this again.

---

## 2. How the audit runs

### The method: the persona harness

`docs/qa/night/personas/` holds a harness that runs the **real engine and the
real page-rendering code** over a fixture tenant and returns the text a person
would read. It is how the previous rounds were driven, and it is the method to
use again, for one reason that nothing else can match: **it can give each
persona a genuinely different tenant.**

Key files:

| file | what it is |
|---|---|
| `harness.ts` | The API. `tenant()`, `plan()`, `render()`, `lanes()`, `decide()`, `deploy()`, `rescan()`, `days()`, `enrolMfa()`, `prepareEmergencyAccess()`, `configurePasskeys()`, `settleFoundations()`, `acceptDirection()`. |
| `r3-tenants.ts` | The five persona tenants, built from fixtures plus mutations. |
| `r3-journey.ts` | `walk()` — drives a whole journey with options for how faithfully the person follows it. |
| `HARNESS.md` | The written API notes. |

Run a probe with `node docs/qa/night/personas/<file>.ts` from the repo root.

`render(t, r, step)` returns what the persona sees on an opened step: `title`,
`eyebrow`, `lane`, `state`, `why`, `cards` (the readiness tiles), `found` (the
"What IAMAI found" findings), `milestone`, `tasks`, `channels` (every
implementation channel's text), `doneWhen`, `decision`.

**`found` was added today, and this matters.** For three rounds `render()`
returned the readiness tiles only, so every persona was shown **half of each
step** — the whole findings section was invisible to them. The coverage lines,
the shortfall sentence, the "not as asked" comparison and the new
wider-than-its-name disclosure were never read by anybody. A persona cannot
report a sentence it was never shown, which made every previous round's reading
of comprehension softer than it looked.

**Caveat:** `docs/qa/night/` is gitignored. The harness exists on this machine
and is not in git. If it should survive a clone, that is an owner decision to
make deliberately — the fixtures are synthetic and contain no tenant data, so
there is no safety reason not to commit it.

### Why not five dev servers

Worth recording so nobody re-derives it. The browser can only ever show one
tenant. `src/ui/demoMode.ts` exposes exactly one switch, `?demo=1`, and
`src/ui/demo.ts:65` hard-codes what it loads:

```ts
const f = fixture(week2 ? 'demo-week2' : 'demo')
```

There is no URL parameter, setting or build flag that loads `midflight`, `mid`,
`large`, `getiamai` or `hostile`. Five dev servers started today would show five
personas the **same sample tenant**, which would make the audit worthless.

A dev-only `?demo=1&tenant=<name>` selector is a reasonable future task — gated
on `import.meta.env.DEV` so it cannot exist in the built site, giving each
fixture its own `demo-sample-tenant#<name>` store id, falling back to `demo` on
anything unknown. It is **not** a prerequisite for this audit and should not
block it.

---

## 3. The stashed work — option A, the row reason line

`git stash list` holds **"option A: row reason line, in progress"**, touching
`src/ui/surfaces/planBoard.ts` and `src/ui/surfaces/stepContract.ts`. The owner
approved this design; it is half-built.

**The defect.** A held Plan row says only "On Hold". What it is waiting for —
the step that must come first, or the Direction question nobody has answered —
is computed by the board and reaches no collapsed row. On one plan, fifteen rows
were waiting on an unanswered question and eleven on one named step, and every
one said "On Hold". An administrator who reads that, goes to the portal and
deploys anyway has been told he cannot and not told what to do first.

**Why it is not just a missing string.** Two functions keep the lane badge to
one word, on purpose:

- `laneLabelOf` in `planBoard.ts` appends the lane tail only on `Ready` (since
  `8f440021`, the V1 plan design).
- `compactLane` in `StepSections.tsx:737` strips `On Hold · After ` from the
  badge if one gets through.

The When column cannot take it either: fixed 125px, `white-space: nowrap;
overflow: visible`. Measured in the browser — a 25-character string already
spills 9px, and "After Configure Passkey Authentication" would cross the row.

**A recorded decision says not to do this.** `src/ui/accessibility.test.ts`
asserts `row.includes('plan-row-reason') === false`, citing RUN-CONTEXT-B
decision 10, whose stated premise is "the lane label is the row's reason". That
premise stopped being true in `8f440021`. The owner has resolved the
contradiction in favour of the reason line; **update that guard with the new
decision rather than routing around it.**

**Done in the stash:** `waitingForOf(r, titleOf)` in `planBoard.ts` (the step
title as "After X", or the Direction-waiting phrase, or null for holds that
already read as themselves), plus `waitingFor: string | null` on `LaneView` in
`stepContract.ts`.

**Still to do:**
1. `StepSections.tsx` — a `waitingFor` prop on `PlanRow`, rendered as a span
   inside `.plan-row-title` beneath `.step-title`.
2. `Plan.tsx` — pass `waitingFor={lane.waitingFor}`, and update the comment at
   the `<PlanRow>` call that currently asserts the opposite.
3. `src/ui/app.css` — a `.plan-row-reason` rule.
4. `src/ui/accessibility.test.ts` — the two assertions named above.
5. `src/ui/surfaces/planAnatomy.test.ts` — its mock `laneOf()` builds a
   `LaneView` literal and needs the new field.
6. A behaviour test, and a check at desktop **and** mobile widths.

**Safe to add:** the walk reads `.step-title` (the inner span) and `.when`;
smoke reads `.lane`, `.when`, `.plan-row-number` and `.next-mark`. A new sibling
span inside `.plan-row-title` disturbs none of them — verified by grep.

---

## 4. The personas

Five administrators. Each is a habit, a tenant, and a reason that pairing is
worth testing. **Transcribe these into the agent prompts. Do not point an agent
at the file they came from** — it carries commentary about what previous rounds
found, which is exactly what a first-time user must not have.

### Jordan — fast, skips warnings
An MSP technician. Competent, impatient. Does not read "Why" sections. Scans for
the button that makes progress happen. Takes pre-filled suggestions because he
assumes the tool knows. Trusts guardrails, resents explanations. If something
does not visibly change when he acts, he assumes the tool is broken and tries
again harder.

**Tenant:** `jordanTenant()` — fixture `midflight`, with
`mapping.breakGlassUserIds = []` and `wizardAnswered.breakGlass = false`,
`wizardAnswered.globalExclusion = false`. He has **inherited** somebody else's
half-finished rollout — policies already tagged by IAMAI and applied ~60 days
ago by a person who left no notes and chose no emergency accounts. 62 people.

*Why this pairing:* his habits are worst for an inherited tenant.

### Marcus — follows instructions exactly
IT generalist at a 285-person company. Does what the step says, in the order
given, and does not improvise. Waits the full period when told to. Has no
instinct to overrule the tool, which makes him the persona the product is
easiest for and the one whose trust is most brittle: he will faithfully execute
a wrong instruction.

**Tenant:** `marcusTenant()` — fixture `mid`, with `capabilities.intune =
{ enabled: true, seats: 300, consumed: 41 }`. 285 people, 11 existing policies,
three service accounts, mixed licences, Intune bought and barely deployed.

*Why this pairing:* the licence mixture is what his literal reading meets first.

### Sam — verifies everything
Senior identity engineer, 4,900 people. Acts on no claim he cannot check, and
checks numbers against the underlying data by hand. Will stop trusting the tool
entirely the first time he catches it wrong. Cares most about **order** — doing
right things in the wrong sequence is how you lock 4,900 people out.

**Tenant:** `samTenant()` — fixture `large`, with
`config.securityDefaults.rows[0] = { isEnabled: true }` and
`config.caPolicies.rows = []` (security defaults and Conditional Access do not
run together, so a tenant with defaults on has no policies of its own).
4,900 people, 51 admins.

*Why this pairing:* the security-defaults cutover, at a scale where getting it
wrong is a headline.

### Nadia — careful, learning
Sole IT person at a tiny company. New to Conditional Access — knows what MFA is,
does not know what a break-glass account is or what report-only does. Reads
everything. Checks every number by hand because her tenant is small enough.
Exactly the person the tool should teach, and the one most likely to build the
wrong thing if told to — though she *does* read, so a warning placed where she
will see it works on her.

**Tenant:** `nadiaTenant()` — fixture `getiamai`, with `capabilities.intune =
{ enabled: true, seats: 11, consumed: 0 }`. Thirteen accounts — eleven people
plus two emergency accounts — nine of whom have never signed in. One guest.

*Why this pairing:* every count is one she can check by hand, which is where a
wrong one shows.

### Priya — expert, sceptical, fast
Security consultant, deep Entra knowledge. Goes straight at what a tool claims
when it **cannot see** — where products lie, usually by accident, by computing a
number from missing data and presenting it with the confidence of a measured
one. Judges wording precisely; notices sentences that are technically true and
misleading.

**Tenant:** `priyaTenant()` — fixture `hostile`, with E5 added
(`capabilities.entraP2` and `.intune` enabled, plus an `SPE_E5` sku row carrying
`AAD_PREMIUM_P2` and `INTUNE_A` service plans). 42 people. Three sources refuse
to answer: registration details disabled, device data disabled, sign-in records
insufficient.

*Why this pairing:* the half of the product a cooperative tenant never exercises.

---

## 5. Ground rules that make the audit worth running

The previous rounds were **not** independent agents. They were probe scripts and
prose written by one process. The numbers and quoted strings came from the real
engine, but "five personas" was one author, and the theses were that author's
prose. That is the flaw this round exists to correct, and these rules are what
correct it.

1. **Separate agent, separate task, five running concurrently.** No shared
   context, no shared conclusions, no agent told what another found.
2. **Ground zero. Each persona has never seen IAMAI before.** They are the first
   beta testers. No agent may read `R3-FINDINGS.md`, `R3-THESES.md`,
   `SYNTHESIS.md`, any `r3-*.ts` probe, this handoff, or any other prior audit
   artefact. Nothing an agent knows may come from an earlier round. The harness
   API files it needs — `HARNESS.md`, `harness.ts`, `r3-tenants.ts`,
   `r3-journey.ts` — are the driving mechanism and are fine to read; the
   findings and theses are not.
3. **They are beta testers, not engineers.** An agent must not read `src/**` to
   work out what the product *means*. Reading the source is how an agent stops
   being a first-time user — it starts explaining the product to itself instead
   of reporting that the product failed to explain itself. **If the rendered
   text does not say it, the finding is that the product does not say it.**
   Reading `src/` is allowed for exactly one purpose: computing ground truth
   from the tenant snapshot to check a number the product printed.
4. **Read the whole step.** `render()` returns `cards` (readiness tiles) *and*
   `found` (the findings section). Both are on screen; both must be read before
   judging whether the product explained itself.
5. **Every quotation must be text the agent actually saw in output from a
   command it ran.** Anything not reproducible is reported as "could not
   reproduce". Fabricated or paraphrased-into-quotes product text is the one
   unforgivable failure — it is the exact flaw this round exists to correct.
6. **Stay in character throughout.** Jordan skips the warning even when reading
   it would have helped. Marcus follows the instruction even when it is wrong.
   The value is in what the persona *actually does*, not what a careful auditor
   would do.
7. **Read-only on the product.** No agent edits anything outside its own
   `docs/qa/night/personas/<prefix>-*.ts` scratch files, changes git state, or
   runs `npm test` / `walk` / `smoke` / `verify` (15+ minutes, not their job).
   Give each agent a unique file prefix — they run concurrently in one directory.

---

## 6. What is left to do, in order

1. **The ground-zero persona audit** — the prompt in §7.
2. **Finish option A** (§3) — approved, half-built, stashed.
3. **Open defects from the last round**, none of them fixed:
   - **R3-1, severity 4** — IAMAI matches a policy carrying its own plan tag
     that is `disabled`, then instructs you to create a duplicate named "… (2)".
     Reproduces on the shipped `midflight` fixture. Three layers diagnosed; the
     third needs a `packageStateOf` state meaning "this exists and is switched
     off, turn it on", which does not exist, plus a block in all 44 policy
     packages.
   - **R3-2, severity 3** — a policy the tenant already enforced before IAMAI
     arrived ends the run at "Review now" with completion criteria requiring a
     report-only period that can never have happened. Unfinishable rows.
   - **R3-7, severity 2** — a policy whose named people are all dormant reads
     "No user impact".
4. **Found today, not filed anywhere else:**
   - `holdGroupOf` is computed onto every board item in `Plan.tsx` and read by
     nothing. The machinery to group held rows by what holds them exists, wired
     as far as the item, then stops.
   - The Plan row breaks below 940px independently of anything above: the grid
     drops to three columns and the who/when zones reflow into the 28px and
     110px tracks. Measured — the "who" cell is 28px wide with "2 people" in it.
5. **Longer-standing, unresolved:** putting every fixture on the pinned baseline
   (measured cost: 6 failures of 976 roadmap+coverage, 12 of 1133 surfaces); the
   Inforcer wording (decided, not built — say why it is on the list, do not
   describe or link a third party); `docs/plans/vocabulary-plan.md` (four terms,
   unapproved, four owner questions open); the dev-only fixture selector (§2).

---

## 7. The kickstart prompt

Paste this into the new chat.

```
Read docs/plans/2026-09-21-persona-audit-handoff.md first. It is the handoff for
this work and it is self-contained. Do not start fixing anything in the product.

Run a ground-zero persona audit of IAMAI.

Launch FIVE separate agents, one per persona, as five separate concurrent tasks.
Give each agent its persona character and tenant transcribed from §4 of the
handoff, the harness instructions from §2, and the ground rules from §5 in full.
Give each a unique scratch-file prefix — they run concurrently in one directory.

Each agent drives the real engine through the persona harness
(docs/qa/night/personas/) over ITS OWN tenant, and makes every decision from its
persona's perspective.

The rules that matter most, and they are absolute:

  * Each persona has NEVER USED THIS TOOL BEFORE. They are the first beta
    testers of a public beta. They know nothing about IAMAI that the product has
    not just told them on screen. No agent may read R3-FINDINGS.md,
    R3-THESES.md, SYNTHESIS.md, any r3-*.ts probe, this handoff, or any other
    prior audit artefact. Nothing an agent knows may come from an earlier round.
    HARNESS.md, harness.ts, r3-tenants.ts and r3-journey.ts are the driving
    mechanism and are fine to read.

  * They are beta testers, not engineers. An agent must not read src/** to work
    out what the product MEANS. If the rendered text does not say it, the
    finding is that the product does not say it. The single exception: reading
    the tenant snapshot to compute ground truth and check a number the product
    printed.

  * Read the whole step. render() returns `cards` (readiness tiles) AND `found`
    (the "What IAMAI found" findings). Both are on screen. Judging comprehension
    from one of them is how three previous rounds came out softer than the truth.

  * Every quotation of product text must be text the agent actually saw in
    output from a command it ran. Anything not reproducible is reported as
    "could not reproduce". Fabricated or paraphrased quotes are the one
    unforgivable failure.

  * Stay in character the whole way through. Jordan skips the warning even when
    reading it would have helped. Marcus follows the instruction even when it is
    wrong. Report what the persona actually did, not what a careful auditor
    would have done.

Each agent returns: a first-person account of its session in order; every point
where it acted, what it expected and what happened, with the product's own words
quoted verbatim; where it lost or gained trust and exactly why; where it ended
(steps done of total, policies live); each defect with a severity 1-5 and exact
reproduction (probe file and step id); and a rating out of 10 with the specific
reasons for the points lost.

When all five report, give me: the five ratings and the mean; every defect two
or more personas hit independently; every place one persona's account
contradicts another's; and the shortest list of changes that would move the most
ratings. Tell me plainly if any agent's finding cannot be reproduced. Do not
start fixing anything until I have read it.
```

---

## 8. Things about this codebase a new chat will otherwise learn the hard way

- **Pick focused test files by the rendered TEXT, not the module edited.** Two
  CI failures today came from that: `enforcedLanes.test.ts` pins a whole
  sentence, and `src/ui/shell/footer.test.ts` lints every string under
  `pages.plan`/`app.plan` — including `$comment` values — for the banned word
  "user". Neither file contained any code that was touched.
  `grep -rln "<the new phrase>" src --include=*.test.ts` finds them.
- **The `[snapshots]` rule bites.** `scripts/check-change-scope.mjs` fails any
  commit touching both `src/` and `docs/qa/step-snapshots/` without
  `[snapshots]` in its subject, and it can only be satisfied by rewording that
  commit. Run `node scripts/check-change-scope.mjs --range <before>..HEAD`
  before pushing.
- **`npm test` takes 15–25 minutes** and writes nothing until it ends when piped
  through grep. Redirect to a file and watch the file.
- **Foundation A guards readings of `readiness.family`** with an exact per-file
  count in `src/roadmap/foundationA.test.ts`. A new read needs the count bumped
  and a reason written.
- Shell quoting mangles backslashes here. Prefer `[0-9]` over `\d`, plain
  `.includes()` over regex in tests, and the Write tool for long prose.
