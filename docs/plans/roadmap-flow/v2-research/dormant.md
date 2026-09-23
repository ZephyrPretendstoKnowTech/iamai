# 3.1 Disable or Confirm Dormant Accounts: owner request review

**Recommendation.** Put the smart list in v1.1. It would take about 3–4 hours with tests, well over the 30-minute limit. The basic list the owner asked for already exists. For v1.0 there is one bug worth fixing instead, and it is about a 20–30 minute fix (section 5).

Everything was checked on worktree `C:\Dev\IAMAI-q-flow` (a433ab41) and on the live demo. I wrote nothing tracked. The four probes I wrote under `docs/qa/night/personas/` have been deleted.

## 1. What it lists now

- **The rule.** It lists enabled people whose last successful sign-in is older than 90 days, or who have none on record. It only judges people whose sign-in activity the scan could read (`src/derive/sets.ts:242-251`; `INACTIVE_DAYS = 90` at `src/scoring/mfaViability.ts:12`).
- **Last sign-in date.** It takes the later of two dates: the directory's `lastSuccessfulSignIn` and the newest interactive sign-in record (`sets.ts:141-144`).
- **Where it is built.** `src/roadmap/generate.ts:1246-1254` and `:2945-2993`. The step completes when every listed account is disabled, active again, or kept with a reason (`:2950`, `:2990-2993`).
- **What the person sees (live demo):**
  - The accounts appear only as one comma-joined sentence in the Entra task: "Accounts to review (2): MFP Reception (…), Kai Nguyen (…)". That sentence comes from `src/ui/surfaces/stepPackage.ts:1066-1067` and `CONTENT.md:4`.
  - Below it is a "keep" picker with one reason for the whole set (`src/ui/surfaces/ContentStep.tsx:1467-1495`).
  - The last-sign-in dates are shown only inside the "Why IAMAI says this" dialog, as "MFP Reception · Apr 25, 2026" (`src/derive/contentLists.ts:183`; content.json `who.accounts`).
  - The accounts are in directory order. There is no sorting, no account type and no created date.

## 2. What it already leaves out, and what it doesn't

**Left out:**
- **Disabled accounts** (`sets.ts:77`, `:104`, `:131-133`).
- **Confirmed service accounts from Direction 2.2** (`sets.ts:37-39`, `:75`; `src/roadmap/directionAnswers.ts:85`).
- **Accounts that look like a mailbox.** This covers Exchange-only licences, and an address with no plans and no sign-in (`sets.ts:105-110`).
- **Teams Rooms and shared devices**, found by their licence or by signing in only from a Teams device (`sets.ts:76`; `src/derive/sharedDevices.ts:14-35`).
- **Confirmed emergency accounts** (`sets.ts:38`).
- **People whose activity couldn't be read** (`sets.ts:245`). They are counted separately only when the Users read was `partial` (`generate.ts:2970-2982`).

**Still listed:**
- **Guests.** They count as people (`sets.ts:60`). Examples: demo "MFP Reception" (a guest), 2 on mid, 28 on large.
- **Brand-new accounts that haven't signed in yet.** The date the account was created is read (`src/graph/collect/collectors.ts:271`) but not used here. None of the eight fixtures has such an account created within the last 30 days.
- **Shared accounts picked by hand in Direction 2.2.** That pick is stored in `mapping.sharedDeviceUserIds` (`src/roadmap/decisions.ts:311`), and the dormant list never reads it (`sets.ts:121` reads only the licence/sign-in detection). No fixture shows this, because their picks are ones the licence detection already catches.
- **Emergency accounts that were nominated but not chosen** (`sets.ts:30-32`, by design).

## 3. What the scan has

- **Directory read (`collectors.ts:302-303`, `:255-289`):**
  - `signInActivity` (needs Entra ID P1): last successful sign-in and last attempt (the attempt may have failed). `lastNonInteractiveSignInDateTime` is not stored.
  - Also: `createdDateTime`, `accountEnabled`, `assignedPlans`, licences (`assignedLicenses`, stored as `skuIds`), `userType`, `mail`, `onPremisesSyncEnabled`, `department`, `jobTitle`.
  - Without P1 it falls back to the same read minus sign-in activity and marks it `partial` (`collectors.ts:304-327`).
- **Sign-in logs:** beta `auditLogs/signIns`, interactive sign-ins only (`src/graph/collect/laneB.ts:34-35`), last 30 days (`src/graph/collect/constants.ts:2`; `worker.ts:351`), P1 and AuditLog.Read.All (`registry.ts:121`).
- **Why this matters for the owner's "no sign-in logs in 30 days":** the logs miss sign-ins where an app like Outlook or Teams signs in in the background. The directory's last successful sign-in covers both kinds and is kept for the life of the account (https://learn.microsoft.com/graph/api/resources/signinactivity). IAMAI already uses it, which is the better source.

## 4. Can shared mailboxes be told apart without Exchange permissions?

Mostly, but only by inference. The mailbox's actual type needs a permission IAMAI doesn't request.

- **Sign-in blocked.** Microsoft blocks sign-in on new shared mailboxes by default (https://learn.microsoft.com/microsoft-365/admin/email/create-a-shared-mailbox), so IAMAI already leaves them out as disabled.
- **No licence.** Shared mailboxes don't need one (https://learn.microsoft.com/microsoft-365/admin/email/about-shared-mailboxes), so an address with no licence and no sign-in is already left out (`sets.ts:109`).
- **The definite answer** is Graph's `mailboxSettings.userPurpose` (shared, room or equipment). It needs MailboxSettings.Read (https://learn.microsoft.com/graph/api/resources/mailboxsettings), and IAMAI's consent list doesn't include it (`src/copy/permissions.ts:121-129`). Adding it changes the consent screen, so it is an owner decision and not v1.0.
- **What still slips through:** an enabled, unlicensed shared mailbox that someone once signed into directly. It stays on the list with its date.

## 5. Bug found while tracing (fix candidate for v1.0)

On a real tenant, accounts that have never signed in are left off the list. The step can then read as complete when it isn't.

- **What Graph does:** it leaves `signInActivity` out entirely for a user who never signed in (https://learn.microsoft.com/graph/api/resources/user, property table).
- **What IAMAI does with that:** `collectors.ts:258` marks each user as "activity read" only if that property is present. So those users come back as not read. `sets.ts:166-168` and `:245` then drop them from the list. The "couldn't read" count only appears on a `partial` read (`generate.ts:2971`), so they aren't counted anywhere.
- **The code contradicts its own comments.** `sets.ts:177-178` and `generate.ts:2966-2968` both say a missing property on a successful read means "read, not unread".
- **Why the fixtures don't show it:** they mark every user as read (`src/roadmap/fixtures/index.ts:676`).
- **What I ran:**
  - Mocked `collectUsers` returns `read:false` for a never-signed-in row with `partialReason null`.
  - I then re-ran getiamai with its 9 never-signed-in accounts read the way Graph actually returns them. The step went from "Ready · Review, 9 accounts" to "done / satisfied", showing "The scanned directory has no outstanding dormant accounts."
- **The fix:** on the successful path, treat sign-in activity as read for every user. That is one change in `collectors.ts` plus one test in `collectors.test.ts`. About 20–30 minutes including `npm run verify -- --prepush`.
- **Side effect the owner should know about:** on live tenants, MFA Readiness would move these accounts from activity "unknown" to "never signed in" (`mfaViability.ts:189-192`). The fixtures already assume that reading.
- **Not verified on a live tenant.**

## 6. The list on three fixtures (scan dated 2026-08-28)

**demo** (2 accounts):

| Account | Type | Last successful sign-in | Days ago |
|---|---|---|---|
| Kai Nguyen | member | 2026-05-16 | 104 |
| MFP Reception | guest (a printer account) | 2026-03-30 | 151 |

The live demo shows the same two accounts with rebased dates (Jun 11 and Apr 25).

**getiamai (curated)** (9 accounts, all "never signed in"):
- 8 members, created 2023-05 to 2024-09: Quinn Morgan, Jordan Taylor, Alex Morgan, Drew Ivanova, Alex Taylor, Noor Walker, Riley Nguyen, Alex Chen.
- 1 guest: Kai Brown.
- On a real tenant, the bug in section 5 would hide all 9.

**mid** (33 accounts):
- 31 members and 2 guests. None hold an admin role and none are unlicensed.
- The oldest are Priya Patel (2025-11-17, 284 days), Rowan Patel (283), Drew Nguyen (283), Morgan Nguyen (280), Alex Singh (274) … down to Sam Patel (94).
- The only account detected as shared (Jamie Haddad, Teams Rooms licence) is correctly left out.

**large, for contrast:** 731 accounts. 9 hold admin roles, and 510 are synced from on-premises Active Directory. The step's "Entra → Account enabled: No" instruction (`CONTENT.md:6`) is the wrong path for synced accounts. Microsoft's hybrid guidance is to disable them in Active Directory (https://learn.microsoft.com/entra/identity/users/users-revoke-access#revoke-access-for-a-user-in-the-hybrid-environment).

## 7. Proposed smart list (v1.1)

- **Criteria:** keep the current rule, 90 days. Microsoft suggests 90–180 days (https://learn.microsoft.com/entra/identity/monitoring-health/howto-manage-inactive-user-accounts), and `INACTIVE_DAYS` is shared with MFA Readiness (`mfaViability.ts:194`). A 30-day window would take the lists from:

  | Fixture | Today (90 days) | At 30 days |
  |---|---|---|
  | demo | 2 | 10 |
  | mid | 33 | 115 |
  | messy | 14 | 55 |
  | large | 731 | 2,081 (42% of the directory) |

- **Groups, in this order:**
  1. Admin-role holders.
  2. Never signed in, and the account is more than 30 days old.
  3. No sign-in for 90+ days, oldest first.
  4. Guests, pointed to Microsoft's stale-guest review.
  5. New accounts (under 30 days old, not signed in yet), shown as "not yet claimed" rather than "disable".
- **Columns:** account (name and UPN), last successful sign-in (date or "Never") with days, created date, member or guest, and flags. The flags are:
  - holds an admin role
  - synced from on-premises: disable in Active Directory
  - has a mailbox but no licence: may be a shared mailbox, so block sign-in
  - failed sign-in attempt since the last success, within 30 days (from the last-attempt date the scan already reads, `collectors.ts:261`; no fixture has this)
- **Sorting:** by group, then days since last success (longest first), then created date (oldest first).
- **Deliberately left out:**
  - a 30-day threshold
  - accounts whose activity couldn't be read (the step says so instead of guessing)
  - disabled, service, emergency and shared-device accounts, as today
  - the actual mailbox type (needs a new permission)
  - bulk or automatic disabling
  - licence-cost advice
- **Also for v1.1:** the list should read the Direction 2.2 shared picks.

## 8. Honest build estimates

- **Section 5 bug fix:** 20–30 minutes. Fits v1.0.
- **Sort-only slice** (riskiest first, from one shared helper used by `generate.ts:1246` and `contentLists.ts:98`, plus one unit test and prepush): 35–45 minutes. Over the limit.
- **Synced-account sentence in `CONTENT.md` and content.json** (with the registry regenerated): 30–45 minutes. Over the limit.
- **Full smart list:** about 3–4 hours. That breaks down as:
  - a shared grouping helper: 45 minutes
  - a table in the step body, plus the printed plan and a mobile-width check: 60–90 minutes
  - content keys: 30 minutes
  - tests: 45–60 minutes (new grouping and flag tests; updating the row format at `src/ui/surfaces/night1.test.ts:90` and the order check in `src/ui/surfaces/aiGrounding.test.ts:51-55`; about 23 test files touch this step)
  - prepush, CI and a visual check: 30 minutes

So: v1.1 for the feature. For v1.0, consider only the section 5 fix; it's the owner's call because it also changes MFA Readiness.