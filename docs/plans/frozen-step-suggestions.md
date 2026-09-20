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
