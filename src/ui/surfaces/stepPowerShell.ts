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

export function powershellFor(operations: readonly PolicyOperation[]): string {
  const valid = operations.filter(isValidOperation)
  const labels = valid.length > 1 ? valid.map((_, i) => String.fromCharCode(65 + i)) : ['']
  const blocks = valid.map((op, i) => {
    const label = labels[i]
    const v = `$body${label}`
    const cmdlet =
      op.mode === 'update'
        ? `Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '${op.policyId}' -BodyParameter ${v}`
        : `New-MgIdentityConditionalAccessPolicy -BodyParameter ${v}`
    return `${label ? `# Policy ${label}\n` : ''}${v} = @'\n${JSON.stringify(op.body, null, 2)}\n'@ | ConvertFrom-Json -AsHashtable\n${cmdlet}`
  })
  return ['Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', ...blocks].join('\n\n')
}
