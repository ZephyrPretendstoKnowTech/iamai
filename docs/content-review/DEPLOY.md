# Content Review — Deployment Guide

## Execution order

| Segment | Phase | What it does | Items |
|---------|-------|-------------|-------|
| S0 | Universal | Renderer fixes R1–R9, UI polish U-P1–U-P3, resolved decisions D1–D5 | 17 code changes |
| S1 | Universal | Content pattern sweeps C1–C5 | 5 find/replace sweeps across all packages |
| S2 | Per-step | Prerequisite steps | 5 specs |
| S3 | Per-step | MFA and auth policy steps | 5 specs |
| S4 | Per-step | Session and admin steps | 5 specs |
| S5 | Per-step | Risk, device, campaign steps | 5 specs |
| S6 | Per-step | Remaining new-policy steps | 5 specs |
| S7 | Per-step | Final steps and cleanup | 5 specs |

**S0 and S1 MUST run before S2.** Universal fixes change shared templates and renderer logic. Per-step specs go on top.

---

## What's in the box

```
docs/content-review/
├── DEPLOY.md                      ← this file
├── RUN-CONTEXT.md                 ← Claude Code reads this first every segment
├── SEGMENTS.md                    ← S0–S7 segment definitions
├── run-content-review.ps1         ← the runner script
└── specs/                         ← 31 files
    ├── UNIVERSAL-CONTENT-CHANGES.md   ← executable spec for S0 and S1
    └── content-spec-*.md (30 files)   ← one per step, for S2–S7
```

---

## Step 1: Kill the current run

If S0 from the old runner is still running:

```powershell
# Ctrl+C in the terminal running it, then:
cd C:\Dev\IAMAI
git stash list
# If there's a stash from the current run, drop it:
git stash drop stash@{0}
# Revert any uncommitted changes from the partial run:
git checkout -- .
```

Check the git log for any commits the old run made. If they landed correctly, keep them. If they're wrong, revert:

```powershell
git log --oneline -10
# If bad commits exist:
git revert HEAD~N..HEAD --no-commit
git commit -m "revert partial content-review run"
```

---

## Step 2: Replace the runner files

Delete the old `docs/content-review/` folder contents (keep the `specs/` folder intact), then drop in the new versions of these 4 files:
- DEPLOY.md
- RUN-CONTEXT.md
- SEGMENTS.md
- run-content-review.ps1

The `specs/` folder should already have all 31 files from the previous commit.

---

## Step 3: Commit

```powershell
cd C:\Dev\IAMAI
git add docs/content-review/
git status
# Should show 4 modified files (the runner files)
git commit -m "content-review: rebuild runner — universals first"
```

---

## Step 4: Pre-flight

```powershell
# Clean tree
git status
# Should say "nothing to commit, working tree clean"

# Spec count
(Get-ChildItem docs\content-review\specs\content-spec-*.md).Count
# Should say 30

# Universal file
Test-Path docs\content-review\specs\UNIVERSAL-CONTENT-CHANGES.md
# Should say True

# Claude Code
claude -p "Reply with the word ok" --model opus --effort high
# Should print ok
```

---

## Step 5: Run

```powershell
powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\content-review\run-content-review.ps1 -Primary opus -Secondary opus
```

Watch until S0 exits. If exit 0, leave it overnight.

To resume from a segment:
```powershell
... -Start 2
```

---

## Step 6: Morning review

1. `docs\content-review\BLOCKED.md` — anything that couldn't be applied
2. `docs\content-review\logs\` — one JSON per segment
3. `git log --oneline -50` — should show commits for R1–R9, U-P1–U-P3, C1–C5, then 30 per-step commits

---

## Nothing deferred

All 5 open decisions have been resolved and are included in S0 as D1–D5. There are no items waiting on your input. The run covers everything.

---

## Estimated runtime

8 segments × 30–90 min each = 4–12 hours. S0 (renderer fixes) will be the longest — it's 12 code changes. S1–S7 are text replacements and should be faster.
