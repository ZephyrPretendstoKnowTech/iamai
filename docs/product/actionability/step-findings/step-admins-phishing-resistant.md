# Step findings: Require Phishing-Resistant MFA for Admins

**Step ID:** `s-goal-admins-phishing-resistant`
**Archetype:** CA policy (enforced, with drift, threshold-gated)
**Current state on Lachlan's tenant:** Ready · Observing, Enforced (0% admin readiness, IAMAI reports missing exclusions group and passkey prerequisite)
**Package path:** `docs/implementation-content/s-goal-admins-phishing-resistant/`

---

## Step-specific fixes

### S-PR-1: Same exclusion-group data accuracy issue as Legacy Auth

**Current:** Prerequisite tile shows "PREREQUISITE · READY — Create or Correct Exclusions Group" and "PREREQUISITE · READY — Create or Correct Emergency Access Accounts" and "PREREQUISITE · READY — Set Up Passkeys to Match the Baseline" and "PREREQUISITE · UP NEXT — Create and Enforce the MFA Registration Campaign". The step has four prerequisite tiles, three of which are direct and one (Campaign) may be transitive.

**Target:** Same investigation as S-LA-1 (U27). If the tenant's policy already excludes "Breakglass Exclusion", the exclusion-group prerequisite is satisfied and the tile should show green or be suppressed. The Emergency Access tile is transitive (suppressed by U7 when the Exclusions Group tile is present). The Passkeys tile is a legitimate direct prerequisite (the policy requires the authentication strength which requires passkey settings). The Campaign tile should be verified: is it a direct dependency of this step or transitive through the threshold?

**Implementation notes for Claude Code:** After the U27 investigation resolves the exclusion-group mismatch globally, re-evaluate which prerequisite tiles are legitimate on this step. Expected result: Passkeys (direct, keep), Campaign (verify — if transitive through threshold, suppress per U7 pattern), Exclusions Group (satisfied if tenant matches), Emergency Access (suppress as transitive).

---

### S-PR-2: Threshold tile shows 0% but policy is enforced

**Current:** THRESHOLD tile: "0% / admin readiness is 0% today; enforcement waits for 100%." The policy is enforced on the tenant.

**Target:** Per U22 (state-aware threshold text), on an enforced policy the threshold tile is informational, not a gate. The text should read: "0% of admins have a qualifying phishing-resistant method" — stating the fact without the "enforcement waits for" language, since the policy is already enforced.

Additionally, 0% admin readiness on a tenant with 2 admins where the policy is enforced is a real concern: it means the admins are signing in without meeting the phishing-resistant requirement, which means either the policy grants fall through to a weaker method, or the admins are excluded from the policy's scope. This is worth surfacing as a readiness concern, not just a number.

**Implementation notes for Claude Code:** The threshold tile's text template needs a state check. In the tile's rendering logic (likely in `stepContract.ts` → `engineTiles` or the readiness evaluation), check `state.lifecycle === 'enforced'`. If enforced, use the informational template: `"${percentage}% of admins have a qualifying method"`. If not enforced, use the gate template: `"admin readiness is ${percentage}% today; enforcement waits for ${threshold}%"`.

---

### S-PR-3: "Nothing to submit yet" — no Implementation channels

**Current:** "Implementation / Nothing to submit yet / IAMAI offers no artifact for this policy as it stands." Zero channels. The policy is enforced and live.

**Target:** Per U14, Implementation channels are always visible. For an enforced policy with drift, the channels should show:
- **Entra:** "Open this policy by its stable tenant ID [id]. Verify: Users → Exclude → Groups includes the exclusions group. Verify: Grant controls require the baseline's authentication strength. If the policy is On, move to Report-only before making access-affecting changes, apply the corrections, verify, then move back to On."
- **JSON:** The target policy body as a PATCH request (if the package has it authored and it can be safely projected).
- **AI Info:** Context about what the correction does, what the authentication strength requires, and why the exclusion matters.

For an enforced policy that matches the baseline (after S-PR-1 resolves and if the policy is actually correct): the channels show what was done and how to verify, as reference material.

**Implementation notes for Claude Code:** This is U14 + U19. The projector (`stepPackage.ts` → `packageStateOf`) must stop returning `nothingToSubmit` for enforced policies. The package's channel content exists in CONTENT.md; the projector is withholding it because the prerequisites aren't Complete. After U19 (correction safety before prerequisite holds), the Entra and AI Info channels should render. The JSON channel renders if the package has a complete authored JSON body.

---

### S-PR-4: Done-when already satisfied

**Current:** "The policy is enforced in GetIAMAI." The policy IS enforced.

**Target:** "The policy is enforced with the baseline's authentication strength, the exclusions group, and every admin holds a qualifying phishing-resistant method." This adds the correction targets and the readiness threshold to the done-when, so it's not trivially satisfied by the current state.

---

### S-PR-5: "Continue observation" bar misleading on enforced policy with drift

**Current:** Bar says "Continue observation". The readiness bar between the tiles and the content reads "Continue observation / Why IAMAI says this →".

**Target:** Per archetype rule A4, distinguish Observing-with-drift from Observing-clean:
- If the policy is in Report-only and accumulating evidence: bar reads "Continue observation" (healthy).
- If the policy is Enforced but has drift: bar reads "Needs correction" (the policy works but doesn't match the baseline target).
- If the policy is Enforced and matches: bar reads "In place" and the step is Completed.

On this tenant: the policy is Enforced with drift → bar reads "Needs correction".

**Implementation notes for Claude Code:** The bar text is produced by `stepContract.ts` → `readinessOf` (or the bar component). It currently reads the lane substatus (Observing → "Continue observation"). After U20/U21, an enforced policy with drift reads Ready · Correct, and the bar text for Correct is "Needs correction". This should flow naturally from the lane change; no separate bar fix needed if U20/U21 are implemented correctly. Test: an enforced policy with drift shows bar "Needs correction", not "Continue observation".

---

### S-PR-6: Add Source checked

**Current:** No source checked visible. A4 was supposed to add `checkedOn` to 13 packages — verify whether this package was one of them.

**Target:** Add `checkedOn` date if absent.

---

### S-PR-7: NEXT MILESTONE repeats lane and prerequisite

**Current:** "Ready · Observing / after: Create or Correct Exclusions Group"

**Target:** After the universal fixes (U3, U20/U21), the milestone shows the date (if scheduled) and a specific action: "Correct the policy exclusions" or nothing. "after:" text is removed.

---

## Universal items that apply to this step

- **U1:** No "What to do" section currently exists on this step. No change needed.
- **U4:** No Planned work banner; shows "Nothing to submit yet" instead. After U14, this is replaced with visible channels.
- **U6:** Four tiles, all expanded, taking significant vertical space. After compact/expand, only labels and one-line statuses show by default.
- **U7:** Suppress transitive prerequisite tiles. Emergency Access is transitive (through Exclusions Group). Campaign may be transitive (through threshold). After suppression, likely just Exclusions Group and Passkeys remain as direct prerequisite tiles.
- **U9:** Row subtitle "after: Create or Correct Exclusions Group" removed.
- **U14:** Implementation channels always visible. Critical for this step — currently shows nothing.
- **U19:** Projector shows correction even though prerequisites aren't all Complete.
- **U20/U21:** Enforced with drift → Ready · Correct. Enforced without drift → Completed.
- **U22:** Threshold tile state-aware text (S-PR-2).
- **U23:** Name conformance check — verify whether the tenant's policy name matches the baseline convention.
- **U25:** Learn link inline at end of Why. Currently Why says "A code or an approval can be tricked out of an admin by a convincing page; a passkey cannot be used on the wrong site." — add Learn link.
- **U26:** Source checked rendered after S-PR-6.
