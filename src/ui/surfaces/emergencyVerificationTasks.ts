import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'

const upnOf = (phase: CleanupPhase, id: string): string => phase.accountUpnsById?.[id] ?? id

export function emergencyVerificationTasksOf(phase: CleanupPhase): EmergencyTaskProjection {
  const accounts = phase.accountIds.map(id => `**${upnOf(phase, id)}**`).join(', ') || 'each selected emergency account'
  const signIns = phase.recoveryFindings?.find(finding => finding.key === 'recovery-sign-ins')
  const verified = new Set((signIns?.items ?? []).filter(item => item.outcome === 'pass').map(item => item.accountId ?? item.subjectId).filter((id): id is string => !!id))
  const pending = phase.accountIds.filter(id => !verified.has(id))
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'verify-emergency-sign-in', accountId: null, title: 'Verify emergency sign-in', targetUpn: null,
      required: pending.length > 0, readinessKey: 'recovery-sign-ins', evidence: pending.length ? `${pending.length} account${pending.length === 1 ? '' : 's'} still need a qualifying sign-in.` : 'Both emergency accounts are verified.', actionLabel: 'Open sign-in instructions',
      issueKeys: pending.map(id => `recovery-sign-in:${id.toLowerCase()}`),
      // The per-account list is the Sign-in Evidence tile's; the procedure names no list of its own.
      readinessFacts: phase.accountIds.map(id => ({ label: upnOf(phase, id), value: verified.has(id) ? 'Verified' : 'Sign-in required' })),
      steps: ['Keep your working administrator session open.', 'Retrieve the prepared passkey for the emergency account named in Tasks Remaining.', 'Open a new private browser window and go to **Microsoft Entra admin center** (any Microsoft sign-in counts).', 'Sign in as that emergency account using its prepared passkey.', 'Confirm the account and tenant. Optional: open **Entra ID → Conditional Access** to confirm the account can manage policies.', 'Sign out and close the private window. Repeat for each remaining account.', 'Wait 5–10 minutes, then select **Scan to update the plan**. If the event has not appeared, wait and scan again.'],
    },
    {
      id: 'troubleshoot-emergency-sign-in', accountId: null, title: 'Troubleshoot emergency sign-in', targetUpn: null,
      required: false, readinessKey: 'recovery-sign-ins', evidence: null, actionLabel: 'Open troubleshooting instructions',
      steps: ['Keep the working administrator session open.', 'Open **Entra ID → Monitoring & health → Sign-in logs**.', `Filter by the affected emergency account (${accounts}) and attempt time.`, 'Open the event. Check **Status**, **Authentication details**, and **Conditional Access**.', 'Correct the issue in the relevant account, exclusions, or passkey task.', 'Follow **Verify emergency sign-in** again, then scan to update the plan.', 'If no administrator can sign in, follow **Emergency recovery procedure** below.'],
    },
  ]
  return { tasks, printAll: true }
}

export function emergencyVerificationPowerShell(phase: CleanupPhase): string {
  const ids = phase.accountIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ')
  const from = Object.values(phase.configurationObservedAtByAccount ?? {}).filter((value): value is string => !!value).sort()[0] ?? phase.snapshotObservedAt ?? ''
  return [
    '# Read-only evidence inspection. Match observed events to the configured emergency accounts.',
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
  const result = phase.recoveryFindings?.find(finding => finding.key === 'recovery-sign-ins')
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
