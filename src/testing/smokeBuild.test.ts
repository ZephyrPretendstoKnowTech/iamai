// The smoke runs against its own production build (scripts/smokeBuild.ts), not
// the dev server: on a CI runner Chrome refused the dev server's hundreds of
// unbundled modules (net::ERR_INSUFFICIENT_RESOURCES) and the Plan never drew on
// some runs. The synthetic tenant that build keeps must never reach the site
// that is published.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SMOKE_MODE, smokeOutDir } from '../../scripts/smokeBuild.ts'
import { TOOL_PATH } from '../../scripts/toolPath.ts'

const read = (path: string) => readFileSync(path, 'utf8')

test('the synthetic tenant is compiled in for the dev server and the smoke build only, never the published bundle', () => {
  const config = read('vite.config.ts')
  assert.match(config, /__MOCK_TENANT__: JSON\.stringify\(command === 'serve' \|\| mode === SMOKE_MODE\)/)
  // The mock is read from that flag alone: nothing else can switch it on in a build.
  assert.match(read('src/ui/App.tsx'), /const MOCK =\s*__MOCK_TENANT__ &&\s*new URLSearchParams\(window\.location\.search\)\.get\('dev'\) === '1' &&/)
  // No published build asks for the smoke mode.
  for (const file of ['package.json', '.github/workflows/deploy-pages.yml', '.github/workflows/ci.yml', 'scripts/assemble-site.mjs']) {
    assert.doesNotMatch(read(file), new RegExp(`--mode[ =]${SMOKE_MODE}\\b`), `${file} builds in the smoke mode`)
  }
})

test('the smoke build is written outside dist/, a folder per port, so it cannot be published and two smokes do not collide', () => {
  assert.equal(smokeOutDir(5199), `dist-smoke/5199/${TOOL_PATH}`)
  assert.notEqual(smokeOutDir(5199), smokeOutDir(5289))
  assert.ok(!smokeOutDir(5199).startsWith('dist/'))
  assert.match(read('vite.config.ts'), /mode === SMOKE_MODE\s*\? \{ outDir: smokeOutDir\(Number\(process\.env\.SMOKE_PORT\) \|\| 0\),/)
  assert.match(read('.gitignore'), /^dist-smoke\/$/m)
})
