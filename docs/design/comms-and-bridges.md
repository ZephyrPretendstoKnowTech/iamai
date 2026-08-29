# Design: communications, AI bridges, and adjacent value

## Part 1 — Communications as a plan, not a per-step afterthought

Today every step carries its own announcement. Twelve steps in a week means twelve emails,
which means the thirteenth is not read. Communications need their own model.

### 1.1 Audiences

Every step computes its audience from its population, not from a template choice:

| Audience | When it applies |
|---|---|
| `everyone` | The step touches all or nearly all enabled users |
| `segment` | The step touches an identifiable group: a department, a licence tier, a persona group, a named location's users |
| `named` | Fewer than 10 affected people: they are contacted individually, by name |
| `admins` | Only role holders are affected |
| `helpdesk` | Never a broadcast: the internal note for whoever answers the phone |
| `none` | Evidence says nobody is affected: no message at all |

A step may have more than one audience (everyone plus a named list who need help first).

### 1.2 Bundling rules

- One **bulletin** per audience per week, at most. All steps enforcing in the same week
  with the same audience merge into one message: a short lead paragraph, then one short
  block per change, in enforcement-date order, then one "what to do" list and one "who to
  contact" line.
- A step whose disruption is high may claim its own message; the bundle then references it
  ("a separate note about device requirements went out on Tuesday").
- `named` audiences are never bundled with broadcasts. They get individual messages, and
  those go out at the earliest notice period of any step affecting them.
- If a week has no `everyone` step, no `everyone` bulletin is sent. Silence is a valid week.
- A month with more than three bulletins to the same audience triggers a warning on the
  Schedule tab: "four messages to everyone this month; consider moving one change into
  next month's bulletin."
- The reminder is one message per bulletin, not per step.

### 1.3 The communications plan

A new section on the Schedule tab and in the print pack: a table of every message the plan
will send — date, time, audience, channel, subject, and which steps it covers. This is the
artifact an MSP shows a client to prove they will not be spammed, and it is also the thing
that stops a technician from writing fourteen emails by hand.

Channels offered, all copy-out (nothing is sent by IAMAI): email, a Teams or Slack post
(shorter form), a help-desk note, and an intranet or portal notice.

### 1.4 Recipient lists

For `segment` and `named` audiences, offer a copyable recipient list and a CSV for mail
merge, drawn from the step population. Names and addresses never leave the browser unless
the user copies them, and the export says so.

## Part 2 — Bridges to the user's own AI

IAMAI runs no models and sends nothing anywhere. What it can do is hand the user
well-built context to paste into whatever assistant they already use. Everything here is
copy-to-clipboard or download; nothing calls an API.

### 2.1 Copy as prompt

Any generated artifact gains a second action beside Copy: **Copy as prompt**. The clipboard
receives a short, structured prompt with the facts embedded and clear instructions, for
example on an announcement:

> You are writing an internal IT announcement for <tenant>. Rewrite the draft below in our
> own voice: plain English, no jargon, under 150 words, friendly but direct. Keep every
> date, time, and instruction exactly as written. Do not add anything we did not say.
>
> Context: <what changes, who is affected, when it takes effect, what people must do>.
>
> Draft: <the generated announcement>

Offered on: the announcement, the reminder, the help-desk note, "what to tell your
manager", the change record, the executive summary, and the whole plan.

### 2.2 The prompt pack

A page (and a download) with ready prompts, each pre-filled from the current plan:

- Rewrite this announcement in our voice.
- Write MFA setup instructions for our users, for iPhone and Android, at a reading level a
  non-technical person can follow.
- Turn this step into a help-desk knowledge base article with symptoms, cause, and fix.
- Write the change request for our change board from this change record.
- Explain this step to me as if I am new to Conditional Access, then quiz me on it.
- My client says no to this change. Write three responses that address the risk without
  being pushy.
- Translate this announcement into <language>, keeping the dates and instructions exact.
- Summarise this plan for a non-technical business owner in five sentences.

### 2.3 Grounding bundle

A download: the plan, the findings, and the tenant profile as one JSON file, **redacted by
default** (no UPNs, no display names, no tenant id; counts and roles instead), with a
header block explaining what it is. This is what someone pastes into their own assistant to
ask questions across the whole plan. A toggle allows the unredacted version, with a plain
warning that it contains user names and will leave the browser when they upload it.

### 2.4 Rules

- Nothing is sent by IAMAI. Every bridge is a copy or a download, initiated by the user.
- Redaction is the default on anything that leaves as a file.
- Every prompt says "do not invent facts" and carries the source data with it.
- The Start page's no-AI line stays accurate: IAMAI runs no models. These are prompts for
  the user's own tools, and the page says exactly that.

## Part 3 — Adjacent value, no AI involved

Ranked by value per unit of work.

1. **Post-enforcement watch.** The 72 hours after a change is when it either works or
   ruins a Tuesday. After a step is enforced, IAMAI watches for the failure signature on
   the next scans: sign-in failures with that policy applied, by user, against a baseline
   of the days before. The card shows "12 failures in 48 hours, 9 from one user" and a
   plain revert threshold agreed in advance ("more than 5% of the affected population
   fails: set it back to report-only"). This is the single most useful thing a technician
   lacks the day after a change.

2. **Client-facing report.** A separate, brandable HTML export with the MSP's name and
   logo, written for the client rather than the technician: what was found, what is being
   done, when, what the client must do, and progress since last time. No JSON, no portal
   paths, no user names unless chosen. This is the artifact that gets an MSP paid for the
   work.

3. **Calendar export with runbooks.** ICS invites for each enforcement window whose body
   contains the step's portal path, done-when criteria, rollback, and the watch threshold.
   The technician's calendar becomes the runbook.

4. **Effort and call-volume estimate.** Per step: admin minutes to execute, and an estimate
   of help-desk contacts based on the affected population and the control type. Per plan: a
   total. An MSP quoting this work has nothing to base a number on today.

5. **Approval sheet.** A one-page printable with the plan summary, the risks, the dates,
   and a signature line. Some clients need a signature; most MSPs write it by hand.

6. **Break-glass drill procedure.** A dated, printable procedure for the recurring drill:
   who tests, from where, what to verify, where the credential is sealed, and where to
   record the result. The drill step exists; the procedure does not.

7. **Baseline update watch.** The baseline is pinned to a commit. On load, compare against
   the source's latest: "the baseline has three new policies since your plan was made:
   review them." Adopting an update becomes a deliberate act with a diff, not a surprise.

8. **Offline after scan.** Everything after the scan should work with no network at all, so
   a technician can build and print a plan on a plane or in a client site with bad wifi.
   Verify and state it.

9. **Plain-language check on generated comms.** Run the announcement through a readability
   measure and flag anything above roughly grade 9, with the offending sentence named. The
   comms are the part users actually read.

10. **Multi-language comms.** The templates are short and structured; offering them in the
    two or three languages an MSP's client base needs is a small content job with real
    value in mixed workforces.
