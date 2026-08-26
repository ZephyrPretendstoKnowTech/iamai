// Refreshes data/service-plans.json plan-id lists from Microsoft's published
// licensing reference CSV ("Product names and service plan identifiers for
// licensing"). Name patterns stay curated; this script fills servicePlanIds
// for every plan whose name matches a pattern.
// Usage: node scripts/refresh-service-plans.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CSV_URL =
  'https://download.microsoft.com/download/e/3/e/e3e9faf2-f28b-490a-9ada-c6089a1fc5b0/Product%20names%20and%20service%20plan%20identifiers%20for%20licensing.csv'

const FILE = resolve(import.meta.dirname, '../data/service-plans.json')

type Matcher = { servicePlanIds: string[]; namePatterns: string[] }
type Doc = { $comment: string; asOf: string; capabilities: Record<string, Matcher> }

async function main(): Promise<void> {
  const doc = JSON.parse(readFileSync(FILE, 'utf8')) as Doc
  const res = await fetch(CSV_URL)
  if (!res.ok) {
    console.error(`fetch failed (${res.status}); CSV may have moved — update CSV_URL. File left unchanged.`)
    process.exitCode = 1
    return
  }
  const csv = await res.text()
  // Columns: Product_Display_Name,String_Id,GUID,Service_Plan_Name,Service_Plan_Id,...
  const planIdsByName = new Map<string, string>()
  for (const line of csv.split('\n').slice(1)) {
    const cols = line.split(',')
    if (cols.length < 5) continue
    const planName = cols[3]?.trim()
    const planId = cols[4]?.trim().toLowerCase()
    if (planName && planId && /^[0-9a-f-]{36}$/.test(planId)) planIdsByName.set(planName, planId)
  }
  let filled = 0
  for (const matcher of Object.values(doc.capabilities)) {
    const patterns = matcher.namePatterns.map((p) => new RegExp(p))
    const ids = new Set(matcher.servicePlanIds.map((id) => id.toLowerCase()))
    for (const [name, id] of planIdsByName) {
      if (patterns.some((p) => p.test(name)) && !ids.has(id)) {
        ids.add(id)
        filled += 1
      }
    }
    matcher.servicePlanIds = [...ids]
  }
  doc.asOf = new Date().toISOString().slice(0, 10)
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n')
  console.log(`${filled} plan id(s) added from ${planIdsByName.size} catalog rows.`)
}

void main()
