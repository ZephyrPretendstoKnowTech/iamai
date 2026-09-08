# Contributing

IAMAI is a single-maintainer project. Issues and pull requests are welcome; this
file records the rules that already hold, so a change does not have to discover
them in review.

## What a change may not do

These are product boundaries, not preferences. A change that crosses one will be
declined however good the rest of it is.

- **Read-only.** No Graph write scope, and no call that mutates a tenant. Not
  even a report-only policy: the plan tells the operator what to create, in the
  portal, themselves.
- **Browser-only.** No server, no telemetry, no CDN, no fonts or scripts from a
  third party. `src/network.test.ts` fails the build if a source file addresses
  a host other than `graph.microsoft.com`, `login.microsoftonline.com` and
  `raw.githubusercontent.com`.
- **No tenant-derived data in the repository.** No sign-in names, object ids or
  tenant GUIDs, in fixtures, tests, screenshots or commit messages.
- **Exclusions go through the exclusions group**, never an emergency-access
  account by name.

`SECURITY.md` states what the app reads and stores, `SPEC.md` states the product
decisions and their reasons, and `CLAUDE.md` states the working rules.

## What is not a casual refactor target

The safety foundations and the baseline translation carry decisions that are
load-bearing and were made deliberately: the Conditional Access operation
semantics, the step lifecycle and readiness authority, the emergency-access
decision, the Plan step contract, and the pinned baseline and its
interpretation. Change them when correctness requires it, and say in the pull
request which decision is being revisited and why. Do not add a second authority
for a fact that already has one.

## Before you open a pull request

```
npx tsc --noEmit
npm test
npm run build:site
npm run smoke
```

The `ci` check runs the same four on every push and every pull request, and
`main` requires it: a change cannot land on `main` until `ci` is green.

Publication is gated separately. After a change reaches `main`, the deploy
workflow runs `walk`, and the build and the deploy each depend on it, so a P0
finding stops the site from being published. `walk` is not a pull-request check
— it cannot run before a change lands — so treat a green `ci` as necessary
rather than sufficient.

An acceptance is a unit test. A change that can be asserted should arrive with
the test that asserts it.

## Review, and commits

`.github/CODEOWNERS` routes every path to the repository owner.

`main` requires signed commits. The rule that requires the `ci` check also
requires a signature, so a commit reaching `main` is rejected unless it carries
one, and the maintainer's commits are signed with an SSH key. A pull request is
not rejected for having unsigned commits of its own: the commit GitHub writes
when it squashes or merges is signed by GitHub. The repository admin holds a
bypass on that rule while the build-out is running, and it will be removed.

## Reporting a problem

Security: `SECURITY.md`. Anything else — a wrong number, unclear wording, a step
that does not match your tenant — **feedback@getiamai.com**, or an issue on this
repository. Every page has a link in the footer that prefills the message.
