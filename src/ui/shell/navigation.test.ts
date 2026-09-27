// Moving around IAMAI behaves like a website (F-051, F-147): Back undoes the
// step you opened, and another page starts at its top.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { opensAtTop, visitStep } from './routes.ts'

test('opening or closing a step adds a history entry, so Back undoes it (F-051)', () => {
  const pushed: string[] = []
  const history = { pushState: (_data: unknown, _unused: string, url?: string | URL | null) => { pushed.push(String(url)) } }
  visitStep(history, 's-prereq-break-glass')
  visitStep(history, null)
  assert.deepEqual(pushed, ['#/plan/s-prereq-break-glass', '#/plan'])

  // The Plan's row press goes through it: a replaced entry is what sent Back out of IAMAI.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  const start = plan.indexOf('const openStep = ')
  const openStep = plan.slice(start, plan.indexOf('\n  }\n', start))
  assert.match(openStep, /visitStep\(window\.history, next\)/)
  assert.doesNotMatch(openStep, /replaceState/)
})

test('another page starts at its top; a change inside a page keeps the place (F-147)', () => {
  assert.equal(opensAtTop('plan', 'readiness'), true)
  assert.equal(opensAtTop('readiness', 'inventory'), true)
  assert.equal(opensAtTop('export', 'plan'), true)
  // A step opening or closing, and a Readiness filter, stay where the reader is.
  assert.equal(opensAtTop('plan', 'plan'), false)
  assert.equal(opensAtTop('readiness', 'readiness'), false)

  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(shell, /if \(opensAtTop\(shown\.current, next\)\) window\.scrollTo\(0, 0\)/)
})
