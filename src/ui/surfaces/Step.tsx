// A step, opened in place under its row (prompt 48 Part 3, target-state §6).
// First open shows, in order and nothing else: the title with its status word
// and one line of what changes, Why, Who this touches (the population then the
// evidence lines from Part 1), Do it, Dates, Done when, If it goes wrong, Tell
// your people. Then one More with the catalogue and the rest.
import { useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import { PLAN as C } from '../../copy/plan.ts'
import { populationLine } from '../../derive/whoLine.ts'
import { REDACTED, exportClipboard, exportDownload } from '../exportGuard.ts'
import { unknownsFor } from '../../roadmap/unknowns.ts'
import { promptFor, stepContext } from '../../roadmap/prompts.ts'
import { isEmergencyAccess } from '../../roadmap/blockerSteps.ts'
import { SKIP } from '../../copy/skip.ts'
import { toCsv } from '../format.ts'
import { Button, Status } from '../components/index.ts'
import { statusOf } from './statusWord.ts'

type DoTab = 'portal' | 'json' | 'ps'
const MAX_NAMES = 10

// The two Dates side-lines live on Dates now, so the catalogue does not repeat them (item 7).
const DATE_LINE_TITLES = new Set(['Report-only prompts for a certificate', 'Existing tokens keep working'])

export function Step({ step, schedule, steps, tenantName, nameOf, onSkip, onUnskip, onTick, onClose }: {
  step: Step
  schedule: Schedule
  steps: Step[]
  tenantName: string
  nameOf: (id: string) => string
  onSkip: (reason: string) => void
  onUnskip: () => void
  onTick: (key: 'credentialStorage' | 'signInMonitoring', done: boolean) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<DoTab>('portal')
  const [copied, setCopied] = useState<string | null>(null)
  const status = statusOf(step)
  const copy = (id: string, text: string): void => {
    void exportClipboard(text, REDACTED).then((ok) => {
      if (!ok) return
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  const pop = step.population

  return (
    <div className="step-body">
      <p className="line">
        <span className="step-title">{step.plainTitle || step.title}</span> <Status tone={status.tone}>{status.word}</Status>
      </p>
      <p className="reason">{step.whatChanges}</p>

      <h3>{C.step.why}</h3>
      <p>
        {step.why}{' '}
        {step.learn && (
          <a href={step.learn.url} target="_blank" rel="noopener noreferrer">
            {C.step.learn}
          </a>
        )}
        {step.learn?.cis.map((c) => (
          <span key={c} className="chip">
            {C.step.cis(c)}
          </span>
        ))}
      </p>

      <h3>{C.step.whoTouches}</h3>
      <p className="line">{populationLine(pop)}</p>
      {(step.scenarioLines ?? []).map((l, i) => (
        <p key={i} className="reason">
          {l.text}
          {l.people.length > MAX_NAMES && (
            <>
              {' '}
              <Button variant="tertiary" onClick={() => exportPeople(step, l.people, nameOf)}>
                {C.step.exportCsv}
              </Button>
            </>
          )}
        </p>
      ))}
      {step.includesOperator && step.operatorNote && <p className="reason">{step.operatorNote}</p>}

      <h3>{C.step.doIt}</h3>
      {step.action.omits && step.action.omits.length > 0 && <p className="reason omits-note">{C.step.omitsJson(step.action.omits)}</p>}
      {step.action.json ? (
        <>
          <div className="tabs no-print" role="tablist">
            {([['portal', C.step.portalSteps], ['json', C.step.json], ['ps', C.step.powershell]] as [DoTab, string][]).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'portal' && (
            <ol className="sections">
              {step.action.portalSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {tab === 'json' && <pre className="mono">{step.action.json}</pre>}
          {tab === 'ps' && <pre className="mono">{step.action.powershell}</pre>}
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`${step.id}.json`, step.action.json!, 'application/json', REDACTED)}>
              {C.step.downloadJson}
            </Button>
          </p>
        </>
      ) : (
        <ol className="sections">
          {step.action.portalSteps.length > 0 ? step.action.portalSteps.map((s, i) => <li key={i}>{s}</li>) : step.action.summary.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}

      <h3>{C.step.dates}</h3>
      {step.events ? (
        <p className="line">{C.step.datesLine(step.events.announce?.date ?? '—', schedule.reportOnlyAt[step.id] ? shortDate(schedule.reportOnlyAt[step.id]) : '—', step.events.enforce.date)}</p>
      ) : (
        <p className="reason">{C.who.now}</p>
      )}
      {step.rings.length > 1 && (
        <p className="reason">{step.rings.map((r) => C.step.ring(r.name, shortDate(r.plannedStart), r.targeting.memberCount)).join(' · ')}</p>
      )}
      {(step.dateNotes ?? []).map((n, i) => (
        <p key={i} className="reason">
          {n}
        </p>
      ))}

      <h3>{C.step.doneWhen}</h3>
      <ul className="sections">
        {step.exitCriteria.slice(0, 3).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
        {(step.tickable ?? []).map((t) => (
          <li key={t.key} className="tick">
            <label>
              <input type="checkbox" checked={t.done} onChange={(e) => onTick(t.key, e.currentTarget.checked)} /> {t.text}
            </label>
          </li>
        ))}
      </ul>

      <h3>{C.step.ifWrong}</h3>
      <p className="line">
        {step.rollback}{' '}
        <a href="#/recovery">{C.step.recovery}</a>
      </p>

      {step.comms && (
        <>
          <h3>{C.step.tellPeople}</h3>
          <pre className="mono comms-draft">{step.comms}</pre>
          <p className="actions">
            <Button variant="secondary" onClick={() => copy('comms', step.comms!)}>
              {copied === 'comms' ? 'Copied' : C.step.copy}
            </Button>
          </p>
        </>
      )}

      <More step={step} steps={steps} tenantName={tenantName} copy={copy} copied={copied} onSkip={onSkip} onUnskip={onUnskip} />

      <p className="actions no-print">
        <Button variant="tertiary" onClick={onClose}>
          {C.step.close}
        </Button>
      </p>
    </div>
  )
}

function More({ step, steps, tenantName, copy, copied, onSkip, onUnskip }: { step: Step; steps: Step[]; tenantName: string; copy: (id: string, text: string) => void; copied: string | null; onSkip: (reason: string) => void; onUnskip: () => void }) {
  const [confirmSkip, setConfirmSkip] = useState(false)
  const catalogue = step.failureModes.filter((f) => !DATE_LINE_TITLES.has(f.title))
  const unknowns = unknownsFor(step)
  const dependents = steps.filter((x) => x.blockedBy.includes(step.id) && x.status !== 'done' && x.status !== 'skipped')
  return (
    <details className="more">
      <summary>{C.step.more}</summary>

      <h3>{C.step.couldGoWrong}</h3>
      <ul className="sections">
        {catalogue.map((f, i) => (
          <li key={i}>
            {f.title}
            {f.applies === 'yes' && <span className="chip">{C.step.appliesHere}</span>}
          </li>
        ))}
        {citationUrl(catalogue) && (
          <li>
            <a href={citationUrl(catalogue)!} target="_blank" rel="noopener noreferrer">
              {C.step.learn}
            </a>
          </li>
        )}
      </ul>

      <h3>{C.step.prerequisites}</h3>
      {step.blockedBy.length > 0 || step.unblockNotes.length > 0 ? (
        <ul className="sections">{step.unblockNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      ) : (
        <p className="reason">{C.step.noPrerequisites}</p>
      )}

      <h3>{C.step.waitsOnThis}</h3>
      {dependents.length > 0 ? (
        <ul className="sections">{dependents.map((d) => <li key={d.id}>{d.plainTitle || d.title}</li>)}</ul>
      ) : (
        <p className="reason">{C.step.nothingWaits}</p>
      )}

      <h3>{C.step.exitCriteria}</h3>
      <ul className="sections">
        {step.exitCriteria.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
        {step.rings.flatMap((r) => r.exitCriteria).map((x, i) => (
          <li key={`r${i}`}>{x}</li>
        ))}
      </ul>

      {step.helpDesk && (
        <>
          <h3>{C.step.forHelpDesk}</h3>
          <ul className="sections">
            {step.helpDesk.whatToSay.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      )}

      <h3>{C.step.forManager}</h3>
      <p className="reason">{step.forManager}</p>
      <p className="actions">
        <Button variant="secondary" onClick={() => copy('manager', step.forManager)}>
          {copied === 'manager' ? 'Copied' : C.step.copy}
        </Button>
        <Button variant="tertiary" onClick={() => copy('prompt', promptFor('wholePlan', tenantName, stepContext(step), step.forManager))}>
          {C.step.copyAsPrompt}
        </Button>
      </p>

      {(step.cantSee ?? []).length > 0 && (
        <>
          <h3>{C.step.cantSee}</h3>
          <ul className="sections">
            {step.cantSee!.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
            {unknowns.map((u) => (
              <li key={u.id}>{u.cannotSee}</li>
            ))}
          </ul>
        </>
      )}

      {step.status === 'skipped' ? (
        <p className="actions">
          <Button variant="tertiary" onClick={onUnskip}>
            {SKIP.unskip}
          </Button>
        </p>
      ) : isEmergencyAccess(step) ? null : confirmSkip ? (
        <p className="actions skip-confirm reason">
          {SKIP.confirmLine}{' '}
          <Button variant="tertiary" onClick={() => { setConfirmSkip(false); onSkip(SKIP.defaultReason) }}>
            {SKIP.confirmSkip}
          </Button>
          <Button variant="tertiary" onClick={() => setConfirmSkip(false)}>
            {SKIP.confirmCancel}
          </Button>
        </p>
      ) : (
        <p className="actions">
          <Button variant="tertiary" onClick={() => setConfirmSkip(true)}>
            {C.step.skip}
          </Button>
        </p>
      )}
    </details>
  )
}

function citationUrl(modes: Step['failureModes']): string | null {
  for (const m of modes) {
    const c = m.citation
    if (c && typeof c === 'object' && 'url' in c) return c.url
  }
  return null
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function exportPeople(step: Step, ids: string[], nameOf: (id: string) => string): void {
  exportDownload(`${step.id}-people.csv`, toCsv(['Name'], ids.map((id) => [nameOf(id)])), 'text/csv', REDACTED)
}
