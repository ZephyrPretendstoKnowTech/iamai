// Loading a plan file over recorded work asks first, and says what came back (F-023).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { asksBeforeLoading, holdsOf, loadConfirmText, loadedText } from './planFileLoad.ts'

const drill = { cleanup: 'drill', date: '2026-09-18' }
const record = { planId: 'p', skips: { 's-a': { reason: 'Not licensed yet' } }, checkpoints: [drill, { kind: 'save' }], stepDecisions: { 's-b': {}, 's-c': {}, 's-d': {} } } as never

test('a record holds the answers, deferrals and Cleanup items a person recorded, and nothing else', () => {
  assert.deepEqual(holdsOf(record), { decisions: 3, deferred: 1, cleanup: 1 })
  assert.deepEqual(holdsOf(null), { decisions: 0, deferred: 0, cleanup: 0 })
  // Over a browser holding recorded work the page asks; over one holding none there is nothing to lose.
  assert.equal(asksBeforeLoading(record), true)
  assert.equal(asksBeforeLoading({ planId: 'p', skips: {}, checkpoints: [{ kind: 'save' }] } as never), false)
  assert.equal(asksBeforeLoading(null), false)
})

test('the confirm says the file\'s day, what it holds and whose record it replaces, and the Plan says which file came back', () => {
  assert.equal(
    loadConfirmText({ savedAt: '2026-09-20T10:00:00Z', holds: { decisions: 3, deferred: 1, cleanup: 2 }, tenant: 'Contoso' }),
    'This plan file was saved Sep 20, 2026. It holds 3 answered decisions, 1 deferred step and 2 Cleanup items marked done. Loading it replaces what this browser holds for Contoso.',
  )
  assert.equal(
    loadConfirmText({ savedAt: '2026-09-20T10:00:00Z', holds: { decisions: 1, deferred: 0, cleanup: 1 }, tenant: 'Contoso' }),
    'This plan file was saved Sep 20, 2026. It holds 1 answered decision and 1 Cleanup item marked done. Loading it replaces what this browser holds for Contoso.',
  )
  assert.match(loadConfirmText({ savedAt: '2026-09-20T10:00:00Z', holds: { decisions: 0, deferred: 0, cleanup: 0 }, tenant: 'Contoso' }), /It holds no answers, deferrals or Cleanup items marked done\./)
  assert.equal(loadedText('2026-09-20T10:00:00Z'), 'Loaded the plan file saved Sep 20, 2026.')
})

test('Export replaces the record only from Replace or over a browser holding nothing, and the Plan leads with the loaded file', () => {
  const page = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
  const check = page.slice(page.indexOf('const loadPlanInner'), page.indexOf('const replaceWith'))
  assert.match(check, /if \(asksBeforeLoading\(data\.recordForExport\)\) \{\n\s+setPendingLoad\(load\)\n\s+return\n\s+\}\n\s+await replaceWith\(load\)/)
  assert.equal(check.includes('importPlanRecords'), false, 'the checks no longer replace anything themselves')
  assert.match(page, /<Button variant="secondary" autoFocus onClick=\{\(\) => setPendingLoad\(null\)\}>\{app\.shell\.forgetCancel\}<\/Button>/)
  assert.match(page, /noticeForPlan\(loadedText\(load\.savedAt\)\)\n\s+window\.location\.hash = '#\/plan'/)
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const \[changeLine, setChangeLine\] = useState<string \| null>\(notice\)/)
})
