// Email audiences (correction batch 2.1): an Email's audience is the author's, or it
// is established by the Email's own words — a salutation, a role it names, the
// thing its reader owns or does, or the decision it asks for. Nothing assigns a
// recipient the text does not establish; an Email whose text names nobody is
// withheld until it is authored.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packageDirs, packageSources } from './library.ts'
import { normalizePackage, parseBlocks, validatePackage } from './protocol.ts'
import type { Block, PackageMeta } from './protocol.ts'

/** Emails whose text establishes no single recipient: withheld until authored (package → block). */
const NEEDS_AUTHORING: Readonly<Record<string, readonly string[]>> = {
  's-goal-mfa-all-users': ['email.rollout'],
  's-prereq-auth-strength': ['email.admin-change'],
}

function library(): { meta: PackageMeta; source: Record<string, Block>; normal: ReturnType<typeof normalizePackage> }[] {
  // Every package, a task a folder folds in included (library.ts packageSources).
  return packageDirs().flatMap(packageSources).map(({ metaJson, content }) => {
    const meta = JSON.parse(metaJson) as PackageMeta
    const source = parseBlocks(content)
    return { meta, source, normal: normalizePackage(meta, source) }
  })
}

test('an Email withheld for authoring is refused by the validator, so it is never shown with a guessed recipient', () => {
  for (const { meta, normal } of library()) {
    for (const id of NEEDS_AUTHORING[meta.stepId] ?? []) {
      const errors = validatePackage({ meta: normal.meta, blocks: normal.blocks }).filter((e) => e.includes('audience') && Object.entries(normal.meta.projection).some(([, p]) => JSON.stringify(p ?? {}).includes(`"${id}"`)))
      assert.ok(errors.length > 0, `${meta.stepId}: ${id} validates without an audience`)
    }
  }
})
