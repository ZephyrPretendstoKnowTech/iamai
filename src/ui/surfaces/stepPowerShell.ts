// The PowerShell tab: the same operations the JSON tab shows, as PowerShell.
// Connect with the one write scope, then each operation's body as a here-string
// and the cmdlet its mode calls — New- for a create, Update- against the policy
// an update names. Two operations are two labelled blocks, in the step's order.
// Pure; the engine ships no PowerShell of its own.
import type { PolicyOperation } from '../../roadmap/types.ts'

export function powershellFor(operations: readonly Pick<PolicyOperation, 'mode' | 'policyId' | 'body'>[]): string {
  const labels = operations.length > 1 ? operations.map((_, i) => String.fromCharCode(65 + i)) : ['']
  const blocks = operations.map((op, i) => {
    const label = labels[i]
    const v = `$body${label}`
    const cmdlet =
      op.mode === 'update' && op.policyId
        ? `Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '${op.policyId}' -BodyParameter ${v}`
        : `New-MgIdentityConditionalAccessPolicy -BodyParameter ${v}`
    return `${label ? `# Policy ${label}\n` : ''}${v} = @'\n${JSON.stringify(op.body, null, 2)}\n'@ | ConvertFrom-Json -AsHashtable\n${cmdlet}`
  })
  return ['Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', ...blocks].join('\n\n')
}
