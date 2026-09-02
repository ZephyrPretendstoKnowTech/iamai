// The renderer (prompt 51 Part 1). A faithful port of docs/design/render-review.py:
// the same content.json produces the same words, so the review page the owner
// signs off and the app the engine drives cannot drift. The port emits the same
// HTML the script does, and content.test.ts asserts equality against the script's
// own output. The app surfaces (Parts 4–6) read the same fill/render functions,
// filling variables from the derived model instead of a step's `example`.
//
// Every branch here mirrors a branch in render-review.py; do not add phrasing.
import { content } from './content.ts'

const C = content as unknown as Record<string, any>
const S = C.shared

// The translator dump (docs/design/translator-output.json, prompt 52 Part 2): a
// policy step's What-to-do in the review render comes from it — the product's
// own portal-line translation over the pinned goalMap — so the review page and
// the app cannot drift. render-review.py reads the same file. The app never
// calls renderStep (ContentStep renders a policy step from the baseline via
// stepPortal.ts), so tree-shaking keeps this out of the browser bundle.
import translatorOutput from '../../docs/design/translator-output.json' with { type: 'json' }
const TRANSLATED = translatorOutput as unknown as Record<string, { steps: string[] }>

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

type Ex = Record<string, any> | null | undefined

// Python truthiness: an empty list, string, 0, {} or None is falsy. The port
// mirrors render-review.py's `if ex.get(x)` / `not x` tests, where an empty
// array is falsy — JS would treat `[]` as truthy and render a line the review
// page suppresses (§8.7: a line whose only list is empty is not rendered).
function truthy(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.length > 0
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return Boolean(v)
}

// The app renderer (prompt 51): plain text, the tenant's own values, no review
// markup and no example defaults. `fill` above is for the review HTML (values in
// <var>, lists as <ol>, and example fallbacks); the app never wants those. A
// variable the tenant does not supply renders empty, so the caller's gating drops
// the line rather than showing a placeholder or sample datum.
export function fillText(text: unknown, ex: Ex, depth = 0): string {
  if (text === null || text === undefined) return ''
  if (depth > 4) return String(text)
  const sharedRefs: Record<string, unknown> = {
    portalRoot: S.portalRoot, reportOnlyLine: S.reportOnlyLine, exclusionsLine: S.exclusionsLine,
    signature: ex && ex.signature !== undefined ? ex.signature : S.signatureDefault,
    policyIfWrong: S.policyIfWrong, changeIfWrong: S.changeIfWrong, datesNew: S.datesNew, datesChange: S.datesChange,
    portalOpen: S.portalOpen, existingCoverage: S.existingCoverage ?? '', syncRoleNote: S.syncRoleNote ?? '', strengthName: (ex && ex.strengthName) ?? '',
  }
  const subList = (_m: string, key: string): string => {
    const items = (ex as Record<string, unknown>)[key]
    if (Array.isArray(items)) return items.length === 0 ? '' : items.join(', ')
    return items === undefined || items === null ? '' : String(items)
  }
  const sub = (_m: string, key: string): string => {
    if (key in sharedRefs) return fillText(sharedRefs[key], ex, depth + 1)
    const v = (ex as Record<string, unknown>)[key]
    if (v === undefined || v === null || Array.isArray(v) || typeof v === 'object') return ''
    return String(v)
  }
  let out = String(text)
  out = out.replace(/\{list:([a-zA-Z0-9_]+)\}/g, subList)
  out = out.replace(/\{([a-zA-Z0-9_]+)\}/g, sub)
  out = pluralise(out)
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.;:,])/g, '$1').trim()
}

// The names fillText resolves from shared references rather than the step's own
// values, so a line using one is not treated as having a hole (walk-51 item 2).
/**
 * A picker with no pickerSource reads the first of these keys the step's values
 * fill (the emergency, countries, trusted-network, service-accounts and
 * shared-devices pickers); the product's Decision and this review renderer share
 * the list, so a row appears in both or in neither.
 */
export const PICKER_FALLBACK_KEYS = ['emergencyCandidates', 'emergencyAccounts', 'countriesWithCounts', 'locationsWithMatches', 'accountsWithSignals', 'devicesWithSignals', 'adminsList']
/** The picker sources that choose one thing (a group, a location): radio, never checkbox. */
export const SINGLE_CHOICE_SOURCES = ['groups', 'countryLocations']

const SHARED_REF_KEYS = new Set(['portalRoot', 'reportOnlyLine', 'exclusionsLine', 'signature', 'policyIfWrong', 'changeIfWrong', 'datesNew', 'datesChange', 'portalOpen', 'existingCoverage', 'syncRoleNote', 'strengthName'])

/**
 * The variables a content line names that `ex` does not fill (walk-51 item 2). A
 * line with any is a hole — a missing variable rendered around — and the caller
 * drops it. Shared references and `{n}` at zero are not holes.
 */
export function missingVars(text: unknown, ex: Ex): string[] {
  if (typeof text !== 'string') return []
  const out: string[] = []
  for (const m of text.matchAll(/\{(?:list:)?([a-zA-Z0-9_]+)\}/g)) {
    const key = m[1]
    if (SHARED_REF_KEYS.has(key)) {
      // A shared reference ({datesNew}, {policyIfWrong}…) expands to a shared
      // string with variables of its own; a hole in that string is a hole in
      // this line (the walk found "Announce · Report-only from · Enforce").
      const shared = (S as Record<string, unknown>)[key]
      if (typeof shared === 'string' && key !== 'signature' && key !== 'strengthName') out.push(...missingVars(shared, ex))
      continue
    }
    const v = (ex as Record<string, unknown>)?.[key]
    const present = Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).length > 0
    if (!present) out.push(key)
  }
  return out
}

// "1 guests" reads as one guest (walk-51 item 2). After the count is filled, a
// count of exactly one singularises the noun that follows it. Only a curated set
// of nouns, so "1 status" is never mistaken for a plural.
const SINGULAR: Record<string, string> = {
  people: 'person', admins: 'admin', guests: 'guest', users: 'user', accounts: 'account', policies: 'policy',
  members: 'member', devices: 'device', methods: 'method', days: 'day', weeks: 'week', keys: 'key',
  checks: 'check', steps: 'step', tenants: 'tenant', locations: 'location', countries: 'country', roles: 'role', groups: 'group',
  'sign-ins': 'sign-in',
}
function pluralise(text: string): string {
  // The noun a count governs is the word after it, or the word after one
  // adjective ("1 active people" → "1 active person").
  return text.replace(/(?<![\d,.])\b1 ([A-Za-z-]+)( [A-Za-z-]+)?/g, (m, w1: string, w2?: string) => {
    if (SINGULAR[w1]) return `1 ${SINGULAR[w1]}${w2 ?? ''}`
    const n2 = w2?.trim()
    if (n2 && SINGULAR[n2]) return `1 ${w1} ${SINGULAR[n2]}`
    return m
  })
}

export function fill(text: unknown, ex: Ex, depth = 0): string {
  if (text === null || text === undefined) return ''
  if (depth > 4) return esc(text)
  const ctx: Record<string, any> = { ...(ex || {}) }
  const sharedRefs: Record<string, any> = {
    portalRoot: S.portalRoot,
    reportOnlyLine: S.reportOnlyLine,
    exclusionsLine: S.exclusionsLine,
    signature: ex && ex.signature !== undefined ? ex.signature : S.signatureDefault,
    policyIfWrong: S.policyIfWrong,
    changeIfWrong: S.changeIfWrong,
    datesNew: S.datesNew,
    datesChange: S.datesChange,
    portalOpen: S.portalOpen,
    existingCoverage: S.existingCoverage ?? '',
    syncRoleNote: S.syncRoleNote ?? '',
  }
  const defaults: Record<string, any> = {
    announce: 'Tue Sep 1',
    reportOnly: 'Tue Sep 1',
    enforce: 'Tue Sep 8',
    reportOnlyDays: '7',
    date: 'Aug 28, 2026',
    n: 3,
    exclusionsGroup: 'Breakglass Exclusion',
    emergencyAccounts: ['Breakglass', 'Emergency Access 2'],
    policy: ex && ex.policyName !== undefined ? ex.policyName : '',
    tenant: 'GetIAMAI',
    from: 'Aug 1',
  }
  const subList = (_m: string, key: string): string => {
    let items = ctx[key] !== undefined ? ctx[key] : defaults[key]
    if (typeof items === 'string') items = [items]
    if (!items || (Array.isArray(items) && items.length === 0)) return '<var class="v">(none)</var>'
    return '</p><ol class="names">' + (items as unknown[]).map((i) => `<li><var class="v">${esc(i)}</var></li>`).join('') + '</ol><p>'
  }
  const sub = (_m: string, key: string): string => {
    if (key in sharedRefs) return fill(sharedRefs[key], ex, depth + 1)
    if (key in ctx && !Array.isArray(ctx[key]) && !(ctx[key] && typeof ctx[key] === 'object')) return `<var class="v">${esc(ctx[key])}</var>`
    if (key in defaults && !Array.isArray(defaults[key])) return `<var class="v">${esc(defaults[key])}</var>`
    return `<var class="v miss">{${esc(key)}}</var>`
  }
  let out = esc(text)
  out = out.replace(/\{list:([a-zA-Z0-9_]+)\}/g, subList)
  out = out.replace(/\{([a-zA-Z0-9_]+)\}/g, sub)
  out = out.replace(/<\/ol><p>\s*[.;:,]\s*/g, '</ol><p>')
  out = out.replace(/<p>\s*<\/p>/g, '')
  return out
}

const p = (text: unknown, ex: Ex, cls = ''): string => (text === null || text === undefined ? '' : `<p class="${cls}">${fill(text, ex)}</p>`)
const ol = (items: unknown[] | null | undefined, ex: Ex): string => (!items || items.length === 0 ? '' : '<ol>' + items.map((i) => `<li>${fill(i, ex)}</li>`).join('') + '</ol>')
const ul = (items: unknown[] | null | undefined, ex: Ex): string => (!items || items.length === 0 ? '' : '<ul>' + items.map((i) => `<li>${fill(i, ex)}</li>`).join('') + '</ul>')
const h = (label: string): string => `<h4>${esc(label)}</h4>`
const chip = (t: string): string => `<span class="chip">${esc(t)}</span>`
const btn = (t: string, primary = false): string => `<span class="btn${primary ? ' primary' : ''}">${esc(t)}</span>`

function doneWhen(items: string[], ex: Ex): string {
  const out: string[] = []
  for (const i of items) {
    if (i === '{policyDoneWhen}') out.push(...S.policyDoneWhen)
    else if (i === '{changeDoneWhen}') out.push(...S.changeDoneWhen)
    else out.push(i)
  }
  return ul(out, ex)
}

const findKeys = (line: string): string[] => [...line.matchAll(/\{(?:list:)?([a-zA-Z0-9_]+)\}/g)].map((m) => m[1])
const listKeys = (line: string): string[] => [...line.matchAll(/\{list:([a-zA-Z0-9_]+)\}/g)].map((m) => m[1])

export function renderStep(st: Record<string, any>): string {
  const ex: Record<string, any> = { ...(st.example || {}) }
  const kind = st.kind
  const parts: string[] = []
  const status = ['blocker', 'object', 'check', 'campaign'].includes(kind) ? 'Ready' : 'Blocked'
  const lic = st.licence
  parts.push(
    `<div class="steprow"><span class="chip status">${esc(status)}</span><span class="title">${esc(st.title)}</span>` +
      (lic ? `<span class="lic">needs a licence this tenant does not hold: ${esc(lic)}</span>` : '') +
      '</div>',
  )
  parts.push('<div class="stepbody">')
  parts.push(`<div class="stephead"><span class="title2">${esc(st.title)}</span> <span class="chip status">${esc(status)}</span></div>`)
  if (st.changeLine) parts.push(p(st.changeLine, ex, 'change'))
  if (st.partner) parts.push(p(st.partner, ex, 'partner'))
  if (st.placement) parts.push(p(st.placement, ex, 'sub'))
  // Why
  parts.push(h('Why'))
  const learn = st.learn || {}
  const cis = learn.cis ? ` <span class="chip cis">CIS ${esc(learn.cis)}</span>` : ''
  parts.push(`<p>${fill(st.why, ex)} <a class="learn" href="${esc(learn.url || '')}">Learn →</a>${cis}</p>`)
  // Who
  const who = st.who || {}
  parts.push(h('Who this touches'))
  if (who.lead) parts.push(p(who.lead, ex))
  if (who.timeline) parts.push(p(who.timeline, ex, 'evidence'))
  for (const [k, v] of Object.entries(who)) {
    if (['lead', 'groups', 'adminsNote', 'timeline', 'overlap'].includes(k)) continue
    if (Array.isArray(v)) {
      for (let line of v as string[]) {
        if (line === '{existingCoverage}') {
          if (!truthy(ex.existingPolicies)) continue
          line = S.existingCoverage
        }
        const lk = listKeys(line)
        if (lk.length > 0 && lk.every((k2) => !truthy(ex[k2]))) continue
        if (lk.length === 0 && line.includes('{n}') && (ex.n ?? 1) === 0) continue
        const e2 = { ...ex }
        if (lk.length > 0 && line.includes('{n}')) e2.n = (ex[lk[0]] || []).length
        parts.push(p(line, e2, 'evidence'))
      }
    } else if (typeof v === 'string') {
      if (k === 'none') {
        const main = ['locationsWithMatches', 'accountsWithSignals', 'devicesWithSignals', 'members', 'strengths', 'syncAddresses'].filter((kk) => kk in ex)
        if (main.length > 0 && !truthy(ex[main[0]])) parts.push(p(v, ex, 'evidence'))
        continue
      }
      if (['remoteHint', 'emergencyNote', 'timeline'].includes(k)) {
        parts.push(p(v, ex, 'evidence'))
        continue
      }
      if (k === 'match') {
        if (truthy(ex.matchedStrength)) parts.push(p(v, ex, 'evidence'))
        continue
      }
      parts.push(p(v, ex, 'evidence'))
    }
  }
  if (who.groups) {
    const g = who.groups
    for (const [gk, gl] of Object.entries(g)) {
      const items = ex[gk] || []
      if (!items.length) continue
      const e2 = { ...ex, n: items.length }
      parts.push(`<p class="evidence">${fill(gl, e2)}</p><ol class="names">` + (items as unknown[]).map((i) => `<li><var class="v">${esc(i)}</var></li>`).join('') + '</ol>')
    }
    if (who.overlap) parts.push(p(who.overlap, ex, 'sub'))
    if (who.adminsNote) {
      const e2 = { ...ex, admins: ex.admins ?? ex.adminsList ?? [] }
      parts.push(p(who.adminsNote, e2, 'evidence'))
    }
  }
  // Decision
  const d = st.decision
  if (d) {
    parts.push('<div class="decision">')
    parts.push(`<div class="dlabel">${esc(d.label)}</div>`)
    if (d.help) parts.push(p(d.help, ex, 'dhelp'))
    if (d.location) {
      const L = d.location
      parts.push(`<div class="dlabel">${esc(L.label)}</div>` + p(L.help, ex, 'dhelp'))
      const lrows = ex[L.pickerSource] || []
      parts.push('<div class="picker">' + (lrows.length ? (lrows as unknown[]).map((r) => `<label><input type="radio" checked disabled> <var class="v">${esc(r)}</var></label>`).join('') : `<p class="dhelp">${esc(L.none)}</p>`) + '</div>')
      parts.push(`<div class="dlabel">${esc(d.label)}</div>`)
    }
    if (d.pickerRow) {
      let rows: unknown[] = []
      const keys = d.pickerSource ? [d.pickerSource] : PICKER_FALLBACK_KEYS
      for (const key of keys) {
        if (truthy(ex[key])) {
          rows = ex[key]
          break
        }
      }
      if (rows.length) {
        const kindIn = d.multi || !SINGLE_CHOICE_SOURCES.includes(d.pickerSource) ? 'checkbox' : 'radio'
        parts.push('<div class="picker">' + rows.map((r, i) => `<label><input type="${kindIn}" ${i === 0 || d.multi ? 'checked' : ''} disabled> <var class="v">${esc(r)}</var></label>`).join('') + '</div>')
      } else {
        parts.push(`<div class="picker"><label><input type="checkbox" disabled> ${fill(d.pickerRow, ex)}</label></div>`)
      }
    }
    if (d.options) parts.push('<div class="picker">' + (d.options as string[]).map((o) => `<label><input type="radio" disabled> ${fill(o, ex)}</label>`).join('') + '</div>')
    if (d.question) {
      const q = d.question
      parts.push(
        `<div class="dlabel q">${esc(q.label)}</div>` +
          p(q.text, ex, 'dhelp') +
          '<div class="picker">' +
          (q.options as string[]).map((o) => `<label><input type="radio" disabled> ${fill(o, ex)}</label>`).join('') +
          '</div>' +
          p(q.effect, ex, 'dhelp'),
      )
    }
    parts.push(btn(d.save || 'Save') + '</div>')
  }
  // What to do
  let w = st.whatToDo || {}
  if (kind === 'policy') {
    const tr = TRANSLATED[st.id]
    if (tr) w = { lead: (st.whatToDoReference || {}).lead, steps: tr.steps || tr }
    else {
      w = st.whatToDoReference || {}
      parts.push("<p class=\"annot\">Note: reviewer's rendering; the product generates this section from the baseline policy. Run npm run translator-dump to show the product's version here.</p>")
    }
  }
  parts.push(h('What to do'))
  if (w.lead) parts.push(p(w.lead, ex))
  if (w.steps) parts.push(ol(w.steps, ex))
  if (w.generic) parts.push('<p class="sub">For everyone else:</p>' + ol(w.generic, ex))
  if (w.new) parts.push('<p class="sub">If the policy does not exist yet:</p>' + ol(w.new, ex))
  if (w.create) parts.push('<p class="sub">Create:</p>' + ol(w.create, ex))
  if (w.fallback) parts.push('<p class="sub">' + esc(w.fallback.when) + '</p>' + ol(w.fallback.steps, ex))
  if (w.correct) parts.push('<p class="sub">Correct (when it already exists):</p>' + ol(w.correct, ex))
  if (w.checkFixes) {
    const fails = ex.failingChecks || []
    const lines: string[] = []
    for (const [cid, vals] of fails as [string, Record<string, any>][]) {
      const e2 = { ...ex, ...vals }
      lines.push(fill(w.checkFixes[cid], e2))
    }
    parts.push('<p class="sub">Failing checks, each with its fix:</p><ol>' + lines.map((l) => `<li>${l}</li>`).join('') + '</ol>')
    parts.push(
      '<details class="allchecks"><summary>Every check this step can raise (' +
        String(Object.keys(w.checkFixes).length) +
        ')</summary><ul>' +
        Object.values(w.checkFixes).map((v) => `<li>${fill(v, {})}</li>`).join('') +
        '</ul></details>',
    )
  }
  if (kind === 'policy') {
    parts.push('<div class="tabs"><span class="tab on">Portal steps</span><span class="tab">JSON</span><span class="tab">PowerShell</span></div>' + btn('Download JSON'))
  }
  // Dates
  if (st.dates) {
    parts.push(h('Dates'))
    parts.push(p(st.dates, ex))
  }
  // Done when
  parts.push(h('Done when'))
  parts.push(doneWhen(st.doneWhen || [], ex))
  // If it goes wrong
  if (st.ifWrong) {
    parts.push(h('If it goes wrong'))
    parts.push(p(st.ifWrong, ex))
  }
  if (st.lockedOut) {
    const lo = st.lockedOut
    parts.push(h(lo.label))
    parts.push(ol(lo.steps, ex))
  }
  // Comms
  const cm = st.comms
  if (cm) {
    parts.push(h('Tell your people'))
    const body = `<p>${esc(cm.salutation)}</p><p>${fill(cm.body, ex)}</p><p>${fill(cm.signature, ex)}</p>`
    parts.push(`<div class="copybox"><span class="copy">Copy</span>${body}</div>`)
    if (cm.adminBody) {
      parts.push(`<div class="copybox"><span class="copy">Copy</span><p>${esc('Admins,')}</p><p>${fill(cm.adminBody, ex)}</p><p>${fill(cm.signature, ex)}</p></div>`)
    }
    parts.push(`<p class="adapt">${esc(S.adaptLine)}</p>`)
  }
  // Controls
  const ctrls: string[] = []
  if (st.doesntApply) ctrls.push(btn(S.doesntApplyControl))
  if (st.scanControl) ctrls.push(btn(S.scanControl, true))
  if (ctrls.length) parts.push('<div class="controls">' + ctrls.join(' ') + '</div>')
  // More
  const m = st.more || {}
  parts.push('<details class="more" open><summary>More</summary>')
  const risks = m.risks || []
  if (risks.length) {
    parts.push(h('What could go wrong'))
    const ap = risks.filter((r: Record<string, any>) => r.applies === 'always' || truthy(ex[r.applies]))
    const rest = risks.filter((r: Record<string, any>) => !ap.includes(r))
    if (ap.length) parts.push('<ul>' + ap.map((r: Record<string, any>) => `<li>${fill(r.text, ex)} <span class="chip applies">applies here</span></li>`).join('') + '</ul>')
    if (rest.length) parts.push('<p class="sub">Also possible</p><ul>' + rest.map((r: Record<string, any>) => `<li>${fill(r.text, ex)}</li>`).join('') + '</ul>')
  }
  if (m.waits) {
    parts.push(h('What waits on this'))
    parts.push(p(m.waits, ex))
  }
  if (m.helpDesk) {
    parts.push(h('For the help desk'))
    parts.push(ul(m.helpDesk, ex))
  }
  if (m.manager) {
    parts.push(h('For your manager'))
    parts.push(p(m.manager, ex))
  }
  const mb = [btn('Copy as prompt')]
  if (st.skip) mb.push(btn('Skip this step'))
  parts.push('<div class="controls">' + mb.join(' ') + '</div></details>')
  parts.push('</div>')
  return '<section class="step">' + parts.join('') + '</section>'
}

const kv = (label: string, val: any, ex: Ex = {}): string => `<div class="kv"><div class="k">${esc(label)}</div><div class="val">${typeof val === 'string' ? fill(val, ex) : val}</div></div>`

// The non-step strings — pages, footer, How, the step tip — rendered exactly as
// render-review.py renders them, so content.test.ts can assert one full-body
// equality and prove every key is consumed by a renderer.
export function renderPages(): string {
  const P = C.pages
  const out: string[] = []
  const exT: Record<string, any> = { tenant: 'GetIAMAI', upn: 'Lachlan@getiamai.com', baselineName: 'Jon Hope — Defense in Depth', policyCount: 46, people: 12, policies: 10, from: 'Aug 1', to: 'Aug 31', emergencyAccounts: ['Breakglass'], signals: 'name, Global Administrator, excluded from 9 policies', exclusionsGroup: 'Breakglass Exclusion', n: 9, total: 10, countries: 'the United States', trustedLocations: [], serviceAccounts: [], sharedDevices: [], timezone: 'America/Denver', lane: 'Reading sign-in records', done: 3, steps: 31, inPlace: 7, finish: 'Sun Sep 27', weeks: '4 weeks', age: '17h ago', active: 4, enabled: 12, admins: 3, pct: '50%', date: 'Sep 1, 2026', blocker: 'Create or Correct Emergency Access Accounts', constraint: 'two changes prompt the same people, so Require a Fresh Sign-in for Intune Enrollment cannot enforce in the same window as Block Unsupported Device Platforms', stepTitle: 'Define the Trusted Network', reason: 'fully remote, no office network', licence: 'Microsoft Entra ID P2', policy: 'Monitor Kaladin using Forms', verdict: 'fine to keep', proposed: 'Core - Block - Copilot', current: 'weekly', wanted: '4 hours', name: 'Phase 1', start: 'Sep 8', end: 'Sep 13', measure: 'MFA readiness', threshold: '90%', value: '50%', thing: 'emergency access accounts', have: 1 }
  const sec = (title: string, body: string): void => {
    out.push(`<section class="page"><h3>${esc(title)}</h3>${body}</section>`)
  }
  const H = P.home
  if (H) {
    const hpl = H.planner
    out.push(
      '<section class="page"><h3>Home page — getiamai.com</h3>' +
        `<h2 class="h1">${esc(H.h1)}</h2>` +
        p(H.intro, {}) +
        h(H.toolsLabel) +
        `<div class="card"><b>${esc(hpl.name)}</b> <span class="chip">${esc(hpl.label)}</span><p class="sub">${esc(hpl.descriptor)}</p><p>${esc(hpl.body)}</p>` +
        btn(hpl.open, true) +
        btn(hpl.demo) +
        '</div>' +
        h(H.howLabel) +
        ul(H.how, {}) +
        h(H.aboutLabel) +
        p(H.about, {}) +
        '<p>' +
        (H.aboutLinks as string[]).map((l) => `<a>${esc(l)}</a>`).join(' &nbsp;·&nbsp; ') +
        '</p>' +
        `<p class="sub">${esc(H.footer)} &nbsp;·&nbsp; ` +
        (H.footerLinks as string[]).map((l) => `<a>${esc(l)}</a>`).join(' &nbsp;·&nbsp; ') +
        '</p>' +
        `<p class="sub">Meta description: ${esc(H.metaDescription)}</p></section>`,
    )
  }
  const o = P.opener
  sec(
    'The opener (signed out)',
    `<h2 class="h1">${esc(o.h1)}</h2>` +
      p(o.intro, {}) +
      h(o.builtForLabel) +
      p(o.builtFor, {}) +
      h(o.catchesLabel) +
      ul(o.catches, {}) +
      btn(o.signIn, true) +
      `<details><summary>${esc(o.permissionsSummary)}</summary><p class="sub">(the six-row permissions table, unchanged)</p><p>${esc(o.permissionsNote)}</p>${h(o.removingLabel)}${ol(o.removing, {})}</details>` +
      '<p>' +
      (o.links as string[]).map((l) => `<a>${esc(l)}</a>`).join(' &nbsp;·&nbsp; ') +
      '</p>' +
      `<details class="limits" open><summary>${esc(o.cantCatchSummary)}</summary>` +
      p(o.cantCatchIntro, {}) +
      ul(o.cantCatch, {}) +
      '</details>' +
      `<div class="tip">${esc(o.tip)}<span class="q">?</span></div>`,
  )
  const cn = P.connectNoScan
  sec(
    'Connect (signed in, no scan)',
    `<h2 class="h1">${esc(cn.h1)}</h2>` +
      p(cn.signedIn, exT) +
      p(cn.baselineLine, exT) +
      p(cn.baselineWhat, exT) +
      p(cn.baselineGoal, exT) +
      p(cn.baselineHow, exT) +
      btn(cn.scanButton, true) +
      p(cn.scanNote, {}) +
      p(cn.baselineUpdated, { date: 'Aug 28, 2026', n: 3 }) +
      p("Note: the line above renders only when the author's repository is ahead of the pinned version.", {}, 'annot') +
      `<p class="sub">While scanning: <span class="progress">${fill(cn.scanning, { lane: 'Reading sign-in records', done: 3, total: 8 })}</span> ${btn(cn.stop)}</p>`,
  )
  const t = P.tenant
  sec('Connect (scanned)', `<h2 class="h1">${esc(t.h1)}</h2>` + p(t.scanLine, exT) + btn(t.open, true) + `<div class="tip">${esc(t.tip)}<span class="q">?</span></div>`)
  const pl = P.plan
  const s = pl.settings
  sec(
    'Plan header, settings, blocked reasons, footer',
    `<h2 class="h1">${esc(pl.h1)}</h2>` +
      p(pl.line1, exT) +
      btn(pl.startControl, true) +
      p(pl.startNote, exT, 'sub') +
      p('After starting: ' + fill(pl.line1Started, { ...exT, done: 4, start: 'Mon Sep 7' }), exT, 'sub') +
      p(pl.line2, exT) +
      `<p class="sub">If it cannot finish: ${fill(pl.line1CannotFinish, exT)}</p><p class="sub">Length tooltip: ${fill(pl.lengthTip, exT)}</p>` +
      `<p class="sub">Phase heading: <b>${fill(C.phases.heading, exT)}</b> — first phase <b>${esc(C.phases.first)}</b>, last <b>${esc(C.phases.last)}</b></p>` +
      '<div class="settings"><b>' +
      esc(s.h3) +
      '</b>' +
      kv(s.start, '[date]  ' + s.startNote) +
      kv(s.freeze, `${s.freezeFrom} [date] ${s.freezeTo} [date]  ${s.freezeNote}`) +
      kv(s.timezone, 'America/Denver') +
      kv(s.signature, 'IT') +
      btn(s.close) +
      '</div>' +
      h('Blocked reasons (one per row)') +
      ul([pl.blocked.after, pl.blocked.readiness, pl.blocked.count], exT) +
      h('Gap suffix on a partly-in-place row') +
      ul([pl.gapSuffix['admin-session']], exT) +
      h('Footer groups') +
      ul([pl.footer.inPlace, pl.footer.doesntApply + ' — ' + pl.footer.doesntApplyRow, pl.footer.notLicensed + ' — ' + pl.footer.notLicensedRow + ' — ' + pl.footer.notLicensedNote, pl.footer.housekeeping + ' — ' + pl.footer.notInBaseline + ' · ' + pl.footer.rename], exT) +
      `<div class="tip">${esc(pl.tip)}<span class="q">?</span></div>`,
  )
  const td = P.today
  const tiles = Object.values(td.tiles)
    .map((v: any) => `<div class="tile"><div class="tv">${fill(v.value, exT)}</div><div class="tl">${esc(v.label)}</div>` + (v.heldBy ? `<div class="held">${esc(v.heldBy)}</div>` : '') + `<div class="ttip">${esc(v.tip)}</div></div>`)
    .join('')
  sec(
    'Today',
    `<h2 class="h1">${esc(td.h1)}</h2>` +
      p(td.purpose, {}) +
      p(td.line, exT) +
      `<div class="tiles">${tiles}</div>` +
      `<p class="sub">Show: ${(td.show as string[]).join(' · ')}</p>` +
      h('State definitions') +
      '<ul>' +
      Object.entries(td.states).map(([k, v]) => `<li><b>${esc(k)}</b> — ${esc(v)}</li>`).join('') +
      '</ul>' +
      h('Method definitions') +
      '<ul>' +
      Object.entries(td.methods).map(([k, v]) => `<li><b>${esc(k)}</b> — ${esc(v)}</li>`).join('') +
      '</ul>' +
      `<div class="tip">${esc(td.tip)}<span class="q">?</span></div>`,
  )
  const exP = P.export
  sec(
    'Export and print page 1',
    Object.values(exP.cards).map((v: any) => `<div class="card"><b>${esc(v[0])}</b><p>${esc(v[1])}</p><p class="sub">${esc(v[2])}</p></div>`).join('') +
      h('Print page 1') +
      ul([exP.printPage1.title, exP.printPage1.inPlace, exP.printPage1.toDo, exP.printPage1.doesntApply, exP.printPage1.notLicensed], { tenant: 'GetIAMAI', date: 'September 1, 2026', n: 7, finish: 'September 27' }) +
      `<div class="tip">${esc(exP.tip)}<span class="q">?</span></div>`,
  )
  sec(
    'Footer, How IAMAI works, step tip',
    p(P.footer.readOnly + ' · ' + (P.footer.links as string[]).join(' · '), {}) +
      h('How IAMAI works — reworded lines') +
      ul([P.how.exclusionsCheckReworded, P.how.groupSearchReworded, P.how.packageProblem], { policy: 'IAC - AGENT - BLOCK - HighRiskAgent' }) +
      p('Needs column now names the step: ' + Object.values(P.how.needsByStep).join(', '), {}) +
      p('Under Limits: ' + P.how.noAi, {}) +
      h('Tip on every step') +
      p(P.stepTip, {}),
  )
  return out.join('')
}

// The full <main> body render-review.py emits — steps in the script's order,
// then cleanup, then the pages — so the whole review page can be matched at once.
export function reviewBody(): string {
  const stepsAll = C.steps as Record<string, any>[]
  const prep = stepsAll.filter((x) => ['blocker', 'object', 'check', 'campaign'].includes(x.kind))
  const pol = stepsAll.filter((x) => x.kind === 'policy' && x.id !== 's-shared-devices')
  const sharedDev = stepsAll.filter((x) => x.id === 's-shared-devices')
  const body: string[] = []
  body.push('<h1>IAMAI Planner — every sentence, for review</h1><p class="lede">One box per step in the order the plan shows them, then every non-step string. Nothing here works; only the words and their format are real. GetIAMAI names where GetIAMAI has the case, demo names where it does not.</p>')
  body.push('<div class="legend"><var class="v">Underlined green</var> is filled by the engine from the tenant; everything else is fixed text from the content file. Chips, buttons and pickers are drawn as they would appear. <var class="v miss">{orange}</var> marks a variable the example did not fill.</div>')
  body.push(
    '<h3>Titles</h3><ol class="index">' +
      [...prep, ...sharedDev, ...pol].map((x) => `<li>${esc(x.title)}` + (x.licence ? ` <span class="sub">— ${esc(x.licence)}</span>` : '') + '</li>').join('') +
      Object.values(C.cleanup).map((c: any) => `<li>${esc(c.title)} <span class="sub">— Cleanup</span></li>`).join('') +
      '</ol>',
  )
  body.push('<div class="phase"><h3>Preparation · Sep 1 → Sep 7</h3></div>')
  for (const x of [...prep, ...sharedDev]) body.push(renderStep(x))
  body.push('<div class="phase"><h3>Phase 1 · Sep 8 → Sep 13 &nbsp;/&nbsp; Phase 2 · Sep 15 → Sep 20 &nbsp;/&nbsp; Phase 3 · Sep 22 → Sep 27</h3><p class="sub">Policy steps, one box each; which phase a step lands in is the engine&#8217;s call.</p></div>')
  for (const x of pol) body.push(renderStep(x))
  body.push('<div class="phase"><h3>Cleanup · after the last enforcement</h3></div>')
  for (const c of Object.values(C.cleanup)) body.push(renderCleanup(c as Record<string, any>))
  body.push('<h2 class="h1" style="margin-top:40px">Everything that is not a step</h2>')
  body.push(renderPages())
  return body.join('')
}

export function renderCleanup(c: Record<string, any>): string {
  const parts = [`<div class="steprow"><span class="chip status">Ready</span><span class="title">${esc(c.title)}</span></div><div class="stepbody">`]
  parts.push(h('Why') + p(c.why, {}))
  parts.push(
    h('What to do') +
      ol(c.whatToDo, {
        emergencyAccountUpns: ['breakglass@getiamai.onmicrosoft.com', 'emergency2@getiamai.onmicrosoft.com'],
        renames: ['ACME - APP - BLOCK - Copilot → Core - Block - Copilot'],
        convention: 'Core - Verb - Subject',
        overlaps: ['Core - Allow - MFA for Admins', 'Core - Require - Phishing-resistant MFA for admins'],
        policies: ['IAC - AGENT - BLOCK - HighRiskAgent', 'IAC - AGENT - BLOCK - NonTrustedAgents'],
      }),
  )
  parts.push(h('Done when') + ul(c.doneWhen, { convention: 'Core - Verb - Subject' }))
  parts.push('<div class="controls">' + btn(S.scanControl, true) + '</div></div>')
  return '<section class="step">' + parts.join('') + '</section>'
}
