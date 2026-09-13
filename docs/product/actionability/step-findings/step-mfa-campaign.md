# Step findings: Create and Enforce the MFA Registration Campaign

**Step ID:** `s-verify-mfa`
**Archetype:** Campaign (unique — has a human-process component)
**Current state on Lachlan's tenant:** Up Next · After Set Up Passkeys to Match the Baseline
**Package path:** `docs/implementation-content/s-verify-mfa/`

---

## Step-specific fixes

### S-MC-1: Missing Implementation section (campaign setup)

**Current:** Zero Implementation channels. No Entra, no PowerShell, no AI Info. The only technical guidance is the numbered list under "What to do" which describes the in-person walkthrough, not the campaign creation.

**Target:** At minimum an Entra channel explaining how to create the registration campaign:
1. Go to Entra admin center → Security → Authentication methods → Registration campaign.
2. Enable the campaign.
3. Set the target: all users (or scoped per the admin's choice).
4. Set the method: passkey (Microsoft Authenticator). This is IAMAI's product choice — the baseline is Authenticator-only, but IAMAI targets passkeys.
5. Set the enforcement: remind users on sign-in.

Additionally, per archetype rule A3, the in-person walkthrough ("Book ten minutes with each...") needs a channel. Options: a second Implementation channel called "In person" or "Walkthrough", or a section within the Entra channel clearly separated. The human-process content is:
1. Book ten minutes with each person who needs special care.
2. Open https://aka.ms/mfasetup with them signed in.
3. Person-by-person setup steps are on MFA Readiness — work the Needs setup and Needs proof lists there.
4. No method: issue a Temporary Access Pass first.
5. Text or call only: register the passkey, then remove the phone number as a sign-in method.
6. Admins: passkey or hardware security key.
7. Have each sign in once more; the record shows it on the next scan.

This content currently exists under What to do. After U1 removes What to do, it needs this home.

**Implementation notes for Claude Code:** The package CONTENT.md needs Entra channel content for the campaign setup. The in-person walkthrough content can be authored as a second channel (if the schema supports multiple non-technical channels) or as a clearly separated section within the Entra channel. Check `content-schema.md` for whether the package supports custom channel names. If not, use AI Info for the walkthrough guidance and Entra for the technical setup.

---

### S-MC-2: People picker ("People who need special care") positioning and completion gate

**Current:** The people picker with Admin and Breakglass chips sits under "What to do" with a Save button. The step completes when "every admin is Ready for phishing-resistant MFA" per the Done-when.

**Target:** Two changes:
1. **Positioning:** The people picker moves to the action column (right column under milestone) per U2. Label: "People who need special care." The picker lets the admin identify users who need in-person help with registration (admins, users with no method, users with only text/call).
2. **Completion gate:** The step should stay open until the admin either identifies the special-care users and saves, or explicitly confirms there are no special-care users. Currently, the step can be completed (by scan evidence showing admin readiness) without the admin ever addressing the special-care list. The gate ensures no one falls through the cracks. Per archetype rule A6, explicit user involvement is required.

**Implementation notes for Claude Code:** The people picker's Save writes to the plan record. The step's completion evaluation (`coverage.ts` or the step's readiness check) should include a condition: either the special-care list has been saved (even if empty, as long as the admin explicitly saved), or the step is not completable. This may require a new field in the plan record: `specialCareConfirmed: boolean`. The completion check is: admin readiness threshold met AND `specialCareConfirmed` is true.

---

### S-MC-3: Cross-reference to MFA Readiness should be a link

**Current:** The step says "Person-by-person setup steps are on MFA Readiness; work its Needs setup and Needs proof lists there." This is a text reference, not a clickable link.

**Target:** "Person-by-person setup steps are on [MFA Readiness →](#/readiness); work its Needs setup and Needs proof lists there." with a direct link to the MFA Readiness page. If the link can be filtered to show only the Needs setup / Needs proof lists, do that.

**Implementation notes for Claude Code:** The content is in the package's CONTENT.md. Replace the text reference with a markdown link. The MFA Readiness page is at `#/readiness`. Check whether the page supports URL parameters for filtering (e.g. `#/readiness?filter=needs-setup`); if so, use the filtered link.

---

### S-MC-4: Done-when scope mismatch

**Current:** "Every admin is Ready for phishing-resistant MFA."

**Target:** The campaign targets everyone, not just admins. The admin-readiness gate is the threshold for the phishing-resistant MFA policy specifically. The campaign's own done-when should be broader: "Every active person holds a phishing-resistant method that has been seen to work." (which is already the Why sentence). Or at minimum: "Every admin is Ready for phishing-resistant MFA, and the registration campaign has been reviewed for all other users."

---

### S-MC-5: Add Source checked

**Current:** No `verifiedSources[].checkedOn` in the package META.

**Target:** Add `checkedOn` date. The source is Microsoft's documentation on authentication method registration campaigns and the Authenticator/passkey setup flow.

---

## Universal items that apply to this step

- **U1:** Remove "What to do" section. The content splits: people picker → action column (S-MC-2), numbered walkthrough → Implementation channel (S-MC-1), contextual sentence ("For the people chosen above...") → discarded (the channel content replaces it).
- **U2:** People picker moves to the action column.
- **U4:** No Planned work banner currently on this step (it's Up Next, not Ready). But after the step moves to Ready (when passkeys step is done), the banner rule applies: no banner, disabled copy with tooltip if applicable.
- **U6:** Prerequisite tile compact/expand. Currently shows PREREQUISITE · READY for passkeys with expanded Why text.
- **U9:** Row subtitle removed (if present on the Up Next row; currently the Up Next lane label already shows the prerequisite).
- **U14:** Implementation channels always visible. This step currently has NO channels — S-MC-1 adds them. After U14, they stay visible in every state.
- **U25:** Learn link already inline ("Learn →" at end of Why). No change needed.
- **U26:** Source checked rendered after S-MC-5.
- **U28:** Explicit user confirmation required before completion (S-MC-2 implements this specifically for the special-care people list).
