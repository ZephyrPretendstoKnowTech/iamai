// Page tips: a collapse survives a reload (the store outlives the component).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTipCollapsed, tipCollapsed } from './tipState.ts'
import type { TipStore } from './tipState.ts'

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
