# Content Review — Run Context

## What this is

You are applying word-for-word content fixes to the IAMAI planner. Every fix is defined in a content spec file in `docs/content-review/specs/`. Each spec names a step ID, quotes the CURRENT text on production, and gives the exact TARGET replacement. Your job is to find the source of each piece of text in the codebase, replace CURRENT with TARGET, and commit.

## Where the text lives

Implementation content is generated from package files under `docs/implementation-content/[step-id]/`. Step metadata (titles, Why text, Done When, readiness bar text, tile labels) may live in:

- `src/plan/steps/` or similar step-definition modules
- `src/plan/readiness/` or readiness resolvers
- Template strings in renderers under `src/components/`
- Package JSON/MD files under `docs/implementation-content/[step-id]/`

**Discovery rule:** Before editing, `grep -rn` the exact CURRENT text (or a distinctive 6+ word substring) across `src/` and `docs/` to find where it lives. If it's generated from a template or function, fix the generator, not a downstream cache. If the text is in a `.md` or `.json` content file, edit that file directly.

## Universal issues reference

Read `docs/content-review/specs/UNIVERSAL-ISSUES.md` before starting any segment. It defines the global issue codes (C1, C2, C5, C6, C7, C9, C10, C12) that specs reference. You do not execute this file — it is context only. Each spec tells you exactly what to fix for its step; the universal list explains why.

## Rules

1. **Exact match only.** Every CURRENT → TARGET replacement must match the spec file verbatim. Do not rephrase, do not "improve" beyond what the spec says. If a spec says "No change," skip that section entirely.

2. **One commit per spec.** After applying all changes for one content-spec file, run the build/test suite, then commit with message `content: [step-id] — apply content spec`. If tests fail, fix only what your edit broke, re-run, then commit.

3. **Do not touch code logic.** You are changing text strings, labels, and content. If a fix requires changing rendering logic, component structure, or data flow, record it in BLOCKED.md and move on.

4. **Global issues.** The specs reference catalogued global issues (C1, C2, C5, C6, C7, C9, C10, C12). These are patterns that repeat across steps. When a spec calls out a global issue, apply the fix described in that spec for that step. Do not attempt to fix the global issue at the architectural level — only fix the instance the spec describes.

5. **C6 rewrites (developer-spec → portal walkthrough).** Several specs replace Entra implementation text wholesale. The CURRENT text may be generated from a template or content package. Find the source, replace the content. If the source is a template that generates text for multiple steps, only change the content for the step the spec names — do not alter the template logic for other steps.

6. **AI Info rewrites.** Same rule as C6. Find where the AI Info content is sourced, replace it for the named step only.

7. **"in GetIAMAI" removals.** Many Done When and Why sections say "in GetIAMAI" where they should reference the tenant or say nothing. The spec gives the exact replacement for each instance.

## Build and test

After each spec's changes:
```
npm run build
npm test
```
If no test suite exists, `npm run build` alone is sufficient. The tree must be green before committing.

## Overnight failure protocol

- If a grep finds nothing for a CURRENT string, record it in `docs/content-review/BLOCKED.md` as `- [step-id] · [section] · CURRENT text not found in codebase` and continue to the next section in that spec.
- If a build fails after your edit, revert that edit, record it in BLOCKED.md as `- [step-id] · [section] · build failed after edit: [one-line error]`, and continue.
- If you cannot determine where text is sourced from (template vs. static file), record it in BLOCKED.md and continue.
- Never stall. Log and move on.

## Freeze

Do not modify:
- Test infrastructure
- Build configuration
- Deployment scripts
- Any file not related to the content spec you are executing
- The spec files themselves
