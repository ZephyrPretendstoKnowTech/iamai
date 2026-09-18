import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'

const upnOf = (phase: CleanupPhase, id: string): string => phase.accountUpnsById?.[id] ?? id

export function emergencyVerificationTasksOf(phase: CleanupPhase): EmergencyTaskProjection {
  const accounts = phase.accountIds.map(id => `**${upnOf(phase, id)}**`).join(', ') || 'each selected emergency account'
  const confirmation = phase.recoveryFindings?.find(finding => finding.key === 'recovery-confirmation')
  const verified = new Set((confirmation?.items ?? []).filter(item => item.outcome === 'pass').map(item => item.accountId ?? item.subjectId).filter((id): id is string => !!id))
  const pending = phase.accountIds.filter(id => !verified.has(id))
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'verify-emergency-sign-in', accountId: null, title: 'Verify emergency sign-in', targetUpn: null,
      required: pending.length > 0, readinessKey: 'recovery-sign-ins', evidence: pending.length ? `${pending.length} account${pending.length === 1 ? '' : 's'} still need a qualifying sign-in.` : 'Both emergency accounts are verified.', actionLabel: 'Open verification instructions',
      issueKeys: pending.map(id => `recovery-sign-in:${id.toLowerCase()}`),
      facts: phase.accountIds.map(id => ({ label: upnOf(phase, id), value: verified.has(id) ? 'Verified' : 'Sign-in required' })),
      steps: ['Select **Start verification** before the sign-in.', `Repeat these steps separately for ${accounts}.`, "Retrieve the account's approved recovery credential from its storage location.", 'Open a separate private browser window and sign in to **Microsoft Entra admin center** with the prepared passkey.', 'Confirm the expected account and tenant.', 'Open **Entra ID → Conditional Access → Policies**, open one policy without editing it, then sign out.', 'Wait 5–10 minutes for the sign-in log, then select **Scan to update the plan**. Logs can take longer to appear.', 'Under **Final verification**, select the tested account and its matching sign-in. Confirm the credential and administrative access, choose **Passed**, then select **Save verification**.'],
    },
    {
      id: 'troubleshoot-emergency-sign-in', accountId: null, title: 'Troubleshoot emergency sign-in', targetUpn: null,
      required: false, readinessKey: 'recovery-sign-ins', evidence: null, actionLabel: 'Open troubleshooting instructions',
      steps: ['Keep the working administrator session open.', 'Open **Entra ID → Monitoring & health → Sign-in logs**.', `Filter to the tested account (${accounts}) and test time.`, 'Open the event and inspect **Status**, **Authentication details**, and **Conditional Access**.', 'Under **Final verification**, select the affected account, choose **Failed**, enter the attempt date, then select **Record failed attempt**.', 'Correct the owning account, exclusions, or passkey task. Retry the private-window sign-in.', 'Wait 5–10 minutes, then select **Scan to update the plan**.'],
    },
  ]
  return { tasks, printAll: true }
}

export function emergencyVerificationPowerShell(phase: CleanupPhase): string {
  const ids = phase.accountIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ')
  const from = Object.values(phase.configurationObservedAtByAccount ?? {}).filter((value): value is string => !!value).sort()[0] ?? phase.snapshotObservedAt ?? ''
  return [
    '# Read-only evidence inspection. Match the observed event to the recovery test before saving verification.',
    `$AccountIds = @(${ids})`,
    from ? `$From = [DateTimeOffset]'${from.replace(/'/g, "''")}'` : '$From = [DateTimeOffset](Get-Date).ToUniversalTime().AddDays(-30)',
    "$Graph = 'https://graph.microsoft.com/v1.0'",
    "if ($AccountIds.Count -eq 0) { Write-Warning 'No emergency accounts are selected.'; return }",
    '$rows = @()',
    "$next = \"$Graph/auditLogs/signIns?`$filter=createdDateTime ge $($From.UtcDateTime.ToString('o'))\"",
    'while ($next) {',
    '  try { $page = Invoke-MgGraphRequest -Method GET -Uri $next -OutputType PSObject } catch { throw "Sign-in evidence could not be read: $($_.Exception.Message)" }',
    "  if ($null -eq $page -or -not ($page.PSObject.Properties.Name -contains 'value')) { throw 'Sign-in evidence returned an unreadable response.' }",
    '  $rows += @($page.value)',
    "  $next = if ($page.PSObject.Properties.Name -contains '@odata.nextLink') { $page.'@odata.nextLink' } else { $null }",
    '}',
    '$rows | Where-Object { $AccountIds -contains $_.userId } | Select-Object id,createdDateTime,userId,userPrincipalName,status,isInteractive,appId,resourceId,resourceDisplayName,authenticationDetails,conditionalAccessStatus',
  ].join('\n')
}

export function emergencyVerificationJson(phase: CleanupPhase): string {
  const result = phase.recoveryFindings?.find(finding => finding.key === 'recovery-confirmation')
  return JSON.stringify({
    purpose: 'Read-only emergency-access verification evidence and context; not a Graph write payload.',
    tenantId: phase.tenantId ?? null,
    scanTimestamp: phase.snapshotObservedAt ?? null,
    accounts: phase.accountIds.map(id => ({
      id,
      upn: upnOf(phase, id),
      configurationBasisAvailable: Boolean(phase.accountBasis?.[id]),
      baselineObservedAt: phase.configurationObservedAtByAccount?.[id] ?? null,
      candidates: (phase.recoveryCandidates?.[id] ?? []).map(reading => ({ eventId: reading.candidate.eventId, at: reading.candidate.at, method: reading.candidate.method, resource: reading.candidate.resource ?? reading.candidate.resourceId ?? null, qualifies: reading.qualifies, reason: reading.reason })),
      result: result?.items?.find(item => item.accountId === id || item.subjectId === id)?.value ?? null,
    })),
    unresolvedFindings: (phase.recoveryFindings ?? []).filter(finding => finding.outcome !== 'pass').map(finding => ({ key: finding.key, label: finding.label, value: finding.value, detail: finding.detail, items: finding.items ?? [] })),
  }, null, 2)
}

export function emergencyVerificationAiInfo(phase: CleanupPhase): string {
  return ['Help carry out the current Verify Emergency Access task using only the observed context below. Keep configuration and sign-in evidence distinct. Do not claim an unknown fact is verified.', emergencyVerificationJson(phase)].join('\n\n')
}
