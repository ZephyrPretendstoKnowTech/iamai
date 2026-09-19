# Policy step anatomy — deviations held for the owner

The rule (owner, 2026-09-19): a policy step must look identical to an Establish
Emergency Access step. Nothing may be added that an Emergency Access step does
not already draw. Anything a policy step seemed to need, and anything that could
not be made identical, is written here instead of built.

Pilot: one step, `s-goal-admin-session` ("Shorten Admin Sessions"), demo fixture,
Ready · Create / not deployed. The pilot set is `POLICY_TASK_STEP_IDS` in
`src/ui/surfaces/policyTasks.ts`.

## Cut, and not rebuilt

### 1. The next-action sentence under Readiness

**What.** The ordinary policy step draws the step's one next action as a lead
line inside the Readiness section: "Create the policy in report-only on Sep 22,
2026; it is not turned on until emergency access is sorted."

**Why it seemed needed.** It is the only place the report-only caveat is stated
in a sentence, and the only place the date appears beside it.

**What happens if it's cut.** It is cut: an Emergency Access step draws no
action lead, so the pilot draws none. The Readiness bar still states where the
step stands ("Ready now"), and the action column still carries the date under
NEXT MILESTONE ("Sep 22, 2026"). What is lost is the sentence joining the two,
and the words "it is not turned on until emergency access is sorted" — which the
remaining Tasks Remaining card states in its own words ("Complete Prepare
Emergency Access Accounts before enforcement. Creating this policy in Report-only
does not enforce access restrictions.").

### 2. The lifecycle track bar

**What.** Not deployed → Report-only → Ready to enforce → Enforced, drawn under
the step head.

**Why it seemed needed.** It is the only picture of where a policy is in its
life, and a policy step has four states where an Emergency Access step has none.

**What happens if it's cut.** It is cut (the brief excludes it). The head badge
still says "Ready · Create", and the Completion Criteria still say what finishes
the step. A person cannot see at a glance that report-only comes before
enforcement; they read it in the Tasks Remaining card instead.

### 3. The resolved settings list on the Entra tab

**What.** Below the numbered Entra procedure, today's policy step draws
"Settings for This Action": the resolved policy name, the description tag IAMAI
recognises the policy by, the full resolved role list, the target resources, the
conditions and the session controls (`stepPackage.ts entraWithSettings`).

**Why it seemed needed.** It is the exact, resolved target. The numbered
procedure says "the resolved admin roles"; only this list says which ones.

**What happens if it's cut.** It is cut from the screen. The Emergency Access
task frame draws a task's numbered steps and nothing else on screen; its `facts`
are drawn only when the plan is printed. The settings are carried as the task's
facts, so **Copy task** and the printed plan still contain them in full, and the
JSON and PowerShell tabs still carry the same truth. On screen, the Entra tab now
shows the procedure alone.

## Differences that remain, and are data, not layout

These need no decision unless the owner wants them equalised.

- **One Tasks Remaining card, not two.** The cards are the step's own Readiness
  tiles; this step has one unresolved tile and one satisfied. Emergency Access
  Step 1 has two accounts. The grid is the same two-column grid; it has one cell
  filled.
- **No "N checks remaining" and no "Completed checks · N" inside a card.** An
  Emergency Access card counts the findings behind one subject. A policy
  Readiness tile is itself one check with no findings under it, so there is
  nothing to count or fold. The component draws both lines when there is
  something to draw.
- **A one-option Task selector.** The step has one Entra procedure, so the task
  frame's Task select has one option. Emergency Access steps have three or four.
- **No Method selector.** The task has no method variants; Emergency Access
  draws one only for the passkey task, which does.
- **No Troubleshooting link beside Microsoft Learn.** The step's package
  publishes no troubleshooting scenarios; the frame draws the link when there
  are any.
- **"Defer this step" in the footer.** An Emergency Access step can never be
  deferred (`roadmap/blockerSteps.ts`), so its footer has no left-hand control.
  This step's content marks it deferrable, so the shared footer draws the same
  secondary button it draws on every other deferrable step. Cutting it would
  remove a capability, not a component, so it was left alone.
- **No decision form in the action column.** Emergency Access Step 1 takes a
  decision (which accounts); this step takes none, so the action column holds
  the milestone alone.
