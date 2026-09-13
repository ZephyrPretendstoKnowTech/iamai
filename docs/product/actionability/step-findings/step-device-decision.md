# Step findings: Decide How Devices Are Managed

**Step ID:** `s-prereq-device-plan`
**Archetype:** Decision
**Current state on Lachlan's tenant:** Ready · Needs decision (unanswered)
**Package path:** `docs/implementation-content/s-prereq-device-plan/`

---

## Step-specific fixes

### S-DD-1: Conditional follow-up question

**Current:** Three question groups all shown unconditionally: Phones (3 radios: Enroll / Protect apps / Keep off), Computers (3 radios: Enroll / Hybrid / Not managed), Unmanaged phones (1 checkbox: Block phones not enrolled). "Protect company apps only" is pre-selected for Phones, "Enroll in Intune" for Computers.

**Target:** The "Unmanaged phones" question only applies when the admin chose "Enroll phones in Intune" for Phones. If they chose "Protect company apps only" or "Keep company data off phones", there's no enrollment to be unmanaged from, and the blocking question is irrelevant. Show the follow-up only when the primary answer makes it applicable.

**Implementation notes for Claude Code:** The Unmanaged phones section should be conditionally rendered based on the Phones selection. In the step's input component, add a check: if the Phones radio value is "enroll", show the Unmanaged phones checkbox; otherwise hide it and clear any saved value for it. The plan record's device decisions field should store `null` for unmanaged-phones when phones aren't enrolled.

---

### S-DD-2: No dismiss button needed — the options cover opting out

**Current:** No "Defer this step" or "Doesn't apply here" button exists on this step.

**Target:** No change needed. The decision options themselves include the opt-out: "Keep company data off phones" and "Not managed" for computers. An admin who doesn't manage devices selects those options and saves. No separate dismiss button is required. This is confirmed by Lachlan.

---

### S-DD-3: Impact count inconsistency (minor)

**Current:** Row shows "3 people" in the IMPACT column. Inside the step, the AFFECTED PEOPLE tile shows "3 active people · 2 admins". The row used to show "Lachlan Robinette" on some earlier scan (not currently reproducible, but the universal rule U12 prevents it regardless).

**Target:** Row impact shows "3 people". Tile inside shows "3 active people · 2 admins". This is actually fine — the row is a summary, the tile is the detail. No change needed to this step specifically. U12 prevents the person-name case.

---

### S-DD-4: Done-when is good — keep

**Current:** "Phones and computers are answered; Require a Managed Device Outside the Office shows the platforms it covers beside the baseline's version."

**Target:** No change. It names a concrete downstream verification.

---

## Universal items that apply to this step

- **U1:** Remove "What to do" section. Content "Answer the question this step is waiting on." is redundant. The contextual sentence "Until you decide, phones are out of the compliant-device policy, and the device steps wait on this one." is useful — move it into the Why section or the DECISION tile's expanded content.
- **U2:** Decision radios move to the action column. Per archetype rule A1, convert to dropdowns since the options are one-line labels. The three groups (Phones, Computers, Unmanaged phones) become three dropdowns in the right column under the milestone date, with Save below them.
- **U3:** Milestone sub-text "Make the decision" removed. Date stays. Sub-text could say "Decide phones and computers" or nothing.
- **U5:** DOM order: the NEXT MILESTONE section is visually top-right but in the DOM after Done when. Fix the DOM order to match the visual.
- **U6:** DECISION tile uses compact/expand. Compact: "Decision · How devices are managed". Expand: "Answer how phones and computers are managed. This unlocks Require a Managed Device and Require a Fresh Sign-in for Intune Enrollment." (names the downstream steps that wait on it).
- **U9:** Row subtitle "until phones and computers are decided" removed.
- **U10:** "next" pill on Emergency Access row — applies to the plan view, not this step specifically, but was observed while reviewing this step.
- **U11:** Substatus "Needs decision" → "Decision". Badge reads "Ready · Decision".
- **U12:** Impact never shows a person's name. Currently shows "3 people" which is correct.
- **U13:** Impact "Configuration only" doesn't apply here (already shows people count). But if the count were unavailable, it should say "Device policies" or "2 downstream steps" rather than "Configuration only".
- **U25:** Learn link already present inline ("Learn →" at end of Why). No change needed.
