// Refreshes data/product-names.json from Microsoft's published licensing
// reference CSV ("Product names and service plan identifiers for licensing"):
// one friendly product name per SKU part number (String_Id), so the Licensing
// tab can say "Microsoft 365 Business Premium" instead of "SPB".
// Usage: node scripts/refresh-product-names.ts
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CSV_URL =
  'https://download.microsoft.com/download/e/3/e/e3e9faf2-f28b-490a-9ada-c6089a1fc5b0/Product%20names%20and%20service%20plan%20identifiers%20for%20licensing.csv'

const FILE = resolve(import.meta.dirname, '../data/product-names.json')

type Doc = { $comment: string; source: string; asOf: string; products: Record<string, string> }

// Minimal CSV field splitter: handles quoted fields with commas.
function fields(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((f) => f.trim())
}

async function main(): Promise<void> {
  const res = await fetch(CSV_URL)
  if (!res.ok) {
    console.error(`fetch failed (${res.status}); CSV may have moved — update CSV_URL. File left unchanged.`)
    process.exitCode = 1
    return
  }
  const csv = (await res.text()).replace(/^﻿/, '')
  // Columns: Product_Display_Name,String_Id,GUID,Service_Plan_Name,Service_Plan_Id,...
  const products: Record<string, string> = {}
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const cols = fields(line)
    if (cols.length < 3) continue
    const name = cols[0]
    const stringId = cols[1]?.toUpperCase()
    if (name && stringId && !(stringId in products)) products[stringId] = name
  }
  const count = Object.keys(products).length
  if (count < 100) {
    console.error(`only ${count} products parsed; the CSV format probably changed. File left unchanged.`)
    process.exitCode = 1
    return
  }
  const sorted = Object.fromEntries(Object.entries(products).sort(([a], [b]) => a.localeCompare(b)))
  const doc: Doc = {
    $comment:
      'Friendly product name per SKU part number (String_Id), from Microsoft\'s licensing reference CSV. Refresh with: node scripts/refresh-product-names.ts.',
    source: CSV_URL,
    asOf: new Date().toISOString().slice(0, 10),
    products: sorted,
  }
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n')
  console.log(`${count} product names written.`)
}

void main()
