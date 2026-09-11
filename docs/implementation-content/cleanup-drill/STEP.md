# Run the Emergency Access Drill

## Goal
Prove that every confirmed emergency access account can still sign in and perform the minimum required administrative access before IAMAI relies on those accounts as the rollback path for Conditional Access changes.

## Why this exists
An emergency account that has not been exercised can fail because of stale credentials, lost hardware, unexpected policy scope, role changes, or access-process mistakes. The failure is only discovered safely by performing a controlled human validation before an actual lockout.

## Applies when
The last recorded successful emergency-access drill is missing, failed, or older than 90 days, or the operator intentionally runs an earlier validation before a lockout-sensitive rollout.

## Do not show implementation when
Do not show the drill as actionable when emergency-account identity itself is unresolved, the prerequisite emergency-account step is blocked, or a successful recorded drill is still current and no new validation was requested.

## Prerequisites
- Use only the owner-confirmed emergency access accounts.
- Account credentials/authentication devices must be available through the approved offline custody process.
- Use a designated secure workstation or Privileged Access Workstation. A private browser session is appropriate, but do not deliberately use an insecure/unmanaged endpoint just to make the test harder.
- Know the minimal non-destructive administrative action that proves the assigned emergency role works, such as opening an Entra administrative blade and reading tenant configuration.
- Know the expected monitoring/alert path if one is configured.

## Owner decisions
No new emergency account is nominated by this step. No credential, role, Conditional Access exclusion, or alert configuration is changed merely to make the drill pass. A failed drill returns to the owning prerequisite/remediation step.

## Current-state inputs
Confirmed emergency accounts; last recorded drill/proof date; credential/hardware availability; current monitoring status and alert destination when configured; any known prior failure reason.

## Target state
Every confirmed emergency account:
1. completes an interactive sign-in from the approved secure workstation;
2. reaches the expected administrative surface with the intended role;
3. performs a minimal non-destructive administrative read/check;
4. signs out cleanly;
5. has sign-in/audit evidence reviewed;
6. triggers the configured emergency-account alert when such an alert path exists; and
7. has the successful drill date/result recorded in IAMAI.

The proof remains current for no more than 90 days.

## Security-significant fields
Emergency-account identity, credential/authentication availability, permanent privileged role, Conditional Access exclusion behavior, secure workstation, sign-in/audit evidence, monitoring/alert result, and proof date are security-significant.

## Preserve
Preserve emergency-account credentials, authentication devices, role assignments, Conditional Access exclusions, and monitoring configuration during a passing drill. The drill is validation, not configuration maintenance.

## Do not do
- Do not automate the sign-in.
- Do not paste emergency credentials into scripts, AI prompts, tickets, or this package.
- Do not mark a normal/unrelated emergency-account sign-in as a completed drill without the recorded validation procedure.
- Do not weaken Conditional Access or add exclusions just to make the drill pass.
- Do not use an intentionally untrusted device when Microsoft recommends a designated secure workstation/PAW.
- Do not treat missing alerting as if an alert fired.

## State variants
- **Due:** run the controlled human drill and record the result.
- **Failed:** stop relying on the escape hatch; remediate the exact failed account/path and repeat the drill.
- **Current:** successful recorded drill within 90 days; no implementation viewer.
- **Blocked:** unresolved emergency-account prerequisite; no drill instructions.

## Verification
For each emergency account, verify the interactive sign-in event, expected administrative access, minimal non-destructive admin action, sign-out, and sign-in/audit-log evidence. If emergency-account alerting is configured, confirm the notification reached the intended monitored destination. Record the successful proof date only after the complete procedure passes for every confirmed emergency account.

## Rollback / safe recovery
A drill itself makes no intended tenant configuration change. If it fails, stop dependent lockout-sensitive enforcement work, return to the owning emergency-account/exclusions/monitoring remediation, correct the proven defect, and rerun the drill. Do not compensate by weakening unrelated policies.

## Limitations / unknowns
IAMAI can record the result but cannot perform or prove a human sign-in on the operator's behalf. Sign-in logs alone do not prove the full drill because they do not establish credential custody, administrative task success, or that the sign-in was an intentional validation.

## Source verification
Workbook Order 46 is `cleanup-drill`, a rollout-proof step with no Entra, JSON, or PowerShell implementation and a required human sign-in/test. Existing IAMAI product copy requires each emergency account to be exercised and the date recorded. Current Microsoft guidance recommends at least two emergency accounts, a designated secure workstation/PAW, monitoring of sign-in and audit activity, and account validation at least every 90 days.
