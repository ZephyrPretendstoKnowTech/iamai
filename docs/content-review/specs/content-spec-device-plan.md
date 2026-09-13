# Content spec: Decide How Devices Are Managed

**Step ID:** `s-prereq-device-plan`
**Package:** `docs/implementation-content/s-prereq-device-plan/`

---

## Header

- Step type label: CHECK STEP — No change.
- Title: Decide How Devices Are Managed — No change.
- Badge: Ready · Decision — No change.
- Subtitle: None present — No change. Decision steps don't need one.

---

## Why

CURRENT →
A device policy can only ask for what the business has decided: a phone that is enrolled, an app that keeps the data, or no company data on phones; and computers that are enrolled, domain-joined, or not managed. Learn →

TARGET →
No change. Clear, explains the decision in plain terms, and lists the options. Learn link present and correct.

---

## Readiness tiles

### Tile 1: DECISION

- Icon: "!" — No change. Appropriate for a pending decision.
- Label: DECISION — No change.
- Collapsed summary: "Decision"

CURRENT →
Decision

TARGET →
Not yet decided

Reason: "Decision" as both the label and the summary is redundant and tells the tech nothing. "Not yet decided" communicates status.

- Expanded content: Not visible / none beyond the collapsed summary.

### Satisfied section: "1 satisfied"

CURRENT →
AFFECTED PEOPLE  3 active people · 2 admins

TARGET →
No change. Shows who is affected by this decision.

---

## Readiness bar

CURRENT →
Needs a decision

TARGET →
No change. Clear status.

### Readiness explanation (via "Why IAMAI says this")

**Who this touches:**

CURRENT →
3 people signed in from a phone or from a computer that is not joined since Aug 13, 2026.

Phones:
1. Admin
2. Breakglass

Computers neither joined nor enrolled:
1. Admin
2. Lachlan Robinette
3. Breakglass

TARGET →
No change. Specific and useful — shows exactly who signs in from unmanaged devices.

**Why it matters:**

CURRENT →
Downstream Conditional Access can require only the device posture the owner has explicitly chosen and the tenant can support.

TARGET →
No change. Clear explanation of why the decision must come first.

---

## Milestone / action column

- Milestone:

CURRENT →
Ready · Decision

TARGET →
[Date should appear here, not lane substatus]

**Global issue C2**: Milestone shows lane substatus "Ready · Decision" instead of a date.

- Milestone sub-text:

CURRENT →
Decide phones and computers

TARGET →
No change. Clear action.

- Explanation paragraph:

CURRENT →
Until you decide, phones are out of the compliant-device policy, and the device steps wait on this one.

TARGET →
No change. Explains the consequence of not deciding.

- Inputs:

**Phones dropdown:**
Label: "How should phones be managed?"

CURRENT options →
- Choose…
- Enroll phones in Intune
- Protect company apps only
- Keep company data off phones

TARGET options →
- Choose…
- Enroll phones in Intune — phones must be enrolled and compliant to access company data
- Protect company apps only — use App Protection policies without enrolling the device
- Keep company data off phones — block company data on phones entirely

Reason: C10 — dropdown options need explanation suffixes so the tech understands what each choice means.

**Computers dropdown:**
Label: "How should computers be managed?"

CURRENT options →
- Choose…
- Enroll in Intune
- Hybrid join is sufficient
- Not managed

TARGET options →
- Choose…
- Enroll in Intune — computers must be Intune-enrolled and compliant
- Hybrid join is sufficient — domain-joined computers are trusted without Intune enrollment
- Not managed — no device compliance requirement for computers

Reason: C10 — same as phones.

- Save button: Present. ✓

---

## Implementation

No Implementation section present — No change. Expected for a decision/check step. There is no Conditional Access policy to create; this step only records a business decision.

---

## Done when

CURRENT →
Phones and computers are answered; Require a Managed Device Outside the Office shows the platforms it covers beside the baseline's version.

TARGET →
No change. Specific — names the downstream step that depends on this decision.

---

## Links

- Learn → https://learn.microsoft.com/mem/intune/fundamentals/deployment-guide-enrollment — Correct. ✓
- No cross-reference links present. Could link to "Require a Managed Device Outside the Office" since Done When references it, but this is a nice-to-have.

---

## Buttons

- Save: Present. ✓
- Scan to update the plan: Present. ✓
- Defer this step: Not present. Correct — this is a prerequisite decision that blocks other steps.
- Doesn't apply here: Not present. Correct — every tenant needs this decision.

---

## Global issues

- C2: Milestone shows "Ready · Decision" (lane substatus) instead of a date.
- C10: Dropdown options for both Phones and Computers need explanation suffixes.
- DECISION tile summary is redundant with the label — fix above.
