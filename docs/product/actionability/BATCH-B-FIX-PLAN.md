# Batch B Fix Plan — Universal + Per-Step

## File placement

Before running anything, commit these files to the repo:

```
docs/product/actionability/
├── IAMAI-Universal-Fixes-Master-List.md    ← the v2 universal spec (592 lines)
├── RUN-CONTEXT-B.md                        ← batch B run context (below)
├── SEGMENTS-B.md                           ← batch B segment prompts (below)
└── step-findings/
    ├── README.md
    ├── step-emergency-access.md
    ├── step-exclusions-group.md
    ├── step-device-decision.md
    ├── step-mfa-campaign.md
    ├── step-block-legacy-auth.md
    ├── step-admins-phishing-resistant.md
    ├── step-passkey-settings.md
    ├── step-auth-strength.md
    ├── step-trusted-network.md
    ├── step-allowed-countries.md
    ├── step-separate-accounts.md
    ├── step-admin-session.md
    ├── step-auth-transfer.md
    ├── step-device-code.md
    ├── step-guests-mfa.md
    ├── step-mfa-everyone.md
    ├── step-token-protection.md
    ├── step-sign-in-risk-medium.md
    ├── step-pim-reauth.md
    ├── step-sign-in-risk-high.md
    ├── step-intune-enrollment.md
    ├── step-register-info.md
    ├── step-admin-portals.md
    ├── step-session-lifetime.md
    ├── step-unsupported-platforms.md
    ├── step-device-reg-mfa.md
    ├── step-geo-restriction.md
    ├── step-managed-device.md
    ├── step-user-risk.md
    ├── step-user-risk-medium.md
    ├── step-rename-policies.md
    ├── step-review-baseline.md
    └── step-workload-identity.md
```

---

## Segment breakdown

**Why this order:** Engine changes what state each step is in. Renderer reads those states to decide what to show. Content fills in what the renderer shows. Running them out of order means the renderer reads stale states, or content targets a layout that doesn't exist yet.

| Segment | Scope | Items | Est. time | Risk |
|---|---|---|---|---|
| B1 | Engine + projector | U19, U20, U21, U22, U11, U28 | 60–90 min | High — changes lane states for every enforced policy |
| B2 | Plan rows | U9, U10, U12, U13 | 30–45 min | Low — cosmetic, no state changes |
| B3 | Step body layout | U1, U2, U3, U4, U5 | 90–120 min | High — major DOM restructure |
| B4 | Readiness tiles | U6, U7 | 60–90 min | Medium — component rewrite |
| B5 | Implementation visibility + viewer | U14, U15, U16, U17, U18 | 60–90 min | Medium — projector + dialog changes |
| B6 | Data + pre-fill | U24, U27 | 45–60 min | Medium — investigation + matching logic |
| B7 | Content fixes | High-risk channels, admin-portals message, workload-identity gen, device-code conditional input | 45–60 min | Low — content + one generation rule |
| B8 | Per-step content pass | Source checked, Done-when, Learn links, milestone text across all 33 steps | 60–90 min | Low — META and CONTENT.md edits only |
| B9 | Gauntlet + deploy | Full test suite, walk, smoke, build, Chrome live check | 30–45 min | — |

**Total estimated: 7–10 hours.** Fits in one overnight run. If Fable limits hit, the runner switches to Opus. Segments B2 and B8 are the safest on Opus (cosmetic + content); B1 and B3 need the most judgment (Fable preferred).

---

## Deployment best practices

### 1. One commit per segment, squashed
Each segment produces one squashed commit with the segment ID prefix (`B1:`, `B2:`, etc.). WIP commits every 20 minutes during work, squashed at segment end. This lets you `git revert B3:…` without touching B1 or B2.

### 2. Snapshot lock protects cross-step drift
A3's snapshot harness and change-scope lock are active in CI. Any segment that changes step output must update snapshots with `[snapshots]` in the commit message. If a content-only change in B8 accidentally changes a renderer output, CI catches it.

### 3. No deploy until B9
Segments B1–B8 are local commits. Nothing ships until B9 runs the gauntlet and pushes. If the overnight run hits a problem at B4, segments B1–B3 are safe local commits and B4's failure is in BLOCKED.md. You review BLOCKED.md in the morning, decide whether to fix or skip, and run B9 when ready.

### 4. After B1, stop and verify lane states
B1 changes what state enforced policies are in (Observing → Correct or Completed). This affects everything downstream. The segment includes a fixture verification: lane counts for every fixture must match the new expected values. If they don't, B1 records the mismatch in BLOCKED.md and stops. Do not proceed to B2 until B1's fixture counts are green.

### 5. After B3, stop and verify layout
B3 restructures the step body DOM. The walk and smoke checks reference DOM structure. B3 must update the walk assertions and page contracts for the new two-column layout. If the walk has failures that aren't just stale selectors, B3 records them and stops.

### 6. Chrome live check in B9 only
No Chrome during B1–B8. The dev server may not be running, and Chrome checks are slow. B9 runs `npm run dev` in the background, waits for it, and does the full 12-point live check from Batch A plus the new items from the universal list.

### 7. Stash recovery after failed segments
The runner stashes uncommitted work when a segment fails. The next segment starts clean. If the stash contains work you want to keep, the recovery prompt is: `Read BLOCKED.md for segment BN, apply stash@{0}, and continue from where it stopped.` But usually it's cleaner to restart the segment from the squashed commit before it.

---

## Runner command

```powershell
powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\product\actionability\run-overnight.ps1 -Segments SEGMENTS-B.md -Context RUN-CONTEXT-B.md -Ids B1,B2,B3,B4,B5,B6,B7,B8
```

Review in the morning: `git log --oneline -30` and `Get-Content docs\product\actionability\BLOCKED.md`. If all 8 segments exited 0, run B9:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\product\actionability\run-overnight.ps1 -Segments SEGMENTS-B.md -Context RUN-CONTEXT-B.md -Ids B9
```

---

## Pre-run checklist

1. All docs committed to `docs/product/actionability/step-findings/` and the master list to `docs/product/actionability/`
2. `RUN-CONTEXT-B.md` and `SEGMENTS-B.md` committed to `docs/product/actionability/`
3. Tree is clean (`git status --short` prints nothing)
4. On `main` branch
5. Power settings: never sleep on AC
6. Close Chrome (not needed until B9)

---

## What Lachlan reviews before B9

1. `git log --oneline -30` — one squashed commit per segment, all on main
2. `BLOCKED.md` — any entries from B1–B8? If yes, read each one and decide: fix (write a one-segment patch prompt) or defer (it ships without that item)
3. `npm run dev` → open `localhost:5173/planner/?demo=1#/plan` — spend 5 minutes:
   - Header: Steps / Completed / Projected finish / Started (no Waiting/Remaining)
   - Ready tab: no row subtitles, no "next" pill, "Decision" not "Needs decision"
   - Open Emergency Access: two-column layout, tiles compact, no What-to-do, no Planned work
   - Open an enforced policy (Legacy Auth): badge "Completed" or "Ready · Correct", Implementation channels visible
   - Open the passkey step: Entra + AI Info only (no PowerShell)
4. If it looks right → run B9. If something is wrong → paste what's wrong here and I'll write the fix segment.

