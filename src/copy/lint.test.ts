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

export type Violation = { file: string; line: number; rule: string; text: string; hint?: string }

/** Strings that are the author speaking, not the product (ux-review-05 §30). */
const AUTHOR_VOICE = new Set([
  'Follow me here:',
  'Something wrong or unclear? Tell me.',
  'Tell me what is wrong',
  'This tool is only useful if it is accurate. If something looks wrong, I want to know.',
  'Nothing is sent from here. Your mail app opens with the text above, and you decide whether to send it.',
])

/**
 * Verbs that begin an instruction. A colon in front of one of these is an em
 * dash wearing a disguise (review-07 C13, review-08 F, prompt 40 §23): the
 * dash lint pushed authors to a colon, and a colon between a fact and an
 * instruction splices two unrelated things. A colon that introduces an
 * explanation, a list or a label is correct English and stays allowed, which is
 * why the rule tests what follows the colon rather than banning the character.
 */
const IMPERATIVE =
  /^(ask|assume|stop|run|verify|check|move|exclude|create|enforce|register|upgrade|issue|walk|leave|keep|start|add|treat|fix|confirm|use|give|send|tell|make|set|put|see|read|open|copy|paste|pick|choose|remove|delete|disable|enable|follow|review|contact|call|email|apply|expect|plan|note|do not|don't)\b/i

function colonSplice(s: string): boolean {
  for (const c of s.matchAll(/: /g)) {
    const left = s.slice(0, c.index)
    const right = s.slice(c.index + 2)
    if (left.trim().split(/\s+/).filter(Boolean).length >= 4 && IMPERATIVE.test(right)) return true
  }
  return false
}

const RULES: { rule: string; test: (s: string) => boolean; hint?: string }[] = [
  // An en dash between digits is a range (2–4 weeks), not punctuation.
  { rule: 'dash', test: (s) => /—/.test(s) || /(?<!\d)–|–(?!\d)/.test(s) },
  // The footer is the author's own voice by agreement (ux-review-05 §30), not IAMAI's.
  // The footer and the feedback panel are the author's own voice by agreement
  // (ux-review-05 §30), not IAMAI's. Everything else stays third person.
  { rule: 'first-person', test: (s) => /(^|[^\w'])(I|I'd|I'll|I'm|I've|me|myself|my|let's)(?=[^\w']|$)/.test(s) && !/^config:me$/.test(s) && !AUTHOR_VOICE.has(s) },
  { rule: 'not-x-but-y', test: (s) => /\bnot\b[^.!?]{0,60},\s*but\b/i.test(s) || /\bit'?s not\b[^.!?]{0,80}\bit'?s\b/i.test(s) },
  { rule: 'banned-phrase', test: (s) => /credit where due|\bsimply\b|\bseamless|\brobust\b/i.test(s) },
  // Raw ISO 8601 must never be rendered (prompt 14 §4).
  { rule: 'iso-date', test: (s) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) },
  // CLAUDE.md: never promise no lockouts; the promise is predicted impact, confirmed in report-only.
  { rule: 'lockout-promise', test: (s) => /(won'?t|never|cannot|can'?t|no) (lock|lockout)/i.test(s) },
  {
    rule: 'colon-splice',
    test: colonSplice,
    hint: 'a colon between a fact and an instruction is an em dash in disguise. Write two sentences, or join them with "so".',
  },
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
        if (r.test(text)) out.push({ file: relative(ROOT, file), line, rule: r.rule, text: text.slice(0, 80), hint: r.hint })
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
