**Travel handling in Jon Hope's baseline and IAMAI: retire the Direction travel question**

Retiring the question drops nothing the baseline deploys. Jon's documentation describes a travellers group, but his exported policies never tie that group to any policy. The travel answer IAMAI collects changes nothing in the plan.

**(1) Does Jon's baseline carry a travel mechanism? In the documentation yes; in the exported policies no.**
- The naming guide defines a group called `CA-TravelingUsers`: "Temporarily excluded from location-based block policies (e.g., NonTrustedLocations)", with temporary, manually assigned membership. It appears as an example of a group to create, and is not tied to any policy. Sources: [README.md L524](https://github.com/Jhope188/ConditionalAccessPolicies/blob/90d9b890c4b9af2ac4bc02d97c06bf8900064b4c/README.md#L524), L543-551 and L620-627.
- The countries policy "IAC - GLOBAL – BLOCK – Countries not Allowed" excludes three groups (`baselines/jhope188-conditionalaccesspolicies.pinned.json:1173-1177`):
  - `b63c3682`, the exclusions group.
  - `62d67e66`, which is also excluded from 23 policies.
  - `cc7f9bb7`, which is excluded from this policy only.
- The pinned file's placeholders (the author objects IAMAI swaps for tenant objects) on that policy are only `exclusionsGroup` and `allowedCountries` (pinned.json:1196-1199). There is no travellers placeholder anywhere.
- The only named locations are the allowed countries (`1d421232`, pinned.json:1163) and "IAC - Blocked Countries" (`1267ac22`, used by the NoExclusions variant, pinned.json:1220). There is no travel location.
- The policy's own README ([Countries not Allowed/README.md](https://github.com/Jhope188/ConditionalAccessPolicies/blob/90d9b890c4b9af2ac4bc02d97c06bf8900064b4c/Updated/Documentation/IAC%20-%20GLOBAL%20%E2%80%93%20BLOCK%20%E2%80%93%20Countries%20not%20Allowed/README.md)) says "Only the CA-Breakglass group is excluded" (L9), yet lists "All users (3 exclusions)" (L15). It never names the third group.
- IAMAI's settled reading of the baseline keeps `cc7f9bb7` as unknown and needing a person's answer. It deliberately refuses to call it the travellers group (`baselines/jhope188-conditionalaccesspolicies.interpretation.json:160-168`).
- It is also not excluded from the NonTrustedLocations policies, which is where Jon's guide says travellers are excluded. Those policies exclude `9ee031a3`, which is also unknown (interpretation.json:120-127).

**(2) Does the V1 retirement drop or weaken anything? No.**
- The Direction answer is stored only under `questionAnswers['s-direction-locations:travel']` (`src/roadmap/directionAnswers.ts:92`, :111).
- Its only readers are in `src/roadmap/direction.ts`:
  - the question itself (:271-274);
  - the "Answered in" link from the countries location step (:364);
  - the wait on the countries policy (:410). That wait only checks whether an answer is saved (`q.saved === null`, :435-458) and never reads which answer.
- `graphConditions.ts:46` does not read the Direction answer. It reads the old "Recurring Travel Countries" question on `s-prereq-allowed-countries` (`src/roadmap/answers.ts:160`, :129-138; `docs/design/content.json:3682-3694`). The step that condition belongs to, `s-question-travel`, is never generated (`src/roadmap/stepGroups.ts:124`, `answers.ts:194`). It resolves to `unresolved` in every scenario I ran.
- No travellers token exists anywhere in the pipeline:
  - `TEMPLATE_PLACEHOLDERS` (`src/roadmap/template.ts:25-32`);
  - `PLACEHOLDER_STEP` (`src/roadmap/resolvePolicy.ts:37-42`);
  - `MAPPED_TOKENS` (resolvePolicy.ts:453);
  - `portalLines.ts`, which has no travel token.
- The plan neither creates nor asks for a travellers group.
- The countries policy's unknown exclusions (`62d67e66`, `cc7f9bb7`) are left out of the written policy by the "Approved V1 assumption" (`src/roadmap/sourceMappings.ts:15-24`, applied at resolvePolicy.ts:720-721). The person can still map them to a group of their own in Plan settings → Baseline mappings; a mapped answer is checked before the omission (resolvePolicy.ts:569, :576). None of this touches the travel question.
- Probe with every Direction answer approved (`withFoundationSettled`), on getiamai (curated and raw), demo, demo-week2, small, mid, large, messy and midflight:
  - Switching the answer between `allowed` and `never` changed no step, apart from the stored value itself and history timestamps.
  - On demo and demo-week2, which use the real pinned baseline, the countries policy excludes only the tenant's exclusions group, with both unknown groups recorded as "omitted".
  - The other scenarios use a synthetic baseline whose countries policy has one exclusion.
- The only effect of retiring the question is that the countries policy stops waiting on a question whose answer is read by nothing. The policy's content is unchanged, as `docs/plans/roadmap-flow/v1-proposal-full.md:296` (on main, fdc1ffcf) claims.

**(3) Recommendation: retire it as proposed, and do not move the allowed/never choice onto 6.3.**
- On 6.3 the choice would still be read by nothing.
- Its option text, "Allowed, with notice (a temporary travellers group)" (content.json:2991), promises a group IAMAI never creates.
- IAMAI already handles travel in ways that are actually used:
  - the staff email asks people to tell IT before travelling (`src/copy/comms.ts:31`, `src/copy/announcements.ts:123`);
  - the countries step's completion criteria and help-desk guidance cover trips (content.json:5493, :5521);
  - the optional "Recurring Travel Countries" record, which 6.3 inherits.
- Nothing new is needed.

**One thing to confirm with the owner.** IAMAI's help-desk line says: "add the country to the allowed location for the trip's dates; never a user exclusion" (content.json:5521). That differs from Jon's `CA-TravelingUsers` convention, which excludes the person from the whole block. IAMAI's version is stricter, so it does not weaken the baseline. A tenant that wants Jon's approach can already map the countries policy's third exclusion to its own travellers group in Baseline mappings.

**Two stale statements, left unchanged:**
- The comment at `src/roadmap/resolvePolicy.ts:12` says the baseline "excludes two travellers groups", which contradicts interpretation.json:165.
- content.json:5525 says the baseline excludes "the service accounts group" from the countries policy. interpretation.json:100-106 says `62d67e66` cannot be the service-accounts group.

I read the files in `C:\Dev\IAMAI-q-flow`. The probe files I wrote under `C:\Dev\IAMAI-q-flow\docs\qa\night\personas\` have been deleted, and git status is clean.