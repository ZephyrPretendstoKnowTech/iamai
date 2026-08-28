// Refreshes data/role-templates.json from Microsoft's published list of
// Microsoft Entra built-in roles (the "permissions reference" article,
// fetched as raw markdown from the MicrosoftDocs repo). Template ids are the
// same in every tenant, so the catalogue resolves any role reference offline.
// Usage: node scripts/refresh-role-templates.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE_URL =
  'https://raw.githubusercontent.com/MicrosoftDocs/entra-docs/main/docs/identity/role-based-access-control/permissions-reference.md'

const FILE = resolve(import.meta.dirname, '../data/role-templates.json')

type Role = { templateId: string; name: string; privileged: boolean }
type Doc = { $comment: string; source: string; asOf: string; roles: Role[] }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function main(): Promise<void> {
  const current: Doc | null = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as Doc) : null
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    console.error(`fetch failed (${res.status}) — ${SOURCE_URL}`)
    console.error('The article may have moved; update SOURCE_URL. Existing file left unchanged.')
    process.exitCode = 1
    return
  }
  const md = await res.text()

  // Summary-table rows look like:
  // > | [Global Administrator](#global-administrator) | description<br/>[![Privileged label icon.](…)](…) | 62e90394-… |
  const byId = new Map<string, Role>()
  for (const line of md.split('\n')) {
    const cells = line.replace(/^>\s*/, '').split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    const guidCell = cells.find((c) => GUID.test(c))
    if (!guidCell) continue
    const nameCell = cells.find((c) => /^\[.+\]\(#.+\)$/.test(c))
    if (!nameCell) continue
    const name = nameCell.replace(/^\[(.+)\]\(#.+\)$/, '$1')
    const privileged = /privileged-label/i.test(line)
    byId.set(guidCell.toLowerCase(), { templateId: guidCell.toLowerCase(), name, privileged })
  }
  if (byId.size < 50) {
    console.error(`only ${byId.size} roles parsed; the table format probably changed. File left unchanged.`)
    process.exitCode = 1
    return
  }
  const next: Doc = {
    $comment:
      'Every Microsoft Entra built-in role template (id, display name, privileged flag). Refresh with: node scripts/refresh-role-templates.ts. Template ids are identical in every tenant.',
    source: SOURCE_URL,
    asOf: new Date().toISOString().slice(0, 10),
    roles: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n')
  const before = current?.roles.length ?? 0
  console.log(`${next.roles.length} role templates written (was ${before}); ${next.roles.filter((r) => r.privileged).length} privileged.`)
}

void main()
