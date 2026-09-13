# Step Findings — Index

All files in this directory document step-specific findings from the six-archetype review and the comprehensive 26-step audit on Sep 12, 2026.

## Already reviewed with Lachlan (6 steps)
- `step-emergency-access.md` — Create or Correct Emergency Access Accounts
- `step-exclusions-group.md` — Create or Correct Exclusions Group
- `step-device-decision.md` — Decide How Devices Are Managed
- `step-mfa-campaign.md` — Create and Enforce the MFA Registration Campaign
- `step-block-legacy-auth.md` — Block Legacy Authentication
- `step-admins-phishing-resistant.md` — Require Phishing-Resistant MFA for Admins

## Audited via Chrome, documented by Claude (20 steps)

### Foundation / preparation
- `step-passkey-settings.md` — Set Up Passkeys to Match the Baseline
- `step-auth-strength.md` — Create the Baseline's Authentication Strength
- `step-trusted-network.md` — Define the Trusted Network
- `step-allowed-countries.md` — Create or Correct Allowed Countries Location
- `step-separate-accounts.md` — Use Separate Accounts for Admin Work

### Enforced CA policies (all share the same core pattern)
- `step-admin-session.md` — Shorten Admin Sessions
- `step-auth-transfer.md` — Block Authentication Transfer
- `step-device-code.md` — Block Device Code Sign-in
- `step-guests-mfa.md` — Require MFA for Guests
- `step-mfa-everyone.md` — Require MFA for Everyone
- `step-token-protection.md` — Require Token Protection on Windows

### Up Next CA policies
- `step-sign-in-risk-medium.md` — Challenge Medium-Risk Sign-ins
- `step-pim-reauth.md` — Require MFA at Every Role Activation
- `step-sign-in-risk-high.md` — Challenge High-Risk Sign-ins
- `step-intune-enrollment.md` — Require a Fresh Sign-in for Intune Enrollment
- `step-register-info.md` — Protect Sign-in Method Registration

### On Hold CA policies
- `step-admin-portals.md` — Block the Admin Portals for Non-Admins
- `step-session-lifetime.md` — Limit How Long Sessions Last
- `step-unsupported-platforms.md` — Block Unsupported Device Platforms
- `step-device-reg-mfa.md` — Require MFA to Register a Device
- `step-geo-restriction.md` — Block Sign-ins From Countries Not Allowed
- `step-managed-device.md` — Require a Managed Device Outside the Office
- `step-user-risk.md` — Remediate High-Risk Users
- `step-user-risk-medium.md` — Reset Passwords for Medium-Risk Users

### Cleanup / operational
- `step-rename-policies.md` — Rename Policies Off the Naming Convention
- `step-review-baseline.md` — Review Baseline Policies IAMAI Did Not Assess

### Not licensed
- `step-workload-identity.md` — Restrict the Entra Connect Sync Account

## Not on this tenant (demo-only or conditional)
- Disable or Confirm Dormant Accounts — not generated on this tenant
- Create or Correct Service Accounts Group — not generated on this tenant
- Alert on Emergency Account Sign-ins — not generated on this tenant (may be a demo-only cleanup row)
- Set Up an SMTP Relay for Mail-Sending Devices — not generated (no SMTP traffic)
- Exclude the Partner or MSP Accounts — not generated (no partner accounts)
- Add a Travel Notice and Exclusion — not generated (no travel config)
- Give Shared Devices Their Own Policy — not generated (no shared devices)
- Run the Emergency Access Drill — not generated on this scan
- Disable legacy per-user MFA — not generated (no per-user MFA)
- Turn Off Security Defaults — not generated (SD not enabled)

## Questions resolved
1. High-Risk channel gap: content authoring gap — fix by copying Medium-Risk channel content and adjusting the threshold. (Confirmed)
2. Baseline conflict Implementation: stays empty with explicit message "Not enough information to provide implementation guidance." (Confirmed)
3. Workload identity: tenant has no sync connector — step should not generate. (Confirmed)
1. **S-RH-1 / S-UM-4:** Why do High-Risk variants (sign-in risk, user risk) have zero Implementation channels while Medium-Risk counterparts have full channels? Content gap or intentional?
2. **S-AP-2:** Should a baseline-conflict step show Implementation content for one interpretation, or stay empty?
3. **S-WI-1:** Does this tenant use Entra Connect (user account) or Cloud Sync (service principal)?
