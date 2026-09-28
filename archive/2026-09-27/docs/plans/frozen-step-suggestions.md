# Frozen steps: suggestions held for the owner

The four Establish Emergency Access steps and the four Decide Your Tenant's
Direction steps are frozen (`v1-procedure.md` §3.11). Nothing in them is
changed. Anything a later group found that would be a change to one of them is
written here instead, with the group that found it and the date.

---

## From "Close the Doors Nobody Should Use" (2026-09-19)

Taking the five steps of `close-doors` to the V1 standard needed **no change to
any frozen step**. Two things were noticed while doing it.

### 1. The device-code question in Confirm What You Use does not say what a "Not used" answer leads to

**Where.** `s-direction-use`, the "Device code sign-in (CLI tools, meeting-room
devices)" question. On the demo it reads "Not answered yet: the suggestion is
Not used", and Block Device Code Sign-in waits on it.

**What the group found.** Microsoft Learn (`concept-authentication-flows`,
checked 2026-09-19) documents two consequences of the policy that answer leads
to, which this wave added to the policy step:

- **Protocol tracking.** A session that once used device code flow stays
  tracked, so later requests in it are blocked as well. Microsoft's own note:
  "Possible impact can include things such as not being able to access certain
  resources, or complete device sign out."
- **Device Registration Service.** An authentication-flows policy targeting
  **All resources** — which the pinned baseline's does — is also enforced on
  Device Registration Service. A tenant that registers devices by device code
  must exclude that resource.

**The suggestion.** The question's help text could carry one of these, because
the answer is given before the policy step is ever opened, and "Not used" is the
answer that leads to the block. One sentence would do: *"A session that once
used this flow stays blocked afterwards, which can sign a device out."*

**Why it is only a suggestion.** It is a frozen step's wording, and the policy
step now states both facts in its own risks and in its create procedure, so
nothing is unsaid — it is said later than it could be.

### 2. Nothing else

The four Emergency Access steps behaved correctly as the prerequisite this
group waits on, at 1280 on the demo and on the follow-up scan: the blocked
policy steps name them, link to them, and their own snapshots did not move.

# Frozen step suggestions

The four Establish Emergency Access steps and the four Decide Your Tenant's Direction
steps are frozen (owner, 2026-09-19). Nothing below was changed. Each item says what it
is, what the one-line change would be, and why.

Found in the read-only audit of `10b40609` on the demo at 1280, Initial and Follow-up
scans.

---

## 1. Configure Passkey Authentication links to a renamed Microsoft Learn article

**Where:** `docs/design/content.json`, step `s-prereq-passkey-settings`, `learn.url`
(the "Learn →" link in About this Step).

**Now:** `https://learn.microsoft.com/entra/identity/authentication/how-to-enable-passkey-fido2`

**Proposed:** `https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-passkeys-fido2`

**Why:** the current slug 301s to the proposed one, which is the live article ("How to
enable passkeys (FIDO2) in Microsoft Entra ID", `ms.date` 2026-03-08). A redirect is the
last state before a 404, and the same article was named three different ways across the
repo; the two unfrozen occurrences were corrected in `bbc2d684`, so this step is now the
only place that names the old slug.

## 2. The emergency exclusion action sends the admin down a portal path nothing else uses

**Where:** `src/copy/validation.ts`, `RULE_ACTION['bg.excludedFromAllPolicies']` — the
Do-it line on Prepare Emergency Access Accounts when an account is inside a policy.

**Now:** `… Entra admin center → Protection → Conditional Access → Policies.`

**Proposed:** `… Entra admin center → Entra ID → Conditional Access → Policies.`

**Why:** every implementation procedure in the library says `Entra ID > Conditional
Access > Policies`, and so does Microsoft's own current article (`policy-admin-phish-resistant-mfa`,
`ms.date` 2026-03-24: "Browse to **Entra ID** > **Conditional Access** > **Policies**").
`Protection →` survives in three files only. An admin following the emergency step and
then a policy step is given two different routes to one page.

## 3. "Identity → Users" and "Identity → Groups" are the console's former top level

**Where:** `src/copy/validation.ts`, `SUBJECT_WHERE.breakGlass` and
`SUBJECT_WHERE.exclusionGroup` — the "where this is fixed" line on Emergency Access
Steps 1 and 2 when no individual check supplied a path.

**Now:** `Entra admin center → Identity → Users` and
`Entra admin center → Identity → Groups → this group → Members`

**Proposed:** `Entra admin center → Entra ID → Users` and
`Entra admin center → Entra ID → Groups → this group → Members`

**Why:** the same step's own Implementation Tasks already say `Entra admin center → Users`,
so the step states the route two ways on one screen.

## 4. "Review the scan coverage details" does not say where they are

**Where:** Prepare Emergency Access Accounts, the account card when a check could not run.
Demo Initial scan, account 1: "Passkey check incomplete — IAMAI could not fully check this
account. Review the scan coverage details; no account change is established."

**Proposed:** name the place, as the rest of the step does — the Connect page's scan
result, or MFA Readiness' "Evidence read" panel, whichever is the intended one.

**Why:** it is the only instruction on the frozen steps that asks the admin to go
somewhere without saying where. Everything else on Step 1 names a portal blade.

## 5. One Direction step asks nine questions in four different polarities

**Where:** Confirm What You Use (`s-direction-use`), the Questions section.

**Now:** the nine answer pairs read `Yes/No`, `Yes/No`, `Yes/No`, `Yes/No`, `Yes/No`,
`None/Some`, `Not used/In use`, `No/Yes`, `No/Yes` — and the last two put the negative
first, so the same physical position in the dropdown means "we use it" on some rows and
"we do not" on others.

**Proposed:** one pair for every question on the step, with the same option first.

**Why:** these answers gate every policy in the plan. A person scanning nine dropdowns
reads position, not wording, and two of the nine are inverted.

## 6. A Direction step's Next milestone is a date with no sentence

**Where:** the rail on `s-direction-use`: "NEXT MILESTONE / Sep 21, 2026", and then
Completion Criteria.

**Now:** every other step's rail carries the milestone sentence under the date (Prepare
Emergency Access Accounts: "Sep 21, 2026 / Complete the remaining emergency access
checks."). The Direction steps carry the date alone.

**Proposed:** the existing `engine.milestone.decide` line, "Confirm and save the required
decision.", under the date.

**Why:** the rail is the one place a step says what happens next, and on these four steps
it says only when.

---

## From the step-redundancy work (2026-09-19)

`docs/plans/step-redundancy-analysis.md` findings 1–10 were acted on in the
unfrozen steps. Two of them end inside a frozen step, so they are written here
and not built.

### 7. Decide Where People Sign In From can only pick a network the tenant already has

**Where.** `s-direction-locations` (D4), the "The office network" question, and
`s-prereq-trusted-location` (Define the Trusted Network), which is the doing of
that answer.

**What the audit found.** D4's picker offers the trusted IP named locations the
scan found (`direction.ts` `locationQuestions`, which reads the trusted
`ipNamedLocation` rows of `snapshot.config.namedLocations`). On a tenant that has none — the common case,
and the demo's — the only honest answer is "Everyone works remotely". Saving it
is a statement that no office network exists, which sets `trustedLocationIds` to
none and leaves Define the Trusted Network, the step whose whole job is to create
one, with no reason to run. The step that would produce the object can be
switched off by the answer whose picker had nothing to offer *because* the object
does not exist yet. Finding 2 closed the visible half of this — the step no
longer re-asks D4's question — but the order is still wrong underneath.

**The fix I would propose.** Make the creation the first task of the D4 answer
rather than a separate row the answer can silently switch off. Concretely, on D4:

1. Offer a third option beside "Trusted locations" and "Everyone works
   remotely" — *"We have an office network, but it is not in Entra yet"* — which
   saves the intent without naming an id.
2. Under it, the network draft IAMAI already builds from the scan
   (`mapping/networkDraft.ts`, which the trusted-location step renders today as
   "Create the saved network") as the suggested ranges to confirm.
3. Define the Trusted Network then runs as the doing of THAT answer, with the
   confirmed ranges, and "Everyone works remotely" keeps its current meaning: no
   office network, and no location work to do.

**Why it is only a suggestion.** It is a question, an option and a picker on a
frozen step, and the Direction group's contract is "answers only; nothing is
changed in Entra" (`direction.ts`) — option 1 keeps that contract, but it is the
owner's call whether a third option belongs there at all. Nothing is unsaid
today: a tenant with no office network can still answer "Everyone works
remotely", then create the location and re-answer.

### 8. Confirm What You Use silently rewrites Identify Service and Shared Accounts' answer

**Where.** `src/roadmap/decisions.ts:315-319`, applied when D1's answers are
approved:

```ts
const devices = mailDevicesOf(next).filter((id) => !next.serviceAccountUserIds.includes(id))
if (devices.length > 0) {
  next.serviceAccountUserIds = [...next.serviceAccountUserIds, ...devices]
  next.serviceAccountRejectedIds = next.serviceAccountRejectedIds.filter((id) => !devices.includes(id))
}
```

**What the audit found.** Approving D1 adds every account named as a
mail-sending device to `serviceAccountUserIds` — the exact list D2 asks a person
to curate — and un-rejects any of them that person had rejected in D2. Nothing
on either screen says so. A person approves D1, returns to D2, and the account
count has changed with no explanation; then Create or Correct Service Accounts
Group's Completion Criteria, *"The group exists with exactly the confirmed
accounts"*, asks them to add a member they never picked.

**The fix I would propose.** Either of these, both of which are a change to a
frozen step:

- **Show the merge.** D2's `serviceAccounts` question carries a note in the shape
  of its existing `alreadySetAside` one ("The Emergency Access accounts are
  already set aside: …") — *"Mail-sending devices you named in Confirm What You
  Use are included: …"* — and the group step's member list marks which members
  came from which answer.
- **Stop merging.** Give the mail-device exceptions their own group. They are
  temporary by definition (they exist until the device moves to a supported
  route) and the service-accounts group is not, so they are two lists with two
  lifetimes that happen to share one today. This is the cleaner of the two.

**Why it is only a suggestion.** Both touch a Direction step: the first its
question's words, the second what its answer writes. The behaviour is unchanged
and is recorded as finding 7 of the analysis, which was explicitly not built.

---

## From "Turn On MFA for Everyone" (2026-09-20)

Taking the seven steps of `mfa-everyone` to the V1 standard needed **no change
to any frozen step**. Two things were noticed while doing it, and one belongs to
a settled surface rather than a frozen step.

### 1. Confirm What You Use asks nothing about device code, but Turn Off Security Defaults now depends on the answer

**Where.** `s-direction-use`, and the four Direction steps generally.

**What the group found.** Microsoft Learn (`entra/fundamentals/security-defaults`,
checked 2026-09-20) now lists "Blocking device code flow" among the protections
security defaults give, verbatim: "After security defaults are enabled in your
tenant, authentication requests that use device code flow are blocked." Turn Off
Security Defaults therefore names four replacement policies where it used to
name three, and the fourth is **Block Device Code Sign-in**, whose applicability
comes from the device-code question in Confirm What You Use.

A tenant that answers "Not used" to that question and then turns security
defaults off has nothing left blocking device code flow, and nothing on either
step says so.

**The suggestion.** The device-code question's help text could say that security
defaults block this flow today, so answering "Not used" is also a decision about
what happens on the day they are turned off. One sentence would do.

**Why it is only a suggestion.** It is a frozen step's wording, and Turn Off
Security Defaults now states the dependency in its own risks and its own
procedure, which is where the change is made.

### 2. The Direction steps' Impact all read "Tenant settings", beside four policy rows that name people

**Where.** All four `s-direction-*` rows on the demo, at 1280.

**What the group found.** Nothing wrong — it is the deliberate fallback for a
step with no policy of its own. It is only worth recording that in the same
Plan, one group's rows read "29 people", "29 people and 1 guest" and "Guest
Accounts" while the Direction group's four rows all read the same two words. A
reader scanning the Impact column learns nothing from that group.

**Why it is only a suggestion.** The Direction steps are frozen and the column's
fallback is `rowWho.ts`'s, shared by every non-policy step.

### 3. Not a frozen step: one line on MFA Readiness that is half a fact

`shared.methodGuides.guest` is the only guest line MFA Readiness has: "A guest
cannot be issued a Temporary Access Pass; they register from their own tenant or
with their own phone." That is Learn-correct. It does not say the other half —
`entra/identity/authentication/how-to-authentication-passkeys-fido2`, checked
2026-09-20: "Registration of passkey (FIDO2) credentials isn't supported for
internal or external guest users, including B2B collaboration users in the
resource tenant."

The owner's 2026-09-19 rule — a guest row asks for Microsoft Authenticator,
never a passkey — is exactly what that fact requires, so the rule is right; the
line simply does not carry its reason. MFA Readiness is settled, so this wave
made the steps agree with the page and changed no line on it. Written up here
and in `mfa-everyone-spec.md` §10.8.

## From "Control Where People Sign In From" (2026-09-20)

Taking the six steps of `where-people-sign-in` to the V1 standard needed **no
change to any frozen step**. The two items above that already concern this
group — §7 (Decide Where People Sign In From can only pick a network the tenant
already has) and §8 (Confirm What You Use silently rewrites Identify Service and
Shared Accounts' answer) — were left exactly as written.

What the group did instead, so that nothing is unsaid while they stand:

- **§7.** Define the Trusted Network no longer re-asks D4's question; it reads
  as the doing of D4's answer, and its Readiness names the answer it waits on
  with a link to it. On a tenant with no trusted IP named location the step is
  simply not generated, which is the honest consequence of the answer and not a
  new claim.
- **§8.** Create or Correct Service Accounts Group now says, in its own words,
  that the accounts named as mail-sending devices in Confirm What You Use are
  among the confirmed members. The merge still happens invisibly in
  `decisions.ts`; what changed is that the step a person returns to explains the
  count they find there, so its Completion Criteria — "the group exists with
  exactly the confirmed accounts" — is no longer asking for a member nobody
  picked.

Nothing else. The four Emergency Access steps behaved correctly as the
prerequisite these policy steps wait on, at 1280 on the demo and on the
follow-up scan, and none of their snapshots moved.

---

## From Respond to Risk and Limit Sessions (group 8, 2026-09-20)

`docs/plans/risk-and-sessions-spec.md`. The four Establish Emergency Access steps
and the four Direction steps were not touched, and none of their snapshots moved.
Two things this group's steps wait on, for whoever unfreezes them:

- **Decide How People and Devices Sign In holds Require Token Protection on
  Windows, and the step cannot say why it would matter.** On the demo's follow-up
  scan the token-protection step reads «Waiting on your direction · Decide How
  People and Devices Sign In». Approving the answers releases it. The Direction
  step itself never mentions token protection, so a reader who opens the question
  from that card answers three questions about computers, phones and exception
  devices with no sign that one of them is what the policy in front of them is
  waiting on. A one-line "what this answer releases" on the Direction step would
  close it. Not made: the step is frozen.

- **Verify Emergency Access is the last thing between this group and
  enforcement.** With the Direction answers approved, token protection's only
  remaining prerequisite is the drill, and Limit How Long Sessions Last reaches
  «Ready · Create» while token protection stays «Up Next». That is correct
  sequencing. It is recorded because it means the drill, not the policy work, is
  what decides when this group's steps can be enforced — a fact the Emergency
  Access group's own words do not carry.

## From "Require Healthy Devices" (2026-09-20)

Taking the four steps of `devices` to the V1 standard needed **no change to any
frozen step**, and no Emergency Access or Direction snapshot moved.

One thing to hold for the owner, about a Direction step rather than in it:

- **Decide How People and Devices Sign In creates a step, and says nothing about
  it.** Answering the phones half with "Blocked from company data" generates
  `s-ladder-phone-access-restriction` (`roadmap/generate.ts`), a whole extra step
  of work — a new Conditional Access policy, a report-only week, a test on two
  kinds of phone — and it also sends Require a Managed Device Outside the Office
  and Require a Fresh Sign-in for Intune Enrollment to the footer if it is the
  only platform left. The Direction step's effect line for that option does not
  say that a step appears. The other three phone options add nothing, so the
  answer that looks like the least work is the one that makes the most.

  This wave made the step it creates worth arriving at — it now carries the
  policy in eight numbered steps instead of asking the operator to design one —
  so the gap is what the question says beforehand, not what it leads to. Nothing
  on the Direction step was touched.

## From Ongoing Checks and Cleanup (group 9, 2026-09-20)

`docs/plans/ongoing-spec.md`. Taking the group to the V1 standard needed **no
change to any frozen step**. Two observations, both about Verify Emergency
Access (`cleanup-drill`), which this wave stood beside but did not touch.

### 10. Verify Emergency Access is 2,783 characters in the prompt pack

Cleanup shared one 4,000-character data block in `roadmap/prompts.ts`, and the
drill's own words took seven tenths of it, so the rows after it were clipped —
on the demo, the alerting row's procedure and the consolidation row's Completion
Criteria. The engine was fixed rather than the row: each Cleanup row now gets
its own bounded block, the way each step already did (spec §11.7), so the drill
costs only itself.

**Left for the owner.** The drill's length is not itself wrong — it carries the
emergency recovery procedure, which is the one thing a reader may need offline —
but it is the longest row in the plan by a factor of two, and it is the row most
likely to be read under pressure. If the recovery procedure were its own
artifact rather than part of the row's instructions, the row would read as a
drill and the procedure would read as a procedure. That is a design change to a
frozen step, so it is here and not in the build.

### 11. The drill is the only Cleanup row that draws the task anatomy

`CleanupStep.tsx`: `taskHead = row.kind === 'drill' ? TASK_HEAD : null`. Verify
Emergency Access draws About this Step / Tasks Remaining / Implementation Tasks
/ Completion Criteria; the other four draw Why / Implementation / Done when.
That split is the owner's decision and this wave kept it exactly. It is recorded
only so the next person reading the four rows beside it does not take the
difference for a bug and "fix" it.

Nothing else. The four Emergency Access steps and the four Direction steps
behaved correctly as the prerequisites and the gate this group's rows wait on,
at 1280 on the demo and on the follow-up scan, and none of their snapshots
moved.
