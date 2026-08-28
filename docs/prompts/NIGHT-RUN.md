# Overnight run plan

Goal: prompts 19 and 20 execute unattended, surviving usage-limit pauses, with a
reviewable record in the morning.

## How it works

`scripts/night-run.ps1` runs Claude Code in headless mode (`claude -p`) once per prompt
file, in order. After each prompt it verifies the working tree is committed and that
`npm test` passes before moving on. If a run exits because of a usage limit, the script
sleeps and retries the same prompt; it never skips ahead. Everything is logged to
`docs/qa/night/<prompt>-<timestamp>.log`.

## Before starting (do these yourself)

1. `git status` is clean and pushed; `npm test` passes.
2. Create a branch for the night: `git switch -c night-run-1`. Everything lands there,
   so a bad night is one branch delete rather than a repair job.
3. Confirm headless flags on your version: `claude --help`. The script uses
   `claude -p <file contents> --permission-mode acceptEdits --output-format text`.
   If your build names these differently, fix the two lines at the top of the script.
4. Set Windows to not sleep: `powercfg /change standby-timeout-ac 0`.
5. Leave the dev server stopped. The prompts do not need it; the smoke test in prompt 20
   starts its own.

## Running

```powershell
cd C:\Dev\IAMAI
pwsh -File .\scripts\night-run.ps1
```

Leave the window open. In the morning: read `docs/qa/night/SUMMARY.md`, then
`git log --oneline` on the branch, then run the app.

## Rules the script enforces

- One prompt at a time, in numeric order, never in parallel.
- A prompt that fails twice in a row stops the run; the remaining prompts are not
  attempted, and the failure is written to SUMMARY.md.
- Nothing is pushed to main. The branch is pushed after each successful prompt so the
  work is safe if the machine reboots.
- If `npm test` fails after a prompt, the script records it and stops. It does not try
  to fix tests by re-prompting.
