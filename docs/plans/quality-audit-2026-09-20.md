# Step quality audit, 2026-09-20

Owner request: "Pay special attention to the quality of each Readiness tile, and each
Implementation Task instruction to make sure it matches the quality, formatting, and tone of
the emergency access steps."

Every step the demo can open was read at 1280 on both snapshots (Initial and Follow-up), plus
the five steps only the `mid` fixture builds. What follows is what a component change or an
owner decision would be needed for; the wording, duplication and filler that could be fixed
at the source already were (see the commits on this branch).

---

## 1. The bar, stated precisely

From the four Establish Emergency Access steps, which are the standard:

**A Tasks Remaining card.** A subject label that names a *thing* ("Emergency access account 2",
"Policy exclusions", "Exclusions group", "Passkey protections"). The subject itself under it
(`bg2@demo-fixture.onmicrosoft.com`, `Core - Exclusions`, the four policy names). "N checks
remaining". The next check as the heading, four words or so ("Approved passkey needed", "Group
exclusion", "Current attestation"). One sentence that says what is wrong or what to do, never
what the card already said. One action, naming the Implementation Task by name ("Follow Set up
an approved passkey in Implementation Tasks"). "Completed checks · N", folded.

**An Implementation Task.** A Task selector, and a Method selector where variants exist
(YubiKey / Authenticator on iPhone / Authenticator on Android). Copy and open controls. A
numbered procedure in plain sentences naming the exact portal path
(`Entra ID → Users → New user → Create new user`) and exact field values (**Account enabled**,
the domain, the AAGUID). A "Microsoft Learn · Source checked Sep 12, 2026" footer.

**Tone.** Calm, specific, second person, no marketing, no hedging, no repetition between the
card and the procedure.

---

## 2. Findings that need a component change or an owner decision

### 2.1 The card subject on a step that delivers no policy is the step's *kind*, and the next check is the step's own *title* — OWNER

**What a user sees today.** On every object, check, campaign and baseline-review step, the
first Tasks Remaining card reads:

> **Preparation step**
> Create or Correct Allowed Countries Location
> Create the countries named location the country rule reads, holding exactly the countries
> people work from.
> Follow Create or Correct Allowed Countries Location in Implementation Tasks.

Three of the four lines are the step's own name or its kind. Compare Step 1, where the card is
headed by the account, the check is "Approved passkey needed", and the action names a task the
step's title does not.

The cause is two fallbacks meeting: `policyTasks.ts` `taskSubjectOf` heads the card with the
eyebrow when the content kind is not `policy`, and `taskTitle` calls the Implementation Task
what the step is called when the step submits no operation. `policyCardsOf` then uses the task
title as the next check, because there is no rollout track to name one.

**What I would change.** Two content keys per such step, and no code beyond reading them:

| key | what it is | example (`s-prereq-allowed-countries`) |
|---|---|---|
| `card.subject` | the thing the card is about, sentence case | `Allowed countries location` |
| `card.check` | the next check, the state the scan found | `Not created yet` |
| `task.title` | the Implementation Task, a verb phrase | `Create the countries location` |

Proposed values for the eleven steps this affects:

| step | subject | check when absent | task title |
|---|---|---|---|
| `s-prereq-allowed-countries` | Allowed countries location | Not created yet | Create the countries location |
| `s-prereq-trusted-location` | Trusted network | Not created yet | Create the trusted location |
| `s-prereq-service-accounts-group` | Service accounts group | Not created yet | Create the group |
| `s-prereq-auth-strength` | Authentication strength | Not created yet | Create the strength |
| `s-prereq-security-defaults` | Security defaults | Still on | Turn security defaults off |
| `s-prereq-per-user-mfa` | Per-user MFA states | Still enforced | Disable the per-user states |
| `s-ladder-operator-passkey` | Your passkey | Not registered yet | Register your passkey |
| `s-verify-mfa` | Sign-in method setup | Not prepared yet | Run the preparation |
| `s-check-dormant-accounts` | Dormant accounts | Not reviewed yet | Review each account |
| `s-check-separate-admin-accounts` | Administrator accounts | Not reviewed yet | Review each administrator |
| `s-review-baseline-*` | Baseline policy | Not reviewed yet | Read the baseline definition |

This is an owner decision because it adds a content key shape and changes the task selector's
labels on eleven steps; `policyTasks.test.ts` asserts the present behaviour deliberately ("a
step that submits no operation is called what the step is called", and "the card sends the
reader to it rather than saying nothing").

### 2.2 "Follow &lt;step title&gt; in Implementation Tasks" where the step has one task — OWNER

**What a user sees today.** On the twenty-odd steps with exactly one Implementation Task, the
card's one action points at a task named after the step the card is on. On Emergency Access the
sentence earns its place because there are three or four tasks and the card picks one.

**What I would change.** Direct to a named task only where the projection has more than one.
With one task, the card's sentence is its lead and the section below is titled. Blocked on 2.1:
once tasks are named by their action the pointer reads well even when there is one, so decide
2.1 first.

### 2.3 A blocker's wait is used as the card's heading, and its words were written as a badge
suffix — COMPONENT

**What a user sees today.** `fixTiles`'s fall-through in `stepContract.ts` puts the engine's
blocker binding in the tile's `value`, which `emergencySubjectTileOf` promotes to the card's
`h5`. Those bindings are `pages.app.plan.blocked.*`, written to follow "Blocked · ", so as
headings they read:

> **Prerequisites**
> when 1 Temporary Access Pass policy exist (now 0)

> **Prerequisites**
> when people without a method reaches 0 (now 7)

> **Prerequisites**
> after: Identify the Inforcer application

Lowercase, a dangling "after:", and "policy exist" where the count is one. Two of them sit on
`s-goal-register-info-protected` under the same heading, "Prerequisites", so two cards are
indistinguishable at a glance.

**What I would change.** The tile's value should be the wait's *subject* and the binding should
be the note, the way the session-loop tile now works (fixed on this branch). That needs either
a subject per blocker kind in the engine's blocker data, or a second content key per
`blocked.*` entry giving its heading form. Either is a shape change to blocker data, so it is
recorded rather than built. The grammar bug in `blocked.count` ("{n} {thing} exist") should be
fixed at the same time: it needs `pluralise()`, which already bends verbs (`pluralise` governs
checks).

### 2.4 A step can draw four cards headed "Prerequisite · To do" — COMPONENT

**What a user sees today.** `s-goal-geo-restriction` draws four cards with that identical
heading, each naming a different step underneath. `s-goal-require-managed-device` draws three
plus one "Waiting on your direction". The subject is in the body, not the heading, which
inverts the Emergency Access card (subject in the heading, check in the body).

**What I would change.** Head the card with the step it waits on and make "Prerequisite · To
do" the check line, which is the Emergency Access order. That is a swap inside
`fixTiles`/`emergencySubjectTileOf` for the `step`/`missing`/`direction` kinds. It moves what
the walk and smoke read from the card headings, so it wants doing with those checks in view.

### 2.5 Five steps show no "Source checked" date — OWNER

`s-goal-admin-portals-protected` and the four `s-review-baseline-*` steps have a Microsoft Learn
link and no date beside it, because `packageSourceLine` has no package for them. Emergency
Access always shows both. Nothing here may be fabricated (S6), so the choice is the owner's:
either these five steps get a package (or a dated `learn.checkedOn` in content), or the footer
admits "no dated source for this step".

### 2.6 `s-prereq-passkey-settings` — "Prepare affected passkeys" has headings inside its
numbered list — FROZEN, for `frozen-step-suggestions.md`

The base procedure reads:

> 1. Keep the existing working method available while preparing each affected account: **user24@demo.example.com**.
> 2. **Compatible alternative**
> 3. Sign in with the registered compatible alternative in a separate session, confirm the account, then continue to the final scan action.
> 4. **Replacement registration — only if needed**
> 5. Return to IAMAI and select **Scan to update the plan**.

Steps 2 and 4 are section headings numbered as if they were instructions. Step 4's section then
has no steps under it, because the variants carry them. This is an Emergency Access step and is
frozen, so it is noted, not touched.

### 2.7 Card counts are absent wherever the step has no rollout track

Every Emergency Access card shows "N checks remaining". An object, check or campaign step shows
none, because `stagesOf` counts lifecycle stages and those steps have no lifecycle. Two
readings are possible — count the step's own findings, or accept that a card with one check
needs no count — and it is an owner call which.

### 2.8 A policy at its last stage lists that stage as both the heading and a completed check

`s-goal-block-legacy-auth` (demo) reads "Enforced" as the next check with "Completed checks · 3
— Report-only, Ready to enforce, Enforced". `stagesOf` counts `i <= index` as completed and
falls back to the current stage for the heading. Changing `completed` to `i < index` fixes the
repeat but changes what a report-only card shows too, so it is recorded rather than done.

### 2.9 Two registry members no fixture builds

`s-goal-workload-identity-block` (where-people-sign-in) and `s-ladder-phone-access-restriction`
(devices) are listed in `src/roadmap/stepGroups.ts` and appear in no snapshot of any of the
eight fixtures. Their words were judged from `content.json` only; nothing verifies how they
render. Either a fixture should build them or the registry should say why they cannot be.

### 2.10 Card headings drift between sentence case and Title Case

Emergency Access is sentence case throughout ("Emergency access account 1", "Policy exclusions",
"Passkey protections"). Elsewhere: "Authentication Strength", "Administrator Account Evidence",
"Registration Support", "Guest Directory", "Inforcer Application", "Allowed AVD Users", "Legacy
Per-User MFA", "Baseline definition" (correct). These are `configurationFindings` labels from
the derive layer, so it is one pass over those labels rather than a content edit; worth doing as
one commit, and listed here because it touches finding labels the tests read by name.

### 2.11 The "Guest Directory" card carries a name list in its one sentence

`s-goal-guests-mfa`, satisfied card:

> Guest accounts read from the directory. Policy applicability also depends on external-user
> type, home organization and exclusions.\nMFP Reception\nJamie Singh

The names are newline-joined into the sentence. Emergency Access puts the subject on its own
line (`upn`) and never inside the sentence. Moving them needs the finding to carry subjects,
which is a derive change.

---

## 3. What was fixed on this branch

| fix | steps affected |
|---|---|
| `whatToDo.lead` written for five object/check steps, so the card stops saying "Make the object this step names." | `s-prereq-allowed-countries`, `s-prereq-trusted-location`, `s-prereq-service-accounts-group`, `s-prereq-auth-strength`, `s-ladder-operator-passkey` |
| two leads ending in a colon that led a list no step draws | `s-prereq-security-defaults`, `s-prereq-per-user-mfa` |
| `milestone.resolve` — "Clear what this step is waiting on." named nothing on fourteen cards | every held policy and review step |
| `foundReadiness` started with a lowercase measure ("admin readiness is 67% today") | every step with a readiness gate |
| the session-loop wait was a four-sentence paragraph used as a card heading | `s-goal-intune-enrollment-reauth` |
| two cards printed the same baseline-conflict sentence | `s-goal-admin-portals-protected` |
| "These are the accounts this step asks you to review" over a reach of nobody | `s-check-dormant-accounts` |
| "the Exclusions Group step" is not a step's name; the step is Configure Emergency Exclusions | six implementation packages, plus `fixConfirmExclusions` |
| "Review the Readiness section" named a section the step does not draw | `s-goal-guests-mfa` |
| "the named locations selected in Trusted Network" | every step resolving a trusted-location reference |
