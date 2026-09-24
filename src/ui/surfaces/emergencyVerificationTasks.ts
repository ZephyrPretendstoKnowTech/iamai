import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { Artifact } from './stepBody.ts'

const upnOf = (phase: CleanupPhase, id: string): string => phase.accountUpnsById?.[id] ?? id

export function emergencyVerificationTasksOf(phase: CleanupPhase): EmergencyTaskProjection {
  const accounts = phase.accountIds.map(id => `**${upnOf(phase, id)}**`).join(', ') || 'each selected emergency account'
  const signIns = phase.recoveryFindings?.find(finding => finding.key === 'recovery-sign-ins')
  const verified = new Set((signIns?.items ?? []).filter(item => item.outcome === 'pass').map(item => item.accountId ?? item.subjectId).filter((id): id is string => !!id))
  const pending = phase.accountIds.filter(id => !verified.has(id))
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'verify-emergency-sign-in', accountId: null, title: 'Verify emergency sign-in', targetUpn: null,
      required: pending.length > 0, readinessKey: 'recovery-sign-ins', evidence: pending.length ? `${pending.length} account${pending.length === 1 ? '' : 's'} still need a qualifying sign-in.` : 'Every selected emergency account is verified.', actionLabel: 'Open sign-in instructions',
      issueKeys: pending.map(id => `recovery-sign-in:${id.toLowerCase()}`),
      // The per-account list is the Sign-in Evidence tile's; the procedure names no list of its own.
      readinessFacts: phase.accountIds.map(id => ({ label: upnOf(phase, id), value: verified.has(id) ? 'Verified' : 'Sign-in required' })),
      steps: ['Retrieve the prepared passkey for the emergency account named in Tasks Remaining.', 'Open a new private browser window and go to [Microsoft Entra admin center](https://entra.microsoft.com/). Any Microsoft sign-in counts.', 'Sign in as that emergency account using its prepared passkey.', 'Confirm the account and tenant.', 'Sign out and close the private window. Repeat for each remaining account.', 'Wait 5–10 minutes, then select **Scan to update the plan**. If the event has not appeared, wait and scan again.'],
    },
    {
      id: 'troubleshoot-emergency-sign-in', accountId: null, title: 'Troubleshoot emergency sign-in', targetUpn: null,
      required: false, readinessKey: 'recovery-sign-ins', evidence: null, actionLabel: 'Open troubleshooting instructions',
      steps: ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Monitoring & health → Sign-in logs**.', `Filter by the affected emergency account (${accounts}) and attempt time.`, 'Open the event. Check **Status**, **Authentication details**, and **Conditional Access**.', 'Correct the issue in the relevant account, exclusions, or passkey task.', 'Follow **Verify emergency sign-in** again, then scan to update the plan.', 'If no administrator can sign in, follow **Emergency recovery procedure** below.'],
    },
  ]
  return { tasks, printAll: true }
}

/**
 * The drill's channels: the Entra tab, whose procedure is its tasks, and AI
 * Info. No PowerShell or JSON tab (owner, 2026-09-23): both were read-only
 * sign-in log queries the scan already runs.
 */
export function emergencyVerificationArtifacts(phase: CleanupPhase): Artifact[] {
  return [
    { id: 'portal', form: 'markdown', lines: [], text: () => '', note: null },
    { id: 'ai', form: 'markdown', lines: [], text: () => emergencyVerificationAiInfo(phase), note: null },
  ]
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
