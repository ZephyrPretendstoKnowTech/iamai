# night-run.ps1 - run IAMAI prompt files through Claude Code unattended.
# Usage: pwsh -File .\scripts\night-run.ps1
# Adjust CLAUDE_ARGS if your Claude Code version names flags differently (claude --help).

$ErrorActionPreference = 'Stop'
$repo       = (Get-Location).Path
$promptDir  = Join-Path $repo 'docs\prompts'
$logDir     = Join-Path $repo 'docs\qa\night'
$claudeArgs = @('--permission-mode','acceptEdits','--output-format','text')

$prompts = @(
  '19-qa-sweep.md',
  '20-hardening-and-trust.md'
)

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$summary = Join-Path $logDir 'SUMMARY.md'
"# Night run $(Get-Date -Format 'yyyy-MM-dd HH:mm')`n" | Set-Content $summary

function Test-LimitHit([string]$text) {
  return $text -match 'usage limit|session limit|rate limit|quota|resets at|resets d|too many requests|429'
}

function Invoke-Prompt([string]$file) {
  $path = Join-Path $promptDir $file
  if (-not (Test-Path $path)) { throw "Missing prompt file: $path" }

  $instruction = @"
Read docs/prompts/$file and carry it out exactly as written. Do not start until you have
read it in full, along with CLAUDE.md and any design documents the prompt references.
Before each numbered item, state in one line what you are about to change.
When finished: run npm test and vite build, fix anything you broke, commit with a message
listing the pages touched, and push the current branch. Do not start any other prompt file.
"@

  $attempt = 0
  while ($attempt -lt 12) {
    $attempt++
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $log   = Join-Path $logDir "$($file -replace '\.md$','')-$stamp.log"
    Write-Host "[$(Get-Date -Format HH:mm)] $file attempt $attempt"

    $output = ''
    try {
      $output = & claude -p $instruction @claudeArgs 2>&1 | Tee-Object -FilePath $log | Out-String
    } catch {
      $output = $_.Exception.Message
      $output | Add-Content $log
    }

    if (Test-LimitHit $output) {
      "- $file attempt $attempt paused on a usage limit at $(Get-Date -Format 'HH:mm'), sleeping 30 minutes" | Add-Content $summary
      Start-Sleep -Seconds 1800
      continue
    }

    # Commit anything the session left behind, then verify.
    if ((git status --porcelain).Length -gt 0) {
      git add -A
      git commit -m "night-run: $file (uncommitted leftovers)" | Out-Null
    }
    git push -u origin HEAD 2>&1 | Add-Content $log

    npm test 2>&1 | Add-Content $log
    if ($LASTEXITCODE -ne 0) {
      "- **$file FAILED**: npm test did not pass. Run stopped. See $log" | Add-Content $summary
      return $false
    }

    "- $file completed at $(Get-Date -Format 'HH:mm') ($(git rev-parse --short HEAD))" | Add-Content $summary
    return $true
  }

  "- **$file FAILED**: still limited after 12 attempts. Run stopped." | Add-Content $summary
  return $false
}

foreach ($p in $prompts) {
  if (-not (Invoke-Prompt $p)) { break }
}

"`nFinished at $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Add-Content $summary
Write-Host "Done. See docs/qa/night/SUMMARY.md"
