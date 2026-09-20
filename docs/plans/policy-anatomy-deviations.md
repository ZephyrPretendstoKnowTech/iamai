# Step anatomy — deviations held for the owner

The rule (owner, 2026-09-19): a step that carries work must look identical to an
Establish Emergency Access step. Nothing may be added that an Emergency Access
step does not already draw. Anything a step seemed to need, and anything that
could not be made identical, is written here instead of built.

Scope now: **every step that carries work** draws the anatomy — the `s-goal-*`
policy steps and `s-shared-devices`, the object steps (`s-prereq-*`), the MFA
campaign (`s-verify-mfa`), the checks (`s-check-*`, `s-ladder-operator-passkey`),
the baseline reviews (`s-review-baseline-*`) and anything the catch-all group
holds. The gate is the step group registry's `anatomy` field
(`src/roadmap/stepGroups.ts`), which every group but Decide Your Tenant's
Direction sets to `task`, so there is no list of ids to keep in step with
anything: the board's grouping and the step's interior cannot answer differently.
The one deviation below that was approved on a single policy first (the settings
fold) runs on the same gate.

Outside it: the four Direction steps (the decision anatomy — nothing is built)
and the four Cleanup rows other than the recovery drill (the owner excluded the
Cleanup rows; `CleanupStep.tsx` keeps the drill on the task headings by its own
kind). The four Establish Emergency Access steps draw the anatomy from their own
producers and are frozen.

## Cut, and not rebuilt

### 1. The next-action sentence under Readiness

**What.** The ordinary policy step drew the step's one next action as a lead
line inside the Readiness section: "Create the policy in report-only on Sep 22,
2026; it is not turned on until emergency access is sorted."

**Why it seemed needed.** It is the only place the report-only caveat is stated
in a sentence, and the only place the date appears beside it.

**What happens now it is cut.** There is no lead line: an Emergency Access step
draws none. The sentence itself is not lost — it is the policy's own Tasks
Remaining card's second line, where an account's card says what is wrong with
that account. So the words a person needs are still on screen, in the card that
names the subject they are about, and the section has no line above its cards.

### 2. The lifecycle track bar

**What.** Not deployed → Report-only → Ready to enforce → Enforced, drawn under
the step head.

**Why it seemed needed.** It is the only picture of where a policy is in its
life, and a policy step has four states where an Emergency Access step has none.

**What happens if it's cut.** It is cut (the brief excludes it). Its facts are
not: the four stages are the policy card's checks — the ones already reached
fold under **Completed checks · N**, the next one is the card's heading, and the
rest are its "N checks remaining". The picture is gone; the position is not.

### 3. The resolved settings list on the Entra tab — restored on every policy step

**What.** Below the numbered Entra procedure, a policy step used to draw
"Settings for This Action": the resolved policy name, the description tag IAMAI
recognises the policy by, the full resolved role list, the target resources, the
conditions and the session controls (`stepPackage.ts entraWithSettings`).

**Status: approved by the owner on every policy step** (2026-09-19, after the
one-step pilot on `s-goal-admin-session`; the separate `drawsPolicySettings`
gate is gone — the fold runs on the anatomy's own gate, so a step cannot draw
one without the other, and it reaches every step that draws the anatomy). It is back under the
procedure, collapsed, in the disclosure ContentStep.tsx already draws a resolved
list in (the one Configure Passkey Authentication draws its approved models in)
and under the heading the artifact itself gave the list. No class, component or
word was added. A policy step whose procedure lists no settings folds nothing —
the guard is the task's own facts — so those steps read exactly as before. The
settings are still carried in full by **Copy task**, the printed plan, and the
JSON and PowerShell tabs.

## Changed to make one thing read one way

### 4. "Satisfied · N" became "Completed checks · N"

The fold over a card's finished checks said "Completed checks · N"; the fold
over finished subject cards said "Satisfied · N". Both hold work that is done,
so both now say "Completed checks · N" — the Emergency Access wording, which was
the one to prefer. This is the only change these four items made to an Emergency
Access step, and it is a word, not a component. Ordinary (non-task) steps keep
`readiness.tiles.satisfied` from content.json; nothing else moved.

## Differences that remain, and are data, not layout

These need no decision unless the owner wants them equalised.

- **A policy card carries no UPN and an account card does.** The policy card's
  subject line is the policy's own name (Foundation B's member). A step whose
  goal the tenant already delivers, and a step with no policy of its own, has no
  member to name, so that line is absent — as an unselected account slot's is.
- **A one-option Task selector.** A policy step has one Entra procedure, so the
  task frame's Task select has one option. Emergency Access steps have three or
  four.
- **No Method selector.** The task has no method variants; Emergency Access
  draws one only for the passkey task, which does.
- **No Troubleshooting link beside Microsoft Learn** where the step's package
  publishes no troubleshooting scenarios; the frame draws the link when there
  are any, on a policy step as on an Emergency Access one.
- **"Defer this step" in the footer.** An Emergency Access step can never be
  deferred (`roadmap/blockerSteps.ts`), so its footer has no left-hand control.
  A deferrable policy step's content marks it deferrable, so the shared footer
  draws the same secondary button it draws on every other deferrable step.
  Cutting it would remove a capability, not a component, so it was left alone.
- **A decision form in the action column.** Emergency Access Step 1 takes a
  decision (which accounts); a policy step that takes one draws it in the same
  column, and one that takes none holds the milestone alone.
- **"N checks remaining" counts stages on a policy card and findings on an
  account card.** The component draws the count it is given; what is counted is
  the subject's own kind of check.

## Two things the owner should know, which are not layout

1. **The walk reads the sentence that moved.** `scripts/walk.mjs` decides a step
   "cannot be written yet" by matching sentences in the step body — "first: this
   policy names an object", "in place already: nothing to create". Those
   sentences left the Readiness lead (item 1) and are now the policy card's
   second line, so they are still in the body's text. This was not verified by
   running the walk (the brief excludes it); CI runs it.
2. **A prerequisite tile can still name a step by its id.** On the demo's
   follow-up scan, Require Token Protection on Windows draws a card reading
   "Prerequisite · To do / cleanup-drill / Finish cleanup-drill first." That
   value is the tile's own (the Cleanup row has no title to resolve) and reads
   the same in the old strip; the cards did not introduce it, and it was left
   alone as out of scope.

## Found taking Close the Doors to V1 (2026-09-19)

Neither of these was built. Both are the anatomy's, not one group's.

### 5. "More" is on no screen, in any state

`ContentStep.tsx` draws the `More` region only when `printing` is true. So
**Risks**, **For the help desk**, **For your manager**, **Tell your people**,
**Dates** and the names behind the counts are in the printed plan and in the
export text (`stepExport.ts` reads `more.risks` and `more.helpDesk`), and on no
screen at all — on a policy step or on an Emergency Access one.

**Why it matters here.** Wave 1 found two consequences that an admin needs
*before* creating the policy, not after printing it: device code flow's protocol
tracking, and an all-resources authentication-flows policy reaching Device
Registration Service. They are now risks, so they reach the export and the
print; to put them on a screen they were also written into the create
procedure's numbered steps, which is a surface the anatomy already draws. That
works, but it means a fact worth stating has to be written in two places, and
"the same words on screen, in the export and in print" is only true of the
second copy.

**The question for the owner.** Should a policy step's risks be reachable on
screen — for example under the evidence dialog the Tasks Remaining foot already
links to ("Why IAMAI says this") — or is print-and-export the intended home?
Either answer is one decision; neither is built.

### 6. A group's row numbers are registry positions, so an ungenerated member leaves a gap

On the demo, "Close the Doors Nobody Should Use" heads "4 steps" and numbers its
rows **1, 3, 4, 5**. The 2 is `s-question-mail-devices`, the group's second
registry member, which the plan generates only when the mail-sending-devices
decision answers "Temporary exception accounts" (`roadmap/answers.ts`
`CARVE_OUT_STEP_ID`). The same shape appears in every group with a conditional
member ("Protect Your Administrators — 1 step", numbered 4).

The number is a stable handle, which is worth keeping; the heading counts the
rows drawn, which is also worth keeping. They simply disagree in front of the
reader. No change was made.

## Found rolling the settings fold out to every policy step (2026-09-19)

### 7. Four procedures end in a "Verify the workflow" block, and the fold swallows it

`portalProcedureOf` (`src/ui/surfaces/policyTasks.ts`) splits the Entra artifact
at its first Markdown heading: everything above is the numbered procedure,
everything below is the task's facts. Four procedures carry a second block after
the settings heading — "Verify the workflow:" and its numbered checks — on
`s-goal-register-info-protected`, `s-goal-pim-activation-reauth`,
`s-goal-user-risk-medium` and `s-goal-block-device-code`. Those lines therefore
become fact rows labelled "Setting", under **Settings for This Action**, where
they are not settings; and they are missing from the numbered procedure above,
where they are the last thing the admin is asked to do.

This is not new — the parser has behaved this way since the pilot, and the
printed plan already lists those rows on every policy step. The settings fold
only puts it on screen, on four steps.

**No change was made**: the fix is either to the parser (a second heading ends
the facts, and its lines return to the procedure) or to the four content
packages (the verification block moves above the settings heading). Both are
outside "roll the approved fold out", and the second touches the registry.

## Found taking the anatomy to every step that carries work (2026-09-20)

Nothing here was built. All four are the anatomy's, not one kind's.

### 8. A step with no policy has no subject to name, so its card is headed by its kind

An Emergency Access card is headed "Emergency access account 1" and a policy
card by "Conditional Access policy" over the policy's own name. An object step,
a check, the campaign and a baseline review have no member and no name: the
object does not exist yet, which is why the step is there. The card is therefore
headed by the kind the step's own eyebrow already says it is — "Preparation
step", "Check step", "Campaign step" — from
`pages.app.plan.stepContract.kind`, the words already above the card. No word
was written and no key was added.

**The question for the owner.** Should such a card instead name the object the
step will make ("Named location", "Group", "Authentication strength")? That is a
truer subject, but it is a new taxonomy — one label per object step, kept in
step with the content — and the rule forbids adding one. The kind label is the
honest answer available without inventing anything.

### 9. On a step with no rollout, the card's next check is the task's own title

A policy card's next check is the next lifecycle stage ("Report-only"), because
a policy has a track. A step with no track has no stage, so the next check is
the Implementation Task itself — which, on a step that submits no operation, is
called what the step is called. The card therefore reads

    Preparation step
    Define the Trusted Network
    Make the object this step names.
    Follow Define the Trusted Network in Implementation Tasks.

with the step's own title on the line above it in the head. This is not new —
`s-shared-devices` and every other trackless policy step have read this way since
the pilot — and it is the same shape a policy step reads in ("Report-only" in
both the check and the instruction). Suppressing the instruction where it
repeats the check would make those steps read differently from the policy steps,
which is the thing the rule is against. Left alone.

### 10. Two steps still have no procedure to make a task of, and keep their channel body

`policyTasksOf` projects a task only where the step's portal channel carries a
numbered procedure. Across all eight fixtures exactly two steps do not, and both
are policy steps that already behaved this way:

- `s-goal-admin-portals-protected` — the baseline defines its policy two ways, so
  the step deliberately gets no task: nothing anybody does in the portal resolves
  a contradiction, and a task there would be work offered over a step that says
  there is none.
- `s-goal-device-registration-mfa` — its Entra artifact opens with the settings
  heading, so the parser reads twenty fact rows and no numbered lines (this is
  item 7 above, seen from the other side).

Neither draws an empty frame: the Implementation Tasks region draws the step's
own artifact, whole. The brief's "no action" shape
(`No Entra action is currently identified. Review Readiness.`) was **not** used
for them, because on the second step it would hide twenty lines of real content
behind a sentence saying there is none. Fixing the second properly is item 7's
fix — the parser, or the four content packages.

### 11. The lifecycle track is now cut on every step, not only the policy steps

Item 2 cut the track from a policy step. Extending the anatomy cuts it from the
rest as well. On those steps nothing is lost at all: `stepTrack` already returned
empty for every object, check, campaign and review step in every fixture, because
none of them has a lifecycle. The change is to the code, not to the screen.
