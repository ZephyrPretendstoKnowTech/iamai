# Prompt files

Each file is one instruction set for Claude Code. They live in the repo so every
session can re-read exactly what it was asked, and so the request history is
versioned alongside the code.

Run one by saying, in Claude Code:

    Read docs/prompts/<file> and carry it out exactly as written. Do not start
    until you have read it in full. When finished, summarize what changed,
    list anything you could not do and why, and confirm the commit.

Run them in numeric order. Do not run the next one until the previous one has
committed.

| File | Purpose | Precondition |
|---|---|---|
| `00-scoring-split.md` | Activity vs MFA as two dimensions; strongest method; UI copy fixes | Skip if the table already shows Activity and MFA state as separate columns |
| `01-lock-data-model.md` | Every data field and document later features depend on | 00 done |
| `02-lane-b.md` | Sign-in evidence collection and the derived tables | 01 done |
| `03-app-shell.md` | Design system, navigation, footer, Readiness table features | Edit the two URL placeholders in the file first; 02 done |
