// The (i)'s open state (F-091): hover and focus show it while they last; a
// press keeps it open until the next press, Esc or a press elsewhere.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TIP_CLOSED, tipNext } from './tipState.ts'
import type { TipEvent, TipState } from './tipState.ts'

const run = (...events: TipEvent[]): TipState => events.reduce(tipNext, TIP_CLOSED)

test('a click after a hover keeps the tip open, and moving away leaves it open', () => {
  // Before F-091 the hover opened it and the click closed it.
  assert.deepEqual(run('hover', 'press'), { open: true, pinned: true })
  assert.deepEqual(run('hover', 'press', 'leave'), { open: true, pinned: true })
  // The second click closes it.
  assert.deepEqual(run('hover', 'press', 'press'), TIP_CLOSED)
})

test('hover alone shows the tip while the pointer stays', () => {
  assert.deepEqual(run('hover'), { open: true, pinned: false })
  assert.deepEqual(run('hover', 'leave'), TIP_CLOSED)
})

test('Enter on a focused tip keeps it open; Enter again, Esc or a press elsewhere closes it', () => {
  // Focus shows it; the keyboard press (a click with detail 0) used to close it.
  assert.deepEqual(run('focus'), { open: true, pinned: false })
  assert.deepEqual(run('focus', 'press'), { open: true, pinned: true })
  assert.deepEqual(run('focus', 'press', 'blur'), { open: true, pinned: true })
  assert.deepEqual(run('focus', 'press', 'press'), TIP_CLOSED)
  assert.deepEqual(run('focus', 'press', 'escape'), TIP_CLOSED)
  assert.deepEqual(run('hover', 'press', 'outside'), TIP_CLOSED)
  // Tabbing past without a press closes it as before.
  assert.deepEqual(run('focus', 'blur'), TIP_CLOSED)
})

test('a tap (focus, then click) opens the tip and a second tap closes it', () => {
  assert.deepEqual(run('focus', 'press'), { open: true, pinned: true })
  assert.deepEqual(run('focus', 'press', 'press'), TIP_CLOSED)
})
