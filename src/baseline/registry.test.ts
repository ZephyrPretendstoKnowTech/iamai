// The baseline registry (v2.0 prep, Phase A item 1): the one module in src/ that
// imports a baseline's files, so a second curated baseline is one more entry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BASELINES, DEFAULT_BASELINE, DEFAULT_BASELINE_ID, baselineById } from './registry.ts'
import { PINNED } from './pinned.ts'
import { PINNED_BASELINE } from '../ui/baseline.ts'

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name).split('\\').join('/')
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

test('no module in src/ but the registry imports a baseline file', () => {
  const offenders = sources('src').filter((f) => f !== 'src/baseline/registry.ts' && /from ['"][./]*baselines\/[^'"]+\.json['"]/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [])
})

test("one curated baseline today, Jon Hope's, and every reader of the pin reads it through the registry", () => {
  assert.deepEqual(Object.keys(BASELINES), ['jhope188'])
  assert.equal(DEFAULT_BASELINE_ID, 'jhope188')
  assert.equal(DEFAULT_BASELINE.label, 'Defense in Depth — Maintained by Jon Hope')
  assert.equal(PINNED.commit, DEFAULT_BASELINE.pinned.commit)
  assert.equal(PINNED_BASELINE.label, DEFAULT_BASELINE.label)
  assert.equal(PINNED_BASELINE.commit, DEFAULT_BASELINE.index.commit)
  assert.equal(baselineById('jhope188'), DEFAULT_BASELINE)
  assert.equal(baselineById('someone-else'), null)
  assert.equal(baselineById('toString'), null)
})
