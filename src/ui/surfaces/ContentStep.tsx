// A step opened in place, rendered from content.json (prompt 51 §6, §8.9). Every
// sentence is a string in the content file filled with the tenant's values
// (src/ui/surfaces/stepVars.ts); the What-to-do on a policy step is the portal
// translator over the goal's baseline policy (stepPortal.ts), because the
// baseline wins. This is the React port of src/content/render.ts renderStep, with
// the live controls the review page has no need of. Sections render in §6 order,
// and only when they have content.
import { useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import { content } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, missingVars, SINGLE_CHOICE_SOURCES } from '../../content/render.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'
import { REDACTED, exportClipboard, exportDownload } from '../exportGuard.ts'
import { Button, Status } from '../components/index.ts'
import { statusOf } from './statusWord.ts'

type Ex = Record<string, unknown>
type DoTab = 'portal' | 'json' | 'ps'

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))
const listKeys = (line: string): string[] => [...line.matchAll(/\{list:([^}]+)\}/g)].map((m) => m[1])

/** A content string, filled with the tenant's values. */
function T({ s, ex }: { s: unknown; ex: Ex }) {
  if (s === null || s === undefined) return null
  return <>{fillText(s, ex as Record<string, unknown>)}</>
}

/** True when a content line has every variable it names — no hole (walk-51 item 2). */
const whole = (s: unknown, ex: Ex): boolean => typeof s !== 'string' || missingVars(s, ex as Record<string, unknown>).length === 0

/** A content line as a paragraph, rendered only when it has no hole. */
function Line({ s, ex, cls }: { s: unknown; ex: Ex; cls?: string }) {
  if (s === null || s === undefined || !whole(s, ex)) return null
  return <p className={cls}><T s={s} ex={ex} /></p>
}

export function ContentStep({
  step,
  ctx,
  onSkip,
  onUnskip,
  onClose,
  onScan,
  decision = null,
  onDecide,
  printing = false,
}: {
  step: Step
  ctx: StepVarContext
  onSkip: (reason: string) => void
  onUnskip: () => void
  onClose: () => void
  onScan?: () => void
  /** This step's saved decision, when one was made (prompt 52 Part 3). */
  decision?: StepDecision | null
  /** The picker's Save: the ticked ids or the chosen option become the plan's decision. */
  onDecide?: (decision: { picked?: string[]; option?: string }) => void
  /** Printing: More stands open, so every step prints in full (§7). */
  printing?: boolean
}) {
  const [tab, setTab] = useState<DoTab>('portal')
  const [copied, setCopied] = useState<string | null>(null)
  // The content step (resolved the same way the plan row resolves its title).
  const cs = contentStepFor(step) as Record<string, any> | undefined
  const status = statusOf(step)
  const ex = stepVars(step, ctx) as Ex
  const copy = (id: string, text: string): void => {
    void exportClipboard(text, REDACTED).then((ok) => {
      if (!ok) return
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  // No content for this step id (a step the baseline does not carry, or a
  // non-content step): render nothing here — the row already carried its status.
  if (!cs) return <div className="step-body" />

  const learn = cs.learn || {}
  const who = cs.who || {}
  const d = cs.decision
  const w = cs.whatToDo || {}
  // The tenant's objects behind the baseline's placeholders (a saved decision
  // included), or the names the plan proposes for them, so every line is a name.
  const portalNames = portalNamesFor(ctx, ex, String(cs.title))
  // The baseline's policy through the translator; a floor step (Microsoft
  // recommended, not in this baseline) renders Microsoft's template the engine
  // resolved for this tenant, through the same translator.
  const portalLines = cs.kind === 'policy' ? (stepPortalLines(step.goalId, portalNames) ?? (step.floor && step.action.json ? stepPortalLinesFromBody(step.action.json, portalNames) : null)) : null
  // A goal the baseline holds no policy for has no portal lines; an empty list is
  // not a What to do (the shared-devices step rendered an empty section).
  const portal = portalLines && portalLines.length > 0 ? portalLines : null
  const hasChecks = Array.isArray(ex.failingChecks) && (ex.failingChecks as unknown[]).length > 0 && Boolean(w.checkFixes)
  const hasSteps = Array.isArray(w.steps) && (w.steps as unknown[]).length > 0
  // §8.7: a section with no content is not rendered. A step with nothing to do
  // is a missing content key, logged by the walk, never an empty heading.
  const hasWhatToDo = Boolean(w.lead) || hasChecks || (truthy(ex.needsCreate) && Array.isArray(w.create)) || portal !== null || hasSteps

  return (
    <div className="step-body">
      <p className="line">
        <span className="step-title">{cs.title}</span> <Status tone={status.tone}>{status.word}</Status>
      </p>
      <Line s={cs.changeLine} ex={ex} cls="reason" />
      <Line s={cs.partner} ex={ex} cls="reason partner" />

      <h3>Why</h3>
      <p>
        <T s={cs.why} ex={ex} />{' '}
        {learn.url && (
          <a href={learn.url} target="_blank" rel="noopener noreferrer">
            Learn →
          </a>
        )}
        {learn.url && learn.cis && ' '}
        {learn.cis && <span className="chip">CIS {learn.cis}</span>}
      </p>

      {whoHasContent(who, ex) && <h3>Who this touches</h3>}
      {whoLead(who, ex) && <Line s={who.lead} ex={ex} cls="line" />}
      {evidenceLines(who, ex).filter((line) => whole(line, ex)).map((line, i) => (
        <WhoLine key={i} line={line} ex={ex} />
      ))}
      {/* The campaign's people lists: each bucket with its members, only where the
          bucket has people (walk-51 item 3). */}
      {who.groups && Object.entries(who.groups as Record<string, unknown>).map(([gk, gl]) => {
        const items = (ex[gk] as string[]) || []
        if (items.length === 0) return null
        return (
          <div key={gk} className="names-group">
            <p className="reason"><T s={gl} ex={{ ...(ex as Record<string, unknown>), n: items.length }} /></p>
            <ol className="names">{items.map((nm, i) => <li key={i}>{nm}</li>)}</ol>
          </div>
        )
      })}
      {who.groups && who.overlap && <Line s={who.overlap} ex={ex} cls="sub" />}
      {who.groups && who.adminsNote && truthy(ex.admins) && <p className="reason"><T s={who.adminsNote} ex={ex} /></p>}

      {d && <Decision d={d} ex={ex} saved={decision} onDecide={onDecide} />}

      {hasWhatToDo && <h3>What to do</h3>}
      {hasWhatToDo && w.lead && <p><T s={w.lead} ex={ex} /></p>}
      {/* A check step (emergency access, exclusions group): one numbered fix line
          per failing check, filled from that check's values (walk-51 item 14). */}
      {Array.isArray(ex.failingChecks) && (ex.failingChecks as unknown[]).length > 0 && w.checkFixes && (
        <ol className="sections">
          {(ex.failingChecks as [string, Record<string, unknown>][]).map(([key, vals], i) =>
            (w.checkFixes as Record<string, string>)[key] ? <li key={i}>{fillText((w.checkFixes as Record<string, string>)[key], { ...(ex as Record<string, unknown>), ...vals })}</li> : null,
          )}
        </ol>
      )}
      {/* The create instructions, when fewer than two accounts exist. */}
      {truthy(ex.needsCreate) && Array.isArray(w.create) && (
        <ol className="sections">{(w.create as unknown[]).map((l, i) => <li key={i}><T s={l} ex={ex} /></li>)}</ol>
      )}
      {portal ? (
        <>
          <div className="tabs no-print" role="tablist">
            {([['portal', 'Portal steps'], ['json', 'JSON'], ['ps', 'PowerShell']] as [DoTab, string][]).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'portal' && <ol className="sections">{portal.map((l, i) => <li key={i}>{l}</li>)}</ol>}
          {tab === 'json' && <pre className="mono">{JSON.stringify(policyJson(step), null, 2)}</pre>}
          {tab === 'ps' && <pre className="mono">{portal.join('\n')}</pre>}
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`${step.id}.json`, JSON.stringify(policyJson(step), null, 2), 'application/json', REDACTED)}>
              Download JSON
            </Button>
          </p>
        </>
      ) : (
        hasSteps && <ol className="sections">{(w.steps as unknown[]).map((l, i) => <li key={i}><T s={l} ex={ex} /></li>)}</ol>
      )}

      {cs.dates && whole(cs.dates, ex) && (
        <>
          <h3>Dates</h3>
          <p className="line"><T s={cs.dates} ex={ex} /></p>
        </>
      )}

      {(() => {
        // Expand the shared policy/change done-when placeholders, then drop any
        // line with a hole; the heading appears only if a line survives (§8.7).
        const shared = content.shared as Record<string, string[]>
        const dw = (cs.doneWhen || []).flatMap((x: unknown) => (x === '{policyDoneWhen}' ? shared.policyDoneWhen : x === '{changeDoneWhen}' ? shared.changeDoneWhen : [x])).filter((x: unknown) => whole(x, ex))
        if (dw.length === 0) return null
        return (
          <>
            <h3>Done when</h3>
            <ul className="sections">{dw.map((x: unknown, i: number) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
          </>
        )
      })()}

      {cs.ifWrong && whole(cs.ifWrong, ex) && (
        <>
          <h3>If it goes wrong</h3>
          <p className="line"><T s={cs.ifWrong} ex={ex} /></p>
        </>
      )}
      {cs.lockedOut && (
        <>
          <h3>{cs.lockedOut.label}</h3>
          <ul className="sections">{(cs.lockedOut.steps || []).map((x: unknown, i: number) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
        </>
      )}

      {cs.comms && (
        <>
          <h3>Tell your people</h3>
          <div className="copy-box">
            <Button variant="secondary" onClick={() => copy('comms', commsText(cs.comms, ex))}>
              {copied === 'comms' ? 'Copied' : 'Copy'}
            </Button>
            <p><T s={cs.comms.salutation} ex={ex} /></p>
            <p><T s={cs.comms.body} ex={ex} /></p>
            <p><T s={cs.comms.signature} ex={ex} /></p>
          </div>
        </>
      )}

      <More cs={cs} ex={ex} step={step} onSkip={onSkip} onUnskip={onUnskip} copy={copy} copied={copied} open={printing === true} />

      <p className="actions no-print">
        {cs.scanControl && onScan && (
          <Button variant="secondary" onClick={onScan}>
            Scan to update the plan
          </Button>
        )}
        <Button variant="tertiary" onClick={onClose}>
          Close
        </Button>
      </p>
    </div>
  )
}

/**
 * A lead that ends in a colon promises what follows it. It renders only when
 * something does: an evidence line, a none-branch line, a group list, or a list
 * the lead itself carries (the walk found "…with who signs in from each:" over
 * nothing on the countries step).
 */
function whoLead(who: Record<string, any>, ex: Ex): boolean {
  const lead = who.lead
  if (typeof lead !== 'string' || !whole(lead, ex)) return false
  if (!/:\s*$/.test(lead)) return true
  if (evidenceLines(who, ex).some((line) => whole(line, ex))) return true
  if (who.groups && Object.keys(who.groups as Record<string, unknown>).some((gk) => Array.isArray(ex[gk]) && (ex[gk] as unknown[]).length > 0)) return true
  return false
}

/**
 * One who-line. A line that ends in a list of names — `{list:accounts}` alone,
 * or prose ending in `: {list:accounts}` — renders the names as a list, one per
 * row, never inline (§6.3, §6.5); the prose before it stays a line.
 */
function WhoLine({ line, ex }: { line: string; ex: Ex }) {
  const m = /^(.*?)\s*\{list:([a-zA-Z0-9_]+)\}\s*$/.exec(line)
  const items = m ? ex[m[2]] : undefined
  if (!m || !Array.isArray(items) || items.length === 0) return <p className="reason"><T s={line} ex={ex} /></p>
  const lead = m[1].trim()
  return (
    <div className="names-group">
      {lead && <p className="reason"><T s={lead} ex={ex} /></p>}
      <ol className="names">{(items as unknown[]).map((nm, i) => <li key={i}>{String(nm)}</li>)}</ol>
    </div>
  )
}

/** §8.7: the Who heading renders only when a lead, a line or a group renders under it. */
function whoHasContent(who: Record<string, any>, ex: Ex): boolean {
  if (whoLead(who, ex)) return true
  if (evidenceLines(who, ex).some((line) => whole(line, ex))) return true
  if (who.groups && Object.keys(who.groups as Record<string, unknown>).some((gk) => Array.isArray(ex[gk]) && (ex[gk] as unknown[]).length > 0)) return true
  return false
}

/** The who-line evidence lines that apply to this tenant (render.ts renderStep gating). */
function evidenceLines(who: Record<string, any>, ex: Ex): string[] {
  const out: string[] = []
  let none: string | null = null
  for (const [k, v] of Object.entries(who)) {
    if (['lead', 'groups', 'adminsNote', 'timeline', 'overlap'].includes(k)) continue
    if (k === 'none') {
      none = typeof v === 'string' ? v : null
      continue
    }
    const arr = Array.isArray(v) ? (v as string[]) : typeof v === 'string' ? [v] : []
    for (let line of arr) {
      if (line === '{existingCoverage}') {
        if (!truthy(ex.existingPolicies)) continue
        line = String((content.shared as Record<string, unknown>).existingCoverage)
      }
      const lk = listKeys(line)
      if (lk.length > 0 && lk.every((k2) => !truthy(ex[k2]))) continue
      if (lk.length === 0 && line.includes('{n}') && (ex.n ?? 1) === 0) continue
      out.push(line)
    }
  }
  // The none branch stands in only when nothing else in the block renders.
  if (none !== null && !out.some((line) => whole(line, ex))) out.push(none)
  return out
}

function Decision({ d, ex, saved, onDecide }: { d: Record<string, any>; ex: Ex; saved: StepDecision | null; onDecide?: (decision: { picked?: string[]; option?: string }) => void }) {
  // One row per thing the picker's source names (walk-51 item 3): the source
  // holds the rendered rows, its Ids twin the ids behind them, so a tick is a
  // decision about an account, not a string. A picker with no source reads the
  // key its own rows were built under (pickerKey), never another step's list.
  // No rows, no picker. The Ticked twin (the plan's current value, else
  // everything nominated) starts ticked; a saved decision replaces that.
  const keys: string[] = d.pickerSource ? [d.pickerSource] : typeof ex.pickerKey === 'string' ? [ex.pickerKey] : []
  const key = d.pickerRow ? (keys.find((k) => Array.isArray(ex[k]) && (ex[k] as unknown[]).length > 0) ?? null) : null
  const rows: string[] = key ? (ex[key] as string[]) : []
  const idsOf = key ? ex[`${key}Ids`] : undefined
  const ids: string[] = Array.isArray(idsOf) && (idsOf as string[]).length === rows.length ? (idsOf as string[]) : rows
  // A group or a location is one choice (radio); every other picker ticks many.
  const single = !d.multi && SINGLE_CHOICE_SOURCES.includes(String(d.pickerSource ?? key ?? ''))
  const tickedOf = key ? ex[`${key}Ticked`] : undefined
  const initial: string[] = saved?.picked ?? (Array.isArray(tickedOf) ? (tickedOf as string[]) : single ? ids.slice(0, 1) : ids)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial))
  // An option with a variable the scan cannot fill is not offered (walk-51 item 2).
  const options: string[] = (Array.isArray(d.options) ? (d.options as string[]) : []).filter((o) => whole(o, ex))
  const [option, setOption] = useState<string | null>(saved?.option ?? null)
  const toggle = (id: string): void =>
    setPicked((prev) => {
      if (single) return new Set([id])
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const save = (): void => onDecide?.({ ...(rows.length > 0 ? { picked: ids.filter((id) => picked.has(id)) } : {}), ...(option !== null ? { option } : {}) })
  // The help is explanatory prose and renders in the flow, not inside the
  // .decision row (which the contract measures against the row budget).
  return (
    <>
      <Line s={d.help} ex={ex} cls="reason" />
      <div className="decision">
        <div className="dlabel">{d.label}</div>
        {rows.length > 0 && (
          <div className="picker">
            {rows.map((row, i) => (
              <label key={i}><input type={single ? 'radio' : 'checkbox'} name={single ? d.label : undefined} checked={picked.has(ids[i])} onChange={() => toggle(ids[i])} /> {row}</label>
            ))}
          </div>
        )}
        {options.length > 0 && <div className="picker">{options.map((o, i) => <label key={i}><input type="radio" name={`${d.label}-option`} checked={option === o} onChange={() => setOption(o)} /> <T s={o} ex={ex} /></label>)}</div>}
        <Button variant="secondary" onClick={save}>{d.save || 'Save'}</Button>
      </div>
    </>
  )
}

function More({ cs, ex, step, onSkip, onUnskip, copy, copied, open = false }: { cs: Record<string, any>; ex: Ex; step: Step; onSkip: (r: string) => void; onUnskip: () => void; copy: (id: string, t: string) => void; copied: string | null; open?: boolean }) {
  const more = cs.more || {}
  const risks = (more.risks || []) as { text: string; applies?: string }[]
  const applies = risks.filter((r) => r.applies && truthy(ex[r.applies]))
  const rest = risks.filter((r) => !(r.applies && truthy(ex[r.applies])))
  return (
    <details className="more" open={open || undefined}>
      <summary>More</summary>
      {risks.length > 0 && (
        <>
          <h3>What could go wrong</h3>
          {/* The items that apply here first, marked; the rest under Also possible.
              When none applies the rest stand under the heading, never an empty list. */}
          {applies.length > 0 && <ul className="sections">{applies.map((r, i) => <li key={i}><T s={r.text} ex={ex} /> <span className="chip">applies here</span></li>)}</ul>}
          {rest.length > 0 && applies.length > 0 && <p className="sub">Also possible</p>}
          {rest.length > 0 && <ul className="sections">{rest.map((r, i) => <li key={i}><T s={r.text} ex={ex} /></li>)}</ul>}
        </>
      )}
      {Array.isArray(more.helpDesk) && (more.helpDesk as unknown[]).filter((x) => whole(x, ex)).length > 0 && (
        <>
          <h3>For the help desk</h3>
          <ul className="sections">{(more.helpDesk as unknown[]).filter((x) => whole(x, ex)).map((x, i) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
        </>
      )}
      {more.manager && whole(more.manager, ex) && (
        <>
          <h3>For your manager</h3>
          <p className="reason"><T s={more.manager} ex={ex} /></p>
          <p className="actions"><Button variant="secondary" onClick={() => copy('manager', fillText(more.manager, ex as Record<string, unknown>))}>{copied === 'manager' ? 'Copied' : 'Copy'}</Button></p>
        </>
      )}
      {cs.skip && step.status !== 'skipped' && (
        <p className="actions"><Button variant="tertiary" onClick={() => onSkip('Not needed for this tenant')}>Skip this step</Button></p>
      )}
      {step.status === 'skipped' && <p className="actions"><Button variant="tertiary" onClick={onUnskip}>Put this step back</Button></p>}
    </details>
  )
}

function commsText(comms: Record<string, any>, ex: Ex): string {
  return [fillText(comms.salutation, ex as Record<string, unknown>), fillText(comms.body, ex as Record<string, unknown>), fillText(comms.signature, ex as Record<string, unknown>)].join('\n\n')
}

function policyJson(step: Step): unknown {
  return step.action?.json ? JSON.parse(step.action.json) : { note: 'Portal steps show the policy to create.' }
}
