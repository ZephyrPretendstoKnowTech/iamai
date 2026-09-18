import { loadMappingState } from '../mapping/store.ts'
import { exclusionsGroupIdToVerify } from '../mapping/safetyChoice.ts'
import { captureEmergencyAccessDiagnostic, evaluateDiagnosticPair } from '../../work/emergency-access-diagnostic-core.ts'
import type { EmergencyDiagnosticArtifact } from '../../work/emergency-access-diagnostic-core.ts'
import type { TokenSource } from '../graph/collect/http.ts'
import { requiredModels } from '../roadmap/passkeySettings.ts'
import { passkeyBindings } from '../roadmap/passkeySettings.ts'
import { loadSnapshotRecord } from '../graph/collect/cache.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

type Phase = 'baseline' | 'confirming'
type Pair = { generation: number; binding: string; secret: string; baseline: EmergencyDiagnosticArtifact | null; confirming: EmergencyDiagnosticArtifact | null }
let pair: Pair | null = null
let generation = 0

// Microsoft documents ADIbizaUX as the Azure/Entra portal client and Microsoft
// Graph as the resource in sign-in records. Both identifiers must match.
export const ENTRA_ADMIN_TARGET = {
  appId: '74658136-14ec-4630-ad9b-26e160ff0fc6',
  resourceId: '00000003-0000-0000-c000-000000000000',
} as const

function diagnosticBinding(tenantId: string, accountIds: string[], groupId: string | null, approvedAaguids: string[], passkeyBasis: Record<string, unknown>): string {
  return JSON.stringify({ tenantId: tenantId.toLowerCase(), accountIds: [...accountIds].map(value => value.toLowerCase()).sort(), groupId: groupId?.toLowerCase() ?? null, approvedAaguids: [...approvedAaguids].sort(), passkeyBasis, target: ENTRA_ADMIN_TARGET })
}

export async function runEmergencyDiagnosticEntry(tenantId: string, phase: Phase, deps: {
  load?: typeof loadMappingState
  loadSnapshot?: (tenantId: string) => Promise<TenantSnapshot | null>
  tokens?: () => Promise<TokenSource>
  capture?: typeof captureEmergencyAccessDiagnostic
  kind?: 'synthetic' | 'real'
} = {}) {
  const startingPair = pair
  if (phase === 'confirming' && !startingPair?.baseline) throw new Error('Run the baseline diagnostic first.')
  const invocation = phase === 'baseline' ? ++generation : startingPair!.generation
  const current = (): boolean => generation === invocation && (phase === 'baseline' || pair === startingPair && pair?.generation === invocation)
  const requireCurrent = (): void => { if (!current()) throw new Error('This diagnostic capture was superseded by a newer baseline.') }
  const load = deps.load ?? loadMappingState
  const mapping = await load(tenantId)
  requireCurrent()
  const loadSnapshot = deps.loadSnapshot ?? ((id: string) => loadSnapshotRecord<TenantSnapshot>(id))
  const snapshot = await loadSnapshot(tenantId)
  requireCurrent()
  const accountIds = [...mapping.breakGlassUserIds]
  if (!accountIds.length) throw new Error('Select and save emergency access accounts before running the diagnostic.')
  const groupId = exclusionsGroupIdToVerify(mapping)
  const approvedAaguids = requiredModels(mapping).map(model => model.aaguid)
  const binding = diagnosticBinding(tenantId, accountIds, groupId, approvedAaguids, passkeyBindings(snapshot, mapping))
  if (phase === 'baseline') pair = { generation: invocation, binding, secret: crypto.randomUUID(), baseline: null, confirming: null }
  const active = phase === 'baseline' ? pair! : startingPair!
  if (phase === 'confirming' && active.binding !== binding) throw new Error('The tenant, selected accounts, group, or passkey intent changed. Run a new baseline.')
  const acquireTokens = deps.tokens ?? (async () => (await import('../graph/collect/onDemand.ts')).onDemandTokenSource())
  const tokenSource = await acquireTokens(); requireCurrent()
  const artifact = await (deps.capture ?? captureEmergencyAccessDiagnostic)(tokenSource, { accountIds, groupId, tenantId, expectedTarget: ENTRA_ADMIN_TARGET, approvedAaguids, configurationBasis: binding, kind: deps.kind ?? 'real', secret: active.secret, observationStart: phase === 'confirming' ? active.baseline?.startedAt ?? null : null })
  if (pair !== active || pair.generation !== active.generation) throw new Error('This diagnostic capture was superseded by a newer baseline.')
  const latest = await load(tenantId); requireCurrent(); const latestSnapshot = await loadSnapshot(tenantId); requireCurrent(); const latestAccounts = [...latest.breakGlassUserIds]; const latestGroup = exclusionsGroupIdToVerify(latest); const latestModels = requiredModels(latest).map(model => model.aaguid)
  if (diagnosticBinding(tenantId, latestAccounts, latestGroup, latestModels, passkeyBindings(latestSnapshot, latest)) !== active.binding) throw new Error('The tenant, selected accounts, group, or passkey intent changed while the capture was running. Run a new baseline.')
  if (phase === 'baseline') active.baseline = artifact
  else active.confirming = artifact
  return { phase, artifact, evaluation: active.baseline && active.confirming ? evaluateDiagnosticPair(active.baseline, active.confirming) : null }
}

export function emergencyDiagnosticPairPayload(active: Pair | null = pair, expectedBinding?: string) {
  if (!active?.baseline) throw new Error('Run the baseline diagnostic first.')
  if (active.generation !== generation) throw new Error('The saved diagnostic pair was superseded by a newer baseline.')
  if (expectedBinding && active.binding !== expectedBinding) throw new Error('The saved diagnostic pair is stale for the current tenant, accounts, group, or passkey intent.')
  return { schema: 2, kind: 'sanitized-emergency-diagnostic-pair', baseline: active.baseline, confirming: active.confirming, evaluation: active.confirming ? evaluateDiagnosticPair(active.baseline, active.confirming) : null }
}

export async function downloadEmergencyDiagnosticPair(
  tenantId: string,
  load: typeof loadMappingState = loadMappingState,
  loadSnapshot: (tenantId: string) => Promise<TenantSnapshot | null> = id => loadSnapshotRecord<TenantSnapshot>(id),
): Promise<void> {
  const active = pair
  if (!active) throw new Error('Run the baseline diagnostic first.')
  if (active.generation !== generation) throw new Error('The saved diagnostic pair was superseded by a newer baseline.')
  const expectedGeneration = generation
  const mapping = await load(tenantId); if (pair !== active || generation !== expectedGeneration) throw new Error('The saved diagnostic pair was superseded while preparing the download.')
  const snapshot = await loadSnapshot(tenantId); if (pair !== active || generation !== expectedGeneration) throw new Error('The saved diagnostic pair was superseded while preparing the download.')
  const accounts = [...mapping.breakGlassUserIds]; const groupId = exclusionsGroupIdToVerify(mapping); const models = requiredModels(mapping).map(model => model.aaguid)
  const payload = emergencyDiagnosticPairPayload(active, diagnosticBinding(tenantId, accounts, groupId, models, passkeyBindings(snapshot, mapping)))
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `iamai-emergency-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; anchor.click(); URL.revokeObjectURL(url)
}
