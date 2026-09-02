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
  assert.equal(tipCollapsed('today', store), false, 'remembered per page')
  setTipCollapsed('plan', false, store)
  assert.equal(tipCollapsed('plan', store), false, 'reopened')
  assert.equal(tipCollapsed('plan', null), false, 'no store: open')
})

test('every surface renders its tip once, from its own content key', () => {
  const surfaces: [string, string, string][] = [
    ['src/ui/surfaces/Plan.tsx', 'plan', String((pages.plan as Record<string, unknown>).tip)],
    ['src/ui/surfaces/Today.tsx', 'today', String((pages.today as Record<string, unknown>).tip)],
    ['src/ui/surfaces/Export.tsx', 'export', String((pages.export as Record<string, unknown>).tip)],
    ['src/ui/surfaces/ContentStep.tsx', 'step', String(pages.stepTip)],
  ]
  for (const [file, page, tip] of surfaces) {
    assert.ok(tip.length > 0, `${page}: the content file has a tip`)
    const src = readFileSync(file, 'utf8')
    const renders = src.match(new RegExp(`<PageTip page="${page}"`, 'g')) ?? []
    assert.equal(renders.length, 1, `${file} renders its tip once`)
  }
})
