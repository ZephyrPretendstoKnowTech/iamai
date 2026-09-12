# run-overnight.ps1 — executes SEGMENTS.md S0..S8 in fresh Claude Code sessions, unattended.
# Run:  powershell -ExecutionPolicy Bypass -File C:\Dev\IAMAI\docs\product\actionability\run-overnight.ps1
# Resume from a segment:  ... -Start 3
#
# Model policy: every segment tries Fable first. If Fable reports a usage limit, the same segment is
# restarted on Opus. If Opus also reports a limit, wait and retry. Next segment tries Fable again
# (a 5-hour window may have reset); if Fable is still limited it fails fast and Opus takes it.

param(
  [int]$Start = 0,
  [int]$End = 8,
  [string]$Primary = "fable",
  [string]$Secondary = "opus",
  [string]$Effort = "high",
  [string]$Repo = "C:\Dev\IAMAI",
  [int]$RateLimitWaitMinutes = 35,
  [int]$RateLimitRetries = 8
)

$docs    = "docs/product/actionability"
$logDir  = Join-Path $Repo "$docs/logs"
$blocked = Join-Path $logDir "runner-notes.md"   # runner notes live in logs/ (gitignored) so they never dirty the tree
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $Repo

# logs/ must be ignored or the stash step would stash the log being written.
$gi = Join-Path $Repo ".gitignore"
if (-not (Select-String -Path $gi -Pattern "actionability/logs" -Quiet -ErrorAction SilentlyContinue)) {
  Add-Content $gi "`n$docs/logs/"
  & git -C $Repo add .gitignore | Out-Null
  & git -C $Repo commit -m "runner: ignore actionability logs" | Out-Null
}

# --permission-prompts exists from v2.1.259; older versions reject unknown flags.
$ver = (& claude --version) -replace '[^\d\.]',''
$promptsFlag = @()
try { if ([version]$ver -ge [version]"2.1.259") { $promptsFlag = @("--permission-prompts","none") } } catch {}

function Get-Dirty { return ((& git -C $Repo status --porcelain) -ne $null) }

function Invoke-Segment([string]$seg, [string]$model, [string]$resumeNote) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = Join-Path $logDir "$seg-$model-$stamp.json"
  $prompt = "Read $docs/RUN-CONTEXT.md, then execute segment $seg from $docs/SEGMENTS.md exactly as written. Do not read other segments. Follow the overnight failure protocol. End with the tree green and committed.$resumeNote"
  & claude -p $prompt `
      --model $model --effort $Effort `
      --dangerously-skip-permissions @promptsFlag `
      --chrome --output-format json `
      2>&1 | Out-File -FilePath $log -Encoding utf8
  $code = $LASTEXITCODE
  $text = Get-Content $log -Raw
  return @{ code = $code; log = $log; model = $model
            limited = ($text -match 'rate_limit|usage limit|limit reached|out of usage') }
}

function Stash-Leftovers([string]$seg, [string]$why) {
  if (Get-Dirty) {
    & git -C $Repo stash push -u -m "auto-stash after $seg ($why)" | Out-Null
    Add-Content $blocked "`n- runner · $seg · $why with uncommitted changes · stashed as 'auto-stash after $seg ($why)'"
    return " NOTE: a previous attempt of this segment left uncommitted work in git stash 'auto-stash after $seg ($why)'. Inspect it first; apply it if it is coherent and green, otherwise drop it and redo the task."
  }
  return ""
}

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
    if ($model -eq $Primary) {
      Add-Content $blocked "`n- runner · $seg · $Primary usage limit at $(Get-Date -Format u); restarting segment on $Secondary"
      Write-Host "$Primary limited; switching $seg to $Secondary"
      $model = $Secondary
      continue
    }
    if ($waits -ge $RateLimitRetries) { break }
    $waits++
    Add-Content $blocked "`n- runner · $seg · $Secondary usage limit too; waiting $RateLimitWaitMinutes min (wait $waits of $RateLimitRetries)"
    Start-Sleep -Seconds ($RateLimitWaitMinutes * 60)
    $model = $Primary   # a window may have reset; Fable fails fast if not
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
Write-Host "Done. Read $docs/BLOCKED.md, $logDir/runner-notes.md, and the S8 log in $logDir."
