// Page tips: every surface renders its tip once, from the content file, and a
// collapse survives a reload (the store outlives the component).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setTipCollapsed, tipCollapsed } from './tipState.ts'
import type { TipStore } from './tipState.ts'
import { pages } from '../content/content.ts'

const memory = (): TipStore => {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

test('a collapsed tip survives a reload, and the ? reopens it', () => {
  const store = memory()
  assert.equal(tipCollapsed('plan', store), false, 'open until collapsed')
  setTipCollapsed('plan', true, store)
  // A reload: a fresh read against the same browser store.
  assert.equal(tipCollapsed('plan', store), true, 'still collapsed after a reload')
  assert.equal(tipCollapsed('readiness', store), false, 'remembered per page')
  setTipCollapsed('plan', false, store)
  assert.equal(tipCollapsed('plan', store), false, 'reopened')
  assert.equal(tipCollapsed('plan', null), false, 'no store: open')
})

test('Export renders its tip once, from its own content key; MFA Readiness, the Plan and the step render none', () => {
  const tip = String((pages.export as Record<string, unknown>).tip)
  assert.ok(tip.length > 0, 'export: the content file has a tip')
  const renders = readFileSync('src/ui/surfaces/Export.tsx', 'utf8').match(/<PageTip page="export"/g) ?? []
  assert.equal(renders.length, 1, 'src/ui/surfaces/Export.tsx renders its tip once')
  // MFA Readiness's v3 pack has no tip: the answer's definition line says what Ready means (prompt 62).
  assert.ok(!('tip' in (pages.readiness as Record<string, unknown>)), 'pages.readiness carries no tip')
  assert.match((pages.readiness as unknown as { define: string }).define, /^Ready means /, 'the definition line no longer says what Ready means')
  assert.match(readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8'), /<p className="define">\{T\.define\}<\/p>/, 'the page does not draw the definition line')
  for (const file of ['src/ui/surfaces/MfaReadiness.tsx', 'src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/ContentStep.tsx']) assert.ok(!/<PageTip/.test(readFileSync(file, 'utf8')), `${file} renders no tip`)
})
