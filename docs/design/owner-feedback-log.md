# Owner feedback on the finished product — catalogue

Kept here so nothing said in review is lost between prompts. Each entry: what was
said, the decision it drives, where it lands. Entries marked *open* are waiting on the
deep audit or on the owner's further notes.

## Round 1 (1 Sep)

| Said | Decision | Lands in |
|---|---|---|
| `/rollout/` shared directly lands on a sign-in with no pretence | The signed-out page is the opener: what it is, who it is built for, what it catches. Not a how-to page. | 51 |
| Connect is barren; a baseline is never explained; who/what the baseline is needs a click | Baseline explained in place, three lines | 51 |
| Footer is messy | Three links; build stamp to How IAMAI works | 51 |
| The Plan still asks no questions | See round 2 — the questions move to the tenant page | superseded |
| Where does the scan run? The progress bar was useful | It runs after sign-in; the two-lane progress stays; verify on a first scan | 51 |
| Today has no explanation of how it fits | One purpose line; tiles say which steps they hold; Plan references Today | 51 |
| Remove the Recovery card | Gone from navigation and header; content kept as an Export row (printable) | 51 |

## Round 2 (2 Sep)

| Said | Decision | Lands in |
|---|---|---|
| Opener yes; a "how to use this tool" page no — if it needs one, we failed | The opener stays what/why only. No usage page anywhere. | 51 |
| A collapsible tip at the top of each page: small, expanded on first visit, collapses to a corner control that takes no space, state remembered per page | New primitive `PageTip`: ≤2 sentences per surface, expanded once, collapses to a `?` at the top right of the page column, per-page state in local storage, contract-budgeted | 51 |
| The Plan should tell people Today exists and what it is for | Plan header second line references Today by name | 51 |
| A page before the Plan for generating it: consent → scan → questions. The Plan's top should be about the plan, not "assumed" inputs. "Assume" must not appear. | The tenant page. Sign-in (consent) and scan stay where they are; after the scan the same page shows what IAMAI found as a readable list with confirm/change, then the three questions, then `Open the plan →`. The Plan drops the strip; its header line gains "built from what IAMAI found on Tenant · change". The word "assume" leaves the product. | 51 (revised) |
| More feedback coming from the individual steps | *open* | audit |
| "Audit again, better: see everything, review everything for ease of use and understanding" | Deep audit: every surface, every step on GetIAMAI and the demo, every sentence judged for ease of use; a per-screen ledger | next conversation |

## Standing rules confirmed by these rounds

- No page exists to teach the tool. Explanation is a tip you can dismiss for good.
- Inputs live on the tenant page; the Plan shows outputs.
- "Assume" is not a word the product uses. It says what it found and what it could not
  see.

## Round 3 (2 Sep) — the step bodies, from the emergency-access step to the campaign

The owner read the first eight steps and said every issue applies to every step; the
fixes are holistic, not per step.

| Said | Decision | Lands in |
|---|---|---|
| "Before anything else" sounds machine-written | The first wave is `Preparation` | 51 |
| Titles say what to do, not what is being fixed: `Sort out emergency access before anything else` → `Create or Correct Emergency Access Accounts`; `Sort out the exclusions group` → `Create or Correct Exclusions Group`; `Decide on 8 dormant accounts` → `Address Problematic Accounts` | One title rule product-wide: imperative verb + the thing being fixed, professionally stated, Title Case as in the examples; every title regenerated from a per-goal `fixTitle` | 51 |
| "Nothing changes for anyone. This is groundwork so a mistake later can be undone." is pointless; find every line like it | A sentence earns its place only if it changes what the reader knows or does. Lines that describe the absence of an effect, restate the title, or narrate the tool's reasoning are deleted at the generator | 51 |
| The Why line is messy | Why is one plain sentence naming the tenant: "Emergency access accounts are how you keep access to GetIAMAI if a change goes wrong." | 51 |
| "Who this touches: nobody" on a step that touches the break-glass accounts | Who this touches names the accounts the step acts on, not only the people a policy would prompt | 51 |
| `Do it` → `What to do` | Section renamed | 51 |
| "Exclude both accounts from every Conditional Access policy" with the policies still to do as a sub-list | Any list of objects (accounts, groups, devices, policies) renders as a numbered or lettered list, never inline | 51 |
| Nothing says to re-scan after the day's changes, then tell the tool which the second account is | Every step that changes the tenant ends with the control `Scan to update the plan`, reachable from the step; when the scan returns, the step opens with what it now sees ("second account found: Breakglass2 · excluded from 9 of 10 policies, one to go"); selections happen in the step (item 6) | 51 |
| "A sign-in by an emergency account raises an alert" belongs at the end of the plan, in a cleanup stage, with instructions | A final wave, `Cleanup`, for alerting, naming, consolidation and other hygiene; the alert item moves there with its how-to | 51 |
| Instead of a checklist about the passkey, an instruction on handling emergency-account passwords | The create action carries the credential guidance (long random passphrase, stored offline in two places, no method tied to a person's phone); the tick lines go | 51 |
| `If it goes wrong` only where a meaningful error can occur; the recovery link goes because recovery cards are gone | Section renders only on steps with a real failure mode; the Recovery card is removed entirely, including the Export row | 51 |
| The exclusions-group step tells you to see the exclusions-group step | Self-references deleted; a test forbids a step linking to itself | 51 |
| **Answers belong inside the step that needs them**, pre-filled from the scan: select the emergency accounts in the emergency-access step (with create instructions and a scan if none); select the exclusions group in its step; select the countries in the countries step, which then states the consequence ("people signing in from outside US and CA will be blocked") | **Confirmed by the owner.** Every decision is made in the step that consumes it, with the tenant's data in front of the person, and nowhere else: no assumptions strip, no question list on the tenant page, no reference to a coming question anywhere earlier than the step. The tenant page keeps consent, the scan and what was found, and asks nothing. The three can't-see questions are asked in the steps they affect (mail-sending devices in the legacy-auth block; travellers in the countries step; partner access in the strength and location steps). Selections are the plan's decisions, verified on the next scan | 51 |
| The trusted-location step's first line means nothing after the countries step; some companies are fully remote and need a way past it | First line: "Define the trusted network your team usually signs in from." A `Doesn't apply here` outcome, with a reason kept in the plan file and shown on the printed plan, distinct from Skipped — **only on steps whose subject can legitimately not exist** (trusted network, guests, Intune, on-prem sync, shared devices, mail-sending devices), never on foundations such as emergency access or the exclusions group | 51 |
| The campaign: `Create and Enforce the MFA Registration Campaign`; lists of people by MFA state; choose the special-care people in the step; instructions per state (no method, insufficient method, registered but unused); the email needs a copy control inside its box like Claude's code boxes; the email is poorly written, mentions IAMAI, and gives the tool credit | Campaign step rebuilt around the state lists and per-state instructions; copy boxes with the control inside, top right; every end-user communication is written as from the technician, never names IAMAI, and carries the note "paste this into your own assistant to match your voice" | 51 |
| More feedback to come; the first eight steps stand for all | *open* — the deep audit reads every step against this list | audit |

## Standing rules confirmed by round 3

- The person doing the work gets the credit with their users; the tool is invisible
  to end users.
- Decisions are made in the step that needs them, with the data pre-filled.
- Lists are lists.
- A section renders only when it has something to say.

## Decisions confirmed by the owner after round 3

1. Questions happen in the step, and only in the step. Nothing before it asks them or
   mentions that they are coming. The tenant page asks nothing.
2. The control is `Scan to update the plan`, present at the end of every step that
   changes the tenant and in the header; the step re-reads itself when the scan lands.
3. `Doesn't apply here` exists only where the subject can be excluded; foundations
   cannot be marked not applicable.
4. A `Cleanup` wave closes every plan (alerting, naming, consolidation, the baseline
   policies not assessed); nothing in it delays protection.
5. End-user communications are the technician's; the tool is never named to end users;
   every copy box carries the "paste into your own assistant to match your voice" line,
   and the copy control sits inside the box.
6. Still open for the owner: the since-last-scan header line; Today's tiles linking to
   the steps they hold.
