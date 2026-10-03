// The build channel (scripts/channel.ts, docs/plans/v1.1/plan.md P0-5). With
// VITE_CHANNEL unset the published build must be byte-identical to one made
// before the flag existed. The build's bytes come from three places, and each
// is held here: the planner's index.html (the only page the flag transforms),
// the bundle (no module may read the flag, so Vite inlines nothing for it), and
// the assembled site root (the home page and CNAME).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CHANNELS, channelOf, withChannel } from '../scripts/channel.ts'

const read = (path: string) => readFileSync(path, 'utf8')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|js|mjs|css|html)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : []
  })
}

test('with VITE_CHANNEL unset the build is byte-identical: no channel, every page untouched, no source reads the flag', () => {
  assert.equal(channelOf(undefined), null)
  assert.equal(channelOf(''), null)
  // Every page the build writes passes through withChannel unchanged, byte for byte.
  for (const page of ['index.html', 'home/index.html']) {
    const html = read(page)
    assert.equal(withChannel(html, null), html, `${page} changes with no channel`)
  }
  // The bundle: Vite inlines import.meta.env.VITE_* only where a module reads it.
  // No module does, so the JavaScript is the same with or without the flag.
  for (const file of sourceFiles('src')) {
    assert.doesNotMatch(read(file), /VITE_CHANNEL/, `${file} reads the channel, so the bundle would carry it`)
  }
  // The build reads the flag in exactly two places, each through channelOf and
  // withChannel, and puts nothing in define.
  const config = read('vite.config.ts')
  assert.match(config, /withChannel\(html, channelOf\(process\.env\.VITE_CHANNEL\)\)/)
  assert.doesNotMatch(config.slice(config.indexOf('define:'), config.indexOf('base:')), /CHANNEL/, 'the flag is defined into the bundle')
  const assemble = read('scripts/assemble-site.mjs')
  assert.match(assemble, /const channel = channelOf\(process\.env\.VITE_CHANNEL\)/)
  assert.match(assemble, /if \(channel === null\) cpSync\(join\(root, 'public', 'CNAME'\), join\(dist, 'CNAME'\)\)/, 'an unset channel no longer publishes CNAME')
  assert.match(assemble, /else rmSync\(join\(dist, 'CNAME'\), \{ force: true \}\)/, 'a preview keeps a CNAME left by an earlier build')
})

test('a preview build says so in the title, the banner and to search engines, and an unknown channel stops the build', () => {
  assert.deepEqual([...CHANNELS], ['preview'])
  assert.equal(channelOf('preview'), 'preview')
  assert.throws(() => channelOf('beta'), /unknown channel "beta"/)
  const page = '<html><head><title>IAMAI — Microsoft Entra Planner</title></head><body><div id="root"></div></body></html>'
  const marked = withChannel(page, 'preview')
  assert.match(marked, /<title>IAMAI — Microsoft Entra Planner \(Preview\)<\/title>/)
  assert.match(marked, /<meta name="robots" content="noindex, nofollow" \/>\s*<\/head>/)
  assert.match(marked, /<body>\s*<div role="note" data-channel="preview"[^>]*>Preview of the next IAMAI Planner\./)
  assert.ok(marked.indexOf('data-channel') < marked.indexOf('id="root"'), 'the banner sits above the app')
  assert.throws(() => withChannel('<html><body></body></html>', 'preview'), /no <title>/)
})
