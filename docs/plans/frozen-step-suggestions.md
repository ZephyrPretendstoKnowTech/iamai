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
