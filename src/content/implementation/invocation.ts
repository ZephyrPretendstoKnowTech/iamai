// How a projected PowerShell script is run, from the package's own metadata.
//
// A mode-based script (authoring guide §10.1) takes its values as parameters,
// and a script shown without them cannot be run: "Run with -Mode Enforce"
// beside a script that throws without -PolicyId and -ExcludeGroupIds is not an
// instruction anybody can follow. So a deployable PowerShell block declares its
// invocation — which parameter carries the mode, which carries corrections,
// which binding fills each parameter in which modes, and which switch attests
// which prerequisite — and the artifact the viewer shows and Copy copies is the
// script defined once as a function and called with IAMAI's resolved values, in
// the order the projection names its runs.
//
// Nothing here is authored: every name is the package's, every value a binding,
// and a switch is passed only for a prerequisite that is satisfied now. The
// validator holds the declaration to the script's own param() block, so the two
// cannot drift apart silently.
//
// Pure: no DOM, no network.
import type { Bindings } from './conditions.ts'
import { present } from './conditions.ts'

export type InvocationParameter = {
  /** The binding whose value the parameter takes. */
  binding?: string
  /** A switch, passed only while `prerequisite` is satisfied. */
  switch?: true
  prerequisite?: string
  /** The modes the parameter is passed in. */
  modes: string[]
}

export type InvocationSpec = {
  /** The function name the script is defined as; `Invoke-IAMAIStep` when absent. */
  function?: string
  modeParameter: string
  correctionsParameter?: string
  parameters: Record<string, InvocationParameter>
}

export type ScriptRun = { mode: string; corrections: string[] }

const DEFAULT_FUNCTION = 'Invoke-IAMAIStep'

/** The script's own parameters, from its param() block: name and whether it is mandatory. */
export function scriptParameters(script: string): { name: string; mandatory: boolean }[] {
  const start = script.search(/\bparam\s*\(/i)
  if (start < 0) return []
  let depth = 0
  let end = -1
  for (let i = script.indexOf('(', start); i < script.length; i++) {
    if (script[i] === '(') depth++
    else if (script[i] === ')') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = end > 0 ? script.slice(start, end) : ''
  const out: { name: string; mandatory: boolean }[] = []
  let prev = 0
  for (const m of block.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const attributes = block.slice(prev, m.index)
    out.push({ name: m[1], mandatory: /Parameter\s*\([^)]*Mandatory/i.test(attributes) })
    prev = (m.index ?? 0) + m[0].length
  }
  return out
}

/** Everything wrong with a block's invocation against its script and the package's vocabulary; empty when sound. */
export function invocationErrors(at: string, spec: unknown, script: string, vocab: { bindings: ReadonlySet<string>; prerequisites: ReadonlySet<string> }): string[] {
  if (!spec || typeof spec !== 'object') return [`${at}: a deployable PowerShell block declares its invocation`]
  const s = spec as InvocationSpec
  const errors: string[] = []
  const params = scriptParameters(script)
  const names = new Set(params.map((p) => p.name))
  if (typeof s.modeParameter !== 'string' || !names.has(s.modeParameter)) errors.push(`${at}.modeParameter: not a parameter of the script`)
  if (s.correctionsParameter !== undefined && !names.has(s.correctionsParameter)) errors.push(`${at}.correctionsParameter: not a parameter of the script`)
  for (const [name, p] of Object.entries(s.parameters ?? {})) {
    if (!names.has(name)) errors.push(`${at}.parameters.${name}: not a parameter of the script`)
    if (!Array.isArray(p.modes) || p.modes.length === 0) errors.push(`${at}.parameters.${name}: modes`)
    if (p.switch) {
      if (typeof p.prerequisite !== 'string' || !vocab.prerequisites.has(p.prerequisite)) errors.push(`${at}.parameters.${name}: a switch attests a declared prerequisite`)
    } else if (typeof p.binding !== 'string' || !vocab.bindings.has(p.binding)) errors.push(`${at}.parameters.${name}: binding ${JSON.stringify(p.binding)} is not declared`)
  }
  for (const p of params) {
    if (p.mandatory && p.name !== s.modeParameter && !(p.name in (s.parameters ?? {}))) errors.push(`${at}: mandatory parameter ${p.name} has no invocation`)
  }
  return errors
}

/** A PowerShell literal: single-quoted text, an @() array of them, or a bare number. */
function literal(v: unknown): string {
  const text = (x: unknown): string => `'${String(x).replaceAll("'", "''")}'`
  if (Array.isArray(v)) return `@(${v.map(text).join(', ')})`
  if (typeof v === 'number') return String(v)
  return text(v)
}

/**
 * The script defined once and called once per run, with every parameter its mode
 * takes filled from the bindings. A value a run needs that IAMAI does not hold
 * refuses the whole artifact, exactly as a missing required binding refuses a
 * block; a switch is passed only for a satisfied prerequisite.
 */
export function renderInvocation(script: string, spec: InvocationSpec, runs: ScriptRun[], bindings: Bindings, satisfied: ReadonlySet<string>): { text: string; calls: string[] } | { missing: string[] } {
  const fn = spec.function ?? DEFAULT_FUNCTION
  const missing = new Set<string>()
  const calls = runs.map((run) => {
    const args = [`-${spec.modeParameter} ${literal(run.mode)}`]
    if (run.corrections.length > 0 && spec.correctionsParameter) args.push(`-${spec.correctionsParameter} ${run.corrections.map(literal).join(',')}`)
    for (const [name, p] of Object.entries(spec.parameters)) {
      if (!p.modes.includes(run.mode)) continue
      if (p.switch) {
        if (p.prerequisite && satisfied.has(p.prerequisite)) args.push(`-${name}`)
        continue
      }
      const value = p.binding ? bindings[p.binding] : undefined
      if (!present(value)) {
        if (p.binding) missing.add(p.binding)
        continue
      }
      args.push(`-${name} ${literal(value)}`)
    }
    return `${fn} ${args.join(' ')}`
  })
  if (missing.size > 0) return { missing: [...missing] }
  const body = script.replace(/\s+$/, '')
  return { text: `function ${fn} {\n${body}\n}\n\n${calls.join('\n')}`, calls }
}
