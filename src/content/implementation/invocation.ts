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
  /**
   * The modes IAMAI cannot call, each with the reason: a mode the script runs only
   * with an attestation the package declares no prerequisite for, or with a value
   * in a shape IAMAI does not hold. A projection that runs one is withheld, never
   * shown as a call that would throw.
   */
  withheldModes?: Record<string, string>
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
    // `[Parameter(Mandatory=$true)]`: PowerShell's constants are values in an attribute, not parameters.
    if (/^(true|false|null)$/i.test(m[1])) continue
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
  if (s.withheldModes !== undefined && (typeof s.withheldModes !== 'object' || Object.values(s.withheldModes).some((r) => typeof r !== 'string' || r.trim() === ''))) errors.push(`${at}.withheldModes: each withheld mode names its reason`)
  return errors
}

/**
 * A PowerShell literal: single-quoted text, an @() array of them, or a bare number,
 * written in ASCII alone. Scripts leave by Copy; saved without a BOM and run in Windows
 * PowerShell 5.1 they are read in the ANSI code page, where the UTF-8 bytes of "Ñ", "В"
 * or "€" include 0x91/0x92/0x82, which read as U+2018/U+2019/U+201A, and PowerShell ends
 * a single-quoted string at those as well as at U+0027. So every character above U+007E
 * leaves the quotes: a JSON value (a `.json` binding) carries it as a `\uXXXX` escape,
 * which ConvertFrom-Json reads back as the same character, and other text as `[char]`,
 * in a parenthesised concatenation that evaluates to the same string. A control character
 * (a tab or line break) in text leaves the quotes as `[char]` too, so the call stays one
 * ASCII line; JSON.stringify already escapes controls in a JSON value. U+0027 is doubled.
 * Invocations use no double-quoted strings.
 */
const NOT_ASCII = /[\u007f-\uffff]/g
const OUTSIDE_QUOTES = /([\u0000-\u001f\u007f-\uffff])/
function literal(v: unknown, json = false): string {
  const quoted = (s: string): string => `'${s.replace(/'/g, "''")}'`
  const text = (x: unknown): string => {
    const s = String(x)
    if (json) return quoted(s.replace(NOT_ASCII, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`))
    if (!OUTSIDE_QUOTES.test(s)) return quoted(s)
    const parts = s.split(OUTSIDE_QUOTES).filter((p) => p !== '')
    const terms = parts.map((p) => (p.length === 1 && OUTSIDE_QUOTES.test(p) ? `[char]0x${p.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}` : quoted(p)))
    // [char] + string would convert the string to a char, so the concatenation starts with a string.
    if (terms[0].startsWith('[char]')) terms.unshift("''")
    return `(${terms.join(' + ')})`
  }
  if (Array.isArray(v)) return `@(${v.map(text).join(', ')})`
  if (typeof v === 'number') return String(v)
  return text(v)
}

/**
 * The script carrying only the modes this projection actually calls.
 *
 * A deployable script is one function with a mode switch, and it was shipped
 * whole however few modes IAMAI offered. A step holding enforcement back said
 * "the instruction being withheld is the one that turns the policy on" — the
 * Portal channel withheld it and the JSON channel withheld it, and the
 * PowerShell script shipped the Enforce branch with the target policy and its
 * id pre-filled on the invocation line, one word's edit from Observe. Its own
 * guards check policy shape and nothing else, so on a tenant where readiness
 * cannot be measured it would have run straight through them.
 *
 * So the artifact carries the modes it is offered in, as it does in every other
 * channel. Anything that cannot be removed cleanly — a mode the ValidateSet
 * does not declare, a branch in a shape this does not recognise, a mention left
 * behind — withholds the whole channel rather than shipping a script half
 * stripped (project.ts: no half-built artifact).
 */
export function scriptForRuns(script: string, spec: InvocationSpec, runs: ScriptRun[]): { text: string } | { unstripped: string[] } {
  const set = validateSetOf(script, spec.modeParameter)
  if (set === null) return { text: script }
  const keep = new Set(runs.map((r) => r.mode))
  const drop = set.modes.filter((m) => !keep.has(m))
  if (drop.length === 0) return { text: script }
  let out = script.slice(0, set.start) + set.modes.filter((m) => keep.has(m)).map((m) => QUOTE + m + QUOTE).join(',') + script.slice(set.end)
  const failed: string[] = []
  for (const mode of drop) {
    const cut = withoutBranch(out, spec.modeParameter, mode)
    if (cut === null) failed.push(mode)
    else out = cut
  }
  // What must not survive is a way to REACH the mode: its own branch or switch
  // arm. A precondition guard that names it — "if($Mode -ne 'PeopleExclusions')",
  // "if($Mode -in @('Create','CorrectConditions'))" — simply stops firing once
  // the ValidateSet no longer accepts it, and refusing those withheld a whole
  // channel over a line that does nothing.
  const left = drop.filter((m) => !failed.includes(m) && reachable(out, spec.modeParameter, m))
  return failed.length + left.length > 0 ? { unstripped: [...new Set([...failed, ...left])].sort() } : { text: out }
}

const QUOTE = String.fromCharCode(39)
const SIGIL = String.fromCharCode(36)

/** The mode parameter's own ValidateSet: its literals and where they sit. */
function validateSetOf(script: string, modeParameter: string): { modes: string[]; start: number; end: number } | null {
  const NEEDLE = 'ValidateSet('
  for (let at = script.indexOf(NEEDLE); at >= 0; at = script.indexOf(NEEDLE, at + 1)) {
    const start = at + NEEDLE.length
    const end = script.indexOf(')', start)
    if (end < 0) continue
    // The parameter it decorates is the next variable after the attribute; an
    // attribute on any other parameter (a corrections ValidateSet) is not it.
    const after = script.slice(end, end + 200)
    const named = after.indexOf(SIGIL + modeParameter)
    if (named < 0 || after.indexOf(SIGIL) !== named) continue
    const parts = script.slice(start, end).split(QUOTE)
    if (parts.length < 3) return null
    return { modes: parts.filter((_, i) => i % 2 === 1), start, end }
  }
  return null
}

/** A mode's `if($Mode -eq 'X'){ ... }` branch removed whole; null where the script does not have exactly that shape. */
function withoutBranch(script: string, modeParameter: string, mode: string): string | null {
  const tail = ' -eq ' + QUOTE + mode + QUOTE + ')'
  let out = script
  let removed = false
  // Every branch on the mode, not just the first: the guests pair adds a scope
  // in one "if" and does the work in another, and refusing the pair withheld
  // the whole channel.
  for (const head of ['if(' + SIGIL, 'if (' + SIGIL]) {
    const needle = head + modeParameter + tail
    for (let at = out.indexOf(needle); at >= 0; at = out.indexOf(needle)) {
      let i = at + needle.length
      while (i < out.length && (out[i] === ' ' || out[i] === NEWLINE)) i++
      if (out[i] !== '{') return null
      const end = matchingBrace(out, i)
      if (end < 0) return null
      i = end + 1
      while (i < out.length && (out[i] === NEWLINE || out[i] === RETURN)) i++
      out = out.slice(0, at) + out.slice(i)
      removed = true
    }
  }
  if (removed) return out
  const arm = withoutSwitchArm(script, modeParameter, mode)
  if (arm !== null) return arm
  // A mode with no branch of its own (a bare read, dispatched nowhere) needs
  // nothing removed.
  return reachable(script, modeParameter, mode) ? null : script
}

/** Whether the script still dispatches on a mode: its own branch, or an arm of the mode switch. */
function reachable(script: string, modeParameter: string, mode: string): boolean {
  const label = QUOTE + mode + QUOTE
  for (const head of ['if(' + SIGIL, 'if (' + SIGIL]) {
    if (script.includes(head + modeParameter + ' -eq ' + label)) return true
  }
  for (const head of ['switch(' + SIGIL, 'switch (' + SIGIL]) {
    const at = script.indexOf(head + modeParameter + ')')
    if (at < 0) continue
    const open = script.indexOf('{', at)
    const close = open < 0 ? -1 : matchingBrace(script, open)
    if (close < 0) return true
    const body = script.slice(open + 1, close)
    for (let i = body.indexOf(label); i >= 0; i = body.indexOf(label, i + 1)) {
      const line = body.slice(body.lastIndexOf(NEWLINE, i) + 1, i)
      if (line.trim() === '') return true
    }
  }
  return false
}

/** A mode's arm of a `switch($Mode){ 'X'{ ... } }` removed whole; null where the script does not have that shape. */
function withoutSwitchArm(script: string, modeParameter: string, mode: string): string | null {
  for (const head of ['switch(' + SIGIL, 'switch (' + SIGIL]) {
    const at = script.indexOf(head + modeParameter + ')')
    if (at < 0) continue
    const open = script.indexOf('{', at)
    if (open < 0) return null
    const close = matchingBrace(script, open)
    if (close < 0) return null
    const body = script.slice(open + 1, close)
    // An arm opens at the start of its line, so a mode named inside another
    // arm's body is not mistaken for one.
    const label = QUOTE + mode + QUOTE
    let armAt = -1
    for (let i = body.indexOf(label); i >= 0; i = body.indexOf(label, i + 1)) {
      const before = body.slice(0, i)
      const line = before.slice(before.lastIndexOf(NEWLINE) + 1)
      if (line.trim() !== '') continue
      if (armAt >= 0) return null
      armAt = i
    }
    if (armAt < 0) return null
    let i = armAt + label.length
    while (i < body.length && body[i] === ' ') i++
    if (body[i] !== '{') return null
    const armEnd = matchingBrace(body, i)
    if (armEnd < 0) return null
    let after = armEnd + 1
    while (after < body.length && (body[after] === NEWLINE || body[after] === RETURN)) after++
    const start = body.lastIndexOf(NEWLINE, armAt) + 1
    const cut = body.slice(0, start) + body.slice(after)
    return script.slice(0, open + 1) + cut + script.slice(close)
  }
  return null
}

/**
 * The index of the brace closing the one at `open`; -1 where it does not close.
 *
 * Braces inside a string or a comment are text, not structure: counting them
 * raw lost the end of any branch holding, say, `-like '{{*'` (the guard against
 * an unresolved binding), and the whole channel was withheld for it. Only
 * PowerShell's quoting needs handling here, and the library has no here-strings.
 */
function matchingBrace(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === HASH) { const nl = text.indexOf(NEWLINE, i); if (nl < 0) return -1; i = nl; continue }
    if (c === QUOTE || c === DQUOTE) { const end = endOfString(text, i); if (end < 0) return -1; i = end; continue }
    if (c === BACKTICK) { i++; continue }
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return -1
}

/** The index of the quote closing the one at `open`: a doubled quote is an escaped one, and a backtick escapes inside "..." only. */
function endOfString(text: string, open: number): number {
  const q = text[open]!
  for (let i = open + 1; i < text.length; i++) {
    if (q === DQUOTE && text[i] === BACKTICK) { i++; continue }
    // A "..." can hold a $( ) subexpression, and that can hold quotes of its
    // own: "displayName eq '$($Name.Replace("'","''"))'". Read naively, the
    // inner quote ended the outer string and every brace after it was counted
    // in the wrong place.
    if (q === DQUOTE && text[i] === SIGIL && text[i + 1] === '(') {
      const end = endOfSubexpression(text, i + 1)
      if (end < 0) return -1
      i = end
      continue
    }
    if (text[i] !== q) continue
    if (text[i + 1] === q) { i++; continue }
    return i
  }
  return -1
}

/** The index of the parenthesis that closes the one at the given index, skipping strings and comments; -1 where it does not close. */
function endOfSubexpression(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === HASH) { const nl = text.indexOf(NEWLINE, i); if (nl < 0) return -1; i = nl; continue }
    if (c === QUOTE || c === DQUOTE) { const end = endOfString(text, i); if (end < 0) return -1; i = end; continue }
    if (c === BACKTICK) { i++; continue }
    if (c === '(') depth++
    else if (c === ')' && --depth === 0) return i
  }
  return -1
}

const DQUOTE = String.fromCharCode(34)
const HASH = String.fromCharCode(35)
const BACKTICK = String.fromCharCode(96)

const NEWLINE = String.fromCharCode(10)
const RETURN = String.fromCharCode(13)

/**
 * The script defined once and called once per run, with every parameter its mode
 * takes filled from the bindings. A value a run needs that IAMAI does not hold
 * refuses the whole artifact, exactly as a missing required binding refuses a
 * block; a switch is passed only for a satisfied prerequisite.
 */
export function renderInvocation(script: string, spec: InvocationSpec, runs: ScriptRun[], bindings: Bindings, satisfied: ReadonlySet<string>, standIns: ReadonlySet<string> = new Set(), emptyOk: ReadonlySet<string> = new Set()): { text: string; calls: string[] } | { missing: string[] } | { unstripped: string[] } {
  const fn = spec.function ?? DEFAULT_FUNCTION
  const missing = new Set<string>()
  const calls = runs.map((run) => {
    const args = [`-${spec.modeParameter} ${literal(run.mode)}`]
    if (run.corrections.length > 0 && spec.correctionsParameter) args.push(`-${spec.correctionsParameter} ${run.corrections.map((c) => literal(c)).join(',')}`)
    for (const [name, p] of Object.entries(spec.parameters)) {
      if (!p.modes.includes(run.mode)) continue
      if (p.switch) {
        if (p.prerequisite && satisfied.has(p.prerequisite)) args.push(`-${name}`)
        continue
      }
      const value = p.binding ? bindings[p.binding] : undefined
      // A resolved empty list the package declares a value (`resolvedEmptyBindings`) is passed as @().
      if (!present(value) && !(p.binding !== undefined && emptyOk.has(p.binding) && Array.isArray(value))) {
        if (p.binding) missing.add(p.binding)
        continue
      }
      // A preview's stand-in ("‹policy conditions›") is drawn as it reads; a preview is never copied.
      // Structured bindings are JSON parameters even when the binding's semantic
      // name is not suffixed `.json`. String(value) would emit `[object Object]`
      // and silently discard the operation the JSON channel carries.
      const structured = value !== null && typeof value === 'object' && !Array.isArray(value)
      args.push(`-${name} ${standIns.has(p.binding!) ? `'${String(value).replace(/'/g, "''")}'` : literal(structured ? JSON.stringify(value) : value, p.binding!.endsWith('.json') || structured)}`)
    }
    return `${fn} ${args.join(' ')}`
  })
  if (missing.size > 0) return { missing: [...missing] }
  // The script carries the modes it is called in, and no others.
  const only = scriptForRuns(script, spec, runs)
  if ('unstripped' in only) return only
  const body = only.text.replace(/\s+$/, '')
  return { text: `function ${fn} {\n${body}\n}\n\n${calls.join('\n')}`, calls }
}
