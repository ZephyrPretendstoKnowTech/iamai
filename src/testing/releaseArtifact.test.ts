import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { artifactProof, verifyArtifact } from '../../scripts/release-artifact.mjs'
import { TOOL_PATH } from '../../scripts/toolPath.ts'

test('release artifacts require the tested commit and exactly the validated site bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'iamai-release-proof-'))
  try {
    mkdirSync(join(root, TOOL_PATH))
    writeFileSync(join(root, 'index.html'), 'home')
    writeFileSync(join(root, TOOL_PATH, 'index.html'), 'planner')
    const sha = 'a'.repeat(40)
    const proof = artifactProof(root, sha)
    assert.equal(verifyArtifact(root, proof, sha), true)
    assert.throws(() => verifyArtifact(root, proof, 'b'.repeat(40)), /do not match/)
    writeFileSync(join(root, 'index.html'), 'changed')
    assert.throws(() => verifyArtifact(root, proof, sha), /do not match/)
    writeFileSync(join(root, 'index.html'), 'home')
    writeFileSync(join(root, 'extra.txt'), 'unexpected')
    assert.throws(() => verifyArtifact(root, proof, sha), /do not match/)
    rmSync(join(root, 'extra.txt'))
    rmSync(join(root, TOOL_PATH, 'index.html'))
    assert.throws(() => verifyArtifact(root, proof, sha), /incomplete/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
