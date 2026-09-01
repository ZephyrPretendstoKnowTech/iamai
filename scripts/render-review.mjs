// Regenerate docs/qa/content-review.expected.html from docs/design/content.json
// with docs/design/render-review.py — the owner's wording-review page and the
// checked-in expectation content.test.ts asserts the TypeScript renderer against
// (prompt 51 Part 1). Run after any content.json change:  npm run render-review
//
// The script is the source of truth; this wrapper only runs it with UTF-8 forced
// (its arrows are outside cp1252) and normalises the newlines to LF so the
// fingerprint and git see no spurious CRLF churn.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'docs/design/render-review.py'
const CONTENT = 'docs/design/content.json'
const OUT = 'docs/qa/content-review.expected.html'
const tmp = join(tmpdir(), `content-review-${process.pid}.html`)

const python = process.platform === 'win32' ? 'python' : 'python3'
const r = spawnSync(python, [SRC, CONTENT, tmp], { env: { ...process.env, PYTHONUTF8: '1' }, encoding: 'utf8' })
if (r.status !== 0) {
  console.error(`render-review: ${python} ${SRC} failed:\n${r.stderr || r.stdout || r.error}`)
  process.exit(1)
}
const html = readFileSync(tmp, 'utf8').replace(/\r\n/g, '\n')
writeFileSync(OUT, html)
rmSync(tmp, { force: true })
console.log(`render-review: wrote ${OUT} (${html.length} chars)`)
