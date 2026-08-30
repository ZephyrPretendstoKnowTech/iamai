// The fingerprint has to answer "did the source change" the same way git does.
//
// It did not, for a week. It hashed raw bytes, so a file carrying CRLF endings
// in a Windows working tree and LF in the committed blob produced one value on
// the machine that generated the inventory and another on the Linux runner that
// checked it. `git status` was clean the whole time, correctly: .gitattributes
// says `* text=auto eol=lf`, so git had already decided line endings are not
// part of a file's identity. Every CI run failed for seven commits.
//
// These tests are the cheap part of that fix. Without them the next person to
// touch the hash reintroduces it, and the symptom (a green local run, a red CI)
// takes far longer to diagnose than it does to prevent.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { normaliseSource, sourceFiles, sourceFingerprint } from './fingerprint.ts'

const FIXTURE = ["import { a } from './a.ts'", '', 'export const x = 1', ''].join('\n')
const hash = (s: string) => createHash('sha256').update(normaliseSource(s)).digest('hex')

test('CRLF and LF hash the same', () => {
  // The exact defect: usePrinting.ts, 598 bytes on disk with CRLF, 581 in the
  // blob with LF, identical to git.
  assert.equal(hash(FIXTURE.replace(/\n/g, '\r\n')), hash(FIXTURE), 'a Windows checkout would not match a Linux one')
})

test('a lone CR hashes the same as LF', () => {
  assert.equal(hash(FIXTURE.replace(/\n/g, '\r')), hash(FIXTURE))
})

test('a UTF-8 BOM does not change the fingerprint', () => {
  // Notepad and some PowerShell redirections add one; git does not treat it as
  // a change to the file's identity either.
  assert.equal(hash('﻿' + FIXTURE), hash(FIXTURE), 'a BOM would make the same file look different')
})

test('a missing or doubled final newline does not change the fingerprint', () => {
  assert.equal(hash(FIXTURE.replace(/\n$/, '')), hash(FIXTURE), 'no trailing newline')
  assert.equal(hash(FIXTURE + '\n\n'), hash(FIXTURE), 'extra trailing newlines')
})

test('everything above at once still hashes the same', () => {
  const windows = '﻿' + FIXTURE.replace(/\n/g, '\r\n').replace(/\r\n$/, '')
  assert.equal(hash(windows), hash(FIXTURE))
})

test('real changes still change the fingerprint', () => {
  // The normalisation must not be so eager that the hash stops detecting
  // anything. A changed character, changed indentation and a changed blank line
  // between statements are all real edits.
  assert.notEqual(hash(FIXTURE.replace('x = 1', 'x = 2')), hash(FIXTURE), 'a changed value')
  assert.notEqual(hash(FIXTURE.replace('export', '  export')), hash(FIXTURE), 'changed indentation')
  assert.notEqual(hash(FIXTURE.replace('\n\n', '\n')), hash(FIXTURE), 'a removed blank line')
})

test('the file list is platform independent', () => {
  const files = sourceFiles()
  assert.ok(files.length > 50, `only ${files.length} source files found`)
  for (const f of files) {
    assert.ok(!f.includes('\\'), `${f} carries a Windows separator, so the sort order would differ by platform`)
    assert.ok(!/\.test\.tsx?$/.test(f), `${f} is a test and must not be fingerprinted`)
    assert.ok(f.startsWith('src/copy/') || f.startsWith('src/ui/'), `${f} is outside the fingerprinted directories`)
  }
  assert.deepEqual(files, [...files].sort(), 'the list is not sorted, so the hash depends on directory order')
  // This module computes the hash; it must not be an input to it.
  assert.ok(!files.includes('src/fingerprint.ts'))
})

test('the fingerprint is stable across calls', () => {
  assert.equal(sourceFingerprint(), sourceFingerprint())
  assert.match(sourceFingerprint(), /^[0-9a-f]{16}$/)
})
