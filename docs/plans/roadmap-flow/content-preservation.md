# Content preservation during the roadmap restructure

The owner, 2026-09-23:

> Let's make sure as we go that we DON'T break or remove any content. The only thing we can fix of the steps we're keeping, is which dependencies they have, and the order. I don't want to have to find all the work we did over the last few days cleaning up wording didn't amount to anything.

## The rule
- **A step we keep:** only its dependencies and its order may change. Its wording, tasks, instructions, Readiness cards, completion criteria and exports stay exactly as they are, except where the owner approved a change (list below).
- **A step that merges into another** (countries into 6.3, each medium risk step into its high partner): its content moves across word for word and is combined, not rewritten. If two versions of the same sentence clash, keep both, or ask; never write a third.
- **Anything that must go:** retired Direction questions, and duplicates. Its text is removed only after it is confirmed to be either a word-for-word duplicate or a retirement the owner approved.

## Baseline
**Pre-restructure baseline: `d884e60f`** (main after the large-tenant sign-in read, before any roadmap stage merged).

## The check, before every merge
```
node scripts/content-diff.mjs --base d884e60f --head <branch>
```
It lists every user-visible string that was reworded, removed, moved or added, key by key, plus changed implementation-content files. Every line must match an approved change below, a word-for-word move, or a confirmed duplicate. Anything else is reverted before merge.

## Approved wording changes
- **Section titles:**
  - Define Your Rollout Scope;
  - Prepare Accounts and Objects;
  - Extend MFA Coverage;
  - Limit Sessions and Require Healthy Devices;
  - "Waiting on your direction" becomes "Waiting on your answers" (V2 decision A).
  - Cross-references to a renamed section change the name only.
- **The view (V2 decisions B and H):**
  - the remaining and completed counts on section headers;
  - the how-to intro (start at the top of All work; create every Ready · Create policy in report-only once sections 1 and 2 are done);
  - the "ready to create in report-only now" line.
- **Licence wording (V2 decision G):** pages.plan.footer.notLicensedNote and pages.export.printPage1.notLicensed.
- **Per-user MFA only when needed (V2 decision E):** the bg.perUserMfaOff explanation, so it doesn't send people to a step that is hidden.
- **Hold the compliant-device create (V2 decision D):**
  - the statement of why the create waits (readinessHeldCreate);
  - shared.certificatePrompt reworded to Microsoft's description (it had no reader until now).
- **Switched-off policies go to Report-only, never straight On (owner, 2026-09-23):**
  - the switched-off instructions, procedure and task title;
  - the tagged-disabled finding;
  - the no-operation line;
  - rollback advice ("set the policy back to Report-only", not "disable").
  - The "leave it off until then" wait variants and the switched-on done-line go, because that wait no longer exists.
- **Stage 3 (V1 decisions 3, 4, 5 and 6):**
  - the three retired Direction questions (external methods, travel, device exceptions) are removed;
  - the countries location step's content moves into 6.3 word for word;
  - Doesn't apply wording for Turn Off Security Defaults and Define the Trusted Network.
- **Stage 4 (V1 decision 7):** each medium risk step's content moves into its high partner word for word; the two-policy strip.
- **Stage 5 (V1 decision 8):** print and export ordering only.

## Confirmed duplicates removed so far
- `pages.plan.howTo.items`: its six entries repeated the intro and the five `legend` descriptions word for word ("Ready: " + the legend text). The legend is unchanged.
