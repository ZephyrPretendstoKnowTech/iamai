# The V1 audit: what runs, in what order

The method is `audit-method.md`. This is the running order, what each pass owns,
and how findings become fixes. The order matters: each pass reads what the one
before it produced, and auditing text that is about to change wastes the audit.

## 0. Land the shape decisions first — but only those

The owner answered eleven things on 2026-09-20 (`owner-questions-2026-09-20.md`).
They do not all belong in the same place, and the split is deliberate: **the audit
is what decides what is worth fixing, so nothing else gets built ahead of it.**

**Step 0, before any audit — the rules that decide the shape of every tile and
task:** the card shape (subject → what the scan found → where to do it), no
pointer sentence where a step has one task, a card heading that is what is being
waited on with its state beneath, the dated source line on every step, and risks
behind the "Why IAMAI says this" dialog rather than print-only. Land these first
or every one of the ~45 steps produces the same finding — "this tile has the old
shape" — and the audit becomes forty-five restatements of one change. With them
landed, a tile finding is about content: is this true, is it useful, is it fluff.

**Step 0 as well, because they are cheap, approved and contingent on nothing:**
the four Direction text fixes, the two Emergency Access instruction fixes, and
making the medium user-risk policy build the same thing on every channel.

**Step 2.5, after the two heuristic audits and before the walkthrough:** the third
office-network answer, and mail devices getting their own group. Both change what
a person is asked and what the plan contains, so the walkthrough should test the
real flow; the tile and instruction audits are indifferent to them.

**Everything else waits for the audit to rank it** — the items taken over on
2026-09-20, the anatomy deviations, the wave specs' leftovers. Some of it the
audit will say to delete rather than polish, which is the cheapest fix available.

**Out of scope for now, owner's call:** the admin-portals re-pin (held until after
launch) and anything on the frozen steps beyond the six text fixes he approved.

## 1. Readiness tile audit — heuristic, three independent passes

**Owns:** every Tasks Remaining tile on every step, in every state a fixture can
reach, on both demo snapshots.

**Asks of each tile:** does it name a real subject? does the count mean
something? is the next check the actual next action? does its sentence say
something the heading and the procedure do not? would a person know what to do
from this tile alone? does any tile exist only to fill the row?

**Produces:** one row per tile — step, state, quoted text, verdict, severity,
proposed fix. Plus a short list of tiles that should not exist.

## 2. Implementation Task audit — heuristic, three independent passes

**Owns:** every task on every step, and every channel of it: Entra, PowerShell,
JSON, AI Info, Email.

**Asks of each:** is the task list the right set for the state? does the leading
task match what the step is for? is the procedure complete enough to follow in a
real tenant, with exact blade names and field values? do the channels describe
**the same policy** — the Entra tab, the JSON body and the PowerShell must not
build different things? is every Microsoft claim current, and dated? does the
AI Info prompt describe the step honestly, and the Email say what people will
experience?

**Produces:** one row per task per channel, same shape as pass 1, plus a
cross-channel divergence list (the highest-severity class this product has).

## 3. Journey audit — cognitive walkthrough, then a service blueprint

**Owns:** the story, end to end: Home → Connect → scan → Direction → the plan →
one policy deployed in report-only → enforce → re-scan → export.

**Method:** walk each scenario as a named person, asking the walkthrough's four
questions at every step: will they try to do the right thing, will they see the
control, will they connect it to the outcome they want, and will they see that it
worked? Then blueprint it: for each step, what IAMAI actually read, what it
inferred, and what it asked the person to supply — so a claim with nothing behind
it shows up as a gap in the blueprint.

**Scenarios, in this order:** the small-business admin who has never written a
Conditional Access policy; the MSP technician doing it for a client; the person
who inherits the plan and has to finish it; the tenant where half the reads fail
(no premium licence, refused permission). Use Claude-in-Chrome against the
deployed site where a real browser makes the answer more honest.

**Reads:** the outputs of passes 1 and 2, and it runs after step 2.5 has landed —
a journey fault is often a tile fault seen from further away, and the walkthrough
must test the flow as it will ship.

**Produces:** the coherence findings, each tied to the scenario and the step, and
an explicit list of places the story breaks, repeats itself, or asks twice.

## 4. Two passes the owner did not name, and why they belong

- **Claim integrity.** Every sentence that asserts something about the tenant,
  checked against what the scan can actually know. This product's promise is that
  it never says more than it read; a single overstatement is worse for trust than
  ten clumsy sentences. Severity 4 by definition.
- **Failure-mode pass.** What every surface says when reads fail, permission is
  refused, the licence is absent, or the tenant is empty. A public beta meets
  these on day one, and they are the states least exercised by fixtures.

Both are cheap next to their value and run alongside pass 3.

## 5. The fix pass

Findings from 1–4 merge into one list, deduplicated, each with severity and
effort. Then:

1. **Severity 4 first**, whatever the effort: anything that could widen a policy,
   lock somebody out, or overstate what IAMAI knows.
2. **High impact, low effort** next, batched by theme so one commit fixes one
   class everywhere rather than one step at a time.
3. **Owner decisions** extracted as they appear, in the short form
   `owner-questions-2026-09-20.md` now uses: the screen, what it says, what a
   person gets wrong, the options as outcomes, a recommendation.
4. **Deferred** items recorded with the reason, not silently dropped.

Each fix keeps the project's existing bar: a unit test per acceptance item, the
same words on screen, in the export, in print and in the prompt pack, no new
component or CSS class, and frozen steps untouched.

## 6. Then, and only then, the security review

In its own session, against the final tree, with its own threat model: what a
hostile baseline file, a hostile tenant response, or a malicious link in content
could do; what the export and prompt pack leak; the Graph scopes actually
requested; the CSP and the absence of a server; what a stranger's tenant data
touches on this machine. It runs last because it should audit what ships, and it
needs an adversarial frame rather than a quality one.

## Working rules for the audit sessions

- Three independent passes, merged. Not one pass trying to see everything.
- Reproduce or drop. Quote, don't paraphrase.
- The audit finds; the fix pass decides. No pass rewrites what it is auditing.
- Every Microsoft claim gets its page and the date it was checked.
- Nothing on a frozen step is changed — it is written down for the owner.
