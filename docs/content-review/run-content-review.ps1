# run-content-review.ps1 — executes content review segments S0..S5 in fresh Claude Code sessions.
#
# BEFORE FIRST RUN: commit this file and all specs to git. See DEPLOY.md.
#
# Run:    powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\content-review\run-content-review.ps1 -Primary opus -Secondary opus
# Resume: ... -Start 3

param(
  [int]$Start = 0,
  [int]$End = 5,
  [string]$Primary = "opus",
  [string]$Secondary = "opus",
  [string]$Effort = "high",
  [string]$Repo = "C:\Dev\IAMAI",
  [int]$RateLimitWaitMinutes = 35,
  [int]$RateLimitRetries = 8
)

$docs    = "docs/content-review"
$logDir  = Join-Path $Repo "$docs/logs"
$blocked = Join-Path $Repo "$docs/BLOCKED.md"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $Repo

# ── Pre-flight ──────────────────────────────────────────────────────
# Abort early if the setup is wrong, rather than stashing the world at 3am.

# 1. Runner files must be committed (not untracked) or stash will eat them.
$runnerStatus = & git -C $Repo status --porcelain -- "$docs/run-content-review.ps1" "$docs/RUN-CONTEXT.md" "$docs/SEGMENTS.md"
if ($runnerStatus -match '^\?\?') {
  Write-Host "FATAL: Runner files are untracked. Commit them first:"
  Write-Host "  git add $docs/ && git commit -m 'content-review: specs, runner, context'"
  exit 1
}

# 2. Spec files must exist.
$specCount = (Get-ChildItem (Join-Path $Repo "$docs/specs/content-spec-*.md") -ErrorAction SilentlyContinue).Count
if ($specCount -lt 30) {
  Write-Host "FATAL: Expected 30 spec files in $docs/specs/, found $specCount."
  Write-Host "  Place all content-spec-*.md files in $docs/specs/ and commit."
  exit 1
}

# 3. Working tree should be clean.
$dirty = & git -C $Repo status --porcelain
if ($dirty) {
  Write-Host "WARNING: Working tree is not clean. Proceeding, but stash between segments may pick up unrelated changes."
  Write-Host $dirty
}

# ── Gitignore logs ──────────────────────────────────────────────────
$gi = Join-Path $Repo ".gitignore"
if (-not (Select-String -Path $gi -Pattern "content-review/logs" -Quiet -ErrorAction SilentlyContinue)) {
  Add-Content $gi "`n$docs/logs/"
  & git -C $Repo add .gitignore | Out-Null
  & git -C $Repo commit -m "content-review: ignore logs" | Out-Null
}

# ── Version-gated flags ────────────────────────────────────────────
$ver = (& claude --version) -replace '[^\d\.]',''
$promptsFlag = @()
try { if ([version]$ver -ge [version]"2.1.259") { $promptsFlag = @("--permission-prompts","none") } } catch {}

# ── Functions ───────────────────────────────────────────────────────

function Get-Dirty { return ((& git -C $Repo status --porcelain) -ne $null) }

function Invoke-Segment([string]$seg, [string]$model, [string]$resumeNote) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = Join-Path $logDir "$seg-$model-$stamp.json"
  $prompt = "Read $docs/RUN-CONTEXT.md, then execute segment $seg from $docs/SEGMENTS.md exactly as written. Do not read other segments. Follow the overnight failure protocol. End with the tree green and committed.$resumeNote"
  & claude -p $prompt `
      --model $model --effort $Effort `
      --dangerously-skip-permissions @promptsFlag `
      --output-format json `
      2>&1 | Out-File -FilePath $log -Encoding utf8
  $code = $LASTEXITCODE
  $text = Get-Content $log -Raw
  return @{ code = $code; log = $log; model = $model
            limited = ($text -match 'rate_limit|usage limit|limit reached|out of usage') }
}

# CRITICAL FIX: no -u flag. Only stash tracked (modified/deleted) files.
# Untracked files (logs, new files Claude Code created) are left alone.
# This prevents the runner from stashing itself.
function Stash-Leftovers([string]$seg, [string]$why) {
  if (Get-Dirty) {
    & git -C $Repo stash push -m "auto-stash after $seg ($why)" | Out-Null
    Add-Content $blocked "`n- runner · $seg · $why with uncommitted changes · stashed as 'auto-stash after $seg ($why)'"
    return " NOTE: a previous attempt of this segment left uncommitted work in git stash 'auto-stash after $seg ($why)'. Inspect it first; apply it if it is coherent and green, otherwise drop it and redo the task."
  }
  return ""
}

# ── Main loop ───────────────────────────────────────────────────────

$consecutiveFailures = 0
for ($n = $Start; $n -le $End; $n++) {
  $seg = "S$n"
  Write-Host "=== $seg start $(Get-Date -Format u) ==="

  $r = $null
  $resumeNote = ""
  $model = $Primary
  $waits = 0
  while ($true) {
    $r = Invoke-Segment $seg $model $resumeNote
    if (-not $r.limited) { break }

    $resumeNote = Stash-Leftovers $seg "usage limit on $model"
    if ($model -eq $Primary -and $Primary -ne $Secondary) {
      Add-Content $blocked "`n- runner · $seg · $Primary usage limit at $(Get-Date -Format u); restarting segment on $Secondary"
      Write-Host "$Primary limited; switching $seg to $Secondary"
      $model = $Secondary
      continue
    }
    if ($waits -ge $RateLimitRetries) { break }
    $waits++
    Add-Content $blocked "`n- runner · $seg · usage limit; waiting $RateLimitWaitMinutes min (wait $waits of $RateLimitRetries)"
    Start-Sleep -Seconds ($RateLimitWaitMinutes * 60)
  }
  Write-Host "=== $seg exit $($r.code) on $($r.model) $(Get-Date -Format u) === log: $($r.log)"
  Stash-Leftovers $seg "exit $($r.code)" | Out-Null

  if ($r.code -ne 0) { $consecutiveFailures++ } else { $consecutiveFailures = 0 }
  if ($consecutiveFailures -ge 2) {
    Add-Content $blocked "`n- runner · stopped after two consecutive failed segments ($seg)"
    Write-Host "Two consecutive failures; stopping."
    break
  }
}
Write-Host "Done. Read $docs/BLOCKED.md and the logs in $logDir."
