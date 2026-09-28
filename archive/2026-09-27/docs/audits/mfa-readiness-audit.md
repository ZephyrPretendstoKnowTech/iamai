# MFA Readiness audit: what the rebuild is built around

Prompt 61, 2026-09-18. Read-only against the repository and the GetIAMAI tenant.
Standard: `docs/EMERGENCY-ACCESS-HANDOFF.md` ("Approved interaction and writing
rules", "Prompt 60 corrections").

Evidence marks: **observed** means live GetIAMAI (production, scan of 2026-09-18 14:03,
signed in as the operator) or a fixture run that I saw; **inferred** means from code
reading only. The live tenant is anonymised here: **A** is the operator's admin account,
**B** is the second active person, and the two emergency accounts stay out of the
readiness count.

Fixture numbers come from a scratch probe over `readinessView`, `runFixture`,
`stepMfaHold` and `readinessCells`. The probe is not committed. Per fixture:

| Fixture | Active | Page "Ready" (phishing-resistant proof) | Plan's `s-verify-mfa`: method ready for target | Plan-prepared but page not Ready | Default "Needs action" rows (pages of 50) |
| --- | --- | --- | --- | --- | --- |
| small | 22 | 1 | 16 of 22 (3 unknown) | 15 | 21 (1) |
| demo | 30 | 4 | 21 of 30 (2 unknown) | 17 | 26 (1) |
| mid | 246 | 17 | 181 of 246 (32 unknown) | 164 | 229 (5) |
| large | 4,169 | 306 | 3,034 of 4,178 (563 unknown) | 2,728 | 3,863 (78) |
| huge | 21,329 | 1,640 | 15,768 of 21,375 (2,793 unknown) | 14,128 | 19,689 (394) |

Earlier findings rechecked:
- Proof is still per sign-in, per method class and per OS family, read from interactive
  sign-ins within 30 days (`laneB.ts:24`, `constants.ts:2`). It still holds.
- "No history beyond the window" no longer holds. Since Step 7, `mfaHistory.ts` keeps
  proof and platforms across scans and never expires them.
- "`phishingResistant.ts` holds the one readiness state and the gates count only Ready"
  no longer holds. `generate.ts:1790-1799` replaces every MFA, admin and guest step's
  readiness with `methodPreparation`, which measures a registered, usable method against
  the step's target policy. `s-verify-mfa` is built the same way (`generate.ts:2219-2235`).
  The comment at `readiness.ts:24-33` and the header of `MfaReadiness.tsx:17-22` still
  claim the one-state rule.

---

## 1. Decision and user

The admin running the rollout uses this page to answer one question: **can I enforce
the next MFA step's sign-in requirement for the people it reaches today, and if not,
who stops me and what does each of them have to do?**

"The requirement" means the step's own grant: a strength such as Phishing-resistant MFA
or the baseline's Modern MFA + TAP, or built-in MFA. It is not a tenant-wide passkey or
phishing-resistant aspiration. The baseline requires built-in MFA for all users
(`IAC - GLOBAL - GRANT - MFA - AllUsers`). Phishing resistance, plus a Temporary Access
Pass, applies only to admins and a few named scopes.

Today's page serves a different question: "who has proven phishing-resistant MFA on
every platform?" Nothing on the page is tied to a step unless it was opened from one.

## 2. Keep

Ranked by user impact.

1. **Unknown as its own state, with which read failed** (`phishingResistant.ts:295-318`,
   `readinessCells.ts:145-146`). The inventory and sign-in failures are named separately
   and never counted as Ready or as a shortfall. The summary shows `summaryUnmeasured`
   instead of "0 of N" (`MfaReadiness.tsx:185`). Keep. *Inferred.*
2. **One next action per person, with Why and Next one level deep**
   (`readinessCells.ts:166-217`). This matches "show the next check": the row carries one
   action and the detail explains it. Keep the shape, but re-derive the action from the
   step's requirement (see Fix 1). *Observed on fixtures.*
3. **Needs action as the default view, with satisfied people out of it.** On GetIAMAI the
   default view is empty because both people are Ready. That is correct behaviour, but
   the empty state reads "No people match this view." rather than saying nobody is
   blocking (Cut 6). *Observed live.*
4. **The denominator ledger and the evidence window** (`MfaReadiness.tsx:363-377`). Live,
   it read "Not counted toward the 2 active people: 2 emergency access · 1 sign-in
   disabled · sign-ins Aug 19 → Sep 18". It is true, it explains the number, and it links
   each population. *Observed live.*
5. **A lost qualifying method** (`restore`, `phishingResistant.ts:301-314`). A qualifying
   method that disappeared between two readable inventories is a real, actionable change:
   the person restores it. Keep. *Inferred.* No fixture exercises it with retained history.
6. **Step scoping by hash** (`#/readiness/step/<id>`, `stepFromReadinessHash`). The URL
   carries only the step id, and the page resolves who. Keep, and make it the default
   entry (Rebuild §1). *Observed live.*
7. **Admins filter and CSV export.** These are the only tools that work at 3,863 or
   19,689 rows. *Observed on fixtures.*
8. **Per-method, per-platform proof lines.** They are true at the grain the records
   support. Keep them in the person detail as confidence evidence, not as a gate (Owner
   decision 2). *Observed live:* A's lines were "Passkey · Windows" and
   "Passkey · Android", B's was "Passkey · Windows". The snapshot agrees: those are the
   passkey sign-ins and platforms recorded Aug 19 → Sep 18.

## 3. Cut

Ranked by user impact.

1. **The unscoped tenant-wide phishing-resistant headline as the page's answer**
   ("{ready} of {active} are Ready.", `MfaReadiness.tsx:185`, `pages.readiness.summary`).
   It does not serve the decision, contradicts the Plan (Fix 1), and at scale tells
   thousands of people prepared for their actual requirement to "Set up passkey". On mid,
   217 of 246 get that action; on huge, 18,162 of 21,329. For people whose policy asks
   only for MFA, that is a recommendation shown as a requirement, which the handoff's
   rules forbid. It moves to the collapsed recommendations (Rebuild §6).
2. **The "Tenant readiness" strip** (`MfaReadiness.tsx:304-319`). It repeats the
   headline. Live, the same fact rendered three times: "2 of 2 are Ready.", "2 of 2 have
   qualifying sign-in proof" and "All active people have qualifying proof". It also
   links to `s-verify-mfa`, which measures something else (Fix 1). *Observed live.*
3. **The "Passkey rollout" strip** (`MfaReadiness.tsx:320-345`). It duplicates the No
   passkey filter and promotes a recommendation to the top of the page. The headline is
   not the place for a passkey campaign. *Observed live* ("2 of 2 have a passkey · None
   without").
4. **The three state tiles as the summary** (Need proof / Need setup / Unknown). At scale
   they are three large numbers with one identical action behind the biggest one. A
   shortfall count per next action replaces them, because the action is what the admin
   works through (Rebuild §3). *Observed on fixtures:* the large fixture's 3,569 Needs
   setup people all carry "Set up passkey".
5. **The separate "Preparation" vocabulary on the step-scoped view** (`MfaReadiness.tsx:185-190,
   249-259, 293, 307-308, 358`). The same page speaks two languages depending on the
   entry: "Ready" and "Needs setup" unscoped, "Method Ready" and "Check Compatibility"
   scoped. The strings are hard-coded English outside `content.json`. One state, one set
   of words (Fix 1). *Observed live.*
6. **The empty worklist as the whole answer on a ready tenant.** Replace "No people match
   this view." on the default view with the answer itself ("Nobody blocks <step>"), and
   collapse the satisfied people. *Observed live.*
7. **Uncounted accounts in the worklist.** Not-active people, emergency, service,
   shared-device and disabled rows are reachable as worklist filters
   (`mfaReadiness.ts:31-35, 140-142`). They are not part of any readiness decision. The
   ledger counts are enough, and Inventory owns the accounts. *Inferred.*
8. **The Role column's "Person" word and the per-row "Retry scan" action.** The first is
   noise. The second is a page-level fact: one failed read affects everyone
   (`readinessCells.ts:175`). *Inferred.*
9. **Dead code:** `firstMfaDependency` (`stepMfaReadiness.ts:132`) has no production
   caller, so the approved pack's "Current Plan dependency" callout is no longer rendered
   (task 037 built it; it was later replaced by the strips). The rebuild should restore
   the idea (Rebuild §1) and delete one of the two implementations. *Observed:* grep finds
   only the test.

## 4. Fix before rebuild (truth defects)

Ranked by user impact.

1. **Two readiness models give opposite answers on one page.** *Observed live and on
   fixtures.*
   - Live GetIAMAI, unscoped `#/readiness`: "2 of 2 are Ready."
   - Live, the same page from the Plan (`#/readiness/step/s-verify-mfa`): "0 of 2 people
     have a method ready for this step · 2 need a compatibility check". Both rows still
     show verified passkey sign-ins.
   - Fixtures: people the Plan counts as prepared but the page tells to set something up
     number 15 (small), 164 (mid), 2,728 (large) and 14,128 (huge).
   - Cause: the page's summary, tiles, strip and rows read `personReadiness`
     (`MfaReadiness.tsx:119-121, 185`). The Plan's gates read `methodPreparation`
     (`generate.ts:1790-1799, 2219-2235`).
   - The strip's comment (`MfaReadiness.tsx:17-22`) and `readiness.ts:24-33` both claim
     the page and the gate share one measurement. They no longer do: `readinessFor`
     (`MfaReadiness.tsx:121`) is not the function the Plan's gate reads any more.
   - Fix: one person state, derived from the step's requirement, read by both. Owner
     decisions 1 and 2 settle which.
2. **"Compatibility unknown" for people whose passkey demonstrably works.** *Observed live.*
   - The tenant enforces the built-in Phishing-resistant MFA strength for all internal
     users and for admins (policies enabled; strength read, with no combination
     configurations).
   - A and B each have successful device-bound passkey sign-ins in the window. The
     scoped page still marks both "Check Compatibility" with the action "Review method
     compatibility in the plan step" (`MfaReadiness.tsx:250-258`).
   - The Plan step it links to says nothing about compatibility. It shows "Registration
     support · Not confirmed" and a support-list picker.
   - Source: `methodPreparation` → `methodAvailability.usable` → `passkey()` →
     `emergencyPasskeyCompatibility` returns `unknown` for these accounts
     (`methodAvailability.ts:24-33`, `passkeyCompatibility.ts:28-111`). Group-membership,
     profile or model reads are the candidates; which one was not isolated live.
   - Two rule breaks. First, the outcome loses to a derived registration flag: a
     successful fido2 sign-in in the window, under the enforced strength, proves that
     credential works with the runtime configuration. Second, the failing check names no
     action the admin can see and take.
   - Fix: (a) observed success under the requirement settles compatibility for the
     credential that signed in; (b) whatever unknown is left names the read IAMAI is
     missing (IAMAI's to diagnose), not a trip to the Plan.
3. **The Plan's preparation step names Ready admins as blockers, under a completed
   policy.** *Observed live.*
   - `s-verify-mfa` reads "Admins: Admin: Require Phishing-Resistant MFA for Admins waits
     on each registering a passkey or security key". It offers A under "People Needing
     Help".
   - But A has a passkey with Windows and Android proof, and that policy step is in
     Completed.
   - Cause: `adminNames` is every admin (`derive/contentLists.ts:154`), rendered by
     `content.json:3440` (`adminsNote`).
   - This is Plan copy, but the rebuilt page will be linked from it. The page must not
     inherit a list that contradicts its own states.
4. **Partial sign-in coverage is treated as complete coverage.** *Inferred.* Fixtures
   never produce `partial`.
   - `evidenceUsable` accepts `partial` (`mfaViability.ts:188, 216`). Collection stops at
     50,000 rows or 10 minutes and still reports `partial` down to 24 h of coverage
     (`constants.ts:3-5`, `laneBCore.ts:599-606`).
   - On a large tenant that can be a day or two out of 30. A person whose only passkey
     sign-in fell outside the covered hours reads "Needs proof · No sign-in with it seen"
     with the action "Sign in with passkey", which is a finding made from missing data.
     The footer's dated window is the only hint.
   - Fix: a person whose last successful sign-in (directory `signInActivity`) predates
     the covered window reads Unknown (sign-ins not covered). The page states the
     coverage shortfall once, at page level.
5. **Retained proof and seen platforms never expire.** *Inferred.* No fixture has
   retained rows.
   - `mfaHistory.ts:10` says "Nothing expires". `phishingResistant.ts:337-343` merges
     retained proof and platforms into the current reading.
   - Two outcomes follow. A person proven once stays Ready indefinitely, against the
     90-day proof rule settled for emergency accounts. A platform used once, long ago,
     keeps them in Needs proof with "Test Android" forever, and the only action that
     clears it is using a platform they may have abandoned. That is a failing check with
     no reasonable visible action.
   - Fix: age proof and platforms out (Owner decision 3).
6. **A registered method is counted whatever the Authentication methods policy says.**
   *Inferred.*
   - `personReadiness`'s `inventory` (`phishingResistant.ts:253-279`) takes every
     registered qualifying class at face value.
   - A passkey whose model the tenant's allow list now excludes, or a FIDO2 method policy
     that no longer targets the person, still reads qualifying. It can even read Ready
     from retained proof.
   - `methodAvailability` already answers usability. The page judges the stored
     registration rather than whether the method can be used.
7. **Activity comes from directory `signInActivity`, which lags the records.** *Observed
   in the live snapshot; the page effect is inferred.*
   - An account created on the day of the scan had 9 successful sign-ins in the records
     but `lastSuccessfulSignInDateTime` null. `mfaViability.ts:179-186` classes it
     `neverSignedIn`.
   - It was an emergency account, so nothing visible changed. A new starter would read
     "Not active", out of the denominator and out of the worklist, despite having signed
     in that day.
   - Fix: the later of `signInActivity` and the records.
8. **Guests are told to "Set up passkey".** *Observed on fixtures:* large has 165 guest
   rows with that action; mid has 10; demo has 1.
   - B2B guests normally satisfy MFA in their home tenant, through inbound cross-tenant
     trust, or with a method registered in the resource tenant. For them a passkey in the
     resource tenant is not the visible action.
   - This is the open guest-gate question from Step 7 (Owner decision 4).
9. **Hard-coded words outside `content.json`.** *Observed.* Found in `MfaReadiness.tsx`
   at lines 185, 190, 250, 256-259, 293, 307-308, 315 and 358, and in `MfaHandoff.tsx:69`
   ("Has", "Needs"). They break the words rule and are the reason the scoped view speaks a
   different vocabulary (Cut 5).
10. **The Plan step points at lists the page does not show.** *Observed live.*
    - `content.json:86` (`pointer`): "Person-by-person setup steps are on MFA Readiness;
      work its Needs setup and Needs proof lists there."
    - The page holds no setup steps. Opened from that step, it replaces Needs setup and
      Needs proof with Method Ready and Check Compatibility.
11. **Minor (observed live):** on first load the strip rendered without its "Open the
    preparation step →" link until the plan finished computing (`gateStepId` null,
    `MfaReadiness.tsx:111`). A page that depends on the plan should say it is waiting
    for it, not render a partial answer.

Fixture fidelity, not a product defect: the fixtures' Authentication methods policy has
no `Voice` configuration, so every SMS-only person's compatibility is unknown
(`methodAvailability.ts` CONFIG_IDS `mobilephone → sms, voice`). That explains the 32
unknown people on mid and makes every fixture MFA gate unmeasured. The live tenant
returns `Voice`, so the effect is fixture-only, but it hides whether the gates measure
correctly at scale. *Observed.*

## 5. Cannot prove

What IAMAI cannot establish with its current read-only permissions and data windows,
and how the page should say so.

| Cannot establish | Why | How the page says it |
| --- | --- | --- |
| That a registered method works, if it was never seen in a sign-in | Registration is a claim; v1.0 has no last-used date | "Registered, not seen signing in since <window start>". This is a confidence note, and a blocker only if the owner keeps proof as the gate (decision 2) |
| Anything older than the records IAMAI holds | Entra keeps 30 days (P1/P2); IAMAI history starts with its first scan | Date every proof; say "before <date> IAMAI has no records" |
| The full 30 days on a large tenant | 50,000-row and 10-minute ceilings (`constants.ts`) | One page-level line: "Sign-ins read for <from> → <to> of 30 days". People not covered read Unknown (Fix 4) |
| Which physical credential or device was used | Logs expose OS family; the credential id is not reliable (handoff, exact-key limit) | Proof is "<method> on <OS family>", never a device or key |
| Non-interactive or token-only use | Only `interactiveUser` sign-ins are read (`laneB.ts:24`) | Say platforms are "seen at interactive sign-in" |
| Platforms a person has not used yet | Future use cannot be observed | Say nothing. Do not predict lockout on unseen platforms |
| A guest's home-tenant MFA | The home tenant's methods are not readable | Guests read "MFA from home tenant, not visible to IAMAI" unless cross-tenant trust is read |
| Whether a compatibility reading is complete when group membership, profile or model reads are partial | Membership is read on demand and may be sampled | Unknown, naming the read that is missing and the scan that will fetch it (IAMAI's to diagnose) |

## 6. Rebuild outline

The anatomy follows `archive/design/mfa-readiness-v2.html` (then the approved pack): summary,
Current Plan dependency callout, toolbar, six-zone table, footer. The pack itself
separates "blocking the current Plan" from "on a weaker method but not blocking". The
rebuild restores that split.

1. **Which requirement.** Question: *"What am I checking readiness for?"* Default: the
   first MFA-family step in plan order that is not done (`firstMfaDependency`, reborn).
   A step link sets it. The selector lists the MFA, admin and guest steps. The line
   names the step, its grant (strength name or MFA) and its population. Evidence: the
   Plan's step, its target policy effects and `reached`.
2. **The answer.** Question: *"Can I enforce it today?"* One sentence: **Yes**, **No —
   N people would be blocked**, or **Not yet known — N people IAMAI could not read**,
   with the Plan's gate threshold beside it. Evidence: one per-person state against the
   step's requirement: a usable registered method that satisfies it, with an observed
   successful sign-in under it counting as proof of usability. It is the same state the
   Plan's gate reads (Fix 1, Fix 2).
3. **Next check.** Question: *"What is the one thing to do next?"* The largest blocking
   group, by next action, with one action. Examples: "14 people have no method allowed
   by Phishing-resistant MFA: each registers a passkey at My Sign-ins; for anyone with
   no method, issue a Temporary Access Pass", or "3 people: the Authentication methods
   policy excludes their passkey model: add the model in Passkey (FIDO2) settings". Then
   **Other shortfalls · N**, collapsed, one line per action with its count. Evidence:
   the same state's next action.
4. **People.** Question: *"Who exactly?"* The worklist, scoped to blockers, grouped by
   next action, paged, with search, the Admins filter and CSV. Row: person, methods
   usable for this requirement, state, one action. The detail holds Why and Next and the
   proof lines (method × OS family, dated) as confidence. Evidence: the per-person state
   plus `personReadiness`'s proof, which stops gating.
5. **Unknown.** Question: *"What can IAMAI not see, and how is that fixed?"* One line
   per unknown reason: sign-ins not covered, method inventory unread, membership unread,
   guest home tenant. Each gives its count and IAMAI's fix: scan again, a named read or
   consent. It is never folded into blocked or ready.
6. **Recommendations (collapsed).** Question: *"What would make this stronger than
   required?"* Phishing-resistant beyond the requirement, passkey adoption, platforms
   without proof. Each is labelled Recommended, not required, and none changes §2.
   Evidence: `personReadiness`, used as it is today.
7. **Satisfied · N** (collapsed): the people who meet the requirement.
8. **Ledger footer:** the denominator, uncounted populations as counts, the sign-in
   window and coverage status, a link to Inventory.

## 7. Owner decisions needed

1. **What does the page measure against?**
   - Options: each step's own grant (built-in MFA for all users; phishing-resistant plus
     TAP for admins, per the baseline), or phishing-resistant for everyone, as the page
     does today.
   - *Recommendation:* the step's own grant, with phishing-resistant as a collapsed
     recommendation. The baseline never requires it for non-admins, and the handoff says
     recommendations stay suggestions.
   - On GetIAMAI the two coincide, because the tenant already enforces phishing-resistant
     MFA for all internal users. That is why the live page looks right while the fixtures
     do not.
2. **What counts as ready for a gate: a usable registered method, or observed proof on
   every platform seen?**
   - The Plan now gates on the former, and the page on the latter. Step 7's owner
     decision chose proof, and `generate.ts` has since moved to registration.
   - *Recommendation:* gate on a usable registered method that satisfies the grant, where
     an observed success under the grant also settles usability. Show proof per platform
     as confidence, and "not seen on <OS>" as a recommendation.
   - Reason: Conditional Access checks the method, not IAMAI's records, and the
   per-platform rule creates unresolvable checks (Fix 5).
3. **How long does retained proof or a seen platform last?**
   - *Recommendation:* 90 days for both, matching emergency-access proof and
     `INACTIVE_DAYS`. After that, proof reads "last seen <date>, older than 90 days" and
     the platform drops out.
4. **Guests.**
   - *Recommendation:* guests leave the person worklist. The guest step's readiness
     becomes a tenant-level question (is inbound MFA trust configured?). That read is not
     collected today, so this needs a decision on whether to add it under existing
     consent.
   - Until then, guests read "home tenant MFA, not visible to IAMAI" (Unknown), not
     "Set up passkey".
5. **Partial sign-in coverage.**
   - *Recommendation:* people whose last sign-in falls outside the covered hours read
     Unknown, and the answer (§2) says "Not yet known" when more than a stated share of
     the population is uncovered.
   - Approve the rule, and whether to raise the 50,000-row ceiling for readiness only.
6. **Passkey promotion.**
   - *Recommendation:* drop the passkey rollout strip and keep "No passkey" as a filter
     inside Recommendations.
   - If you want an adoption metric on this page, it needs a named place that is not the
     answer.
7. **Plan copy that points here.**
   - *Recommendation:* in the same batch as the rebuild, reword `pointer`
     (`content.json:86`) and `adminsNote` (`content.json:3440`, all admins) to read the
     rebuilt page's state.
   - Otherwise the Plan will keep naming Ready admins as blockers (Fix 3).
