# What IAMAI Planner is for

The owner and Claude re-aligned on this on 2026-09-23, after Claude's fixes kept making the tool more defensible and less useful. Every audit pass reads this first, and judges each step against it before judging its accuracy.

## The tool
An IT admin at a small or mid business (Business Premium is the target) signs in and gets a Conditional Access rollout plan built from their own tenant. Nobody gets locked out, and the admin always knows the next thing to do.

## How it must feel
- **An expert who has already looked.**
  - IAMAI has read the tenant, so it gives the answer and the exact action: which accounts, which policy, which values, which clicks.
  - It confirms when the step is done.
- **Useful, not defensible.** The failure to avoid is optimising for having hedged every claim, disclosed every gap and passed every test, rather than for a person on their tenant knowing exactly what to do.
- **The tool carries the uncertainty; the person never does.**
  - Never "could not read / verify / confirm", "not established", "none found", or "Waiting on you to confirm".
  - When IAMAI lacks something, it reads it, derives it, or designs the step so it doesn't need it.
  - For data states no real tenant has shown, delete the line rather than build a contingency.
- **Suggest, never assume.** Suggestions are welcome and easy to see, and IAMAI states only facts it holds. "You're signed in to IAMAI with this account" is a fact; "this is your working account" is an assumption.
- **No homework.** No workflow checks. Never ask the person to verify what the scan verifies, or to record what IAMAI never reads.
- **No fluff.** No filler, qualifiers, lectures about how IAMAI works, or warnings nobody asked for. Stating a weakness nobody needs is fluff too. Every line must read well and give a useful instruction, or go. Prefer deleting over rewording.
- **Don't add for the sake of adding.** No new features or words beyond what makes the step do its job.
- **Uniformity is a big deal.** Every step follows docs/plans/roadmap-flow/step-template.md, and the same kind of line is phrased the same way everywhere.
- **The plan reads in doing order,** with no duplicate steps or cards, and one place for each fact.
- **Web only;** nobody uses it from a phone.

## The questions every audit asks of every step
1. Does a person reading this know exactly what to do next, with real names and values?
2. Does it complete when the work is done, and not before or after?
3. Is any line here to protect IAMAI rather than to help the person? Delete it.
4. Does it read like a senior admin talking to a colleague: plain, short, specific?
5. Is it the same shape as every other step?
