# What needs you, 2026-09-20

Forty-six items came out of the audit, the two held lists and the seven wave specs. Five of them
need you; I have taken the other forty-one, and each one is a line below so you can pull any of
them back. Everything here was re-checked on `6cfcc1c9`; what no longer happens has been dropped.

---

## Answered, 2026-09-20

1. **The office-network question** — agreed: add the third answer ("we have an office network, but it is not in Entra yet"), and make sure answering it pays off later in the plan rather than just recording a preference.
2. **Block the Admin Portals for Non-Admins** — held. The pinned baseline contradicts itself on that policy (its README spares administrators; its export blocks All users), so a re-pin is what fixes it, and the pin is frozen for V1. Ship Monday without it; revisit after launch.
3. **Mail devices** — agreed: their own group, so a temporary exception cannot become a permanent service account.
4. **The four Direction text fixes** — agreed, text only, before Monday.
5. **The break-glass rename** — done by the owner.

## Questions for you

### 1. A tenant with no office network in Entra has no honest answer to the office question

**Screen.** *Decide Where People Sign In From* → "The office network". Two answers: **Trusted
locations** / **Everyone works remotely**, under the evidence line "No named location is marked
trusted."
**Why it matters.** Most small tenants have never created a trusted network, so the only answer
they can give is "Everyone works remotely" — which is untrue, and it switches off the step that
would have defined the office network in the first place.
**Outcomes.** (a) A tenant with an office ends up with its network defined in Entra and its service
accounts restricted to it. (b) A tenant with an office says it is all-remote, and neither ever gets
built.
**Recommendation.** Add a third answer — *"We have an office network, but it is not in Entra yet"* —
which keeps the trusted-network step alive and offers the ranges we already see for them to
confirm. It changes a frozen question, which is why it is yours. **If you say nothing:** leave it.

### 2. One policy from Jon's baseline appears on nobody's plan

**Screen.** *Ongoing Checks*. Its first row is numbered 2, because **Block the Admin Portals for
Non-Admins** is registered as the first and drawn on no plan, in no state, for anyone.
**Why it matters.** It was held back because the step cannot currently say what to build in a
tenant that already has something similar — it ends on "Not enough information to provide
implementation guidance". So a beta user's plan simply never mentions keeping non-admins out of the
admin portals.
**Outcomes.** (a) Monday ships a plan that quietly omits one baseline policy. (b) Monday ships it
with an instruction that admits it cannot advise.
**Recommendation.** (a) for Monday, fix the reading and turn it on in the first week. The omission
is a launch call, so it is yours. **If you say nothing:** (a), and I will make it the first item
after launch.

### 3. Marking a printer or scanner puts it in the service accounts group for good

**Screen.** *Confirm What You Use* → "Devices or apps that send email by signing in (printers,
scanners, line-of-business apps)" → **Some**. On approval those accounts join the group from
*Identify Service and Shared Accounts*, and any account you explicitly rejected there is quietly
un-rejected. Neither screen says so.
**Why it matters.** A scanner using an old email protocol is a temporary exception you expect to
remove; a service account is permanent and gets restricted to the trusted network. One group, two
lifetimes — and a person's "no" is reversed without being told.
**Outcomes.** (a) One group, with a line on each screen saying what got added. (b) Mail devices get
their own group, so the temporary list can empty without touching the permanent one.
**Recommendation.** (b) — it adds a group, so it is yours. **If you say nothing:** (a), the cheaper
half, so nothing is silent on Monday either way.

### 4. Four small text fixes on the frozen Direction steps

**Screens.** *Confirm What You Use* → "Device code sign-in" says only "Not answered yet: the
suggestion is Not used", and never that a session which once used it stays blocked and can sign a
device out. *Decide How People and Devices Sign In* → "Phones → **Blocked from company data**" does
not say that picking it adds a whole new policy, a report-only week and two phone tests. Two of the
nine questions read No/Yes where the rest read Yes/No, so the same dropdown position means opposite
things. *Confirm What You Use* shows a bare date under NEXT MILESTONE where every other step has a
sentence.
**Why it matters.** These are the questions that decide which policies the whole plan contains, and
they are the four steps you froze, so none of it is mine to touch.
**Recommendation.** Do all four as text only — no layout, no behaviour — before Monday. **If you say
nothing:** they wait for the Direction UI pass and nothing changes.

### 5. Rename the break-glass account in the GetIAMAI tenant

Only you can: IAMAI never writes. Its old name is in the public git history. Rename it in Entra,
re-scan, and confirm Establish Emergency Access still reads Completed — before the link goes out.

---

## Decided, doing it

**Your four answers today, and how I am applying them**
- Every channel — portal, JSON, PowerShell — builds the policy the pinned baseline intends, for the
  medium user-risk step and everywhere else. The per-channel caveat then has nothing to say, so no
  new caveat slot is added to the anatomy.
- Risks, For the help desk, For your manager, Tell your people and the dates move behind "Why IAMAI
  says this". Risk is surfaced on the card only for a step with very high implementation risk.
- The passkey procedure is unfrozen: its "Compatible alternative" and "Replacement registration"
  become headings, not numbered instructions that instruct nothing.
- "Review the scan coverage details" is unfrozen and will name the place: MFA Readiness, where the
  account sits under Emergency access and "Evidence read" says what could not be read.
- The card shape stands as agreed: subject → what the scan found → where to do it; no pointer
  sentence where a step has one task; the heading is what is being waited on, with its state
  beneath; every step carries a dated line saying we checked it against Microsoft's page, or checked
  the instructions themselves where no useful page exists.

**Your earlier decisions, unchanged**
- The pin stays at `90d9b89` for V1. Microsoft's current guidance differs in eight places; each step
  says so and follows the pin. I would revisit one first after launch: token protection does not
  cover Windows Cloud Login.
- "Never used" passkeys keep the flag; it gets checked against GetIAMAI in the Sunday live pass.
- The four hidden MFA Readiness group headings go into the page's heading list, because you approved
  hiding them.
- *Approve answers* stays under the questions rather than moving to the action column; that belongs
  to the Direction UI pass you already set aside.
- Verify Emergency Access stays one long row with the recovery procedure inside it — it is the one
  thing a person may need with nothing else working.
- Step 2's export keeps printing the optional exclusions-group task, because the export is the
  screen.

**What a step says**
- A policy at its last stage stops listing that stage as both its next check and a completed one.
- Where the work is ready but the plan is not, the card says so in one sentence, instead of the body
  and the badge contradicting each other in silence.
- A held step keeps both of its Completion Criteria; today it drops the half the scan cannot see.
- A step with no rollout keeps no "N checks remaining" count — one check needs no counter.
- The two account-review steps stop reading "No user impact" and say what the review covers.
- A card with no subject of its own is not drawn, instead of printing its kind twice.
- A held policy names what it is waiting on once, not in three cards.
- The session-loop card says one thing; its extra fact moves behind "Why IAMAI says this".
- The "change this setting first" lines come from the step's own instructions only — one source, not
  two.
- A procedure's "verify the workflow" checks go back into the procedure, where they are the last
  thing the admin is asked to do, instead of becoming stray setting rows.
- Group rows are numbered as drawn, so the count in the heading and the last number agree.
- Impact for a row comes from one place, not three; the four Direction rows say "Your answers"
  instead of all reading "Tenant settings".

**Words**
- Finding labels go to sentence case, matching Emergency Access.
- The guest directory card puts the names on their own line instead of inside the sentence.
- The instructions say **Network** everywhere, as Microsoft's blade does, instead of Locations in
  one place and Network in another.
- The guest MFA guidance gains the clause that explains the rule: a guest cannot register a passkey
  in your tenant at all.
- "Restrict the Entra Connect Sync Account to Its Address" is renamed for what the policy actually
  targets — the sync service principal, not a user account.
- The Mac-only tenant stops being told about Windows Hello on the computer.
- Remediate High-Risk Users keeps both hybrid remediation routes but names the condition that picks
  each, so a reader knows which one is theirs.
- The four-year-old service-accounts reference stays — no newer page covers it — with its date shown
  beside it, as other steps do.
- The baseline-review rows get one pass after launch to pick up Microsoft's phased-change warning.
- Home, How and the public pages get checked for any mention of the retiring legacy risk policies;
  nothing in the plan depends on them.

**Tests and fixtures**
- Two shipped steps that no test tenant reaches get a fixture that reaches them, after Monday.
- The Ready-to-enforce, Partial and Enforced badges get a fixture that draws them, after Monday.
- The week-two demo keeps one Direction answer open on purpose; I will say so in the fixture so
  nobody "fixes" it.
- Passkey profiles aimed at a group keep reading "unknown" for V1 — the conservative answer, never
  an overstatement — with the reason said once. Counting them properly comes after launch.

---

## Noted, no action

- Microsoft never states what **Configure: No** means for Network; we claim no more than they do.
- Two Microsoft pages name the same condition differently; both procedures name both.
- Authentication flows is "(preview)" on one page and a how-to on another; two steps depend on it.
- Microsoft's authentication-transfer recipe skips report-only; IAMAI does not. We are stricter.
- Per-user MFA state is a preview-only read, so "not fully read" is the best a read-only tool can do.
- The registration campaign's licence requirement is undocumented; the step claims none.
- Intune bundles are no longer enumerable from Microsoft; no step names one.
- The guest selector has two names on Microsoft's own pages; we use the one the blade shows.
- The pin's device-filter syntax differs from Microsoft's example; the pin's is the portal builder's
  own form.
- Free-tier dormant accounts cannot be checked end to end against a test tenant; the licence note is
  asserted from the words.
- Microsoft defines "last successful sign-in" two ways; our wording claims neither.
- Four risk steps cannot be seen on the demo because they need a licence; they were read elsewhere.
- Verify Emergency Access is the only Cleanup row drawing the task shape; that is your decision,
  recorded so nobody undoes it.
- The drill, not the policy work, decides when the risk-and-sessions group can be enforced.
- A very large tenant can still stop short of 30 days at Microsoft's 50,000-row sign-in ceiling.
- Mobile app protection is in no group and no baseline policy; the facts a future wave needs are
  written down.
- Three circulating device claims and two beliefs about device registration have no Microsoft page
  behind them and are on no step.
- The unused device-plan reason and tile words, and the reference file nothing renders, are dead and
  will be deleted with the next pass through that area.
