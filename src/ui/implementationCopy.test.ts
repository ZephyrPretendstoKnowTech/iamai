// Copy on an implementation artifact copies the artifact (owner decision: a
// copied JSON body, script or procedure stays technically valid; preview and
// Copy are the same artifact). Every other export path keeps its redaction.
//
// The copied text is read through the real guard (exportGuard.ts) from the real
// projection of the active package (content/implementation/project.ts), so what
// this proves is the path the Implementation viewer takes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REDACTED, exportClipboard, unredactedFrom } from './exportGuard.ts'
import { compilePackage } from '../content/implementation/protocol.ts'
import { projectImplementation } from '../content/implementation/project.ts'
import type { PackageState } from '../content/implementation/project.ts'
import { PILOT_IDS, PILOT_STEP_ID, pilotBindings, pilotRuntime } from '../testing/pilotFixture.ts'

const DIR = `docs/implementation-content/${PILOT_STEP_ID}`
const PKG = compilePackage(readFileSync(`${DIR}/META.json`, 'utf8'), readFileSync(`${DIR}/CONTENT.md`, 'utf8'))
/** Microsoft's built-in Multifactor authentication strength: a public constant, never tenant data. */
const BUILT_IN_MFA = '00000000-0000-0000-0000-000000000002'

async function copyThrough(text: string, disposition: Parameters<typeof exportClipboard>[1]): Promise<string | null> {
  let written: string | null = null
  Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void (written = t) } })
  const ok = await exportClipboard(text, disposition)
  assert.equal(ok, true)
  return written
}

const ARTIFACT = unredactedFrom('implementation-artifact')
const text = (state: PackageState, channel: string): string => {
  const c = projectImplementation(PKG, state, pilotBindings(state), pilotRuntime()).channels.find((x) => x.channel === channel)
  assert.ok(c, `${state} projects no ${channel}`)
  return c.text
}

test('a copied JSON body is the projected body: valid JSON with the tenant ids and Microsoft constants in it', async () => {
  const body = text('missing', 'json')
  const out = await copyThrough(body, ARTIFACT)
  assert.equal(out, body, 'Copy changed the artifact the viewer shows')
  const parsed = JSON.parse(out ?? '') as { conditions: { users: { excludeGroups: string[] } }; grantControls: { authenticationStrength: { id: string } } }
  assert.deepEqual(parsed.conditions.users.excludeGroups, [PILOT_IDS.exclusions])
  assert.equal(parsed.grantControls.authenticationStrength.id, BUILT_IN_MFA)
  assert.doesNotMatch(out ?? '', /guid-\d{4}|upn-\d+@redacted/, 'a placeholder replaced a value the request needs')
})

test('a copied script keeps its constants, and AI Info keeps its tenant context and its warning', async () => {
  const script = text('readyToEnforce', 'powershell')
  const copiedScript = await copyThrough(script, ARTIFACT)
  assert.equal(copiedScript, script)
  assert.match(copiedScript ?? '', new RegExp(`\\$StrengthId = '${BUILT_IN_MFA}'`))
  const ai = text('readyToEnforce', 'aiInfo')
  const copiedAi = await copyThrough(ai, ARTIFACT)
  assert.equal(copiedAi, ai)
  assert.match(copiedAi ?? '', new RegExp(`Policy ID: ${PILOT_IDS.policy}`))
  assert.match(copiedAi ?? '', /Contains tenant context/)
  const email = text('readyToEnforce', 'email')
  assert.equal(await copyThrough(email, ARTIFACT), email, 'the Email is not copied as authored')
})

test('every other export keeps its redaction: the same body through the default disposition is masked', async () => {
  const body = text('missing', 'json')
  const redacted = await copyThrough(body, REDACTED)
  assert.notEqual(redacted, body)
  assert.doesNotMatch(redacted ?? '', new RegExp(PILOT_IDS.exclusions))
  assert.match(redacted ?? '', /guid-0001/)
})

test('only the Implementation region copies as an artifact; the copy boxes under More stay redacted', () => {
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.equal(step.split("unredactedFrom('implementation-artifact')").length - 1, 1, 'the artifact disposition is claimed from more than one place')
  assert.match(step, /<Implementation[\s\S]*?copy=\{copyArtifact\}/)
  assert.match(step, /<More[\s\S]*?copy=\{copy\}/, 'More no longer copies through the redacting disposition')
  // The warning the AI channel carries is the one the disposition names.
  assert.equal(step.split("{tab === 'ai' && (").length - 1, 2)
})
