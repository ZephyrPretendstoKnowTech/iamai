// R3 (docs/plans/v1-resolution-plan.md): whatever the script refuses to do, the
// portal procedure must refuse in words, at the point of action.
//
// The PowerShell channel hard-codes `enabledForReportingButNotEnforced` on create
// and refuses enforcement on named conditions; the JSON channel ships report-only
// with every narrowing condition intact. The Entra channel is the path a
// portal-fluent administrator always takes, and it carried none of that: one
// sentence saying report-only is what to pick, and an enforce procedure that said
// "change Enable policy to On".
//
// These are rules over the whole library, not assertions per package. Each
// package's own script is the specification: the gates the test demands of the
// Entra procedure are read off that package's `powershell.run`, so a package that
// adds or drops a refusal moves its own requirement with it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileLibrary } from './library.ts'
import type { LibraryPackage } from './library.ts'
import type { Block, CompiledPackage } from './protocol.ts'

const LIBRARY = compileLibrary()
const ALL: LibraryPackage[] = [...LIBRARY.registered, ...LIBRARY.notSteps]

const REPORT_ONLY = 'enabledForReportingButNotEnforced'

const blocksOf = (pkg: CompiledPackage, channel: string): Block[] =>
  Object.values(pkg.blocks).filter((b) => b.meta.channel === channel)
const inState = (blocks: Block[], state: string): Block[] =>
  blocks.filter((b) => (b.meta.states ?? []).includes(state))

/** The block that POSTs a new Conditional Access policy, or null: what makes a package a policy-create package. */
function policyCreateBody(pkg: CompiledPackage): Block | null {
  for (const b of blocksOf(pkg, 'json')) {
    if (b.meta.method !== 'POST') continue
    if (!/conditionalAccess\/policies$/.test(String(b.meta.endpoint ?? ''))) continue
    return b
  }
  return null
}

/** The Entra procedure for a state, as one text (a state's blocks render together). */
function entraText(pkg: CompiledPackage, state: string): string {
  return inState(blocksOf(pkg, 'entra'), state).map((b) => b.text).join('\n')
}

/** The package's script, or null. */
function script(pkg: CompiledPackage): string | null {
  const b = blocksOf(pkg, 'powershell')[0]
  return b ? b.text : null
}

/** The part of the script that runs in its Enforce/EnforceCA mode. */
function enforcePath(text: string): string {
  const from = text.search(/'Enforce(CA)?'\s*\{|\$Mode\s+-eq\s+'Enforce(CA)?'/)
  return from === -1 ? '' : text.slice(from)
}

// ---------------------------------------------------------------------------
// Rule 1 — create: every channel creates in report-only, and the Entra procedure
// says so at its enable line, with the reason turning it on now is the failure.
// ---------------------------------------------------------------------------

const CREATES = ALL.filter((p) => policyCreateBody(p.source) !== null)

test('every package that creates a Conditional Access policy ships one, and only report-only creates', () => {
  assert.ok(CREATES.length >= 25, `policy-create packages found: ${CREATES.length}`)
  for (const p of CREATES) {
    // The JSON channel: every create body, not only the first.
    for (const b of blocksOf(p.source, 'json')) {
      if (b.meta.method !== 'POST') continue
      if (!/conditionalAccess\/policies$/.test(String(b.meta.endpoint ?? ''))) continue
      const states = [...b.text.matchAll(/"state"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
      assert.ok(states.length > 0, `${p.stepId} ${b.meta.id}: a create body states no lifecycle`)
      for (const s of states) assert.equal(s, REPORT_ONLY, `${p.stepId} ${b.meta.id}: create body ships ${s}`)
    }
    // The PowerShell channel: the create path names report-only and nothing else.
    const ps = script(p.source)
    if (ps === null) continue
    const created = [...ps.matchAll(/state\s*=\s*'([^']+)'/g)].map((m) => m[1])
    assert.ok(created.includes(REPORT_ONLY), `${p.stepId}: the script never creates in report-only`)
    for (const s of created) assert.ok(s === REPORT_ONLY || s === 'enabled', `${p.stepId}: the script writes state ${s}`)
  }
})

test('every create procedure refuses On at its enable line, in the Entra channel', () => {
  const missing: string[] = []
  for (const p of CREATES) {
    const text = entraText(p.source, 'missing')
    if (text.length === 0) { missing.push(`${p.stepId}: no Entra create procedure`); continue }
    // The line where the administrator sets the lifecycle.
    const enable = text
      .split('\n')
      .filter((l) => /Enable policy|in \*\*Report-only\*\*|in Report-only/i.test(l))
    if (enable.length === 0) { missing.push(`${p.stepId}: no enable line`); continue }
    const at = enable.join(' ')
    if (!/Report-only/i.test(at)) missing.push(`${p.stepId}: the enable line does not name Report-only`)
    // Not "report-only is recommended": the reason On is the failure, at that line.
    if (!/Do not choose \*\*On\*\* here/.test(at)) missing.push(`${p.stepId}: the enable line does not refuse On`)
    if (!/before anyone has seen who it would have stopped/.test(at)) missing.push(`${p.stepId}: the enable line does not say why On is the failure`)
    if (!/can only create in Report-only/.test(at)) missing.push(`${p.stepId}: the enable line does not carry the script's own refusal`)
  }
  assert.deepEqual(missing, [])
})

// ---------------------------------------------------------------------------
// Rule 2 — enforce: the Entra procedure names, where the administrator is about
// to flip it, the conditions this package's own script refuses on.
// ---------------------------------------------------------------------------

/** The enforce procedure of a package that turns a policy on, or null. */
function enforceProcedure(pkg: CompiledPackage): string | null {
  const text = entraText(pkg, 'readyToEnforce')
  if (text.length === 0) return null
  return /Enable policy|from Report-only to|to \*\*On\*\*|policy to \*\*On\*\*|set it to On|policy on/i.test(text) ? text : null
}

const ENFORCERS = ALL.map((p) => ({ p, text: enforceProcedure(p.source) })).filter((x) => x.text !== null) as { p: LibraryPackage; text: string }[]

test('every enforce procedure names the conditions the script refuses on', () => {
  assert.ok(ENFORCERS.length >= 25, `enforce procedures found: ${ENFORCERS.length}`)
  const missing: string[] = []
  const fired = { reportOnly: 0, drift: 0, attested: 0, people: 0 }
  for (const { p, text } of ENFORCERS) {
    const ps = script(p.source) ?? ''
    const path = enforcePath(ps)

    // Gate A — the script reads the policy back and refuses unless it is still
    // report-only immediately before the change.
    const refusesNotReportOnly = /Report-only immediately before|not Report-only|must be Report-only/i.test(path)
    if (refusesNotReportOnly) fired.reportOnly++
    if (refusesNotReportOnly && !/still Report-only/i.test(text)) missing.push(`${p.stepId}: does not say the policy must still be Report-only`)

    // Gate B — the script refuses unless the policy still matches the canonical
    // target (its conditions, grant and session controls, exclusions included).
    const refusesDrift = /canonical target|Assert-Canonical|Canonical\b|mismatch/i.test(path)
    if (refusesDrift) fired.drift++
    if (refusesDrift) {
      if (!/still match(es)? the intended target|match the intended settings|still matches the intended/i.test(text))
        missing.push(`${p.stepId}: does not say the settings must still match the intended target`)
      // The refusal is named as a refusal, not offered as advice.
      if (!/refuses to enforce/.test(text)) missing.push(`${p.stepId}: does not say the script refuses`)
    }

    // Gate C — the observation window. Some scripts hold it as a human
    // attestation IAMAI cannot supply (-ReadinessApproved and its siblings, so
    // the Enforce mode is withheld); for the rest it is the product's own gate
    // (shared.policyDoneWhen). Either way a procedure that turns a policy on
    // states it before the flip.
    const attested = /\$(Readiness|MfaRegistration|Hybrid\w*|Enrollment\w*|Workflow\w*|IdentityTypes|Compatibility\w*|Unsupported\w*|TrustedLocation\w*|ReportOnlyEvidence|CurrentEgressAddress|GuestExternalScope)\w*\b/.test(path)
      || Object.keys((p.source.meta.invocation as { withheldModes?: Record<string, string> } | undefined)?.withheldModes ?? {}).some((m) => /^Enforce/.test(m))
    if (attested) fired.attested++
    if (!/required report-only period is complete/.test(text)) missing.push(`${p.stepId}: does not require the report-only period to be complete`)
    if (!/no failures on (this policy|these policies) in the sign-in records/.test(text)) missing.push(`${p.stepId}: does not require the sign-in records to be clear`)
    if (!/leave (the policy|both) in Report-only/.test(text)) missing.push(`${p.stepId}: does not say what to do when a condition is not met`)

    // Emergency access is a property of the tenant, not of the policy's
    // lifecycle (R2): a policy that reaches people is not enforced before it is
    // prepared and tested. A workload-identity policy reaches no person, so it
    // makes no such claim.
    const reachesPeople = !/includeServicePrincipals|clientApplications/.test(policyCreateBody(p.source)?.text ?? '')
    if (reachesPeople) fired.people++
    if (reachesPeople && !/Emergency access is prepared and tested/.test(text))
      missing.push(`${p.stepId}: does not require emergency access before enforcement`)
    if (!reachesPeople && /Emergency access is prepared and tested/.test(text))
      missing.push(`${p.stepId}: claims emergency access matters to a policy that reaches no person`)
  }
  assert.deepEqual(missing, [])
  // The rule is not vacuous: each gate is read off a real script and fires widely.
  assert.ok(fired.reportOnly >= 20 && fired.drift >= 20 && fired.attested >= 15 && fired.people >= 20, JSON.stringify(fired))
})

test('the refusal stands before the line that turns the policy on, never after it', () => {
  const late: string[] = []
  for (const { p, text } of ENFORCERS) {
    const refusal = text.search(/Do not turn (it|either) on unless/)
    if (refusal === -1) continue
    const flip = text.search(/Change (only )?\*\*Enable policy\*\*|Change Enable policy|Change only Enable policy|Set \*\*Enable policy|Change it from Report-only|Change the policy from Report-only|Then set \*\*Enable policy|Set \*\*Enable policy\*\* from|Enable both in the same|Set one policy to \*\*On\*\*/)
    if (flip !== -1 && flip < refusal) late.push(`${p.stepId}: the refusal reads after the change`)
  }
  assert.deepEqual(late, [])
})
