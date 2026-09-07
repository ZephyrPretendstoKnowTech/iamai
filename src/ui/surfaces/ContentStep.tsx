// A step opened in place: the one body the Plan draws for every step it has, and
// the only one (task 011).
//
// The order is the Step Contract's own (Foundation D): where it is and what
// happens next, Why, What IAMAI found, Who this touches, What to do, Fix before
// continuing, Done when, More. Every sentence is a string in content.json filled
// with the tenant's values (stepVars.ts); the What-to-do on a policy step is the
// portal translator over the goal's baseline policy (stepPortal.ts), because the
// baseline wins.
//
// Three things this body will not do.
//
// It does not require a content entry. A free-tier ladder rung and a validation
// blocker are named and explained by the engine, and before this they opened to
// an empty panel; now the contract's own title, Why and next action stand, and
// the content entry adds only the words the engine has none of.
//
// It does not put everything the engine knows on the first screen. A list of
// names is a fact while it is short enough to read and an inventory once it is
// not, so above NAMES_INLINE the default step keeps the count and the
// consequence and the names themselves go to More. The person-by-person
// registration state behind them belongs to the MFA readiness surface, not to a
// rollout step.
//
// And it does not decide anything. What the step is, whether an implementation
// is offered, what blocks it and what finishes it are the contract's answers,
// asked once, below the UI.
import { useState, useMemo } from 'react'
import type { Step } from '../../roadmap/types.ts'
import { isEmergencyAccess } from '../../roadmap/blockerSteps.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, content, pages } from '../../content/content.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { fillText, whole, SINGLE_CHOICE_SOURCES } from '../../content/render.ts'
import { baselineConflictWords } from '../../roadmap/baselineConflict.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { Picker } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import { filterPickerObjects, pickerUniverse } from './pickerRows.ts'
import type { PickerObject } from './pickerRows.ts'
import { answerParts, answerText, optionsOf, questionFor, valueSource } from './stepQuestion.ts'
import type { QuestionOption } from './stepQuestion.ts'
import { answerKey } from '../../roadmap/decisions.ts'
import { answerOf, effectLine } from '../../roadmap/answers.ts'
import { powershellFor } from './stepPowerShell.ts'
import { jsonOffered, missingObjects, policyJsonText, stepOperations } from './stepJson.ts'
import { commsFor, datesLineFor, ifWrongLineFor, managerText, decisionLine } from './stepExport.ts'
import { list } from '../../copy/statements.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { REDACTED, exportClipboard, exportDownload } from '../exportGuard.ts'
import { Button } from '../components/index.ts'
import { stepContract } from './stepContract.ts'
import { DoneWhen, FixBeforeContinuing, PolicyMembers, StepSection, StepState, WhatIamaiFound, WhatToDoLead } from './StepSections.tsx'
import { MfaHandoff } from './MfaHandoff.tsx'
import { HEAD } from './stepHeadings.ts'
import { whoBlocks, whoLeadLine } from './whoBlocks.ts'
import type { WhoBlock } from './whoBlocks.ts'

type Ex = Record<string, unknown>
type DoTab = 'portal' | 'json' | 'ps'

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))

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

/** One who block on the default step: the sentence, and its names under it when they are short enough to read. */
function WhoBlockView({ block }: { block: WhoBlock }) {
  if (block.names.length === 0) return <p className="reason">{block.lead}</p>
  return (
    <div className="names-group">
      {block.lead && <p className="reason">{block.lead}</p>}
      <ol className="names">{block.names.map((nm, i) => <li key={i}>{nm}</li>)}</ol>
    </div>
  )
}

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
  // The step's own words, where the content file has any. A step it has no entry
  // for is not a step without a body: the contract still knows where it is, why
  // it matters and what to do next, and this renders that.
  const cs = (contentStepFor(step) ?? {}) as Record<string, any>
  const ex = stepVars(step, ctx) as Ex
  // The Step Contract (stepContract.ts): the state, the next milestone, the one
  // action, the blockers and the completion, worked out once from Foundations A,
  // B and C. Everything below renders it; nothing below asks them again.
  const contract = stepContract(step, ctx, ex as Record<string, unknown>)
  // The one title, from the one resolver the row reads (content/stepTitle.ts), so
  // the row and the body it opens can never disagree.
  const title = contentTitle(step)
  const copy = (id: string, text: string): void => {
    void exportClipboard(text, REDACTED).then((ok) => {
      if (!ok) return
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  const learn = cs.learn || {}
  const who = cs.who || {}
  const d = cs.decision
  const w = cs.whatToDo || {}
  // The tenant's objects behind the baseline's placeholders (a saved decision
  // included), or the names the plan proposes for them, so every line is a name.
  const portalNames = portalNamesFor(ctx, ex, title)
  // What to do offers today (stepInstructions.ts): the step's own resolved
  // policies through the translator — the same bodies the JSON, the PowerShell
  // and the download carry — the content's leading "before" lines, and the
  // step's own instruction lines. All three are withheld together while an
  // authority holds the change: a policy the plan may not write, or one
  // deployed in report-only whose only remaining submission is the enforcement
  // its window has not earned. The export view reads the same decision, so the
  // screen cannot instruct a change the artifacts refuse to describe.
  const instructions = stepInstructions(step, cs, ex as Record<string, unknown>, portalNames)
  // A goal the baseline holds no policy for has no portal lines; an empty list is
  // not a What to do (the shared-devices step rendered an empty section).
  const portal = instructions.portal
  // Why an implementation is not offered — a missing object, an unmatched pair,
  // an emergency account in reach, an unverified way back in, a readiness
  // threshold, a baseline that contradicts itself — is one question with one
  // answer, and the contract's action line carries it (stepContract.ts). What is
  // still read here is only whether the step has *dates* and a rollback to show,
  // which it does not while its policy cannot be written.
  const reason = cs.kind === 'policy' ? unavailableReason(step) : null
  // The contradiction this step's own source carries, where it carries one
  // (roadmap/baselineConflict.ts): the explanation follows the reviewed source
  // policy recorded on the step, so it renders on whichever goal the active
  // baseline hands that source.
  const conflictWords = baselineConflictWords(step)
  // The content's leading "before" lines (a setting to change before the policy
  // is created: the device-settings toggle, password writeback, the SharePoint
  // access control) stay above the translator's portal lines, numbered with them.
  const before = instructions.before
  const hasSteps = instructions.steps.length > 0
  // Who this touches, split into what the default step shows and what More
  // carries (whoBlocks.ts): the counts and the consequences here, the names
  // behind them there, once there are more of them than a person reads at a
  // glance. Whether the reach is knowable at all is the contract's answer
  // (Foundation A) — a scope this scan could not settle says so in one line and
  // shows no count, which is why the section renders even where the step's own
  // who-lines could not fill.
  const { inline: whoInline, held: whoHeld } = whoBlocks(who, ex as Record<string, unknown>)
  const lead = whoLeadLine(who, ex as Record<string, unknown>, [...whoInline, ...whoHeld])
  const showWho = lead !== null || whoInline.length > 0 || (contract.who !== null && !contract.who.known)

  return (
    <div className="step-body">
      <p className="line">
        <span className="step-title">{title}</span>
      </p>
      <StepState contract={contract} />
      <PolicyMembers members={contract.members} />
      <Line s={cs.changeLine} ex={ex} cls="reason" />
      {/* The baseline defines this policy two ways (roadmap/baselineConflict.ts):
          the step says so and offers no instructions. The words belong to the
          reviewed source policy the step's own state names, never to the goal,
          so whichever goal a baseline hands that source says the same thing
          about it. They are the content file's; nothing here composes them. */}
      {conflictWords && <p className="reason conflict"><T s={conflictWords} ex={ex} /></p>}
      <Line s={cs.partner} ex={ex} cls="reason partner" />

      {/* The contract's Why: the step's own sentence where the content file has
          one, and the engine's where it does not (a validation blocker states how
          many of its checks are outstanding, and that changes between scans). */}
      <h3>{HEAD.why}</h3>
      <p>
        {contract.why}{' '}
        {learn.url && (
          <a href={learn.url} target="_blank" rel="noopener noreferrer">
            Learn →
          </a>
        )}
      </p>

      <WhatIamaiFound found={contract.found} />

      {/* Who this touches: the counts and the consequences that decide the next
          action. A list longer than NAMES_INLINE names is in More. */}
      {showWho && <h3>{HEAD.who}</h3>}
      {lead && <p className="line">{lead}</p>}
      {whoInline.map((b) => <WhoBlockView key={b.key} block={b} />)}
      {/* Foundation A settled the reach and could not: no count, no names, and
          one line saying so rather than the goal's people standing in. */}
      {contract.who !== null && !contract.who.known && <p className="reason">{contract.who.text}</p>}

      <h3>{HEAD.whatToDo}</h3>
      {/* The one action, always. Where nothing overrules the lifecycle this is the
          step's own lead; where an authority does — a policy the plan may not
          write, a goal already in place, a question waiting on a person — it is
          that authority's answer instead (stepContract.ts actionOf). */}
      <WhatToDoLead contract={contract} />
      {/* The decision comes before the instructions, and on a step that needs one
          it *is* the action: IAMAI cannot choose, so nothing is offered to submit
          until a person has (Foundation C). A decision with an `applies` key is
          offered only while its condition holds (the risk policy's first-enforcement
          rung, while anyone has only Authenticator approval). */}
      {d && (typeof d.applies !== 'string' || truthy(ex[d.applies])) && <Decision d={d} ex={ex} saved={decision} onDecide={onDecide} stepId={step.id} ctx={ctx} />}
      {/* The create instructions. `needsCreate` is a proof that nothing
          qualifies; `createIfNeeded` is the same instructions offered to an
          operator who knows they need one, on a reading that could not prove it
          (mapping/safetyChoice.ts). */}
      {truthy(ex.createIfNeeded) && typeof w.createIfNeeded === 'string' && <p className="reason"><T s={w.createIfNeeded} ex={ex} /></p>}
      {(truthy(ex.needsCreate) || truthy(ex.createIfNeeded)) && Array.isArray(w.create) && (
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
          {tab === 'json' && jsonOffered(step) && <pre className="mono">{policyJsonText(step)}</pre>}
          {tab === 'ps' && jsonOffered(step) && <pre className="mono">{powershellFor(stepOperations(step))}</pre>}
          {jsonOffered(step) && (
            <p className="actions">
              <Button variant="secondary" onClick={() => exportDownload(`${step.id}.json`, policyJsonText(step), 'application/json', REDACTED)}>
                Download JSON
              </Button>
            </p>
          )}
        </>
      ) : (
        // Why an implementation is not offered is the contract's action line and
        // is said once, above. This is only the step's own instructions where it
        // has them; the eight reason branches that used to stand here were the
        // same eight sentences a second time, chosen by a second reading of
        // Foundation A inside the JSX.
        (hasSteps || before.length > 0) && <ol className="sections">{[...before.map((l) => <>{l}</>), ...instructions.steps.map((l) => <T s={l} ex={ex} />)].map((node, i) => <li key={i}>{node}</li>)}</ol>
      )}

      <FixBeforeContinuing fix={contract.fix} />

      {/* Where this step's own enforcement waits on the people it reaches being
          able to sign in the way it asks, who those people are is MFA
          Readiness's answer, not the Plan's (derive/stepMfaReadiness.ts). */}
      <MfaHandoff step={step} snapshot={ctx.snapshot} mapping={ctx.mapping} />

      {reason === null && datesLineFor(step, cs) && whole(datesLineFor(step, cs), ex) && (
        <>
          <h3>{HEAD.dates}</h3>
          <p className="line"><T s={datesLineFor(step, cs)} ex={ex} /></p>
        </>
      )}

      {/* Every step has a completion, and it is concrete. The step's own gates
          where it has them; where a policy cannot be written yet, what would
          clear that instead — which is exactly the step that used to render no
          Done when at all (stepContract.ts doneWhenOf). */}
      <DoneWhen heading={HEAD.doneWhen} lines={contract.doneWhen} />

      {/* Everything below the completion is audit depth and work artifacts: the
          names behind the counts, the way back from a change nobody has made
          yet, the recovery runbook, and the three copy boxes. None of it decides
          the next action, so none of it stands between the operator and it. The
          print opens More, so a printed step is unchanged. */}
      <More
        cs={cs}
        ex={ex}
        step={step}
        contractWho={whoHeld}
        ifWrong={reason === null ? ifWrongLineFor(step, cs) : null}
        comms={reason === null ? commsFor(cs, ex as Record<string, unknown>, step) : null}
        onSkip={onSkip}
        onUnskip={onUnskip}
        onDoesntApply={onDoesntApply}
        copy={copy}
        copied={copied}
        open={printing === true}
      />

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
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }
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
  const decisionAnswer = answerOf(ctx.mapping, stepId, 'decision')
  const questionEffect = question ? effectLine((d.question as { effect?: unknown }).effect, answerOf(ctx.mapping, stepId, 'question')) : null
  // The help is explanatory prose and renders in the flow, not inside the
  // .decision row (which the contract measures against the row budget); once
  // the decision is answered, its effect line stands where the help stood
  // (stepExport.ts decisionLine): one line, never both.
  return (
    <>
      {decisionAnswer === null && <Line s={decisionLine(d, null)} ex={ex} cls="reason" />}
      <div className="decision">
        <div className="dlabel">{d.label}</div>
        {hasPicker && <Picker selected={chips} options={results} suggestions={nominated} onChange={setChips} onSearch={setQuery} single={single} />}
        {options.length > 0 && <Options name={answerKey(stepId, String(d.label))} options={options} answer={option} onAnswer={setOption} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} />}
        {decisionAnswer !== null && <Line s={decisionLine(d, decisionAnswer)} ex={ex} cls="reason effect" />}
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

/**
 * Audit depth and work artifacts, under one disclosure.
 *
 * What is here is what does not change the next action: the names behind the
 * counts stated above, what could go wrong, the way back from a change, the
 * recovery runbook, and the three boxes of text to send. What is never here is a
 * blocker — those are the contract's `fix`, and they render above, in a section
 * of their own.
 *
 * `open` while printing, so a printed step is the whole step (§7).
 */
function More({ cs, ex, step, contractWho, ifWrong, comms, onSkip, onUnskip, onDoesntApply, copy, copied, open = false }: {
  cs: Record<string, any>
  ex: Ex
  step: Step
  /** The name lists the default step stated as counts (whoBlocks). */
  contractWho: WhoBlock[]
  /** The rollback the step's operation earns, where the change is one that could be made. */
  ifWrong: string | null
  /** The email as the exports say it (stepExport.ts commsFor), where the step asks anybody to do anything. */
  comms: { salutation: string; body: string; extra: string[]; signature: string } | null
  onSkip: (r: string) => void
  onUnskip: () => void
  onDoesntApply?: (reason: string) => void
  copy: (id: string, t: string) => void
  copied: string | null
  open?: boolean
}) {
  const more = cs.more || {}
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const risks = (more.risks || []) as { text: string; applies?: string }[]
  const applies = risks.filter((r) => r.applies && truthy(ex[r.applies]))
  const rest = risks.filter((r) => !(r.applies && truthy(ex[r.applies])))
  const commsText = comms ? [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n') : null
  return (
    <details className="more" open={open || undefined}>
      <summary>{HEAD.more}</summary>
      {/* The people behind the counts above: the same lines, with their names
          under them. Nothing here is new evidence; it is the evidence the step
          already stated, at the length it actually is. */}
      <StepSection heading={HEAD.namesHeld} when={contractWho.length > 0}>
        {contractWho.map((b) => (
          <div key={b.key} className="names-group">
            {b.lead && <p className="reason">{b.lead}</p>}
            {b.names.length > 0 && <ol className="names">{b.names.map((nm, i) => <li key={i}>{nm}</li>)}</ol>}
          </div>
        ))}
      </StepSection>
      {risks.length > 0 && (
        <>
          <h3>{HEAD.risks}</h3>
          {/* The items that apply here first, marked; the rest under Also possible.
              When none applies the rest stand under the heading, never an empty list. */}
          {applies.length > 0 && <ul className="sections">{applies.map((r, i) => <li key={i}><T s={r.text} ex={ex} /> <span className="chip">applies here</span></li>)}</ul>}
          {rest.length > 0 && applies.length > 0 && <p className="sub">{HEAD.alsoPossible}</p>}
          {rest.length > 0 && <ul className="sections">{rest.map((r, i) => <li key={i}><T s={r.text} ex={ex} /></li>)}</ul>}
        </>
      )}
      {/* The rollback the step's operation earns, not the one its content was
          written with: a created policy is set back to report-only or deleted,
          a changed one has its settings put back (stepExport.ts ifWrongLineFor). */}
      {ifWrong && whole(ifWrong, ex) && (
        <>
          <h3>{HEAD.ifWrong}</h3>
          <p className="line"><T s={ifWrong} ex={ex} /></p>
        </>
      )}
      {/* The recovery runbook the emergency-access step carries: what to do the
          day a change locks somebody out. It is not the next action on any step,
          and it is here whole rather than half of it above. */}
      {cs.lockedOut && (
        <>
          <h3>{cs.lockedOut.label}</h3>
          <ul className="sections">{(cs.lockedOut.steps || []).map((x: unknown, i: number) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
        </>
      )}
      {comms && commsText && (
        <>
          <h3>{HEAD.comms}</h3>
          <div className="copy-box">
            <Button variant="secondary" onClick={() => copy('comms', commsText)}>
              {copied === 'comms' ? 'Copied' : 'Copy'}
            </Button>
            <p>{comms.salutation}</p>
            <p>{comms.body}</p>
            {comms.extra.map((l, i) => <p key={i}>{l}</p>)}
            <p>{comms.signature}</p>
          </div>
          <p className="reason adapt">{ADAPT_LINE}</p>
        </>
      )}
      {Array.isArray(more.helpDesk) && (more.helpDesk as unknown[]).filter((x) => whole(x, ex)).length > 0 && (
        <>
          <h3>{HEAD.helpDesk}</h3>
          <ul className="sections">{(more.helpDesk as unknown[]).filter((x) => whole(x, ex)).map((x, i) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
          <p className="reason adapt">{ADAPT_LINE}</p>
        </>
      )}
      {managerText(cs, ex as Record<string, unknown>) !== null && (
        <>
          <h3>{HEAD.manager}</h3>
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

