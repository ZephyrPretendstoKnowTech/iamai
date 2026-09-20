# The Plan's step groups (draft for owner redline, 2026-09-19)

Every step on the Plan now sits in exactly one group, and each group's row list
is numbered from 1. The registry is `src/roadmap/stepGroups.ts` — the same file
the two pinned groups already used. Renaming a group, moving a step between
groups, reordering the groups or splitting and merging them is an edit to that
one file (plus the group's two title keys in `content.json`).

## How to redline this

- **Rename a group**: change its two strings under `pages.app.plan.groups.<key>`
  in `docs/design/content.json`. Nothing in the code holds the words.
- **Move a step**: cut its id from one group's `members` and paste it into
  another's, at the position you want it numbered.
- **Reorder a group's list**: reorder its `members`. The numbers follow.
- **Reorder the groups**: reorder the entries. The board draws them in registry
  order inside every lane tab.
- **Split or merge**: add or remove an entry (and its title keys).

## The rules the numbering follows

1. The number is the step's position in its group's **full** order, counting
   from 1 in every group.
2. A lane tab never renumbers. On the Ready tab a group may read 1, 3, 6 — the
   gaps are the steps of that group that are on Up Next or On Hold, and they
   are honest.
3. The numeral is tinted with the row's existing lane tone (the same
   `--success-text` / `--attention-text` / `--danger-text` the status dot beside
   it uses; the quiet ink for a Deferred row). The state's words are unchanged
   beside it, so the colour is never the only cue.
4. The number appears only in a group's row list, never inside an opened step.

## The groups, in the order the board draws them

Order follows the build order in `docs/plans/v1-step-map.md` §3, with the nine
waves collapsed to the fewest runs that still read as one job each: nine
headings would be a table of contents, not a plan. The waves stay the engine's
sequencing; a group is only a heading.

Every id below is one the engine can generate. The first draft of this document
listed five that it cannot — `s-prereq-device-plan` (replaced by D3),
`s-question-travel` (hidden for V1), `s-goal-mobile-app-protection` and
`s-goal-azure-management-mfa` (goals the pinned baseline does not carry and the
floor does not force), and `s-goal-unmanaged-browser` (never an id at all: it is
the content entry two goals merge into, so only `s-goal-byod-session-controls`
can be built) — and so overstated three of the group sizes. They are gone from
the registry and from the lists here: Protect Your Administrators is 5, the
sign-in-location work is 6 (3 objects and 3 policies since the 2026-09-20 split
below), and Require Healthy Devices is 4, which is what it already drew. See
`docs/plans/step-redundancy-analysis.md` finding 4.

A tenth was a duplicate rather than a phantom: `cleanup-notAssessed` said the
same list of unassessed baseline policies the `s-review-baseline-…` rows say one
policy at a time, and the engine had already switched it off by handing the
Cleanup deriver an empty array. The row, its words and its note control are gone;
the review rows are the one source (finding 8). Ongoing Checks and Cleanup is 8
listed members plus the review rows.

An eleventh was a pointer. `s-question-partner`'s whole instruction was to go and
read the Implementation of Require MFA for Guests and Block Sign-ins From
Countries Not Allowed, both of which already carry the Service provider exclusion
the answer asks for. Its one original warning is now the guests policy's
help-desk line and its evidence field is on that step, so Turn On MFA for
Everyone is 7 (finding 5).

A twelfth was half of another step's outcome. `s-question-mail-devices` moved
every device the mail-sending answer named onto a supported route and removed its
temporary exception — which is the second half of what Block Legacy
Authentication is for, and it drew a `check` step's headings beside four policy
steps in the same group. It is now that step's second Implementation Task, shown
only where an exception account is named. Close the Doors Nobody Should Use is 4,
which is what it already drew, and its rows number 1–4 with no gap
(`docs/plans/close-doors-spec.md` §3, §8.4; finding 6).

### 1. Establish Emergency Access — pinned, unchanged

Frozen. Drawn above the lanes until all four are Completed.

| # | Step | Id |
|---|---|---|
| 1 | Prepare Emergency Access Accounts | `s-prereq-break-glass` |
| 2 | Configure Emergency Exclusions | `s-prereq-exclusion-group` |
| 3 | Configure Passkey Authentication | `s-prereq-passkey-settings` |
| 4 | Verify Emergency Access | `cleanup-drill` |

### 2. Decide Your Tenant's Direction — pinned, unchanged

| # | Step | Id |
|---|---|---|
| 1 | Confirm What You Use | `s-direction-use` |
| 2 | Identify Service and Shared Accounts | `s-direction-accounts` |
| 3 | Decide How People and Devices Sign In | `s-direction-devices` |
| 4 | Decide Where People Sign In From | `s-direction-locations` |

### 3. Prepare the Groups and Locations — new (owner, 2026-09-20)

An object step is here because a Direction answer says it should exist: each of
these three is the **doing** of an answer saved in the group above. They used to
sit among the policies that reference them, so a policy group held objects and
the reader met "create this location" in the middle of a run of policies. Placed
straight after Direction the plan reads decide → make the things → roll out the
policies.

Only objects an answer creates move here. `s-prereq-per-user-mfa` and
`s-prereq-security-defaults` are tenant settings to retire, not objects to build;
`s-prereq-auth-strength` is the pinned baseline's demand and stays with the admin
policies that require it; the emergency prerequisites stay in group 1.

| # | Step | Id |
|---|---|---|
| 1 | Define the Trusted Network | `s-prereq-trusted-location` |
| 2 | Create or Correct Allowed Countries Location | `s-prereq-allowed-countries` |
| 3 | Create or Correct Service Accounts Group | `s-prereq-service-accounts-group` |

### 4. Close the Doors Nobody Should Use — new (§3 wave 1)

| # | Step | Id |
|---|---|---|
| 1 | Block Legacy Authentication | `s-goal-block-legacy-auth` |
| 2 | Block Device Code Sign-in | `s-goal-block-device-code` |
| 3 | Block Authentication Transfer | `s-goal-block-auth-transfer` |
| 4 | Block Unsupported Device Platforms | `s-goal-block-unsupported-platforms` |

### 5. Protect Your Administrators — new (§3 wave 2)

| # | Step | Id |
|---|---|---|
| 1 | Register Your Own Passkey | `s-ladder-operator-passkey` |
| 2 | Create the Baseline's Authentication Strength | `s-prereq-auth-strength` |
| 3 | Require Phishing-Resistant MFA for Admins | `s-goal-admins-phishing-resistant` |
| 4 | Shorten Admin Sessions | `s-goal-admin-session` |
| 5 | Require MFA at Every Role Activation | `s-goal-pim-activation-reauth` |

### 6. Turn On MFA for Everyone — new (§3 waves 3 and 4)

| # | Step | Id |
|---|---|---|
| 1 | Protect Sign-in Method Registration | `s-goal-register-info-protected` |
| 2 | Require MFA to Register a Device | `s-goal-device-registration-mfa` |
| 3 | Prepare Your Team for MFA | `s-verify-mfa` |
| 4 | Turn Off Security Defaults | `s-prereq-security-defaults` |
| 5 | Require MFA for Everyone | `s-goal-mfa-all-users` |
| 6 | Require MFA for Guests | `s-goal-guests-mfa` |
| 7 | Finish Moving Off Per-User MFA | `s-prereq-per-user-mfa` |

### 7. Control Where People Sign In From — new (§3 wave 5)

The three objects this group used to open with are group 3; what is left is the
run of policies that reference them.

| # | Step | Id |
|---|---|---|
| 1 | Block Sign-ins From Countries Not Allowed | `s-goal-geo-restriction` |
| 2 | Restrict Service Accounts to the Trusted Network | `s-goal-service-accounts-trusted-network` |
| 3 | Restrict the Entra Connect Sync Account to Its Address | `s-goal-workload-identity-block` |

### 8. Require Healthy Devices — new (§3 wave 6)

| # | Step | Id |
|---|---|---|
| 1 | Require a Managed Device Outside the Office | `s-goal-require-managed-device` |
| 2 | Require a Fresh Sign-in for Intune Enrollment | `s-goal-intune-enrollment-reauth` |
| 3 | Keep Company Data Off Phones | `s-ladder-phone-access-restriction` |
| 4 | Give Shared Devices Their Own Policy | `s-shared-devices` |

### 9. Respond to Risk and Limit Sessions — new (§3 waves 7 and 8)

| # | Step | Id |
|---|---|---|
| 1 | Challenge High-Risk Sign-ins | `s-goal-sign-in-risk` |
| 2 | Remediate High-Risk Users | `s-goal-user-risk` |
| 3 | Challenge Medium-Risk Sign-ins | `s-goal-sign-in-risk-medium` |
| 4 | Reset Passwords for Medium-Risk Users | `s-goal-user-risk-medium` |
| 5 | Limit How Long Sessions Last | `s-goal-all-users-no-persistence` |
| 6 | Require Token Protection on Windows | `s-goal-token-protection` |

### 10. Ongoing Checks and Cleanup — new, the catch-all (§3 wave 9 and §4)

The last entry, and the only one that also takes **every step no other group
claims**. That is what makes it impossible for the board to draw an unheaded
row: a step nobody placed is ongoing work until somebody places it.

| # | Step | Id |
|---|---|---|
| 1 | Block the Admin Portals for Non-Admins | `s-goal-admin-portals-protected` |
| 2 | Require MFA for Inforcer Access | `s-goal-inforcer-mfa` |
| 3 | Disable or Confirm Dormant Accounts | `s-check-dormant-accounts` |
| 4 | Use Separate Accounts for Admin Work | `s-check-separate-admin-accounts` |
| 5 | Alert on Emergency Account Sign-ins | `cleanup-alerting` |
| 6 | Harden Emergency Access | `cleanup-hardening` |
| 7 | Review Overlapping Policies | `cleanup-consolidation` |
| 8 | Align Policy Names | `cleanup-naming` |
| 9+ | The baseline-review rows, in the engine's order | `s-review-baseline-…` |

The baseline-review rows are matched by **prefix**, not listed: their ids carry
the tenant's own policy keys (`s-review-baseline-iac-app-block-avd-…`), so they
are data and cannot be constants. A prefix member numbers after every listed
member, in the order the board hands it over.

## Open questions for the owner

1. **The catch-all's contents.** `s-goal-admin-portals-protected` and
   `s-goal-inforcer-mfa` are policies, not cleanup, and they are here because
   §5 of the step map moves the Admin Portal block to the lockdown kit and
   §3 wave 9 makes Inforcer a service policy. If the lockdown kit becomes its
   own group at the end (step map §4), both move there and this group goes back
   to being cleanup only.
2. **Group 8's name.** It carries two different jobs — risk response (P2 only)
   and session hardening — because neither is four steps on its own. Splitting
   them gives a 4 and a 2.
3. **Group 5's length.** Seven steps is the longest list here. Splitting the
   registration pair (1–2) into the "Close the Doors" group would give a 7 and
   a 7, at the cost of putting protective work under a blocking heading.
4. **The On Hold tab's headings.** They used to be the blocker kind ("Baseline
   conflict", "Waiting on your direction"). They are now the step groups, like
   every other tab. What holds a row, and by what, is still said word for word
   in that row's own state column.
