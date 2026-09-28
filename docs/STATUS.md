# IAMAI Planner: status

The one place that says where things stand, where each kind of fact lives, and
which owner decisions are binding. Update it at the end of every round or night.
Everything else is either a working document it links to, or history in
`archive/`.

## Live

- `main` at f0c82ea3, deployed 2026-09-28 and audited live: https://getiamai.com (Home)
  and https://getiamai.com/planner/ (the tool). It carries the pre-launch night (the Plan
  without its Show completed and Show deferred toggles, public docs corrected, superseded
  docs archived) and the morning of 2026-09-28 (Home's plan-first headline and share
  picture, the On line, the Inforcer step on the template, the way out on user-risk
  steps, the tenant guard), after four review rounds.

## Launch

The morning list: [docs/launch/2026-09-28-pre-launch.md](launch/2026-09-28-pre-launch.md).
It holds what needs the owner's yes before posting, what waits, what to discard, and
what was promised and never done.

## Where each fact lives

| What | Where |
|---|---|
| How to work: rules, verify, commits | `CLAUDE.md` (the one source; `AGENTS.md` points to it) |
| Contributing, CI and review rules | `CONTRIBUTING.md` |
| Permissions, storage, exports, reporting a vulnerability | `SECURITY.md` |
| Every word the product shows | `docs/design/content.json` |
| Design authority | `docs/design/approved/` (the packs in `anatomy/`, their hashes and what production follows in `manifest.json`), then the brand contract `docs/brand/iamai-brand-contract.md`; owner changes made since are in the decisions below |
| The baseline | `baselines/*.pinned.json` with its index and interpretation; `docs/baselines/` |
| The step standard | `docs/plans/roadmap-flow/intent.md` (the seven questions), `step-template.md` |
| The v1.0 plan and its design decisions | `docs/plans/roadmap-flow/v1-plan.md` |
| Rounds: scores, Needs attention, Round 5 candidates, next-chat prompt | `docs/plans/2026-09-27-low-hanging-fruit.md` and its `-backlog.json` |
| After launch | `docs/plans/roadmap-flow/v1.1-list.md` |
| What every step shows, per test tenant | `docs/qa/step-snapshots/` (`node scripts/step-snapshots.mjs`) |
| The dependency playbook the engine reads | `docs/product/actionability/` |
| Content specs the tests cite | `docs/content-review/` |
| Product decisions and their reasons, historical | `SPEC.md` |
| Past plans, handoffs, audits and prototypes | `archive/` (the 2026-09-27 moves are under `archive/2026-09-27/`, at their old paths) |

## Where it stands

After Round 4 (live audit, 2026-09-27): 87.75 across the eight surfaces, none under 85;
the honest whole-tool rating is about 86 (truth and safety about 90, experience about
81). What stands between it and 90: steps still correct the tenant's own policies in
place (the policy-matching pilot on 4.3 is Round 5's felt item), Export's file names
and CSVs, Inventory search, and real users. The table and its reasons are in the
rounds document.

## Binding owner decisions

Each is binding until the owner changes it; don't re-ask. The date is when it was set.

**The product**
- Read-only: no write scope, no call that changes a tenant. No server, no telemetry of
  its own. One tenant per sign-in for v1.0.
- The pinned baseline (Jon Hope's Defense in Depth) is king. Microsoft Learn is a source
  of facts, never of a policy's shape (2026-09-25).
- Exact controls: a policy completes its step only when every setting equals the plan's.
  Every difference, stricter or weaker, is corrected or accepted with a reason
  (2026-09-25, 2026-09-26).
- Policy matching: build new, retire old (2026-09-27). A step will create the baseline's
  policy beside a tenant policy it did not write, and Cleanup retires the old one once the
  new one is On. The pilot is 4.3 in Round 5; until it ships, steps correct in place.
- New policies take the baseline's own names; renames live in 8.2 Align Policy Names
  (2026-09-26).
- Implementation Tasks show the whole procedure in every state. Risk is named in Tasks
  Remaining, never by hiding a procedure (2026-09-25).
- Never "couldn't read" or "not established": where IAMAI cannot read, it says nothing
  (2026-09-24).
- Every open row shows a plain date. No "Est." or "(estimated)" anywhere; the tile keeps
  "Estimated finish" (2026-09-27, replacing the 2026-09-23 "Est. <date>" rule).
- Everyone works remotely: every block whose only purpose is keeping sign-ins to the
  trusted network reads Doesn't apply, and service and shared-device accounts get MFA like
  anyone (2026-09-24; wording 2026-09-27).
- 5.1 and 5.2 are created On with no report-only week; 5.2's turn-on waits for the
  passkey campaign (2026-09-24).
- Emergency access: only purpose-phrase names classify an emergency account; only the
  operator's saved decision writes the list; one passkey per emergency account, and the
  second account is the redundancy (2026-09-22).
- The MFA campaign finishes when everyone is ready or on the Turn On Without Them list
  (2026-09-22).
- The printed plan is a leadership briefing, not a manual (2026-09-26).
- Finished sections are frozen: a change that reaches one, even through shared code,
  needs the owner's yes first (2026-09-26).
- The Plan draws finished and deferred steps in place; there are no Show completed and
  Show deferred toggles (2026-09-27, on the night branch).
- Needs your input counts each question once. The Home image (pack v3) is regenerated
  every release: `npm run build:site && node scripts/home-shot.mjs` (2026-09-27).
- Home says what IAMAI does in words the product backs, with no fluff: no "Free public
  preview", no caption under the Plan picture; the primary button reads "Connect your
  tenant". The sample's bar holds only its buttons and Leave the demo (2026-09-28).
- A correction to a policy that is On says so; a user-risk step held by a person's risk
  says how to clear it (2026-09-28).
- Polish, not features. The polish research waits for v1.5 or v2 (2026-09-26).
- Out of v1.0: Jon's AVD allowed-users block and WindowsAzureAD-BaselineScopes (their
  groups are unidentified); the ZTCA Admin Portal block stays hidden (2026-09-24).
- IAMAI is the brand; IAMAI Planner is the tool.

**How work is done**
- The owner approves every fix, and every push. Deploy runs on every push to `main`; CI
  runs on demand, for major changes (2026-09-23).
- Audits are Claude's own, in Claude in Chrome. Workflows only review a diff
  (2026-09-25).
- Never commit tenant data, and never put the owner's tenant or people names in the repo.
- 90% means nine in ten people who touch the tool find it useful and well made. A safety
  floor sits outside the score: nothing the tool says to do locks anyone out, loses work
  or weakens protection (2026-09-27).
