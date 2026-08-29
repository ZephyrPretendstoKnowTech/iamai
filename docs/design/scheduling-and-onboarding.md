# Design: change timing, the fast path, and the day-one user

Three problems, one document.

1. Nothing says this tool is for Microsoft 365 until the user is already signed in.
2. The plan schedules by week. Real change management happens by day and hour, and the
   two failure modes it must prevent are impatience (enforce now, break something, revert)
   and paralysis (never enforce, because the comms plan is unknown).
3. The tool is written by someone who knows Conditional Access for someone who knows
   Conditional Access. The person who needs it most does not.

## Part 1 — Say what this is

- Page title and meta description: "IAMAI: Microsoft Entra Conditional Access rollout
  planner". Tagline under the wordmark on every page: "Microsoft Entra ID and Microsoft
  365".
- Start page headline gains the product name: "Turn your **Microsoft Entra** Conditional
  Access baseline into a dated rollout plan…". First body sentence names the product
  surface: "IAMAI reads your Microsoft 365 tenant's Conditional Access policies, people,
  and sign-in records…".
- "What you'll need" gains a first line: "A Microsoft 365 tenant with Microsoft Entra ID
  (any licence). A Global Administrator or Global Reader account."
- Favicon, the OpenGraph card, and the print cover all say Microsoft Entra.
- Nothing claims Microsoft endorsement; the wording is "for Microsoft Entra", never
  "Microsoft's".

## Part 2 — Change timing

### 2.1 The tenant's own rhythm

Sign-in records already carry timestamps. Compute, in the tenant's time zone:

- **Working pattern**: sign-ins per weekday and per hour, over the collected window.
- **Peak hour** (highest interactive sign-in volume) and **quiet business hour** (lowest
  volume within local working hours, defined as the 09:00 to 17:00 band on the days that
  show activity).
- **Weekend activity**: whether Saturday or Sunday carry meaningful volume, which changes
  every recommendation below.
- **Shift shape**: if activity is roughly flat across 24 hours, say so and fall back to
  calendar defaults with a note that the tenant appears to run outside office hours.

Show this once on the Schedule tab as one sentence: "Your people mostly sign in Monday to
Friday, 08:00 to 18:00 Mountain Time. The busiest hour is Monday 09:00; the quietest
working hour is Thursday 15:00." Every recommendation below then cites it.

### 2.2 Default rules for when to act

These are the defaults, applied unless the tenant's rhythm contradicts them.

| Activity | Default timing | Why |
|---|---|---|
| Create policies in report-only | Any day, any time, including Friday | Nobody is affected |
| Prerequisites (groups, named locations, auth strengths) | Any day | Nobody is affected |
| Send the announcement | Tuesday or Wednesday, 09:30 local | Monday inboxes are full; Friday is read on Monday |
| Send the reminder | The working day before enforcement, same time | Short enough to still be in memory |
| Enforce a change | Tuesday or Wednesday, one hour after the peak hour | A full working day plus a spare day of support before the weekend |
| Enforce a high-disruption change | Tuesday only | Two clear days of support cover |
| Start a registration campaign | Monday | Gives users a full week |
| Registration deadline | Wednesday of the target week | Leaves two days to chase stragglers |
| Never enforce | Friday, the last working day before a holiday, or inside the change freeze | The failure lands when nobody is watching |

Every step shows its own three dates: **announce**, **remind**, **enforce**, each with
day, date, and local time, and each with a one-line reason.

### 2.3 Notice period by disruption

Lead time between announcement and enforcement, in working days:

| Predicted disruption | Notice | Reminder |
|---|---|---|
| Nobody affected (evidence-backed) | none required | none |
| Low (a prompt, no lockouts predicted) | 2 working days | day before |
| Medium (a prompt for many, or a small lockout risk) | 5 working days | day before |
| High (lockout risk, device or geo requirements) | 10 working days | day before and morning of |
| Anything touching a handle-with-care user | never less than 5, and that user is contacted individually first | day before |

Notice periods are settings in Plan settings, with these as defaults, so an MSP can match
its own client agreements.

### 2.4 The fast path: what can be done today

A step qualifies as **Safe today** when all of these hold, and the card says which:

- Every prerequisite is done.
- The break-glass accounts are verified and excluded.
- The signed-in operator is not at risk (What If, or evidence, says so).
- Predicted affected users is zero, from evidence, not from absence of evidence:
  sign-in records cover at least 14 days, hold at least one sign-in for every active user
  in scope (or 500 sign-ins total), and show zero sign-ins that the change would have
  blocked or challenged.
- The control does not depend on a readiness number below its threshold (no device
  requirement while device readiness is under the bar, no MFA requirement while people
  still lack methods).

A Safe-today step may be enforced immediately, out of wave order, with no announcement,
and the card says so in those words: "Nothing in the last 30 days would have been blocked
by this. Safe to enforce today, no announcement needed." Its report-only period is not
skipped — it is created in report-only, observed for the shortest window that still gives
evidence, and enforced as soon as the evidence holds.

This is what answers impatience: the tool gives the impatient person a legitimate list of
things to do right now, so they stop reaching for the risky ones.

### 2.5 The two failure modes, addressed by name

**Impatience.** Every step carries a one-line verdict at the top: "Safe to enforce today"
or "Not yet: <the specific reason>". The Roadmap gets a "Safe today" filter that shows
only the first kind. A step that is not safe today shows the single thing that would make
it safe.

**Paralysis.** Every step ships with its announcement, its reminder, and a help-desk note
("what people will call about, and what to say"), all dated, all copyable. No step is
blocked on the user knowing how to communicate it.

### 2.6 Presentation

Schedule tab gains a week view: for each week of the plan, a small table with the days
across the top and three rows (announce, remind, enforce), so the user can see that the
week has one enforcement on Tuesday and two announcements on Wednesday. Steps outside
working hours are flagged. A "this week" card at the top of the Roadmap lists exactly
what to do in the next seven days, with dates and times.

## Part 3 — The day-one user

Written for a technician with basic terminology and no Conditional Access depth.

### 3.1 Plain titles, jargon second

Every goal gets a plain-language title, with the technical name as a subtitle. Examples:

| Plain title | Technical subtitle |
|---|---|
| Stop attackers adding their own MFA method | Security-info registration requires a trusted context |
| Make sure everyone can prove who they are | Every user satisfies MFA on every app |
| Turn off old sign-in methods that skip MFA | Legacy authentication blocked |
| Stop sign-ins from countries you don't work in | Sign-ins outside allowed countries blocked |
| Require a company-managed device for company data | Office apps require a compliant or joined device |
| Keep admin sessions short | Admin sessions expire quickly and never persist |
| Stop a stolen session token from being reused | Windows desktop sessions require token protection |

Search matches both. Print shows both. The plain title leads everywhere a user first
meets the goal; the technical name leads in Inventory and the JSON.

### 3.2 Terms explained where they appear

A term component: dotted underline, one sentence on hover or tap, no separate glossary
page. Minimum set: report-only, break-glass, named location, trusted location,
phishing-resistant, authentication strength, Temporary Access Pass, compliant device,
hybrid joined, device code flow, authentication transfer, session control, sign-in
frequency, persistent browser, service principal, dynamic group, soak, ring, verification
campaign, security-info registration, workload identity, Conditional Access policy itself.

The last one matters most: "A Conditional Access policy is an if-then rule Microsoft
Entra checks at every sign-in: if these people use these apps in these conditions, then
require this or block it."

### 3.3 What to tell your manager

Each step gains a short section, plain business language, no jargon, three sentences:
what risk this closes, what it costs the people who use the system, and what happens if
it is not done. Copyable. This is the artifact that lets a junior technician defend a
change to a manager or a client who outranks them.

### 3.4 Licence awareness on the plan itself

The Roadmap header states it: "With this tenant's Microsoft 365 Business Premium, 19 of
24 steps are available now. Five need Entra ID P2; the Licensing guide shows what they
would add." Steps that need an absent licence are grouped at the end, marked clearly, and
never counted against the plan's completion.

### 3.5 This week

A card at the top of the Roadmap, above the tabs: "This week: send one announcement
(Wednesday), enforce one change (Tuesday 10:00), and set up MFA for Navani Kholin." Three
items maximum. This is the answer to a technician who has two hours on a Tuesday, not a
quarter.
