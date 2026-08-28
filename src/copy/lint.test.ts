// Copy lint (prompt 14 §1): fails the test run on any user-facing string that
// carries an em/en dash used as punctuation, first person, the "not X, but Y"
// construction, or the banned phrases. Runs over src/copy and every .tsx.
// Dev-only pages (component gallery, spikes, fixtures) are not user-facing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const EXCLUDE = /(\.test\.tsx?$)|DevSpikes\.tsx$|ComponentsPage\.tsx$|fixtureSnapshot\.ts$|lint\.test\.ts$/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if ((p.endsWith('.tsx') || (p.endsWith('.ts') && relative(ROOT, p).split(sep)[0] === 'copy')) && !EXCLUDE.test(p)) out.push(p)
  }
  return out
}

// String literals only (single, double, template) — never comments or code.
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g

export type Violation = { file: string; line: number; rule: string; text: string }

const RULES: { rule: string; test: (s: string) => boolean }[] = [
  // An en dash between digits is a range (2–4 weeks), not punctuation.
  { rule: 'dash', test: (s) => /—/.test(s) || /(?<!\d)–|–(?!\d)/.test(s) },
  // The footer is the author's own voice by agreement (ux-review-05 §30), not IAMAI's.
  { rule: 'first-person', test: (s) => /(^|[^\w'])(I|I'd|I'll|I'm|I've|me|myself|my|let's)(?=[^\w']|$)/.test(s) && !/^config:me$/.test(s) && s !== 'Follow me here:' },
  { rule: 'not-x-but-y', test: (s) => /\bnot\b[^.!?]{0,60},\s*but\b/i.test(s) || /\bit'?s not\b[^.!?]{0,80}\bit'?s\b/i.test(s) },
  { rule: 'banned-phrase', test: (s) => /credit where due|\bsimply\b|\bseamless|\brobust\b/i.test(s) },
  // Raw ISO 8601 must never be rendered (prompt 14 §4).
  { rule: 'iso-date', test: (s) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) },
  // CLAUDE.md: never promise no lockouts; the promise is predicted impact, confirmed in report-only.
  { rule: 'lockout-promise', test: (s) => /(won'?t|never|cannot|can'?t|no) (lock|lockout)/i.test(s) },
]

function isUserFacing(s: string): boolean {
  // Skip identifiers, paths, URLs, selectors, and Graph/PowerShell fragments.
  if (s.length < 3) return false
  if (/^(#\/|https?:|\/|\.|[a-z]+:[a-z]|__)/.test(s)) return false
  if (/^[\w.$/{}[\]()*=,'-]+$/.test(s) && !/\s/.test(s)) return false
  if (/Invoke-Mg|Get-Mg|Connect-Mg|\$select|\$expand|odata/.test(s)) return false
  return true
}

export function lintCopy(): Violation[] {
  const out: Violation[] = []
  for (const file of walk(join(ROOT, 'copy')).concat(walk(join(ROOT, 'ui')))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(LITERAL)) {
      const text = m[1] ?? m[2] ?? m[3] ?? ''
      if (!isUserFacing(text)) continue
      const line = src.slice(0, m.index).split('\n').length
      for (const r of RULES) {
        if (r.test(text)) out.push({ file: relative(ROOT, file), line, rule: r.rule, text: text.slice(0, 80) })
      }
    }
  }
  return out
}

test('user-facing copy has no dashes-as-punctuation, first person, AI-isms, or raw ISO dates', () => {
  const v = lintCopy()
  const report = v.map((x) => `${x.file}:${x.line} [${x.rule}] ${x.text}`).join('\n')
  assert.equal(v.length, 0, `${v.length} copy violations:\n${report}`)
})
