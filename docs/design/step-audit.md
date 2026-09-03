# Step audit — fixes to make in content.json (and the small engine hooks they need)

Source: the 43-step audit of 2 Sep 2026 (38 content steps + 5 Cleanup rows), with the
owner's calls applied. Work top to bottom. A fix marked (engine) needs a code change beside
the content edit; make it in the same commit. Verify each batch with `npm run walk`.

Standing principle (owner): the tool helps with strictness and never requires it. A decision
may narrow scope or defer; it never weakens a grant. The baseline's version is always shown
beside the person's choice.

## Cross-cutting (do these first, one commit each)

C1. Remove every `learn.cis` value and the CIS chip rendering. Frameworks return later as a
    feature, not a chip.
C2. Learn links. Replace the three 404s:
    - s-check-dormant-accounts → https://learn.microsoft.com/entra/identity/monitoring-health/howto-manage-inactive-user-accounts
    - admins-phishing-resistant → https://learn.microsoft.com/entra/identity/conditional-access/how-to-policy-phish-resistant-admin-mfa
    - block-legacy-auth → https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-policy-block-legacy
    Replace the wrong-page links: s-prereq-exclusion-group → the emergency-access page
    (security-emergency-access, exclusions section); s-prereq-service-accounts-group →
    https://learn.microsoft.com/entra/architecture/secure-service-accounts; admin-portals-protected →
    https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps#microsoft-admin-portals;
    guests-mfa → https://learn.microsoft.com/entra/identity/conditional-access/policy-old-require-mfa-b2b;
    intune-enrollment-reauth → https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-intune-enrollment (verify; else keep).
    Add a Learn link to every Cleanup row (alerting and drill → the emergency-access page,
    monitoring section; naming and consolidation → plan-conditional-access; notAssessed →
    the baseline's repository). A test fetches every Learn URL and fails on non-200
    (network test, skipped offline).
C3. Remove every hard date and "preview" claim: guests-mfa (October 2026, three places),
    mobile-app-protection (June 30, 2026 → "Microsoft has retired it"), token-protection
    ("only in preview" → drop the browser clause). No date in content that isn't a variable.
C4. Manager lines that assert "nobody here used it" (block-device-code,
    block-auth-transfer, geo-restriction): make the clause conditional on the evidence
    count being zero, otherwise omit the clause. (engine: `applies` on manager lines)
C5. Decision help rewritten for the typeahead, per picker, no "Tick"/"ticked":
    emergency → "Add every account that exists only for this purpose; two are needed. IAMAI nominated these from names, roles and exclusions."
    exclusions group → "The one group every policy excludes. IAMAI recognised this one from the exclusions already in place."
    countries → "Every country with sign-ins since {from}. Remove one nobody should work from; add one people travel to."
    trusted network → "Your offices and VPN exits. Remove anything nobody signs in from that location."
    service accounts → "Only accounts no person signs in with. An interactive sign-in in the records makes it a person, whatever it is called."
    shared devices → "Accounts that belong to a room, a panel or a shared phone."
    strength → "The strength whose combinations match the baseline's."
    admins group → "The group every admin belongs to; it is excluded from this block."
    partner tier → "Partner tenants whose home MFA you trust; they get the stronger tier."
    special care → "Admins, anyone with no method, anyone with text or call only, and your own account. These get the in-person instructions."
C6. Baseline transcriptions (verified against the pinned JSON):
    - sign-in-risk: condition line "Sign-in risk → High" (not High, Medium).
    - user-risk-medium: condition line "User risk → Medium" (not High, Medium).
    - user-risk: add to evidence "Guests rated high risk are blocked, not remediated: they cannot change a password here."
    - require-managed-device: title "Require a Managed Device Outside the Office"; evidence line "The baseline has no platform condition: phones are in scope until the device decision says otherwise."
    - workload-identity-block: Who line says "Cloud Sync's provisioning service principal"; add "Classic Entra Connect syncs with a user account; it is covered by the exclusions in the MFA policies, not by this policy."
C7. Timing guards (engine): s-prereq-security-defaults and s-prereq-per-user-mfa are scheduled
    on the day Require MFA for Everyone enforces, with Block Legacy Authentication and the
    admin MFA policy enforced the same day; their rows carry that date, not `now`.
    s-shared-devices is a policy step in the first phase, not Preparation.
    Verify and record: whether Entra allows creating a report-only policy while security
    defaults are on; if not, security defaults is the first step and MFA for Everyone is
    created On the same hour, and the step text says so.

## Per step

1 s-prereq-break-glass
- `mfa-method` fix: replace "(see step 5 above)" with the instruction itself.
- `recent-sign-in`: "{name} signed in {ago}, not a recorded drill: confirm who signed in and why." (engine: exempt sign-ins matching a recorded drill date)
- `second-account` with zero picked: "Create two accounts: one is a single point of failure." (engine: variant when none picked)
- who.lead keeps names ≤3, count otherwise.

2 s-prereq-exclusion-group
- Order: second in Preparation, directly after emergency access (engine, done).
- Merge `member-count` into `members-only-emergency` (one fix line per fact).
- `not-mail-enabled`: "The group is mail-enabled or licensed; recreate it as a plain security group." 
- `no-admin-members`: "…besides the emergency accounts…" and exempt them (engine).

3 s-check-dormant-accounts
- Title: "Disable or Confirm Dormant Accounts".
- Verify what the scan can read without P1 (signInActivity); if only "none on record", say that.
- Order: after the two foundations (engine, done).

4 s-prereq-allowed-countries
- Drop "add one people will travel to" from the help once the question renders.
- Question effect: answering adds the countries (engine: answers apply).

5 s-prereq-trusted-location
- "a single office is usually /32; use the small block only if your ISP assigned one."
- IPv6: "/128 for one address, or the /64 your ISP delegated; never wider."
- Source of the address: "or take it from the sign-in log's IP column filtered to the office."
- Add risk: "A trusted location also lowers Identity Protection risk scores, so keep the ranges tight."

6 s-prereq-service-accounts-group
- Add ifWrong: "Remove the account from the group; the policies apply again on its next sign-in."
- Add risk (always): "Accounts in this group are outside the legacy, countries and token policies; the baseline's Block Service Accounts policy pins them to the trusted network — see Restrict Service Accounts to the Trusted Network." (engine: add that policy as a step; the baseline has `IAC - GLOBAL – BLOCK – Service Accounts`)

7 s-shared-devices
- Pick one control and describe it: the reference uses compliant device; rewrite the risk and help-desk lines for compliance ("a device whose enrolment lapses is blocked until it checks in"), or switch the reference to trusted-location and keep the current lines. Decide by the baseline's policy.
- Remove Dates while it sits in Preparation (or move it to Phase 1 per C7).

8 s-prereq-security-defaults
- Done-when: "Security defaults are off; Require MFA for Everyone, Block Legacy Authentication and Require Phishing-Resistant MFA for Admins are enforced."
- Add helpDesk: "Prompts on the switch day are the new MFA policy; anyone without a method gets a Temporary Access Pass."
- See C7.

9 s-prereq-per-user-mfa
- Add the "not before" line and a risk: "Disabling per-user MFA before the policy enforces removes MFA for that person."
- Verify "Manage migration" still exists after the 2025 retirement; if not, drop steps 1 and 4.

10 s-prereq-passkey-settings
- "Enforce attestation: Yes, so only the key models on the list can register."
- Authenticator line: "Then Microsoft Authenticator → Enable: On, All users, for push and codes." (passkeys are governed by the FIDO2 policy)
- Add to Who or risks: "Synced passkeys (iCloud Keychain, Google Password Manager) fail attestation and cannot register under these settings."

11 s-prereq-auth-strength
- Description text: "the baseline's phishing-resistant strength with a Temporary Access Pass for first sign-ins."
- Add ifWrong: "Delete the strength; no policy references it yet."

12 s-ladder-operator-passkey
- "Register a hardware security key (survives a lost phone) and a passkey in Microsoft Authenticator (everyday use)."
- Add risk: "A key registered on a shared machine, or left in the laptop, is not a second factor."

13 s-verify-mfa
- Email: date is the day Require MFA for Everyone enforces (`mfaEnforceLong`); "over the next {enrolWindowDays} days" from constants. (engine: variables; delete `firstEnforce`)
- Add to whatToDo.generic: "Turn on Entra's own nudge: Authentication methods → Registration campaign → Enabled, Target: All users, snooze limit 3; it asks people to set up Authenticator at sign-in."
- Done-when: "Every admin has a passkey or a security key registered."
- Add device line per person and to the email once the device decision exists (engine).

14 mfa-all-users
- Evidence line 1: "…a passkey, Authenticator approval, a security key — and a text message or call, which is why the campaign removes phone numbers."
- Replace the Challenge High-Risk clause: "The campaign registers passkeys because the admin and risk policies require one, and a passkey cannot be phished."

15 admins-phishing-resistant
- Evidence: replace "End Browser Sessions When the Browser Closes" with "Limit How Long Sessions Last".
- Drop the "{n} admins are covered" name list when the row already names them.
- Email: "sign-ins by your admin account need a passkey or a security key".

16 admin-portals-protected
- Add risk (always): "Anyone with an Azure RBAC role but no directory role — most developers — is blocked from the Azure portal and CLI; add them to the admins group or scope the Azure API out." Evidence line lists Azure sign-ins by non-admins. (engine: evidence)
- Verify "Microsoft Purview" is a selectable resource; drop it if not.
- Add comms for the Azure users above.

17 guests-mfa
- Hard dates out (C3).
- Policy A and B names distinct (engine: naming).
- who.lead pluralises: "{guests} guest and external users" → "{n} guests and external users" with singular form.

18 register-info-protected
- helpDesk 1: "…over a screen-share, if your VPN exit is in the trusted network, or when they are next in."
- Add risk: "New starters register in the office, or with you over a screen-share."

19 block-legacy-auth
- Why: "Legacy protocols skip MFA; this also moves everyone off the built-in phone mail apps (ActiveSync), even with modern sign-in."
- Risk 2: replace the IMAP line with "The built-in Mail app on iPhone or Android stops syncing until Outlook is installed."
- Mail-sending devices: the option collects accounts through the picker (engine, done).

20 block-device-code
- helpDesk: add "An admin using az login on a box with no browser: sign in from a browser on your own device; device code is off."
- Mark as Safe-today when the evidence count is zero (engine).

21 block-auth-transfer
- Why: "…which is exactly what an attacker who gets someone to scan a code wants."

22 geo-restriction
- helpDesk 2: "VPN exit abroad: add the exit's country to the allowed list for the people who use it, or move the exit." (the policy does not exclude trusted locations)
- "log the trip": name where — "in the plan file's notes, or your ticket system" — and add the date-bounded country to the location.

23 admin-session
- Email: "…admin sessions expire after {wantedLong} and never persist. If your admin account is also your everyday account, that applies to everything you do with it."
- helpDesk: "Prompts every few minutes: the browser is not signed in to a registered device; sign in to the device account."
- Remove the admin-readiness gate (engine).

24 unmanaged-browser
- Dormant on this baseline. Add one plain-language line per policy for baselines that carry them: "Policy A: Windows browsers on unmanaged devices. Policy B: other platforms outside the office."

25 require-managed-device
- Title and evidence per C6; platforms follow the device decision (engine).
- Email: "Personal devices can still use the browser with the limits from Limit Unmanaged Devices in the Browser" only when that step is in the plan; otherwise "Personal devices are blocked".

26 block-unsupported-platforms
- Why: "Linux, and any platform Entra cannot identify, is blocked; that is where the device rules leak."
- Remove the device-readiness gate; Safe-today when the evidence count is zero (engine).
- Move the certificate-prompt risk to the plan level (once) and reference it here.

27 mobile-app-protection
- C3 date out. Add "App protection needs Intune Plan 1 (in Business Premium, E3, E5)." (engine: Not-licensed ladder learns Intune Plan 1)
- Email: "mail, files, Teams and any other app that uses your work account".
- Follows the device decision (engine).

28 azure-management-mfa
- Add evidence: "Microsoft enforces MFA for Azure sign-ins itself; this policy adds the exclusions-group discipline and covers the tools that rollout has not reached."
- Add evidence: "Require MFA for Everyone already prompts here; this policy keeps Azure covered if that one is ever scoped down."
- Add comms for the Azure users listed.

29 device-registration-mfa
- First whatToDo line: "Entra admin center → Entra ID → Devices → Device settings → Require Multifactor Authentication to register or join devices: No (this policy replaces it)."
- Add: "Do not add device-state conditions to this policy; a first join has no device to check."

30 token-protection
- C3 preview clause out.
- Risk: "…and meeting-room devices (already outside this policy if Give Shared Devices Their Own Policy is done)."
- Email: add "If Outlook keeps asking you to sign in, this is why."

31 workload-identity-block
- C6 wording.

32 session-lifetime
- Evidence and email agree per audience: unmanaged browser users "every 9 hours"; everyone else "about once a working day".
- helpDesk 2 as in 23.
- Add: "When several session policies apply, the shortest wins."

33 pim-activation-reauth
- Email: "…asks for your passkey or security key each time".
- Who: "{n} of them have no passkey or key yet: {list}" (engine: from the campaign's data). Dormant eligible accounts go to step 3's list.
- Add: "PIM for Groups and Azure resource roles can use the same authentication context."

34 intune-enrollment-reauth
- Manager: "People see two prompts when they set up a device: one to join, one to enrol."

35 sign-in-risk
- C6 condition. Add risk (always): "A person with only Authenticator approval is not prompted but stopped, until they get a Temporary Access Pass; the campaign's lists say who." Show the count in Who (engine).
- Done-when: "Every risky sign-in in the report-only days was reviewed."
- Offer the plain-MFA rung first when the lockout list isn't empty (engine, strictness principle).

36 user-risk
- Add first whatToDo line: "Hybrid tenants: enable password writeback in Entra Connect, or the change fails."
- C6 guests line. Done-when as 35.

37 sign-in-risk-medium
- Add: "The second rung after Challenge High-Risk Sign-ins: medium risk gets plain MFA, high risk the phishing-resistant strength."

38 user-risk-medium
- C6 condition. Add: "Supersedes Remediate High-Risk Users once enforced; set that one to Off in Consolidate Overlapping Policies."
- Repeat the SSPR and writeback lines.

Cleanup rows
- alerting: Learn link; "Log Analytics ingestion is billed; a small tenant's sign-in logs cost a few dollars a month"; "Defender XDR or your SIEM can take the same rule."
- drill: (engine) Done control records the date in `checkpoints`; the row shows "done {date}"; step 1's recent-sign-in check exempts it.
- naming: "Rename {list:renames}" renders from → to. (engine: renames carry the proposed name)
- consolidation: (engine) the row exists whenever any step's existingCoverage line rendered.
- notAssessed: Why names the conditions ("device filters, authentication contexts, workload identities, agent policies"); (engine) per-policy "does not apply" note with a reason, stored in the plan file.
