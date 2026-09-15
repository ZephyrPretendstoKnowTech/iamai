import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { TOOL_PATH } from './toolPath.ts'

export function artifactProof(root, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('An exact commit SHA is required')
  const files = {}
  function visit(relative = '') {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) throw new Error(`Artifact symlink refused: ${path}`)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile()) files[path] = createHash('sha256').update(readFileSync(join(root, path))).digest('hex')
      else throw new Error(`Unexpected artifact entry: ${path}`)
    }
  }
  visit()
  if (!files['index.html'] || !files[`${TOOL_PATH}/index.html`]) throw new Error('Site artifact is incomplete')
  return { sha, files }
}

export function verifyArtifact(root, proof, sha) {
  const actual = artifactProof(root, sha)
  if (proof.sha !== sha || JSON.stringify(actual.files) !== JSON.stringify(proof.files)) throw new Error('Artifact commit or contents do not match the validated build')
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, sha] = process.argv.slice(2)
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (head !== sha) throw new Error('Checkout does not match the release commit')
  if (mode === 'create') writeFileSync('release-proof.json', JSON.stringify(artifactProof('dist', sha)))
  else if (mode === 'verify') verifyArtifact('dist', JSON.parse(readFileSync('release-proof.json', 'utf8')), sha)
  else throw new Error('Usage: node scripts/release-artifact.mjs create|verify <commit SHA>')
  console.log(`Release artifact ${mode}: ${sha}`)
}
