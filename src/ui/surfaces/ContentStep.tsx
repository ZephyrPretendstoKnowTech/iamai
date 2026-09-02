// A step opened in place, rendered from content.json (prompt 51 §6, §8.9). Every
// sentence is a string in the content file filled with the tenant's values
// (src/ui/surfaces/stepVars.ts); the What-to-do on a policy step is the portal
// translator over the goal's baseline policy (stepPortal.ts), because the
// baseline wins. This is the React port of src/content/render.ts renderStep, with
// the live controls the review page has no need of. Sections render in §6 order,
// and only when they have content.
import { useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import { content } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines } from './stepPortal.ts'
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
}: {
  step: Step
  ctx: StepVarContext
  onSkip: (reason: string) => void
  onUnskip: () => void
  onClose: () => void
  onScan?: () => void
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
  const portal = cs.kind === 'policy' ? stepPortalLines(step.goalId, { nameOf: ctx.nameOf, policyName: String(ex.policyName ?? cs.title), strengthName: (ex as { strengthName?: string }).strengthName ?? null }) : null

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
        {learn.cis && <span className="chip">CIS {learn.cis}</span>}
      </p>

      <h3>Who this touches</h3>
      <Line s={who.lead} ex={ex} cls="line" />
      {evidenceLines(who, ex).filter((line) => whole(line, ex)).map((line, i) => (
        <p key={i} className="reason"><T s={line} ex={ex} /></p>
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

      {d && <Decision d={d} ex={ex} />}

      <h3>What to do</h3>
      {w.lead && <p><T s={w.lead} ex={ex} /></p>}
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
        Array.isArray(w.steps) && <ol className="sections">{(w.steps as unknown[]).map((l, i) => <li key={i}><T s={l} ex={ex} /></li>)}</ol>
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

      <More cs={cs} ex={ex} step={step} onSkip={onSkip} onUnskip={onUnskip} copy={copy} copied={copied} />

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

/** The who-line evidence lines that apply to this tenant (render.ts renderStep gating). */
function evidenceLines(who: Record<string, any>, ex: Ex): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(who)) {
    if (['lead', 'groups', 'adminsNote', 'timeline', 'overlap'].includes(k)) continue
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
  return out
}

function Decision({ d, ex }: { d: Record<string, any>; ex: Ex }) {
  // The help is explanatory prose and renders in the flow, not inside the
  // .decision row (which the contract measures against the row budget).
  return (
    <>
      {d.help && <p className="reason"><T s={d.help} ex={ex} /></p>}
      <div className="decision">
        <div className="dlabel">{d.label}</div>
        {/* One row per person the picker's source names (walk-51 item 3): the
            source holds the rendered "name · state" rows. No source, no picker. */}
        {d.pickerRow && Array.isArray(ex[d.pickerSource]) && (ex[d.pickerSource] as string[]).length > 0 && (
          <div className="picker">
            {(ex[d.pickerSource] as string[]).map((row, i) => (
              <label key={i}><input type="checkbox" defaultChecked readOnly /> {row}</label>
            ))}
          </div>
        )}
        {Array.isArray(d.options) && <div className="picker">{(d.options as string[]).map((o, i) => <label key={i}><input type="radio" name={d.label} readOnly /> <T s={o} ex={ex} /></label>)}</div>}
        <Button variant="secondary" onClick={() => undefined}>{d.save || 'Save'}</Button>
      </div>
    </>
  )
}

function More({ cs, ex, step, onSkip, onUnskip, copy, copied }: { cs: Record<string, any>; ex: Ex; step: Step; onSkip: (r: string) => void; onUnskip: () => void; copy: (id: string, t: string) => void; copied: string | null }) {
  const more = cs.more || {}
  const risks = (more.risks || []) as { text: string; applies?: string }[]
  const applies = risks.filter((r) => r.applies && truthy(ex[r.applies]))
  const rest = risks.filter((r) => !(r.applies && truthy(ex[r.applies])))
  return (
    <details className="more">
      <summary>More</summary>
      {risks.length > 0 && (
        <>
          <h3>What could go wrong</h3>
          <ul className="sections">{applies.map((r, i) => <li key={i}><T s={r.text} ex={ex} /> <span className="chip">applies here</span></li>)}</ul>
          {rest.length > 0 && <><p className="sub">Also possible</p><ul className="sections">{rest.map((r, i) => <li key={i}><T s={r.text} ex={ex} /></li>)}</ul></>}
        </>
      )}
      {more.helpDesk && (
        <>
          <h3>For the help desk</h3>
          <ul className="sections">{(more.helpDesk as unknown[]).map((x, i) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
        </>
      )}
      {more.manager && (
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
