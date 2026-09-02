// The PowerShell tab: the same body the JSON tab shows, as PowerShell. Connect
// with the one write scope, then the body as a here-string and the cmdlet that
// creates it (or updates the existing policy an adjust step names). Two bodies
// are two labelled blocks. Pure; the engine ships no PowerShell of its own.
export function powershellFor(json: unknown, existingPolicyId: string | null = null): string {
  const bodies = Array.isArray(json) ? json : [json]
  const labels = bodies.length > 1 ? bodies.map((_, i) => String.fromCharCode(65 + i)) : ['']
  const blocks = bodies.map((body, i) => {
    const label = labels[i]
    const v = `$body${label}`
    const cmdlet = existingPolicyId ? `Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '${existingPolicyId}' -BodyParameter ${v}` : `New-MgIdentityConditionalAccessPolicy -BodyParameter ${v}`
    return `${label ? `# Policy ${label}\n` : ''}${v} = @'\n${JSON.stringify(body, null, 2)}\n'@ | ConvertFrom-Json -AsHashtable\n${cmdlet}`
  })
  return ['Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', ...blocks].join('\n\n')
}
