# Persona round 4 — grievance register

Five personas, harder tenants than round 3. Mean rating **5.4/10** (round 3: 7.0).
Every row is verified by me before it is worked, and withdrawn with the reason where it
does not reproduce. Round 3 had four findings dissolve under checking and two that were
the harness — the withdrawals matter as much as the fixes.

| # | Sev | Who | Finding | Status |
|---|---|---|---|---|
| R4-01 ✅ | 5 | Jordan D1 | "Configure Emergency Exclusions" tells you to remove both break-glass accounts | **Fixed and pushed.** A member is "extra" only by comparison with the saved emergency selection; with none saved, the comparison named every member. The list is no longer computed until there is something to compute it against, and the task says to remove nobody before then. |
| R4-02 ✅ | 5 | Marcus D1 | "Turn the policy on" fuses the abort branch and the do-it branch | **Fixed and pushed.** Mine, spliced last night UNDER "all of these are true now". Nadia hit it independently. It now stands above the heading as a Stop. |
| R4-03 ✅ | 5 | Marcus D2 | Acting against the prerequisite is recorded as compliance, and the warning disappears | **Fixed and pushed.** Reproduced exactly: ten policies enforced, `cleanup-drill` `done=null`, every "Prerequisite · To do" tile gone. `deriveUncached` returns `result('Completed')` before computing blockers — Completed answers "what is left to do", which is empty by definition — so the unmet prerequisite was erased by the act of going ahead of it. `LaneResult` now carries `unmetPrerequisites`: the hard prerequisites of the action a completed step already took that the scan still finds unmet. The tile is back on the Completed step, reading "The plan asks for Verify Emergency Access before this one. This step is finished and Verify Emergency Access is not, so that order was not followed." Separately, "moved to enforced, as the plan asked" now reads "the state this step targets" — it only ever meant the policy reached its target and was being read as the plan endorsing the sequence. |
| R4-03b | 4 | Marcus D2 (second half) | The "Verify after the change" instruction disappears at the moment it applies | **Split out, not fixed.** Different root cause. The line lives inside the enforce instruction prose (`docs/implementation-content/<id>/CONTENT.md`, the `portal.enforce` block), which is gated on the states before enforcement, so it stops rendering once the policy is On. Done-when then collapses to `doneSatisfied` alone, because `doneWhenOf` replaces a satisfied policy's criteria with the scan's sentence plus `doneEnd` — and only 21 entries author a `doneEnd`. Fix is in the content library, across packages, not in the engine. |
| R4-04 ✅ | 5 | Priya D1 | IAMAI claims a policy predates its own first scan, and its own record says otherwise | **Fixed and pushed** (b70d82c1). Reproduced: the record showed the policy ABSENT on three consecutive scans, then arriving on the fourth eight days after the first scan, under a line saying it was written "before IAMAI's first scan". The date is unknowable — `watchedArrive` compares against the immediately prior scan only, and `neverObserved` is set both for a policy the first scan found enforced and for one deployed straight to enforced under the watch, so neither can date it. The sentence now claims only authorship, which is what the tag proves; the observation note still says separately where a rollout went unwatched. |
| R4-05 ✅ | 5 | Priya D2 | The "withheld" enforce instruction is shipped in full in the PowerShell channel | **Fixed.** Reproduced. A deployable script is one function with a mode switch and was shipped whole however few modes were offered: on the held step the Portal channel withheld the enforce instruction, the JSON channel withheld it, and PowerShell shipped the Enforce branch with the target policy and its id pre-filled on the invocation line, one word’s edit from the Observe mode it did offer — and its guards check policy shape only, so on a tenant where readiness cannot be measured it would have run straight through them. `scriptForRuns` now ships the modes the projection actually calls: the ValidateSet declares only those, and every other mode’s branch or switch arm is removed. A dispatch in a shape it cannot cut withholds the whole channel rather than shipping a script half stripped. Precondition guards that only name a mode (`-ne`, `-in`) are left: they stop firing once the ValidateSet rejects it. |
| R4-06 ✅ | 5 | Priya D3 | The readiness gate is advisory, and its disappearance is silent | **Fixed.** Reproduced with `r4-priya-11-enforced.ts`: the admin policy and the admin-portals policy went on in the portal with readiness unmeasured (registration source 403), both read Completed / Enforced with Done-when satisfied, and the one trace was a clause inside the green coverage tile. `generate.ts` computed the threshold only inside `if (!state.satisfied)`. The threshold reading is now computed for every step; a satisfied step that is under it carries `Action.enforcedBelowReadiness` (holds nothing, cleared if a later pass withdraws satisfaction), and the finished step draws one warn tile: "Not measured — the plan holds enforcement until admin readiness reaches 100%, and IAMAI cannot measure it, so nothing has shown that threshold met", with the unread count and the source that would open it. Where the reading is a count under the threshold, the existing finished-reading tile now names the threshold and today's value. The coverage tile no longer repeats the unread count. It claims nothing about when the policy went on. |
| R4-07 ✅ | 4 | Sam D1 | Admin readiness decays to zero with the calendar. Nothing in the tenant changes | **Confirmed, fixed — severity 4 not 5.** Truth is a constant 14 admins with a phishing-resistant method; the reading falls 5→4→0 of 60 as the clock moves because `provenClasses` expires proofs at 30 days. Not a dead end (the route is named and signing in clears it), but "0 of 60 have a registered method the policies allow" is a registration claim from a proof reading. The line now names the stale count and what makes them count again. |
| R4-08 | 5 | Sam D2 | The plan walks you into the state its own cutover paragraph forbids, then cannot get you out | |
| R4-09 | 4 | Jordan D13 | The passkey Save action is offered ahead of the product's own unresolved warning | |
| R4-10 | 4 | Jordan D2 | The step's own JSON and portal instructions produce a policy IAMAI then rejects | |
| R4-11 | 4 | Jordan D5 | A step whose only remedy is an action that does nothing, on the admin MFA policy | |
| R4-12 | 4 | Jordan D7 | "Completed" on a policy that went live unwatched with 17 people unaccounted for | |
| R4-13 | 4 | Marcus D3 | Approving "the suggestion" silently overwrote saved answers the same screen had just shown me | |
| R4-14 | 4 | Marcus D4 | The same gate has two numbers, and the band label contradicts its own arithmetic | |
| R4-15 | 4 | Marcus D5 | The gate calls a known, fixable problem "not established" | |
| R4-16 | 4 | Marcus D6 | Doing exactly what the board asked moved 13 rows from "Ready" to "On Hold" | |
| R4-17 | 4 | Marcus D8 | A completed step still tells me to do something "before applying restrictions" I already applied | |
| R4-18 | 4 | Marcus D9 | `s-goal-pim-activation-reauth` cannot be completed as written: the settings table holds a description where a value belongs | |
| R4-19 | 4 | Priya D4 | "IAMAI is finished with it" on a policy it holds zero evidence about | |
| R4-20 | 4 | Priya D5 | The step that fixes the blindness promises progress it cannot deliver, and never mentions the 403 | |
| R4-21 | 4 | Sam D3 | The cutover is scheduled three days out; two of its four prerequisites have no date at all | |
| R4-22 | 4 | Sam D4 | The board and the opened step give the same step two different states | |
| R4-23 | 4 | Sam D5 | The guest MFA gate prints the tenant-wide percentage under a guest label, and the guests-only policy claims to cover the whole tenant | |
| R4-24 | 3 | Jordan D14 | The path to every held policy is a three-step chain across three tabs, ending somewhere I never found | |
| R4-25 | 3 | Jordan D3 | "no longer the policy IAMAI was watching", about a policy created in that same scan | |
| R4-26 | 3 | Jordan D4 | Four tiles, one scan, three different values for "MFA readiness" | |
| R4-27 | 3 | Jordan D6 | "Ready · Create" on a step whose own page says Blocked, Not deployed, and do not create | |
| R4-28 | 3 | Jordan D8 | "The policy is enforced and IAMAI is finished with it", above a Done-when that needs a 7-day window | |
| R4-29 | 3 | Marcus D10 | "Enforced and IAMAI is finished with it" beside Done-when criteria that are not met | |
| R4-30 | 3 | Marcus D11 | Enforcing changed the reach by four people with no explanation | |
| R4-31 | 3 | Marcus D12 | A hard prerequisite appeared only after I had already built the policy | |
| R4-32 | 3 | Marcus D14 | The AI Info channel flattens task variants into one unlabelled procedure | |
| R4-33 | 3 | Marcus D15 | The step that clears the gate is filed under On Hold, two hops down | |
| R4-34 | 3 | Marcus D7 | The milestone date recedes as you make progress, and is never labelled | |
| R4-35 | 3 | Priya D10 | The emergency-access tile loses track of which account it is talking about | |
| R4-36 | 3 | Priya D6 | The AI briefing states a different, incomplete set of enforcement preconditions | |
| R4-37 | 3 | Priya D7 | "needs Entra ID P2" on a tenant that holds Entra ID P2 | |
| R4-38 | 3 | Priya D8 | A step reads "Completed / No change needed" while printing a Done-when naming a policy that does not exist | |
| R4-39 | 3 | Priya D9 | An instruction introduces a list with a colon and then lists nothing | |
| R4-40 | 3 | Sam D6 | Sixteen policy steps have one name on the board and a different name on the step page | |
| R4-41 | 3 | Sam D7 | "have a registered method the policies allow" is not what the number measures. The 90% gate is unreachable and the screen never says why | |
| R4-42 | 3 | Sam D8 | Identical numerator and denominator, two contradictory sentences, on adjacent steps | |
| R4-43 | 2 | Jordan D10 | A row in the Ready tab whose work lives on a different step, with no pointer | |
| R4-44 | 2 | Jordan D11 | "No selected account needs a change" when no account is selected | |
| R4-45 | 2 | Jordan D12 | A completed step still renders nine live instruction bullets plus three full variants | |
| R4-46 | 2 | Jordan D9 | The guests step points at two things that are not on the page | |
| R4-47 | 2 | Marcus D13 | The board and the step page use different names for the same row | |
| R4-48 | 2 | Priya D11 | A total source refusal is described as partial coverage | |
| R4-49 | 2 | Priya D12 | The same refusal is disclosed tenant-specifically on one step and reduced to a generic maybe on another | |
| R4-50 | 2 | Priya D13 | "34 active people" and "no sign-in records could be read" sit on the same step, unreconciled | |
| R4-51 | 2 | Priya D15 | A procedure headed by a sentence saying nobody needs it | |
| R4-52 | 2 | Sam D10 | "Prepare Your Team for MFA" carries the population line of a different population | |
| R4-53 | 2 | Sam D11 | A decision note on steps that have no decision, including the cutover | |
| R4-54 | 2 | Sam D12 | The per-user MFA step uses a different tenant size from every other step | |
| R4-55 | 2 | Sam D13 | A firm enforcement date on a step whose own checklist says do not enforce, and a notice claim that does not match the calendar | |
| R4-56 | 2 | Sam D14 | Emergency access sits on the Completed tab while its own text says the tenant is less resilient than recommended | |
| R4-57 | 2 | Sam D9 | The affected-people line counts break-glass into the people figure and out of the admin figure, and leads with a population smaller than the one the policy covers | |
| R4-58 | 1 | Priya D14 | Two different tiles share one heading | |
