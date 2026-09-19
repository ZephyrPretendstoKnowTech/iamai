# Weekend launch: the living hand-off

Target: a public LinkedIn beta on Monday 2026-09-21. The owner and Claude work through Saturday and Sunday. This file is the one place a new session starts from. Update it at every milestone.

## Hand-off prompt (paste into a new session)

> Continue the IAMAI weekend launch. Read `docs/plans/weekend-launch.md` first, then `docs/plans/v1-procedure.md` §3 (the V1 standard). Work from "Next" below. Fast cadence: `npx tsc --noEmit`, `npm run build:site`, focused `node --test --test-isolation=none <files>`, `git diff --check`, commit, `git fetch`, `git push origin HEAD:main`. CI (type check, unit tests, smoke) now runs on every push beside the deploy and never gates it: check it the same day. Run the full suite only at milestones. Tell the owner when context is getting heavy and hand off at a phase boundary.

## Owner decisions this weekend (2026-09-19)

- **Audience:** public (LinkedIn), as a beta.
- **Scope:** "We're going to do it all": design and combine the decision groups, and refresh every next step, by Monday.
- **Jon's groups:** assume IAMAI's identification of each group is right. Where a group follows from a decision, the person creates it and IAMAI maps to it. No basis means the reference is dropped. Break-glass is excluded from every policy, and 5628ad67 is taken as a second break-glass mistake.
- **Design review:** the owner sees every design and recommendation before it's built, and says explicitly when they disagree.
- **Red tests:** clear them, or remove them where they test old data or something already defined as complete.

## Done

- `7e99ffb4`: CI runs on every push to main, beside the deploy and never gating it.

## Next

1. The owner's answers on the 22 overnight decisions (`docs/plans/2026-09-19-overnight-review.md` §2).
2. The V1 step map (phase 1 of `v1-procedure.md`), including the combined decision group, for owner approval.
3. The Step Kit (a group registry, with Emergency Access re-expressed and no visible change).
4. The Direction group.
5. The policy waves, then launch readiness.
