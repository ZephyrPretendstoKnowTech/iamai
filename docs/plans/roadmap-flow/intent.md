# What IAMAI Planner is for

The owner and Claude re-aligned on this on 2026-09-23, after Claude's fixes kept making the tool more defensible and less useful. On 2026-09-24 they confirmed the vision again and added the second half: the pitfalls. Every audit pass reads this first, and judges each step against it before judging its accuracy.

## The tool
An IT admin at a small or mid business signs in and gets a Conditional Access rollout plan built from their own tenant.
- **Licences:** Business Premium is the target, and Entra ID P1 is the minimum.
- **Who reads it:** the admin makes every change themselves. They range from the expert on a large tenant, who wants what's already right left alone, to the help-desk tech who has never opened Conditional Access and is afraid to break something. The voice serves both: no talking down, and no assumed expertise.

The plan has two halves:
- **The path.** What to do, in the order the work is actually done, with the exact change: which accounts, which policy, which values, which clicks.
- **The pitfalls.** What the scan already knows will bite them if they do it as written, named before they act, with the fix. Some examples:
  - a service account a policy will stop;
  - a person whose MFA method hasn't been used in the records;
  - an emergency account inside a policy it has to survive.

The design goal is that nobody gets locked out: every failure point the scan can see is caught before it happens. Where IAMAI can't read something, it says nothing about it. It never guesses and never warns in general terms.

## How it must feel
- **An expert who has already looked.**
  - IAMAI has read the tenant, so it gives the answer and the exact action.
  - It confirms when the step is done.
- **Useful, not defensible.** The failure to avoid is optimising for having hedged every claim, disclosed every gap and passed every test, rather than for a person on their tenant knowing exactly what to do.
- **The tool carries the uncertainty; the person never does.**
  - Never "could not read / verify / confirm", "not established", "none found", or "Waiting on you to confirm".
  - When IAMAI lacks something, it reads it, derives it, or designs the step so it doesn't need it.
  - For data states no real tenant has shown, delete the line rather than build a contingency.
- **A pitfall is specific, or it isn't said.** It names who or what IAMAI found and the fix. A warning that names nobody is fluff.
- **Suggest, never assume.** Suggestions are welcome and easy to see, and IAMAI states only facts it holds. "You're signed in to IAMAI with this account" is a fact; "this is your working account" is an assumption.
- **No homework.** No workflow checks. Never ask the person to verify what the scan verifies, or to record what IAMAI never reads.
- **No fluff.** No filler, qualifiers, lectures about how IAMAI works, or warnings nobody asked for. Stating a weakness nobody needs is fluff too. Every line must read well and give a useful instruction, or go. Prefer deleting over rewording.
- **Don't add for the sake of adding.** No new features or words beyond what makes the step do its job. A control earns its place only if the plan behaves differently because of the answer.
- **Uniformity is a big deal.** Every step follows docs/plans/roadmap-flow/step-template.md, and the same kind of line is phrased the same way everywhere.
- **The plan reads in doing order,** with no duplicate steps or cards, and one place for each fact.
- **Web only;** nobody uses it from a phone.

## The questions every audit asks of every step
1. **The next action.** Does the person know exactly what to do next, with real names and values?
2. **The value.** What does the person gain by finishing this step, and does About this Step say that outcome, not how IAMAI works?
3. **The pitfalls.** What does the scan already know that would bite them if they did this as written? Does the step name it (who or what, and the fix) before they act, in Tasks Remaining? Say nothing where IAMAI couldn't read.
4. **Completion.** Does it complete when the work is done, and not before or after?
5. **Protection.** Is any line here to protect IAMAI rather than to help the person? Delete it.
6. **Voice.** Does it read like a senior admin talking to a colleague: plain, short, specific?
7. **Shape.** Is it the same shape as every other step, and in the order the work is done?
