# Design: observation windows and report-only readiness

Two connected pieces. The first decides how long a policy should sit in report-only before
anyone can call it safe. The second reads the evidence and says whether it is.

## 1. Observation windows: short, with the unknowns stated

The audience is a person with weak sign-in requirements today and limited attention. A long
observation window does not make them safer; it makes them stop. A policy in report-only
harms nobody, so the cost of a shorter window is a smaller evidence base, not exposure. The
cost of a three-week window is abandonment.

So windows are short, and the gap between what the evidence covers and what the control can
break is stated as an unknown the user can close in one click, rather than waited out.

### Windows

| Situation | Window |
|---|---|
| Evidence already shows zero affected users (a block on a flow nobody uses) | 3 days |
| Everything else | 7 days |

No window exceeds 7 days. No window is shorter than 3.

### The evidence bar, which is not a gate

The bar is: the days have passed, **and** a sign-in has arrived for every affected user *who
signed in at all in the last 30 days*.

Nobody else is waited for. A person who has not signed in for a month will not sign in inside
a three-day window either, so requiring one of them makes the short window unreachable by
construction and the user waits anyway — which is the abandonment the short window exists to
prevent. The earlier version of this section required a sign-in from every *active* affected
user and so contradicted the window lengths above it.

People the records cannot speak for are **named on the verdict**, not waited for:

> Ready to enforce, and the records cannot speak for Priya Haddad and Sam Lee, who have not
> signed in since 12 August.

The user then decides, and the verdict offers the three choices the assertions below already
support: carve those people out, defer them to a later wave, or proceed and accept it. Days
alone are still never a verdict, and an absence of evidence is still never read as evidence of
safety — but an absence that names its people is information, where a blocked step is not.

**"Not enough evidence yet" is reserved for the case where the records are thin for the people
who *are* signing in**: no sign-ins at all in the window, or a policy whose report-only results
did not arrive. That verdict never reads as ready.

### Stated unknowns, in place of longer windows

Every step names what its window cannot see, in plain words, with the fact behind it:

| Control | What 7 days cannot see | The question the user can answer |
|---|---|---|
| Device compliance or managed device | A device that stops reporting is marked non-compliant only after the compliance status validity period, 30 days by default. A laptop back from a month away is blocked with nothing having changed. | Does anyone here go weeks without connecting? |
| Device compliance | Devices Intune cannot mark compliant: Windows Home, some Linux builds, personal machines. | Are personal or unmanaged devices used for work here? |
| Location or country block | Travel and roaming. A week of records shows where people were, not where they go. | Does anyone travel or work from another country? |
| Any grant control | People who sign in rarely. | Does anyone sign in less than monthly? |
| Any grant control | Shared, kiosk and frontline accounts that cannot hold a personal method. | Are there shared or kiosk accounts? |
| Risk-based | Risk detections are sparse; a week may contain none. | none: state that the window may hold no detections at all. |

### Assertions

The user answers those questions once, in Setup or from the step, and the answer is stored in
the plan with its date. An assertion does one of three things, stated when it is given:

- adds the named people or devices to a carve-out the step already supports,
- moves the step to a later wave so those people are handled deliberately,
- or records that the exposure is accepted, which appears in the change record.

An unanswered question is not a blocker. It appears on the step and in the verdict as
"the records cannot confirm this", so nobody mistakes silence for safety.

## 2. The readiness verdict

For every step in report-only, one card answering: can this be enforced yet.

**Inputs**, all already collected: `appliedConditionalAccessPolicies` results per sign-in
keyed to the step through the description tag; the step's affected population; the readiness
state of those people; the window from §1.

**The card shows:**

- A verdict: **Ready to enforce** · **Not yet** · **Not enough evidence yet**, with one
  sentence of reason.
- Days observed against days required, and sign-ins observed against the bar.
- Users covered: how many of the affected population have signed in during the window.
- Would-be failures and interruptions, by person, with what each one hit.
- Anyone in the population who has not signed in at all during the window, named — because
  they are the ones a verdict cannot speak for.
- The exit criteria, each ticked or not.

**Verdict rules.** Ready requires: window elapsed, evidence bar met (as defined in §1, over
the people who signed in during the last 30 days), zero would-be failures, and the operator
not in the failure set. Any failure at all means Not yet, with the people named. Insufficient
evidence is its own verdict and never reads as ready.

People the records cannot speak for do not block a Ready verdict; they are named in it. An
unanswered unknown never gates either. Both appear in the verdict so nobody mistakes silence
for safety.

**Show your work.** Every verdict carries two links: the report-only insights workbook
filtered to that policy, and What If pre-filled for the first affected user. The tool is
reading Microsoft's data; a user who wants to check it should be one click away.

**Grouping is by step, not policy.** A goal delivered by three policies shows one verdict
with the three policies listed under it.

## 3. Operator pre-flight

Before any enforcement event, the plan checks the person doing it: run What If for the
signed-in operator against the policies about to be enforced, and show a go or no-go with
the reason. An operator who locks themselves out cannot fix what they just broke.
