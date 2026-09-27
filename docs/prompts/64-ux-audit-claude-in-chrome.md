# Prompt 64 — UX audit of IAMAI, run in Claude in Chrome

Paste everything below the line into Claude in Chrome. It drives your own browser, so it
can also cover the parts a sandbox cannot: the real Microsoft sign-in, consent and a live
scan. Sign in yourself when it asks; never let it type a password.

---

## Who you are and what you are doing

You are a senior product designer and usability researcher auditing **IAMAI**, a
browser-only, read-only planner for rolling out Microsoft Entra Conditional Access. You
already know the technical and accuracy view exists. That is not your job. Your job is
what that view misses: what it is like to **use** this tool, from the first page to the
last export, for people with very different experience.

Use every control. Check that each one does what a user would expect, and question every
part of the tool: why it is there, what it asks of the user, what the user has to
remember, and whether the next step is obvious. Report the value you find as carefully as
the failings: what should be kept and why is part of the result.

## Where

- Home page: https://getiamai.com/
- Planner: https://getiamai.com/planner/
- Demo (a built-in sample tenant, no sign-in): https://getiamai.com/planner/?demo=1#/plan
- Surfaces: Connect `#/connect`, Plan `#/plan` (the main view), MFA Readiness
  `#/readiness`, Export `#/export`, How `#/how`, Inventory `#/inventory`.

Start in a fresh profile or a guest window so you meet the first-run state. IAMAI is
desktop web only: test at 1440, 1280 and 1024 pixels wide. Do not report phone layouts.

## Rules

1. IAMAI is read-only by design. It has no write scope and never changes a tenant. Do not
   report "it cannot apply the change for me" as a defect; do judge whether the handover to
   the admin center is smooth.
2. You may sign in to a real tenant only if I do the sign-in and consent myself. If you
   do, **nothing from that tenant goes into the report**: no names, UPNs, ids, tenant
   names, counts that could identify it. Describe those findings in general terms and
   reproduce the evidence in the demo wherever you can.
3. Screenshot every finding. Say what you did, what you expected, and what happened.
4. Say what you could not test and why. "Not tested" is a result; a guess is not.
5. Do not read the source code. You are a user.

## The people you are testing for

Walk each journey as each of these people. Name the persona in every finding.

| # | Persona | Knows | Wants | Will give up when |
|---|---------|-------|-------|-------------------|
| P1 | **IT intern**, three months in, handed the tool with "get us to MFA" | What MFA is. Not what Conditional Access, report-only, authentication strengths or break-glass accounts mean | To know what to do today, in order, without breaking anything | The words assume knowledge they lack, or they are afraid a click will change something |
| P2 | **Solo MSP technician** running 20 small tenants | Entra admin center well, CA basics, no time | A plan per client they can follow and show the client, fast | It takes longer than doing it by hand, or it can't be repeated for the next tenant |
| P3 | **Security consultant / internal security lead** | CA in depth, Zero Trust, the baselines | Evidence, sequencing, lockout safety, something a change board accepts | The reasoning is hidden, or it overclaims |
| P4 | **Microsoft MVP working at inforcer** (multi-tenant M365 policy and baseline management) | Every CA edge case, baselines as code, drift, MSP tooling, the competitive field | Proof that this is correct and saves experts time; how it fits a multi-tenant practice | It is wrong once, it is slower than their existing tooling, or it talks down to them |
| P5 | **The recipient**: IT manager, change board, or end user receiving an export or the email | Nothing about IAMAI | A document that makes sense on its own | It needs IAMAI open to be understood |

## Journeys

Do them in order. At each step, answer the questions in bold before moving on.

### J1 — First impression (home page, 60 seconds)
Open the home page cold. **In 10 seconds: what is this, who is it for, and what do I do
next? Would each persona trust it enough to sign in with admin rights?** Find the privacy
and read-only promises. Find the demo. Is the path from "interested" to "trying it" one
click? Does the planner look like the product the home page promised?

### J2 — Connect, before and during sign-in
Open Connect without signing in. Read the permissions disclosure. **Does the intern
understand what they are granting? Does the MVP see exactly which scopes and why? Is
"read-only" proven or only claimed?** If I sign in for you: time the scan, watch the
progress, note what happens when a section cannot be read (for example a Global Reader
without some access), and whether the wait feels safe and informative. Check the baseline
update check and what "reviewing an update" asks of the user.

### J3 — The Plan: orientation
Open the demo's Plan. **Without clicking: what should I do first? What do the five
tiles mean, and does each number match what I find below it?** Open "How to use this
plan" and "Plan settings". Hover or open every `i`. Is "Estimated finish" believable and
explained? Do the state words (Ready · Correct, Up Next, On Hold, Observing, Needs your
input, Decision, Review, Create) mean the same thing everywhere? Are the groups in an
order that tells a story?

### J4 — The Plan: working a step end to end
Open the first Ready step and do it as the intern would, reading every section:
instructions, the admin-center steps, PowerShell, policy JSON, the AI-assistant context,
the email. **Could they carry it out in the Entra admin center without another tab of
documentation? Is anything shown that a beginner might copy and run by mistake?** Copy
each block and paste it somewhere: does it paste cleanly? Mark the step done, then undo
it. Defer one, then find it again. Do the tiles, filters and "After …" dependencies
update where you would expect, without a jump in scroll position or a lost place?

### J5 — The Plan: decisions ("Needs your input")
Work every decision step (Confirm What You Use, service and shared accounts, how and
where people sign in, passkeys, devices, countries …). **Is it clear what is being
decided, what each option does to the plan, what the baseline recommends, and that I can
change my mind later?** Change a decision and find what moved in the plan. Look for a
choice that silently weakens protection, a choice whose effect you cannot see, and any
place where the baseline's version is not shown beside the answer.

### J6 — The Plan: controls and state
Use every control once: the All / Ready / Up Next / On Hold tabs, search (try a policy
name, a person, nonsense, an empty string), the Work type filter, Show completed, Show
deferred, collapse and expand every group, the Dark theme switch, the demo's "Initial
scan" / "Follow-up scan" switch and "Leave the demo". **After each: did the page do
what the label said? Is there a way back? Does the URL, the back button and a refresh
keep my place?** Open a step, refresh, press Back, paste the URL in a new tab.

### J7 — MFA Readiness
**Who is not ready, why, and what do I do about each person?** Filter and sort. Open a
person. Does every state have a next action? Do the numbers agree with the Plan's MFA
steps? Could the intern tell "not ready" from "we could not read this"? Could the MSP
tech send the list of people to chase to the client?

### J8 — Export, as the person who receives it
Produce every export: print / Save as PDF, the calendar file, the plan file, each CSV,
the prompts and the grounding bundle, with redaction on and off. Open each file. **Read
it as P5: does it stand alone? Does it match the screen? Are placeholders, raw ids,
internal words or broken formatting visible? Does the calendar land on sensible dates?
Is redaction's effect clear before I export?** Import the plan file back if the product
offers it.

### J9 — How and Inventory
**Does How answer the questions the other pages raised (what it reads, what it checks,
its limits)? Can I get to the right part of How from the place where I needed it?** In
Inventory, find one account and one policy, and check they match what Plan and Readiness
said about them.

### J10 — Leaving and coming back
Complete a step, make a decision, close the tab, reopen. **Is everything where I left
it? Does a follow-up scan explain what changed since last time?** Try Sign out and Forget
this tenant: does the product say plainly what each one keeps and deletes, and ask before
deleting?

### J11 — Keyboard and assistive use
Do J3–J5 with the keyboard only. **Can I reach and operate everything? Is focus always
visible and where I expect after opening, closing, completing and deferring?** Check the
heading outline, button and link names, contrast (light and dark), 200% zoom at 1280 wide,
and reduced motion.

## Lenses to apply everywhere

- **Comprehension**: jargon, acronyms, undefined terms, the same idea under two names.
- **Flow**: dead ends, loops, pages that do not say what to do next, hand-offs between
  surfaces that lose context.
- **Disjointed experience**: a number, name, state or date that differs between two
  places; styles, patterns or tone that change between surfaces; controls that behave
  differently for the same job.
- **Feedback and state**: every click answered; loading, empty, error and success states
  present and honest; nothing silently saved or silently lost.
- **Trust**: overclaims, false precision, missing "why", whether read-only and privacy
  promises stay visible where they matter.
- **Effort**: clicks, reading and memory each task needs; what an expert would want to
  skip; what a beginner needs spelled out.
- **Polish**: alignment, spacing, truncation, wrapping, capitalisation, punctuation,
  icons, focus rings, hover states, dark theme, print layout.
- **Value**: what saves real time, prevents a real lockout, or earns an expert's respect.
  Say which persona gets it and whether they can find it.

## Every finding

```
ID          F-<journey>-<n>
Type        Failing | Friction | Confusion | Disjointed | Polish | Trust | Accessibility | Value
Severity    Blocker (stops the task or risks a lockout) | Major | Minor | Cosmetic   (Value: High | Medium)
Surface     Home | Connect | Plan | Step | Decision | Readiness | Export | How | Inventory | Shell
Personas    P1–P5 affected, and how differently
Steps       what you did, numbered
Expected    what the persona expected, and why
Actual      what happened
Evidence    screenshot(s)
Direction   the smallest change that would fix it (a direction, not a design)
```

## The report

1. **Verdict in five lines**: would each persona use it again, and why.
2. **Top ten**, ranked by harm to users: the failings that matter most.
3. **Journey maps**: for J1–J11, one line per step with the persona's confidence
   (high / wavering / lost) and the finding IDs.
4. **Per-persona scorecard**: learnability, speed, confidence, trust, would-recommend,
   each 1–5, with one sentence of reason.
5. **Value to keep**: what works, for whom, and what would make it more findable.
6. **All findings**, grouped by surface, most severe first.
7. **Coverage**: every control and export you used, and everything you could not test.
