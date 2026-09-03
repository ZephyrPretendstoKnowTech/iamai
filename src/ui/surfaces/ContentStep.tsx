// A step opened in place, rendered from content.json (prompt 51 §6, §8.9). Every
// sentence is a string in the content file filled with the tenant's values
// (src/ui/surfaces/stepVars.ts); the What-to-do on a policy step is the portal
// translator over the goal's baseline policy (stepPortal.ts), because the
// baseline wins. This is the React port of src/content/render.ts renderStep, with
// the live controls the review page has no need of. Sections render in §6 order,
// and only when they have content.
import { useState, useMemo } from 'react'
import type { Step } from '../../roadmap/types.ts'
import { isEmergencyAccess } from '../../roadmap/blockerSteps.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, content, pages } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, listCountVars, missingVars, whole, SINGLE_CHOICE_SOURCES } from '../../content/render.ts'
import { Picker } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import { filterPickerObjects, pickerUniverse } from './pickerRows.ts'
import type { PickerObject } from './pickerRows.ts'
import { answerParts, answerText, optionsOf, questionFor, valueSource } from './stepQuestion.ts'
import type { QuestionOption } from './stepQuestion.ts'
import { answerKey } from '../../roadmap/decisions.ts'
import { answerOf, effectLine } from '../../roadmap/answers.ts'
import { powershellFor } from './stepPowerShell.ts'
import { jsonOffered, missingObjects } from './stepJson.ts'
import { commsFor, datesLineFor, managerText, whoEvidenceLines } from './stepExport.ts'
import { list } from '../../copy/statements.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'
import { REDACTED, exportClipboard, exportDownload } from '../exportGuard.ts'
import { Button, Status } from '../components/index.ts'
import { statusOf } from './statusWord.ts'
import { doneWhenTemplates } from './doneWhen.ts'

type Ex = Record<string, unknown>
type DoTab = 'portal' | 'json' | 'ps'

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))
const listKeys = (line: string): string[] => [...line.matchAll(/\{list:([^}]+)\}/g)].map((m) => m[1])

/** A content string, filled with the tenant's values. */
/** Under every copy box (Tell your people, For the help desk, For your manager): paste it into your own assistant. */
const ADAPT_LINE = String((content.shared as Record<string, unknown>).adaptLine)

/** Doesn't apply here is offered on a content step flagged for it, never on a foundation, never on a policy step whose subject exists. */
function offersDoesntApply(cs: Record<string, any>, step: Step): boolean {
  if (cs.doesntApply !== true || isEmergencyAccess(step)) return false
  if (cs.kind === 'policy' && step.population.total > 0) return false
  return true
}
const SHARED = content.shared as Record<string, string>

function T({ s, ex }: { s: unknown; ex: Ex }) {
  if (s === null || s === undefined) return null
  return <>{fillText(s, ex as Record<string, unknown>)}</>
}

/** True when a content line has every variable it names — no hole (walk-51 item 2). */

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
  onDoesntApply,
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
  /** Doesn't apply here, with the person's one-line reason (content steps flagged doesntApply). */
  onDoesntApply?: (reason: string) => void
  onClose: () => void
  onScan?: () => void
  /** This step's saved decision, when one was made (prompt 52 Part 3). */
  decision?: StepDecision | null
  /** The picker's Save: the ticked ids, the chosen option and the question's answer become the plan's decision. */
  onDecide?: (decision: StepDecisionInput) => void
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
  // The content's leading "before" lines (a setting to change before the policy
  // is created: the device-settings toggle, password writeback, the SharePoint
  // access control) stay above the translator's portal lines, numbered with them.
  const before: string[] = (Array.isArray(w.before) ? (w.before as unknown[]) : []).filter((l): l is string => typeof l === 'string' && whole(l, ex)).map((l) => fillText(l, ex as Record<string, unknown>))
  // §8.7: a section with no content is not rendered. A step with nothing to do
  // is a missing content key, logged by the walk, never an empty heading.
  const hasWhatToDo = Boolean(w.lead) || hasChecks || (truthy(ex.needsCreate) && Array.isArray(w.create)) || portal !== null || hasSteps || before.length > 0

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
      {who.groups && who.adminsNote && truthy(ex.adminNames) && <p className="reason"><T s={who.adminsNote} ex={ex} /></p>}

      {/* A decision with an `applies` key is offered only while its condition holds (the risk policy's first-enforcement rung, while anyone has only Authenticator approval). */}
      {d && (typeof d.applies !== 'string' || truthy(ex[d.applies])) && <Decision d={d} ex={ex} saved={decision} onDecide={onDecide} stepId={step.id} ctx={ctx} />}

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
          {tab === 'portal' && <ol className="sections">{[...before, ...portal].map((l, i) => <li key={i}>{l}</li>)}</ol>}
          {/* The JSON and PowerShell tabs render only when every object the body
              names exists in the tenant; otherwise one line names the Preparation
              step that creates it, and Download JSON is not offered. */}
          {(tab === 'json' || tab === 'ps') && !jsonOffered(step) && (
            <p className="reason">{fillText(app.plan.jsonWaits, { steps: list([...new Set(missingObjects(step).map((m) => m.title))]), tenant: String(ex.tenant ?? '') })}</p>
          )}
          {tab === 'json' && jsonOffered(step) && <pre className="mono">{JSON.stringify(policyJson(step), null, 2)}</pre>}
          {tab === 'ps' && jsonOffered(step) && <pre className="mono">{powershellFor(policyJson(step), step.kind === 'adjust' ? (step.tracking?.policyId ?? null) : null)}</pre>}
          {jsonOffered(step) && (
            <p className="actions">
              <Button variant="secondary" onClick={() => exportDownload(`${step.id}.json`, JSON.stringify(policyJson(step), null, 2), 'application/json', REDACTED)}>
                Download JSON
              </Button>
            </p>
          )}
        </>
      ) : (
        (hasSteps || before.length > 0) && <ol className="sections">{[...before.map((l) => <>{l}</>), ...(hasSteps ? (w.steps as unknown[]).map((l) => <T s={l} ex={ex} />) : [])].map((node, i) => <li key={i}>{node}</li>)}</ol>
      )}

      {datesLineFor(step, cs) && whole(datesLineFor(step, cs), ex) && (
        <>
          <h3>Dates</h3>
          <p className="line"><T s={datesLineFor(step, cs)} ex={ex} /></p>
        </>
      )}

      {(() => {
        // Expand the shared policy/change done-when placeholders (a policy in
        // report-only gets its two gates with today's numbers), then drop any
        // line with a hole; the heading appears only if a line survives (§8.7).
        const dw = doneWhenTemplates(step, (cs.doneWhen || []) as unknown[]).filter((x: unknown) => whole(x, ex))
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

      {(() => {
        // The email as the exports say it (stepExport.ts commsFor): the body keyed on the tenant's state, the extra lines only when whole.
        const comms = commsFor(cs, ex as Record<string, unknown>)
        if (!comms) return null
        const text = [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n')
        return (
          <>
            <h3>Tell your people</h3>
            <div className="copy-box">
              <Button variant="secondary" onClick={() => copy('comms', text)}>
                {copied === 'comms' ? 'Copied' : 'Copy'}
              </Button>
              <p>{comms.salutation}</p>
              <p>{comms.body}</p>
              {comms.extra.map((l, i) => <p key={i}>{l}</p>)}
              <p>{comms.signature}</p>
            </div>
            <p className="reason adapt">{ADAPT_LINE}</p>
          </>
        )
      })()}

      <More cs={cs} ex={ex} step={step} onSkip={onSkip} onUnskip={onUnskip} onDoesntApply={onDoesntApply} copy={copy} copied={copied} open={printing === true} />

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
function WhoLine({ line, ex: stepEx }: { line: string; ex: Ex }) {
  // A line that counts and lists counts its own list (render.ts listCountVars).
  const ex = listCountVars(line, stepEx) as Ex
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

/** The who-line evidence lines that apply to this tenant: the one gate the exports read too (stepExport.ts). */
function evidenceLines(who: Record<string, any>, ex: Ex): string[] {
  return whoEvidenceLines(who, ex as Record<string, unknown>)
}

function Decision({ d, ex, saved, onDecide, stepId, ctx }: { d: Record<string, any>; ex: Ex; saved: StepDecision | null; onDecide?: (decision: StepDecisionInput) => void; stepId: string; ctx: StepVarContext }) {
  // The typeahead (target-state §6.4): empty, it lists the objects the scan
  // nominated with their signal text, ticked by default as chips; typing filters
  // every object of the kind in the tenant by name and UPN; the chips are the
  // selection, and Save writes their ids exactly as the ticks did. A picker with
  // no source reads the key its own rows were built under (pickerKey), never
  // another step's list. Nothing nominated and nothing to type against: no picker.
  const source: string | null = typeof d.pickerSource === 'string' ? d.pickerSource : null
  const keys: string[] = source ? [source] : typeof ex.pickerKey === 'string' ? [ex.pickerKey] : []
  const key = d.pickerRow ? (keys.find((k) => Array.isArray(ex[k]) && (ex[k] as unknown[]).length > 0) ?? null) : null
  const rows: string[] = key ? (ex[key] as string[]) : []
  const idsOf = key ? ex[`${key}Ids`] : undefined
  const ids: string[] = Array.isArray(idsOf) && (idsOf as string[]).length === rows.length ? (idsOf as string[]) : rows
  // A group, a location or a strength is one choice: one chip.
  const single = !d.multi && SINGLE_CHOICE_SOURCES.includes(String(source ?? key ?? ''))
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups }
  const universe = useMemo(() => (d.pickerRow ? pickerUniverse(stepId, source, pickerCtx) : []), [d.pickerRow, stepId, source, ctx.snapshot, ctx.mapping, ctx.nameOf, ctx.groups])
  const byId = useMemo(() => new Map(universe.map((o) => [o.id, o])), [universe])
  const nominated: PickerOption[] = ids.map((id, i) => {
    const known = byId.get(id)
    const name = known?.name ?? rows[i].split(' · ')[0]
    const why = rows[i].startsWith(name) ? rows[i].slice(name.length).replace(/^\s*·\s*/, '') : rows[i]
    return { id, name, secondary: known?.secondary, why: why || undefined }
  })
  const optionOf = (id: string): PickerOption => nominated.find((n) => n.id === id) ?? byId.get(id) ?? { id, name: ctx.nameOf(id) }
  const tickedOf = key ? ex[`${key}Ticked`] : undefined
  const initial: string[] = saved?.picked ?? (Array.isArray(tickedOf) ? (tickedOf as string[]) : single ? ids.slice(0, 1) : ids)
  const [chips, setChips] = useState<PickerOption[]>(() => initial.map(optionOf))
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const hasPicker = rows.length > 0 || universe.length > 0
  // The decision's own options, and its question under the picker: a whole
  // option is a radio; one that needs a value the scan cannot fill (the travel
  // countries, the mail-sending devices) is a picker of the step's kind, accounts
  // otherwise, and its chips are the answer. The question's answer persists as
  // questionAnswers[stepId:label] (decisions.ts).
  const options = optionsOf(d.options, ex)
  const question = questionFor(d, ex)
  const needsValue = options.some((o) => o.needs !== null) || (question?.options.some((o) => o.needs !== null) ?? false)
  const valueUniverse = useMemo(() => (needsValue ? pickerUniverse(stepId, valueSource(stepId), pickerCtx) : []), [needsValue, stepId, ctx.snapshot, ctx.mapping, ctx.nameOf, ctx.groups])
  const [option, setOption] = useState<string | null>(saved?.option ?? null)
  const [answer, setAnswer] = useState<string | null>(question ? (saved?.answers?.[question.label] ?? null) : null)
  // The strict toggle (the device decision's Block phones): off unless ticked;
  // its answer is its one option's words, under its own label.
  const strict = d.strict && typeof d.strict.label === 'string' && typeof d.strict.option === 'string' ? (d.strict as { label: string; option: string; help?: string }) : null
  const [strictOn, setStrictOn] = useState<boolean>(strict ? saved?.answers?.[strict.label] === strict.option : false)
  const save = (): void =>
    onDecide?.({
      ...(hasPicker ? { picked: chips.map((c) => c.id) } : {}),
      ...(option !== null ? { option } : {}),
      ...(question && answer !== null ? { answers: { [question.label]: answer } } : {}),
      ...(strict && strictOn ? { answers: { ...(question && answer !== null ? { [question.label]: answer } : {}), [strict.label]: strict.option } } : {}),
    })
  // Each effect line shows once its answer applied (answers.ts effectLine): the
  // applied mapping holds the stored answer, so the line is true when it shows.
  const decisionEffect = options.length > 0 ? effectLine(d.effect, answerOf(ctx.mapping, stepId, 'decision')) : null
  const questionEffect = question ? effectLine((d.question as { effect?: unknown }).effect, answerOf(ctx.mapping, stepId, 'question')) : null
  // The help is explanatory prose and renders in the flow, not inside the
  // .decision row (which the contract measures against the row budget).
  return (
    <>
      <Line s={d.help} ex={ex} cls="reason" />
      <div className="decision">
        <div className="dlabel">{d.label}</div>
        {hasPicker && <Picker selected={chips} options={results} suggestions={nominated} onChange={setChips} onSearch={setQuery} single={single} />}
        {options.length > 0 && <Options name={answerKey(stepId, String(d.label))} options={options} answer={option} onAnswer={setOption} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} />}
        {decisionEffect && whole(decisionEffect, ex) && <p className="reason effect"><T s={decisionEffect} ex={ex} /></p>}
        {question && (
          <>
            <div className="dlabel">{question.label}</div>
            <p className="reason"><T s={question.text} ex={ex} /></p>
            <Options name={answerKey(stepId, question.label)} options={question.options} answer={answer} onAnswer={setAnswer} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} />
            {questionEffect && whole(questionEffect, ex) && <p className="reason effect"><T s={questionEffect} ex={ex} /></p>}
          </>
        )}
        {strict && (
          <>
            <div className="dlabel">{strict.label}</div>
            {strict.help && <p className="reason"><T s={strict.help} ex={ex} /></p>}
            <div className="picker">
              <label>
                <input type="checkbox" checked={strictOn} onChange={(e) => setStrictOn(e.currentTarget.checked)} /> <T s={strict.option} ex={ex} />
              </label>
            </div>
          </>
        )}
        <Button variant="secondary" onClick={save}>{d.save || 'Save'}</Button>
      </div>
    </>
  )
}

/** Options as radios; the one that needs a value as a picker, its chips the answer in the option's own words. */
function Options({ name, options, answer, onAnswer, ex, universe, nameOf }: { name: string; options: QuestionOption[]; answer: string | null; onAnswer: (answer: string | null) => void; ex: Ex; universe: PickerObject[]; nameOf: (id: string) => string }) {
  const parts = answerParts(answer, options)
  const valued = options.find((o) => o.needs !== null) ?? null
  const [chips, setChips] = useState<PickerOption[]>(() => (parts?.option.needs ? parts.picked.map((id) => universe.find((u) => u.id === id) ?? { id, name: nameOf(id) }) : []))
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const pick = (next: PickerOption[]): void => {
    setChips(next)
    if (valued) onAnswer(next.length > 0 ? answerText(valued, next.map((c) => c.id)) : null)
  }
  return (
    <div className="picker">
      {options.map((o, i) => {
        if (o.needs === null) {
          return (
            <label key={i}>
              <input type="radio" name={name} checked={parts?.option === o} onChange={() => onAnswer(answerText(o))} /> <T s={o.text} ex={ex} />
            </label>
          )
        }
        const [before, after] = o.text.split(/\{(?:list:)?[a-zA-Z0-9_]+\}/)
        return (
          <div key={i} className="option-value">
            {before && <span className="reason">{fillText(before, ex as Record<string, unknown>)}</span>}
            <Picker selected={chips} options={results} suggestions={[]} onChange={pick} onSearch={setQuery} />
            {after && <span className="reason">{fillText(after, ex as Record<string, unknown>)}</span>}
          </div>
        )
      })}
    </div>
  )
}

function More({ cs, ex, step, onSkip, onUnskip, onDoesntApply, copy, copied, open = false }: { cs: Record<string, any>; ex: Ex; step: Step; onSkip: (r: string) => void; onUnskip: () => void; onDoesntApply?: (reason: string) => void; copy: (id: string, t: string) => void; copied: string | null; open?: boolean }) {
  const more = cs.more || {}
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
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
          <p className="reason adapt">{ADAPT_LINE}</p>
        </>
      )}
      {managerText(cs, ex as Record<string, unknown>) !== null && (
        <>
          <h3>For your manager</h3>
          {/* The three sentences, and the clause the records earn (managerNone under its applies, E9). */}
          <p className="reason">{managerText(cs, ex as Record<string, unknown>)}</p>
          <p className="actions"><Button variant="secondary" onClick={() => copy('manager', managerText(cs, ex as Record<string, unknown>) ?? '')}>{copied === 'manager' ? 'Copied' : 'Copy'}</Button></p>
          <p className="reason adapt">{ADAPT_LINE}</p>
        </>
      )}
      {/* Skip, and beside it Doesn't apply here on the content steps flagged for it:
          never a foundation (emergency access, the exclusions group), never a policy
          step whose subject exists. Pressing it asks one line, required, that goes
          on the plan; the step then leaves its phase for the footer. */}
      {step.status !== 'skipped' && (
        <p className="actions">
          {cs.skip && <Button variant="tertiary" onClick={() => onSkip('Not needed for this tenant')}>Skip this step</Button>}
          {offersDoesntApply(cs, step) && onDoesntApply && !asking && <Button variant="tertiary" onClick={() => setAsking(true)}>{SHARED.doesntApplyControl}</Button>}
        </p>
      )}
      {asking && step.status !== 'skipped' && (
        <div className="decision">
          <p className="reason">{fillText(SHARED.doesntApplyPrompt, { tenant: String(ex.tenant ?? '') })}</p>
          <input type="text" required aria-label={fillText(SHARED.doesntApplyPrompt, { tenant: String(ex.tenant ?? '') })} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Button variant="secondary" disabled={reason.trim().length === 0} onClick={() => { if (reason.trim().length > 0) onDoesntApply?.(reason.trim()) }}>Save</Button>
        </div>
      )}
      {step.status === 'skipped' && <p className="actions"><Button variant="tertiary" onClick={onUnskip}>{app.plan.putBack}</Button></p>}
    </details>
  )
}

function policyJson(step: Step): unknown {
  return step.action?.json ? JSON.parse(step.action.json) : { note: 'Portal steps show the policy to create.' }
}
