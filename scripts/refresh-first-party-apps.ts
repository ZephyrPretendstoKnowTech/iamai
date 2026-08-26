// Refreshes data/first-party-apps.json from Microsoft's documented list of
// first-party application ids (the "Application IDs of commonly used
// Microsoft applications" support article, fetched as raw markdown from the
// MicrosoftDocs repo). Existing entries keep their curated category and
// inOffice365Bundle values; newly discovered apps arrive with category
// "unknown" for manual curation. Usage: node scripts/refresh-first-party-apps.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE_URL =
  'https://raw.githubusercontent.com/MicrosoftDocs/SupportArticles-docs/main/support/entra/entra-id/governance/verify-first-party-apps-sign-in.md'

const FILE = resolve(import.meta.dirname, '../data/first-party-apps.json')

type App = { appId: string; displayName: string; category: string; inOffice365Bundle: boolean }
type Doc = { $comment: string; asOf: string; apps: App[] }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function main(): Promise<void> {
  const current = JSON.parse(readFileSync(FILE, 'utf8')) as Doc
  const byId = new Map(current.apps.map((a) => [a.appId.toLowerCase(), a]))

  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    console.error(`fetch failed (${res.status}) — ${SOURCE_URL}`)
    console.error('The article may have moved; update SOURCE_URL. Existing file left unchanged.')
    process.exitCode = 1
    return
  }
  const md = await res.text()

  // Table rows look like: | Application name | appId |
  let added = 0
  for (const line of md.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 3) continue
    const guidCell = cells.find((c) => GUID.test(c))
    if (!guidCell) continue
    const name = cells.find((c) => c && !GUID.test(c) && !/^-+$/.test(c))
    const appId = guidCell.toLowerCase()
    if (!byId.has(appId)) {
      byId.set(appId, {
        appId: guidCell,
        displayName: name ?? 'Unknown',
        category: 'unknown',
        inOffice365Bundle: false,
      })
      added += 1
    }
  }

  const next: Doc = {
    ...current,
    asOf: new Date().toISOString().slice(0, 10),
    apps: [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
  }
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n')
  console.log(`${added} new app(s) added; ${next.apps.length} total. Curate any category:"unknown" entries.`)
}

void main()
