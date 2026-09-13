# Content Review — Run Context

## What this is

You are fixing every piece of user-facing text and every shared renderer issue in the IAMAI planner. The work has two phases, executed in strict order:

**Phase 1 (S0–S1): Universal fixes.** Shared renderer logic, shared templates, and cross-cutting content patterns. These affect 15–22 steps each and must land first so per-step work doesn't collide with template changes.

**Phase 2 (S2–S7): Per-step content specs.** Word-for-word CURRENT → TARGET replacements for each of the 30 steps. These go on top of the universal fixes and handle anything step-specific that the universal sweep didn't reach.

## Source files

- `docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md` — the spec for S0 and S1. Contains 9 renderer fixes (R1–R9), 3 UI polish items (U-P1 to U-P3), and 5 content pattern sweeps (C1–C5). **This is executable work, not reference material.**
- `docs/content-review/specs/content-spec-*.md` (30 files) — one per step, used in S2–S7.

## Where the text lives

Implementation content is generated from package files under `docs/implementation-content/[step-id]/`. Step metadata (titles, Why text, Done When, readiness bar text, tile labels) may live in:

- `src/plan/steps/` or similar step-definition modules
- `src/plan/readiness/` or readiness resolvers
- Template strings in renderers under `src/components/`
- Package JSON/MD files under `docs/implementation-content/[step-id]/`
- Shared lane/milestone/tile components

**Discovery rule:** Before editing, `grep -rn` the exact text (or a distinctive 6+ word substring) across `src/` and `docs/` to find where it lives. If it's generated from a template or function, fix the generator, not a downstream cache. If the text is in a `.md` or `.json` content file, edit that file directly.

## Rules

1. **Exact match only.** Every replacement must match the spec verbatim. Do not rephrase, do not "improve" beyond what the spec says. If a spec says "No change," skip that section entirely.

2. **One commit per logical unit.** In S0: one commit per renderer fix (R1, R2, etc.). In S1: one commit per content pattern (C1, C2, etc.). In S2–S7: one commit per content-spec file. Commit message format: `content: R1 — milestone shows lane substatus` or `content: s-prereq-break-glass — apply content spec`.

3. **Build and test after every commit.** Run `npm run build` and `npm test` (if tests exist). The tree must be green before committing. If a build breaks, revert that edit, record it in `docs/content-review/BLOCKED.md`, and continue.

4. **Do not touch unrelated code.** You are changing text strings, labels, content, and the specific renderer logic described in the spec. If a fix requires changing data flow, state management, or API contracts, record it in BLOCKED.md and move on.

5. **Universal before per-step.** S0 and S1 MUST complete before S2 starts. The runner enforces this by running segments in order. Within a segment, apply items in the order listed.

6. **Per-step specs override universals.** If a per-step spec gives a TARGET that differs from what a universal sweep would produce, the per-step spec wins. The per-step specs were written after the universals and account for step-specific exceptions.

7. **Template vs. per-file.** When a universal pattern (C1–C5) lives in a shared template, fix it once at the template. When it lives in per-step content files, fix every file that contains it. Grep broadly — `grep -rn "canonical target" src/ docs/` — and fix every hit.

## Overnight failure protocol

- If a grep finds nothing for a target string, record it in `docs/content-review/BLOCKED.md` as `- [item] · text not found in codebase` and continue.
- If a build fails after your edit, revert that edit, record it in BLOCKED.md as `- [item] · build failed: [one-line error]`, and continue.
- If a renderer fix requires understanding component state you can't determine from the code, record it in BLOCKED.md and continue.
- Never stall. Log and move on.

## Freeze

Do not modify:
- Test infrastructure
- Build configuration
- Deployment scripts
- Any file not related to the current segment's work
- The spec files themselves
