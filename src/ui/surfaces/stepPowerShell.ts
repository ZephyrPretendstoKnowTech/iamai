// The PowerShell tab: the same operations the JSON tab shows, as PowerShell.
// Connect with the one write scope, then each operation's body as a here-string
// and the cmdlet its mode calls — New- for a create, Update- against the policy
// an update names. Two operations are two labelled blocks, in the step's order.
//
// An operation that does not say exactly one thing produces no command. An
// update with no policy to update is not a create: turning one into the other
// would write a second policy where a person asked to change one.
//
// Pure; the engine ships no PowerShell of its own.
import type { PolicyOperation } from '../../roadmap/types.ts'
import { isValidOperation } from '../../roadmap/operations.ts'
import { BETA_CA_POLICIES, targetsAgents } from '../../roadmap/agentBlocks.ts'

/**
 * The Graph request an operation sends, where it is not the v1.0 cmdlet's: a
 * policy that targets agent identities (Jon's AGENT blocks) goes to the beta
 * collection, the only one that carries the agent fields (Microsoft Learn,
 * disable-agent-identities). Null for every other policy.
 */
export function betaRequestOf(op: PolicyOperation): { method: 'POST' | 'PATCH'; endpoint: string } | null {
  if (!targetsAgents(op.body as Record<string, unknown>) && !(op.mode === 'update' && targetsAgents((op.intent ?? null) as Record<string, unknown> | null))) return null
  return op.mode === 'update' ? { method: 'PATCH', endpoint: `${BETA_CA_POLICIES}/${op.policyId}` } : { method: 'POST', endpoint: BETA_CA_POLICIES }
}

export function powershellFor(operations: readonly PolicyOperation[]): string {
  const valid = operations.filter(isValidOperation)
  const labels = valid.length > 1 ? valid.map((_, i) => String.fromCharCode(65 + i)) : ['']
  const blocks = valid.map((op, i) => {
    const label = labels[i]
    const v = `$body${label}`
    // An agent policy is sent as JSON to the beta endpoint: the v1.0 cmdlets drop its agent fields.
    const beta = betaRequestOf(op)
    if (beta) return `${label ? `# Policy ${label}\n` : ''}${v} = @'\n${JSON.stringify(op.body, null, 2)}\n'@\nInvoke-MgGraphRequest -Method ${beta.method} -Uri '${beta.endpoint}' -Body ${v} -ContentType 'application/json'`
    const cmdlet =
      op.mode === 'update'
        ? `Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '${op.policyId}' -BodyParameter ${v}`
        : `New-MgIdentityConditionalAccessPolicy -BodyParameter ${v}`
    return `${label ? `# Policy ${label}\n` : ''}${v} = @'\n${JSON.stringify(op.body, null, 2)}\n'@ | ConvertFrom-Json -AsHashtable\n${cmdlet}`
  })
  return ['Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', ...blocks].join('\n\n')
}

/**
 * A script handed to a person runs in the tenant IAMAI scanned and nowhere else
 * (N-027): an MSP's Graph session left open to another client is closed first,
 * and every Connect-MgGraph names the tenant, so neither a script that reuses the
 * session it finds nor one that signs in again can write to another tenant.
 */
export function pinnedToTenant(script: string, tenantId: string, tenantName: string): string {
  const id = tenantId.replace(/[^0-9A-Za-z.-]/g, '')
  if (script.trim() === '' || id === '') return script
  const name = tenantName.replace(/[\r\n]+/g, ' ').trim() || 'the scanned tenant'
  // The script's own opening warnings stay first ("Do this after …", "This policy
  // is On"); the pin follows them, before any line that runs.
  const lines = script.replace(/\bConnect-MgGraph\b(?![^\n]*-TenantId)/g, `Connect-MgGraph -TenantId '${id}'`).split('\n')
  const lead = lines.findIndex((l) => !l.startsWith('#'))
  const at = lead === -1 ? lines.length : lead
  return [
    ...lines.slice(0, at),
    `# For ${name} only (tenant ID ${id}): a session open in another tenant is closed first.`,
    `if ((Get-MgContext) -and (Get-MgContext).TenantId -ne '${id}') { Disconnect-MgGraph | Out-Null }`,
    ...lines.slice(at),
  ].join('\n')
}
