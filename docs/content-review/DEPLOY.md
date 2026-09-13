# Content Review — Deployment Guide

## What you're doing

Applying 30 word-for-word content fixes to the IAMAI planner codebase. Each fix is defined in a content-spec file. A runner script feeds them to Claude Code in 6 segments of 5, overnight, unattended.

---

## Step 1: Place the files

Everything goes in `C:\Dev\IAMAI\docs\content-review\`. Create the folder and subfolders if they don't exist.

```
C:\Dev\IAMAI\docs\content-review\
├── DEPLOY.md                      ← this file (reference only)
├── RUN-CONTEXT.md                 ← Claude Code reads this first every segment
├── SEGMENTS.md                    ← defines S0–S5 (which specs per segment)
├── run-content-review.ps1         ← the runner script
└── specs\                         ← all 31 files go here
    ├── UNIVERSAL-ISSUES.md
    ├── content-spec-admin-portals.md
    ├── content-spec-admin-session.md
    ├── content-spec-all-users-no-persistence.md
    ├── content-spec-allowed-countries.md
    ├── content-spec-auth-strength.md
    ├── content-spec-auth-transfer.md
    ├── content-spec-block-legacy-auth.md
    ├── content-spec-block-unsupported-platforms.md
    ├── content-spec-break-glass.md
    ├── content-spec-campaign.md
    ├── content-spec-device-code.md
    ├── content-spec-device-plan.md
    ├── content-spec-exclusions-group.md
    ├── content-spec-geo-restriction.md
    ├── content-spec-guests-mfa.md
    ├── content-spec-intune-enrollment.md
    ├── content-spec-managed-device.md
    ├── content-spec-mfa-everyone.md
    ├── content-spec-notAssessed.md
    ├── content-spec-passkey-settings.md
    ├── content-spec-phishing-resistant.md
    ├── content-spec-pim-activation-reauth.md
    ├── content-spec-register-info-protected.md
    ├── content-spec-rename-policies.md
    ├── content-spec-separate-accounts.md
    ├── content-spec-sign-in-risk-high.md
    ├── content-spec-sign-in-risk-medium.md
    ├── content-spec-token-protection.md
    ├── content-spec-trusted-network.md
    └── content-spec-user-risk-medium.md
```

The 20 specs from earlier conversations and the 10 from the most recent two go in `specs\`. You should have all 31 files (30 specs + 1 universal issues list) downloaded already.

---

## Step 2: Commit before anything else

From PowerShell in `C:\Dev\IAMAI`:

```powershell
cd C:\Dev\IAMAI
git add docs/content-review/
git status
```

You should see ~35 new files staged. If `git status` shows anything else modified or untracked outside `docs/content-review/`, deal with it first — the tree must be clean except for these new files.

```powershell
git commit -m "content-review: specs, runner, context"
```

**This commit is mandatory.** The runner stashes uncommitted work between segments. If the runner files aren't committed, they get stashed too and the script deletes itself mid-run. That's what happened.

---

## Step 3: Pre-flight checks

Run these in order. All must pass.

```powershell
# 1. Clean tree
git status
# Should say "nothing to commit, working tree clean"

# 2. Spec files exist
(Get-ChildItem docs\content-review\specs\content-spec-*.md).Count
# Should say 30

# 3. Runner files exist
Test-Path docs\content-review\run-content-review.ps1
Test-Path docs\content-review\RUN-CONTEXT.md
Test-Path docs\content-review\SEGMENTS.md
# All should say True

# 4. Claude Code auth and version
claude auth status
claude --version
# Auth should exit 0. Version should be 2.1.259+

# 5. Model works
claude -p "Reply with the word ok" --model opus --effort high
# Should print ok

# 6. Git push works without prompting
git push --dry-run
# Should complete silently

# 7. Power settings
# Set to never sleep on AC. Display off is fine; don't lock.
```

---

## Step 4: Run it

```powershell
powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\content-review\run-content-review.ps1 -Primary opus -Secondary opus
```

Watch until S0 exits 0. If it does, the plumbing works. Then leave it.

To resume from a specific segment (e.g. S3):

```powershell
powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\content-review\run-content-review.ps1 -Primary opus -Secondary opus -Start 3
```

---

## Step 5: Morning review

Read in this order:

1. `docs\content-review\BLOCKED.md` — anything that couldn't be applied
2. `docs\content-review\logs\` — one JSON log per segment, named `S0-opus-<timestamp>.json`
3. `git log --oneline -30` — should show one commit per spec that landed: `content: [step-id] — apply content spec`

---

## What the runner does

- Runs S0 through S5, each in a fresh `claude -p` session
- Each segment reads RUN-CONTEXT.md, then applies 5 specs from SEGMENTS.md
- One commit per spec: `content: [step-id] — apply content spec`
- If a session dies mid-edit, uncommitted tracked changes are stashed (untracked files are never stashed — the runner can't delete itself)
- Logs go to `docs/content-review/logs/` (gitignored)
- Rate-limit hits: waits 35 min and retries, up to 8 times
- Two consecutive segment failures: stops and logs why
- BLOCKED.md collects anything that couldn't be applied

---

## Quality safeguards

- Each spec has exact CURRENT → TARGET text — no interpretation needed
- Claude Code greps the codebase for each CURRENT string before editing
- Build/test runs after every spec before committing
- If a build breaks, the edit is reverted and logged to BLOCKED.md
- Each spec is one atomic commit — easy to revert individually
- The universal issues list gives Claude Code the pattern context without re-reading 30 specs

---

## If something goes wrong

**Runner script not found:**
Files aren't committed. `git add docs/content-review/ && git commit -m "fix"`.

**Segment exits immediately (exit 1 in <5 seconds):**
Model alias wrong, auth expired, or CLI flag rejected. Check the log file — `type <log path>` — first 10 lines will say why.

**Stash conflicts on resume:**
`git stash list` to see what's there. `git stash show stash@{0}` to peek. `git stash drop stash@{0}` to discard, or `git stash pop` to apply.

**BLOCKED.md has entries:**
These are strings Claude Code couldn't find in the codebase (text may be generated dynamically or live in a different location than expected). Review each one manually after the run.
