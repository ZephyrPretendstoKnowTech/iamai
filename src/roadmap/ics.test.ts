// The calendar file's line folding (roadmap/ics.ts foldIcsLine): RFC 5545 folds
// at 75 octets, and the Plan's own lines carry " · " and accented names, which
// are longer in UTF-8 than in code units (S7, task 3).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foldIcsLine } from './ics.ts'

const octets = (s: string): number => new TextEncoder().encode(s).length

test('a folded line never exceeds 75 octets, never splits a character, and unfolds to what it was', () => {
  const line = `SUMMARY:${'Éloïse Müller · Require MFA for Everyone · Create the policy in report-only · '.repeat(6)}`
  const folded = foldIcsLine(line)
  const lines = folded.split('\r\n')
  assert.ok(lines.length > 3, 'the line is long enough to fold')
  for (const l of lines) assert.ok(octets(l) <= 75, `${octets(l)} octets: ${l}`)
  for (const l of lines.slice(1)) assert.ok(l.startsWith(' '), 'a continuation line starts with one space')
  assert.equal(folded.replace(/\r\n /g, ''), line, 'unfolding restores the line, so no character was cut in two')
  assert.doesNotMatch(folded, /�/, 'no replacement character')
})

test('a short line is left alone', () => {
  assert.equal(foldIcsLine('BEGIN:VEVENT'), 'BEGIN:VEVENT')
})
