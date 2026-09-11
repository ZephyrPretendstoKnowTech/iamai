# Use Separate Accounts for Admin Work

## Goal
Move privileged directory work onto dedicated administrator accounts so compromise of an everyday mailbox, Teams session, or browsing workflow does not automatically compromise the tenant's administrative authority.

## Why this exists
Microsoft's privileged-access strategy separates high-exposure productivity activity from high-impact administration. A daily-driver account that also holds directory roles bridges phishing/email/browser risk directly into administrative control.

## Applies when
IAMAI identifies a person whose same account both holds a directory role and is used for ordinary productivity activity such as Exchange Online or Teams.

## Do not show implementation when
Do not create a second account without a real affected person and a resolved naming/identity plan. Do not change role assignments while account ownership, assignment type, or PIM governance is ambiguous.

## Prerequisites
- The affected person is confirmed.
- A dedicated cloud-only admin account can be created under the tenant's naming convention.
- Passkey/security-key settings are ready.
- Current role assignments are classified as direct active vs PIM eligible/active before movement.
- Emergency-access accounts are not processed by this step.

## Owner decisions
This step does not invent a new admin-account naming standard or convert PIM eligibility into permanent active access. Existing role-governance intent is preserved.

## Current-state inputs
Affected person/account IDs, observed mail/Teams workload, current direct role assignments, PIM assignments if present, and the new dedicated admin-account identity after creation.

## Target state
The person has a dedicated cloud-only administrator account with no productivity mailbox/workload, a proven phishing-resistant credential, and the same intended privileged access under the same governance model. The everyday account no longer holds the migrated admin role(s).

## Security-significant fields
Principal IDs, role-definition IDs, directory scope IDs, PIM vs direct assignment type, credential proof, and the order of assignment/cutover/removal.

## Preserve
Preserve least privilege and the existing assignment governance model. Add/test the new admin path before removing the old one.

## Do not do
- Do not share admin accounts between people.
- Do not license the admin account for ordinary mail/Teams just for convenience.
- Do not move a PIM eligible assignment into a permanent direct assignment.
- Do not remove the old role until the new account has the intended role and a proven sign-in method.
- Do not process emergency-access accounts as daily admin accounts.
- Do not treat account creation alone as completion.

## State variants
Action required; Credential proof required; Role cutover required; Verification required; In place; Blocked.

## Verification
Confirm the new admin account can sign in with its phishing-resistant method, has the intended role under the intended governance model, and the old daily-driver account no longer holds that role. Subsequent sign-in evidence should show admin work on the dedicated account and productivity on the standard account.

## Rollback / safe recovery
If the new admin account cannot perform required work, restore/retain the old assignment until the new path is corrected. Do not create a second permanent role path as a shortcut.

## Limitations / unknowns
The PowerShell artifact only stages **direct active** role assignments after explicit stable IDs are supplied; it never removes the old assignment and refuses to model PIM eligibility. Passkey/security-key registration remains interactive.

## Source verification
Microsoft privileged-access and Graph v1.0 role-assignment documentation rechecked September 10, 2026.
