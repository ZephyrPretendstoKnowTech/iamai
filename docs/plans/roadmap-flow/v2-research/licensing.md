**Licence gaps in the plan: what IAMAI does today and what to add for v1.0**

The feature the owner describes mostly exists already. On every P1 tenant the Plan footer has a collapsed group headed **"Not licensed (n)"**, which lists each baseline step the tenant's licences don't cover and the licence it needs. What's wrong is one line: under the list it says "Nothing in the plan waits on these." That reassures the reader. Nothing on screen or in print says that finishing the plan is not the whole baseline. The Completed tile reads "36 / 36".

**Recommendation:** for v1.0, reword the two existing sentences (about 15 minutes, owner approves the words). The tile line, the per-row explanation and the rest go to v1.1.

### How it works today
- **Where licences are read:** from the tenant's licence list (`subscribedSkus`). A licence counts if its status is Enabled or Warning and it has seats (`src/licensing/capabilities.ts:61-87`), matched through `data/service-plans.json`. The worker does this at `src/graph/collect/worker.ts:207`. The licence read is a core section (`src/graph/collect/coreSections.ts:110`), so a failed read builds no plan rather than looking unlicensed.
- **P2, PIM, Workload ID and other tier licences:** the goal becomes `licence-limited` (`src/coverage/coverage.ts:350-356`). No step is built (`src/roadmap/generate.ts:1544`).
- **Intune and Workload ID Premium:** these switch a goal to "doesn't apply" (`src/coverage/applicability.ts:60-81`, `coverage.ts:344`). The footer then lists them as licence rows when the reason ends in "licence" (`src/derive/notLicensed.ts:38-39`). Without Intune, the two device goals share one row (`notLicensed.ts:49-55`).
- **Workload goal on a cloud-only tenant:** its reason is "no directory synchronization account", so it is in neither list. That is correct: the policy is irrelevant there.
- **No goal is dropped silently.** A probe found no step for any licence-limited goal on any scenario.

### What the scenarios show (probe on the real 38-policy baseline, probe deleted afterwards)
| Scenario | Licences | Footer | Rows |
|---|---|---|---|
| small (P1 only) | P1 | Not licensed (6) | 1 shared device row + 5 P2 rows (high/medium sign-in risk, high/medium user risk, PIM role activation) |
| getiamai (curated) | P1 | Not licensed (6) | same as small |
| mid | P1+P2+PIM | Not licensed (2) | the device row and the Directory Sync workload block (Workload ID Premium) |
| demo (P1 + Intune, the Business Premium shape) | P1+Intune | Not licensed (6) | 5 P2 rows + workload |

### What each surface says
- **Plan header:** tiles only (`src/ui/surfaces/Plan.tsx:320-326`). A finished plan reads "Completed n / n" with no licence mention. No percentage is shown anywhere; the score exists (`coverage.ts:264`) but isn't displayed.
- **Plan footer:** the rows use the existing `pages.plan.footer.notLicensed*` keys (`docs/design/content.json:982-985`), rendered at `src/ui/surfaces/PlanFooter.tsx:62-72`. The group is collapsed at the bottom of the page.
- **Finished plan (print):** the cover shows the count only, "6 baseline controls need a licence…; nothing in the plan waits on them." (`content.json:1509`, `src/ui/surfaces/PrintPlan.tsx:263`). The first-page header line is "{steps} steps · {inPlace} in place" (`content.json:779-783`).
- **Connect:** mentions licences only when the tenant has no P1 (`src/ui/surfaces/Connect.tsx:569`). Otherwise it shows "38 baseline policies · N plan steps" (`content.json:686`) and says nothing about the difference.
- **How:** each read lists the licence it needs (`src/ui/surfaces/howView.ts:143`). One Limits line is out of date: it says preparation "remain[s] useful without Entra ID P1" (`content.json:3118`). Since the 2026-09-20 owner decision, a tenant without P1 gets no plan at all (`generate.ts:2997-3006`).
- **Inventory:** a licences table shows seats, or "not licensed" (`src/ui/surfaces/inventoryTables.ts:745-759`).

### Other problems found
1. **The count is short by one where the device row is merged.** small has 7 licence-excluded goals but says "6". With n=1 the print line would read "1 baseline controls need" (`notLicensed.ts:49-55, 70-73`).
2. **Seven of the 38 baseline policies appear nowhere, on every licence tier.** They match a goal's pattern but aren't the policy that goal builds, so `coverage.ts:175-212` does not list them as not assessed either. No step, footer row or review step names them. They are:
   - two P2 policies: RiskyUsers-RegisterSecurityInfo and EAM High-Risk Users
   - two ZTCA block policies
   - two passkey policies
   - BreakGlass-TrustedLocations

   This matters for the owner's "100% of Jon's baseline" worry even on a fully licensed tenant. `baselineFidelity.test.ts:44` claims each of these has a Cleanup row, but it only checks the goal map's grouping. The owner needs to say whether leaving them out is deliberate.
3. **Partial P2 seats aren't flagged in the plan.** mid holds P2 for half its users (`src/roadmap/fixtures/index.ts:214`), but risk policies are planned for everyone. Only Inventory shows the seat count.

### Proposal
**v1.0, about 15 minutes including tests and the pre-push run.** Change two existing keys (values only, no new keys):
- `pages.plan.footer.notLicensedNote` becomes: "The baseline includes these and this tenant's licences do not cover them, so they are not in this plan. A finished plan is the baseline as far as those licences reach, not all of it. Nothing in the plan waits on these."
- `pages.export.printPage1.notLicensed` becomes: "{n} baseline controls need a licence the tenant does not hold and are not in this plan: finishing it puts the baseline in place as far as the tenant's licences reach, not all of it."
- The test literal at `src/derive/notLicensed.test.ts:33` changes to match. Run `npm run verify -- --prepush src/derive/notLicensed.test.ts src/content/content.test.ts`.

**v1.1, about 1.5 hours:**
- **Completed tile line, 25–30 minutes.** Add "Not licensed (n)" under the Completed tile, reusing `footer.notLicensed` through `notLicensedSummary`. The styling already exists (`src/ui/app.css:1644`). The smoke check at `scripts/smoke.mjs:535` must be updated in the same change, or the CI browser job fails on the demo. The desktop/mobile check is included.
- **An explanation on each footer row, 20–25 minutes.** Add the step's existing `why` text and Learn link from content. All 8 goals have both.
- **Count fix, about 10 minutes.** Count goals rather than rows, and handle the plural.
- **How Limits line, about 5 minutes.** Replace it with: "IAMAI plans only the baseline controls the tenant's licences cover; the Plan lists the rest under Not licensed."
- **Connect, optional, about 15 minutes.** Add "· n not licensed" to the plan line.
- **Items 2 and 3 above:** separate owner questions, not estimated.

The full v1.0 + tile-line option comes to about 40 minutes, which is over the 30-minute budget. That is why the tile line is in v1.1.