# IAMAI Planner: status

The one place that says where things stand, where each kind of fact lives, and
which owner decisions are binding. Update it at the end of every round or night.
Everything else is either a working document it links to, or history in
`archive/`.

## Live

- `main` = `round-5`, deployed 2026-09-29 (owner's call, before Codex's audit):
  https://getiamai.com (Home) and https://getiamai.com/planner/ (the tool). The whole history
  was rewritten the same day (owner): the résumé, old screenshots, the owner's personal
  address and every tenant value are gone from every branch and tag; only the Home About bio
  and LinkedIn link keep the owner's name. Commit ids from before 2026-09-29 no longer resolve.
- It carries the 2026-09-29 match-Jon run (re-pin to 8af3b118, MFA for Everyone = AllUsers,
  the guest pair, BaselineScopes, 3.8 lists every created policy), not CI-verified: Codex
  audits it, `docs/launch/2026-09-29-codex-handoff.md`.
- Under it, the pre-share night of 2026-09-28/29 (CI green then): the held step's wait first (N-001), scripts pinned
  to the scanned tenant (N-027), the countries baseline line (N-018), Save Countries (N-034),
  the licence line (N-008), the tile filter (N-005), the calendar card (N-047), dash-tolerant
  policy names, three Cleanup rows held back, trusted-network goals delivered only by a
  block that carves out the trusted network, and the contained security fixes of the
  pre-share audit (Graph token to graph.microsoft.com only, CSV formulas, masking, the
  diagnostics hash, links from tenant names, PowerShell quoting, SECURITY.md).

## v1.1 (in progress, branch `v1.1`)

- **The plan:** [docs/plans/v1.1/plan.md](plans/v1.1/plan.md), owner-approved
  2026-10-03.
  - Base: `v1.0.0` = `fcf59888`, the live `main`.
  - v1.1 is built on `v1.1` and reaches `main` only when the owner says so.
  - CI runs on every push to `v1.1`.
- **Phase 0 is done.**
  - The full preflight is green; its one failure was a product defect, fixed at the source.
  - Codex's 2026-09-29 audit is checked: six findings in frozen sections, waiting as Track 1
    item 6.
  - `VITE_CHANNEL=preview` builds a marked preview; unset, the build is byte-identical.
  - The CI actions are pinned.
- **Next:** Phase 1 (Track 1, safety and plain wrongs), on the owner's word.
- **Owner decisions of 2026-10-03, binding for v1.1:**
  - **Passkeys:** device-bound and attested for all users, with no AAGUID key restrictions.
    A tenant's own allow list is left as it is.
  - **The lockout list:** 1.3 lists the active people whose passkey stops working before the
    change.
  - **Tenants:** v1.1 adds switching between tenants in one browser, then sign-in to a named
    tenant. One tenant per session at a time.
  - **Jon's baseline:**
    - the lockdown kit is created Off;
    - Countries NoExclusions and AVD allowed-users are built;
    - ADM-Users and BreakGlass-TrustedLocations stay in the footer;
    - the Agent blocks wait.

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
| After launch | `docs/plans/v1.1/plan.md` (the v1.1 plan), drawing on `docs/plans/roadmap-flow/v1.1-list.md` |
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
- 1.3's passkey-type lockout (a synced-only account stopped by the Device-bound type
  while the allow list is withheld) ships unchanged for now and is first after launch; a
  warning was built and taken out after five review rounds (2026-09-28).
- The tool directs people to build the baseline's own policies, not IAMAI's interpretation
  of it; exceptions only where necessary, and safety is one (2026-09-28). Applied: the
  trusted-network goals (SharePoint and OneDrive, AVD, service accounts) are delivered only
  by a block that carves out the trusted network, never by a Countries block. Decided 2026-09-29 (owner:
  match Jon exactly, follow Jon over IAMAI's own interpretations): Require MFA for Everyone
  is Jon's AllUsers with its Intune Enrollment and RMS exclusions, and the session-loop hold
  is removed; Require MFA for Guests builds Jon's two policies (Mixed-Guests, B2B-Guest), a
  tenant's own guest policy is named as existing coverage and never edited; Medium-Risk
  Users stays Jon's JSON (password change + strength); every policy the plan adds or
  replaces is listed in 3.8 Create the Policies in Report-only, one card per policy, and an
  in-place correction stays its own step's task. Pin: Jon's 8af3b118.
- Policy names match with dashes, spacing and capitals aside: one key,
  baseline/discover.ts nameKey (2026-09-28).
- An On Hold step whose tabs hand over a live change heads its column with its wait, and
  every tab and copy says it first (2026-09-28).
- Every PowerShell script names the scanned tenant, closes a Graph session open in another
  tenant and connects with -TenantId (2026-09-28).
- Held back from every plan for now: Alert on Emergency Account Sign-ins, Remove Emergency
  Accounts Excluded by Name and Review Overlapping Policies (roadmap/cleanup.ts
  WITHHELD_CLEANUP; taking a kind out brings it back). Align Policy Names stays (2026-09-28).
- Polish, not features. The polish research waits for v1.5 or v2 (2026-09-26).
- Out of v1.0: Jon's AVD allowed-users block (its group is unidentified); the ZTCA Admin
  Portal block stays hidden (2026-09-24). WindowsAzureAD-BaselineScopes is in (2026-09-29):
  Require Phishing-Resistant MFA for Basic Sign-ins, in Extend MFA right after Require MFA
  to Register a Device, created in Report-only and turned on only when everyone has a
  method that meets the strength.
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
