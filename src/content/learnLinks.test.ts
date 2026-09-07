// Every Learn link the content carries opens a page (step-audit.md C2). A
// network test: it fetches each URL and fails on anything but a 2xx; offline,
// where the first probe cannot reach Microsoft Learn at all, it is skipped.
//
// It answers a question about Microsoft Learn, not about IAMAI: a page Microsoft
// moved, a 429 from a shared runner address or a Learn outage would redden a
// check that is supposed to mean "IAMAI has a defect". So it runs only under
// EXTERNAL_HEALTH=1, which .github/workflows/external-health.yml sets, and skips
// (visibly, never silently) everywhere else. The two tests below it are pure
// content checks and always run: a step that carries no Learn link at all is
// IAMAI's own defect and stays in the core suite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { content } from './content.ts'

const urls = new Set<string>()
for (const s of content.steps) if (s.learn?.url) urls.add(s.learn.url)
for (const c of Object.values(content.cleanup)) if (c.learn?.url) urls.add(c.learn.url)

async function status(href: string): Promise<number | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 12000)
  try {
    let r = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: ctl.signal })
    if (!r.ok) r = await fetch(href, { method: 'GET', redirect: 'follow', signal: ctl.signal })
    return r.status
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

test('every Learn link answers 2xx (external health; skipped unless EXTERNAL_HEALTH=1)', async (t) => {
  if (process.env.EXTERNAL_HEALTH !== '1') {
    t.skip('external health: set EXTERNAL_HEALTH=1 (external-health.yml) to probe Microsoft Learn')
    return
  }
  if ((await status('https://learn.microsoft.com/')) === null) {
    t.skip('offline: Microsoft Learn is not reachable from here')
    return
  }
  const bad: string[] = []
  for (const href of urls) {
    const s = await status(href)
    if (s === null || s < 200 || s >= 300) bad.push(`${href} → ${s ?? 'no answer'}`)
  }
  assert.deepEqual(bad, [], `Learn link(s) that do not open a page:\n${bad.join('\n')}`)
})

test('every step and every Cleanup row has a Learn link', () => {
  const missing = [...content.steps.filter((s) => !s.learn?.url).map((s) => s.id), ...Object.entries(content.cleanup).filter(([, c]) => !c.learn?.url).map(([k]) => `cleanup.${k}`)]
  assert.deepEqual(missing, [])
})

test('no step carries a CIS value on its Learn link (step-audit.md C1: frameworks are not a chip)', () => {
  const withCis = content.steps.filter((s) => s.learn && 'cis' in (s.learn as Record<string, unknown>)).map((s) => s.id)
  assert.deepEqual(withCis, [])
})
