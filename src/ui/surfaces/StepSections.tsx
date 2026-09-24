// The Step Contract's components (Foundation D). Every Plan step — and every
// Plan row — is drawn with these, so a step answers the same questions in the
// same order whatever it is: where it is now, why it matters, what stands
// between it and its next action (Readiness, the one prerequisite surface),
// what to do, and how you will know it is done.
//
// They render a StepContract (stepContract.ts) and nothing else. There is no
// engine reading here: no `implementationOffered`, no `unavailableReason`, no
// blocker evaluation, no lifecycle arithmetic. Those questions were answered
// below the UI, and asking them again in a component is how two answers to one
// question got onto one screen.
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authoredParts } from './authoredText.ts'
import { Button, Icon, Status } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'
import type { ContractFound, ContractMember, ContractReadiness, ContractStage, ImplementationEmpty, ReadinessTile, ReadinessTone, StepContract } from './stepContract.ts'
import { CONTRACT, FOOTER, badgeLabel, nextCaption, readinessLeadOf, stageClass } from './stepContract.ts'
import type { ContractEmergencySlot, ContractHardening } from './stepContract.ts'
import { fillText } from '../../content/render.ts'
import { autoOpenTiles } from './tileExpansion.ts'

/**
 * One row of the Plan: the lane, the tenant fact, the title, who it touches and when.
 *
 * The one row shape, for a step and for a Cleanup item alike — before this, each
 * surface built its own and they drifted apart a column at a time. It stays
 * deliberately thin: at ~38 baseline policies the collapsed rows are what makes
 * the Plan readable, so a row says only enough to decide whether to open it.
 *
 * Task 033 restored the four zones the approved Plan pack draws
 * (`docs/design/approved/anatomy/plan-step-v1.html`, `.roadmap-row`):
 *
 *     state | title | who | when
 *
 * The state zone is the lane label (A1b decision 1: `Ready · Create`, `Up Next ·
 * After …`, `On Hold · Baseline conflict`), the one producer of the row's state
 * and of its reason — no reason line sits under the title (RUN-CONTEXT-B
 * decision 10) — and under it the one tenant fact the row can add —
 * `Report-only` or `Enforced` — as a chip, or nothing (decision 2). The other
 * zones carry production's facts and nothing else — `contentTitle`, `rowWho`,
 * `rowWhen`, each already the one authority for what it says. Nothing here
 * recomputes a state, a date or a count.
 */
export function PlanRow({ lane, tone, chip: fact = null, wave = null, number = null, stepId, title, waitingFor: waiting = null, who, when, open, onToggle, compact = false }: {
  /** `Lane · substatus/reason`: where the actionability engine puts the row (planBoard.ts laneLabelOf). The row's state. */
  lane: string
  /** The lane's tone (planBoard.ts LANE_TONE). */
  tone: StatusTone
  /**
   * The step's place in its group's full order (planBoard.ts rowNumbersOf), or
   * null where the row is in no group.
   *
   * It is tinted with the lane's own tone and nothing else, and the tint is the
   * SECOND cue: the state's words are beside it, unchanged, so the row still
   * says where it is to somebody who cannot see the colour (WCAG 1.4.1).
   */
  number?: number | null
  /** The tenant fact beside the lane — Report-only or Enforced (stepContract.ts factOf) — or nothing. */
  chip?: string | null
  /** The phase the finished plan places the step in, carried on the row as data only: a secondary projection the lane never reads. */
  wave?: number | null
  /** The step the row opens: where the Plan moves the page to (Plan.tsx after a Direction answer). */
  stepId?: string
  title: string
  /**
   * What a held row is waiting for, named (planBoard.ts waitingForOf), or null.
   *
   * The badge cannot carry it: `laneLabelOf` appends the lane tail only on
   * Ready, and `compactLane` below strips `On Hold · After ` from the badge if
   * one gets through, because the badge is one word by design. The When column
   * cannot either — it is fixed 125px. So it goes here, under the title.
   */
  waitingFor?: string | null
  /** The row's Impact (rowWho.ts), or null where the row draws none (planBoard.ts drawsImpact: a deferred row). */
  who: string | null
  /** A day, or the placeholder (planBoard.ts boardWhen): never a reason. On a compact row, the day it was finished, or empty. */
  when: string
  open: boolean
  onToggle: () => void
  /**
   * Finished work, drawn as one quiet line (planBoard.ts drawsCompact): the
   * number, the lane word, the title, the Impact a Completed row read while it
   * was open, and the day where one was recorded. The tenant chip and the
   * waiting line are for work still to do.
   */
  compact?: boolean
}) {
  // A row is a disclosure: it opens the step under it and closes it again. It
  // says both — that it is a control, and whether the step it controls is open
  // — or a screen reader meets a focusable line of text that promises nothing
  // (task 017). The keyboard behaviour it already had is what the role claims.
  // A compact row is finished work: it names no tenant fact and waits on nothing.
  const chip = compact ? null : fact
  const waitingFor = compact ? null : waiting
  return (
    <div
      className="plan-row"
      role="button"
      aria-expanded={open}
      tabIndex={0}
      data-wave={wave ?? undefined}
      data-step={stepId}
      data-compact={compact || undefined}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      {/* The group position, in the lane's tone. `aria-hidden` because the row's
          own words already carry the state and the title, and a bare ordinal
          read out before every row is noise, not information. */}
      <span className={`plan-row-number number-${tone}`} aria-hidden="true">{number ?? ''}</span>
      <span className="plan-row-status">
        <span className={`lane lane-${tone}`}>{compactLane(lane)}</span>
        {chip && <Status tone={tone}>{chip}</Status>}
      </span>
      {/* The pack's `.row-title`: the title, and beneath it what a held row is
          waiting for. Decision 10 gave the reason to the lane label, on the
          premise that the label carried it; `8f440021` stopped that being true
          by appending the tail only on Ready, so a held row said "On Hold" and
          nothing else. The owner resolved it in favour of this line. Which step
          is next is still the Ready tab's order. */}
      <span className="plan-row-title">
        <span className="step-title">{title}</span>
        {waitingFor && <span className="plan-row-reason">{waitingFor}</span>}
      </span>
      {who !== null && <span className="who">{who}</span>}
      {(!compact || when !== '') && <span className="when">{when}</span>}
    </div>
  )
}

/**
 * Where the step is, on both axes, and when the next thing happens.
 *
 * The lifecycle stage and the condition are two facts and are printed as two
 * (Foundation B): "Report-only · Blocked", "Enforced · Review required". The
 * condition is stated beside a stage always, and on its own only when it has
 * something to say — a prerequisite that is simply fine says nothing here rather
 * than "Healthy", which beside a list of failing checks would read as a
 * contradiction.
 *
 * The Next line renders only where Foundation B has a date for it. Undated, the
 * next milestone and What to do are the same fact, and What to do is the more
 * specific of the two.
 */
export { badgeLabel, nextCaption, FOOTER }

export function StepState({ contract }: { contract: StepContract }) {
  // The two axes moved into the head's badge (`badgeLabel`), which is where the
  // approved step reference puts them: "Report-only · Review required", once.
  // What is left here is the one thing the badge does not say — what happens
  // next — as the caption directly above the track it captions.
  //
  // It reads `nextCaption`, which is the dated milestone sentence where there is
  // one and the gate the rail used to hold alone where there is not. A step with
  // neither gets no caption rather than a manufactured one.
  const next = nextCaption(contract)
  if (next === null) return null
  return <p className="step-next">{next}</p>
}

export function StepHead({ eyebrow = null, title, sub = null, badge, tone, fact = null, track = [], children }: {
  /** What kind of step this is (pages.app.plan.stepContract.kind); null where the kind has no label. */
  eyebrow?: string | null
  title: string
  /** The one supporting line under the title; null where the step has none. */
  sub?: ReactNode
  /** The lane label (`badgeLabel`): the same words the row says. */
  badge: string
  tone: StatusTone
  /** The tenant fact beside the badge — Report-only or Enforced — or nothing (A1b decision 2). */
  fact?: string | null
  track?: ContractStage[]
  /** Where the step is and what happens next — the pack's track caption, above the track it captions. */
  children?: ReactNode
}) {
  return (
    <header className="step-head">
      <div className="step-head-top">
        <div className="step-head-lead">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h3 className="step-title">{title}</h3>
          {sub}
        </div>
        <span className="step-head-state">
          <Status tone={tone} pill>
            {compactLane(badge)}
          </Status>
          {fact && (
            <Status tone={tone} pill title={fact}>
              {fact}
            </Status>
          )}
        </span>
      </div>
      {children}
      <LifecycleTrack track={track} />
    </header>
  )
}

/**
 * The four rollout stages, drawn as the pack draws them: a bar per stage with
 * the stage it is at marked and its label under it, captioned by where the step
 * is and what happens next (`StepState`, immediately above it in the head).
 *
 * It renders `contract.track` and decides nothing. The stages are a list, not
 * four decorative bars: each label is real text a screen reader reads in order,
 * and the one the step is at carries `aria-current="step"`, so where the step is
 * never depends on telling two colours apart. The bar itself is the picture of
 * that same fact and is hidden from assistive technology.
 */
export function LifecycleTrack({ track }: { track: ContractStage[] }) {
  if (track.length === 0) return null
  return (
    <div className="track-wrap">
      <ol className="track" aria-label={CONTRACT.trackLabel}>
        {track.map((s) => (
          <li key={s.key} className={stageClass(s)} aria-current={s.current ? 'step' : undefined}>
            <span className="stage-bar" aria-hidden="true">
              <span className="stage-fill" />
            </span>
            <span className="stage-label">{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * The opened step's action column (U2): what the person does here, in IAMAI.
 * The milestone leads it — the day the plan schedules where it holds one and the
 * lane's own label where it does not, over the package's own words for it or
 * none (stepContract.ts `railOf`, U3) — and under it the controls the step takes:
 * a picker, a decision, a question, and their Save. Every step has a milestone,
 * so every step has the column, inputs or not. It sits between Readiness and
 * Implementation in the DOM (U5), so a screen reader meets it where a narrow
 * screen stacks it; the grid draws it on the right.
 */
export function StepActionColumn({ rail, children = null }: { rail: { metric: string; sub: string } | null; children?: ReactNode }) {
  // No milestone on a Completed step (owner, 2026-09-23): the badge says it.
  return (
    <aside className="step-action-column surface-inset">
      {rail && <div className="side-block">
        <div className="key-label">{CONTRACT.railMilestone}</div>
        <p className="metric">{rail.metric}</p>
        {rail.sub !== '' && <p className="metric-sub">{rail.sub}</p>}
      </div>}
      {children}
    </aside>
  )
}

/**
 * The step's own footer, under both columns (the approved `.step-footer`): the
 * rollout exception on the left where the step offers one, and the existing
 * scan on the right. It offers only what production already does — the
 * exception is the existing skip and Doesn't apply here, the scan is the existing
 * action on the existing routing — and it renders nothing where it has nothing
 * to offer. The row above the step is what closes it.
 */
export function StepFooter({ controls = null, onScan, auxiliary = null }: { controls?: ReactNode; onScan?: (() => void) | null; auxiliary?: ReactNode }) {
  if (!controls && !onScan && !auxiliary) return null
  return (
    <footer className="step-footer no-print">
      {controls}
      <div className="step-footer-end">
        {auxiliary}
        {onScan && (
          <Button variant="primary" className="step-footer-scan" onClick={onScan}>
            {FOOTER.scan}
          </Button>
        )}
      </div>
    </footer>
  )
}

/**
 * "Why IAMAI says this", and the Readiness evidence dialog it opens, are hidden
 * across the tool (owner, 2026-09-23). The dialog, its words and the recovery
 * runbook it carries ("If a change locks you out") are kept for the policy
 * turn-on steps to use later: this is the one switch that shows the link again.
 */
export const WHY_LINK_SHOWN = false

/** The strip's track count (A1 §16.1: up to four across, wrapping); fewer tiles take fewer tracks. */
const TRACKS = 4

/** A tile's mark beside its words: never the state on its own (design lint 5).
 * Three marks, one rule each (content review R4): ! blocks or needs attention —
 * a prerequisite in progress or waiting is still in the way — ✓ is satisfied,
 * and an informational count carries none.
 */
const MARK: Record<ReadinessTone, string | null> = { good: '✓', warn: '!', wait: '!', info: null }

/**
 * The Readiness region (the approved `.readiness-strip` over `.readiness-bar`),
 * the one place a prerequisite is shown (A1 §16.1): the unresolved
 * prerequisites of the next action as tiles, up to four across and wrapping,
 * each expandable for its explanation, evidence and the link to its resolver;
 * a compact success line when nothing is unresolved; the satisfied evidence
 * under its own disclosure, readable and out of the way; then the bar that
 * says where the step stands with the one action under it, and the link to
 * the evidence where there is evidence to open. The grid takes its track
 * count from the tiles it is handed, so nothing is padded.
 */
export function ReadinessSection({ readiness, lead, onWhy = null, onConfirm = null, onOpenMappings = null, extra = null, printing = false, children = null, showClosedCount = true, heading }: {
  readiness: ContractReadiness
  lead: ReactNode
  onWhy?: (() => void) | null
  /** Opens the confirmation of a tile's check (a package gate a person confirms); null where the step takes none. */
  onConfirm?: ((tileKey: string) => void) | null
  /** Opens Plan settings → Baseline mappings, where a tile's link names it; null where the surface has no settings (print). */
  onOpenMappings?: (() => void) | null
  /** Evidence a tile carries beyond its sentence, by tile; null for every tile that has none. */
  extra?: ((tile: ReadinessTile) => ReactNode) | null
  /** Printing: every disclosure stands open, so the printed step is the whole step. */
  printing?: boolean
  children?: ReactNode
  showClosedCount?: boolean
  heading?: string
}) {
  const W = CONTRACT.readiness
  // The blocking tiles open with the step (content review D5). Their explanations
  // are measured before paint, every one drawn open; where together they run past
  // the cap, only the first stays open and a line says how many wait closed.
  const sectionRef = useRef<HTMLElement>(null)
  const blocking = readiness.tiles.filter((t) => MARK[t.tone] === '!').map((t) => t.key)
  const sig = blocking.join('\n')
  const [auto, setAuto] = useState<{ sig: string; keys: readonly string[]; closed: number } | null>(null)
  const autoKeys = auto !== null && auto.sig === sig ? auto.keys : blocking
  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section || printing) return
    const details = new Map([...section.querySelectorAll<HTMLElement>('.readiness-strip.unresolved > li')].map((li) => [li.dataset.tileKey ?? '', li.querySelector<HTMLElement>('.tile-detail')]))
    const measured = blocking.flatMap((key) => {
      const d = details.get(key)
      return d ? [{ key, height: d.getBoundingClientRect().height }] : []
    })
    const keys = autoOpenTiles(measured)
    setAuto({ sig, keys, closed: measured.length - keys.length })
  }, [sig, printing])
  const strip = (tiles: ReadinessTile[], cls: string) => (
    <ul className={`readiness-strip ${cls} tiles-${tiles.length < TRACKS ? tiles.length : TRACKS}`}>
      {tiles.map((t) => (
        <Tile key={t.key} tile={t} open={printing} autoOpen={cls === 'unresolved' && autoKeys.includes(t.key)} extra={extra ? extra(t) : null} onConfirm={onConfirm} onOpenMappings={onOpenMappings} />
      ))}
    </ul>
  )
  const closedBlocking = !printing && auto !== null && auto.sig === sig ? auto.closed : 0
  return (
    <section ref={sectionRef} className="step-section readiness-section">
      <h4>{heading ?? W.heading}</h4>
      {readiness.tiles.length > 0 ? (
        strip(readiness.tiles, 'unresolved')
      ) : (
        <p className="readiness-clear">
          <span className="readiness-status readiness-status-good" aria-hidden="true">
            {MARK.good}
          </span>
          <strong>{W.tiles.clear}</strong>
          <span>{W.tiles.clearNote}</span>
        </p>
      )}
      {showClosedCount && closedBlocking > 0 && <p className="readiness-more">{fillText(W.tiles.moreBlocking, { n: closedBlocking })}</p>}
      {readiness.satisfied.length > 0 && (
        <details className="readiness-satisfied" open={printing || undefined}>
          <summary>{fillText(W.tiles.satisfied, { n: readiness.satisfied.length })}</summary>
          {strip(readiness.satisfied, 'satisfied')}
        </details>
      )}
      {/* The bar's status line only repeated the badge and the cards (owner,
          2026-09-23: "Account preparation is verified." is useless); it carries
          the action lead where one is handed in, and the Why link when shown. */}
      {(lead || (onWhy && WHY_LINK_SHOWN)) && (
        <div className="readiness-bar">
          <div className="readiness-bar-main">{lead}</div>
          {onWhy && WHY_LINK_SHOWN && (
            <button type="button" className="inline-link" onClick={onWhy}>
              {W.why}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * One readiness tile, compact until asked (RUN-CONTEXT-B decision 3, U6): one
 * line — mark, label, value and a chevron — that opens the tile's explanation,
 * its evidence and the link to where it is resolved (A1 §16.1). A tile with
 * nothing to disclose draws no control. Whether it is open is the tile's own
 * state, so it resets when the step closes; a blocking tile opens with the step
 * until it is pressed (content review D5); printing stands every tile open.
 * `extra` is evidence a tile carries beyond its sentence — the hardening's own
 * recommendations — handed in by the step, never read here.
 */
function StructuredFindingItems({ items }: { items: NonNullable<ReadinessTile['items']> }) {
  const groups = new Map<string, { label: string; rows: typeof items }>()
  for (const item of items.filter(row => row.actionCovered !== true)) {
    const key = item.subjectId ?? item.accountId ?? item.subjectLabel ?? item.label
    const group = groups.get(key) ?? { label: item.subjectLabel ?? (item.accountId ? item.label : ''), rows: [] }
    group.rows.push(item)
    groups.set(key, group)
  }
  return <div className="emergency-finding-groups">{[...groups].map(([key, group]) => <section key={key} className="emergency-finding-group">
    {group.label && <h5>{group.label}</h5>}
    <dl>{group.rows.map((item, index) => <Fragment key={`${item.issueKeys?.join(':') ?? item.label}:${index}`}>
      <div className="emergency-fact"><dt>{item.factLabel ?? item.label}</dt><dd>{item.value}</dd></div>
      {item.link && <div className="emergency-fact-action"><a href={item.link.href}>{item.link.label}</a></div>}
    </Fragment>)}</dl>
  </section>)}</div>
}

function Tile({ tile: t, open, autoOpen = false, extra, onConfirm, onOpenMappings }: {
  tile: ReadinessTile
  open: boolean
  /** A blocking tile the step opens with (content review D5), until the tile is pressed. */
  autoOpen?: boolean
  extra: ReactNode
  onConfirm: ((tileKey: string) => void) | null
  onOpenMappings: (() => void) | null
}) {
  // The tile's own toggle once pressed; until then, whether the step opened it (D5).
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const detailId = useId()
  const link = t.link === undefined ? null : 'href' in t.link ? <a href={t.link.href}>{t.link.label}</a> : onOpenMappings ? <button type="button" className="inline-link" onClick={onOpenMappings}>{t.link.label}</button> : null
  const more = t.note !== null || link !== null || extra !== null || !!t.items?.length
  const shown = open || (expanded ?? autoOpen)
  const line = (
    <>
      {MARK[t.tone] && (
        <span className={`readiness-status readiness-status-${t.tone}`} aria-hidden="true">
          {MARK[t.tone]}
        </span>
      )}
      <span className="key-label">{t.label !== t.value ? t.label : null}</span>
      <strong>{t.value}</strong>
      {more && <Icon name="chevron" size={14} className="tile-chevron" />}
    </>
  )
  return (
    <li className={`readiness-tile readiness-tile-${t.tone}`} data-tile-key={t.key}>
      {more ? (
        <button type="button" className="tile-summary" aria-expanded={shown} aria-controls={detailId} title={`${t.label} · ${t.value}`} onClick={() => setExpanded(!shown)}>
          {line}
        </button>
      ) : (
        <div className="tile-summary" title={`${t.label} · ${t.value}`}>
          {line}
        </div>
      )}
      {more && (
        <div id={detailId} className="tile-detail" hidden={!shown}>
          {t.note && <p>{t.note}</p>}
          {!!t.items?.length && (t.structuredItems ? <StructuredFindingItems items={t.items} /> : <ul className="sections">{t.items.map((item, index) => <li key={index}>{item.label && <strong>{item.label} — </strong>}{item.value}</li>)}</ul>)}
          {extra}
          {link && <p className="readiness-link">{link}</p>}
        </div>
      )}
      {t.confirm && onConfirm && (
        <button type="button" className="inline-link readiness-confirm" onClick={() => onConfirm(t.key)}>
          {t.confirm.satisfied ? CONTRACT.confirm.confirmedControl : CONTRACT.confirm.control}
        </button>
      )}
    </li>
  )
}

/** A route or fixed HTTPS source link in authored text: `[words](destination)`. */
const AUTHORED_LINK = /^\[([^\]]+)\]\(((?:#\/|https:\/\/)[^)\s]*)\)$/

/** `**bold**`, `` `code` `` and a safe authored link inside one line. Nothing else is interpreted, and no HTML ever is. */
function inlineText(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:#\/|https:\/\/)[^)\s]*\))/g).map((part, i) => {
    const link = AUTHORED_LINK.exec(part)
    const external = link?.[2].startsWith('https://') === true
    return part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : link ? (
      <a key={i} className="inline-link" href={link[2]} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        {link[1]}
      </a>
    ) : (
      part
    )
  })
}

/**
 * An implementation-content block authored as Markdown (an Entra procedure, AI
 * Info, an Email), drawn as text a person reads: a heading line, numbered and
 * bulleted lists, bold and inline code, and every other line as its own line so
 * an authored line break survives. Copy copies the bound Markdown itself.
 */
export function AuthoredText({ text }: { text: string }) {
  return (
    <>
      {authoredParts(text).map((part, k) => {
        if (part.kind === 'break') return <span key={k} className="authored-break" aria-hidden="true" />
        if (part.kind === 'heading') {
          return (
            <p key={k} className="authored-heading">
              <strong>{inlineText(part.text)}</strong>
            </p>
          )
        }
        if (part.kind === 'line') return <p key={k}>{inlineText(part.text)}</p>
        const items = part.items.map((lines, i) => (
          <li key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {/* The space keeps the item's lines apart in its text, not only on screen: without it "…you save.<br>This change…" reads as one sentence. */}
                {j > 0 && <>{' '}<br /></>}
                {inlineText(l)}
              </Fragment>
            ))}
          </li>
        ))
        return part.ordered ? <ol key={k} start={part.start === 1 ? undefined : part.start}>{items}</ol> : <ul key={k}>{items}</ul>
      })}
    </>
  )
}

/** The truthful no-action box, at the weight of its reason (the approved `.implementation-empty`). */
export function ImplementationEmptyBox({ empty }: { empty: ImplementationEmpty }) {
  return (
    <div className={`implementation-empty implementation-empty-${empty.tone}`}>
      <strong>{empty.title}</strong>
      <p>{empty.text}</p>
    </div>
  )
}

/**
 * One of the step's dialogs (the approved implementation, readiness and rollout
 * dialogs): a native modal, so the platform traps focus, Escape closes it and
 * focus returns to the control that opened it. A click on the backdrop closes it
 * too. Its content is mounted only while it is open.
 */
export function StepDialog({ open, onClose, eyebrow, title, sub = null, closeLabel, wide = false, toolbar = null, children }: {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  sub?: ReactNode
  closeLabel: string
  wide?: boolean
  /** Controls the head carries beside its close control — the viewer's channel tabs and Copy — so they stay in view while the content scrolls (U16). */
  toolbar?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) d.close()
  }, [open])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    // A click on the backdrop lands on the dialog element itself, outside its
    // box. Escape is the keyboard's way out, and the platform already gives it.
    const onBackdrop = (e: MouseEvent): void => {
      if (e.target !== d) return
      const r = d.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose()
    }
    d.addEventListener('click', onBackdrop)
    return () => d.removeEventListener('click', onBackdrop)
  }, [onClose])
  return (
    <dialog
      ref={ref}
      className={`step-dialog panel${wide ? ' step-dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {open && (
        <div className="dialog-shell">
          <header className="dialog-head">
            <div>
              <div className="eyebrow">{eyebrow}</div>
              <h3 id={titleId}>{title}</h3>
              {sub && <p>{sub}</p>}
            </div>
            {/* Icon-only, named for a screen reader and on hover (U17). */}
            <div className="dialog-head-actions">
              {toolbar}
              <button type="button" className="icon-btn" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
                <Icon name="close" size={14} />
              </button>
            </div>
          </header>
          <div className="dialog-content">{children}</div>
        </div>
      )}
    </dialog>
  )
}

/**
 * The step's required policy members, where there is more than one.
 *
 * A goal the baseline implements with two policies is one step delivering two
 * objects, each with its own name, its own stage and its own history
 * (Foundation B). Neither of them is shown as the step, and neither stands for
 * the other. A step with one policy renders nothing here, so the ordinary row
 * stays as light as it was.
 */
export function PolicyMembers({ members }: { members: ContractMember[] }) {
  if (members.length < 2) return null
  return (
    <ul className="step-members">
      {members.map((m) => (
        <li key={m.key}>
          {m.label && <span className="member-label">{m.label}</span>} {m.line}
        </li>
      ))}
    </ul>
  )
}

/**
 * A contract section: its heading and its content, or nothing at all. §8.7: a
 * heading with nothing under it is not rendered.
 *
 * Task 035 gave it the frame the approved pack draws around every section of an
 * opened step (`docs/design/approved/anatomy/plan-step-v1.html` `.step-section`): a
 * `<section>` of its own, divided from the next by the frame's hairline. The
 * division is what makes the canonical order legible as an order rather than as
 * a column of headings — and it is a real element, so the sections a step
 * renders are also the sections a screen reader walks.
 *
 * `frame` is false where a section is nested inside another disclosure (More's
 * own blocks), which the pack draws as cards and not as ruled sections.
 */
export function StepSection({ heading, when = true, frame = true, children }: { heading: string; when?: boolean; frame?: boolean; children: ReactNode }) {
  if (!when) return null
  if (!frame)
    return (
      <>
        <h4>{heading}</h4>
        {children}
      </>
    )
  return (
    <section className="step-section">
      <h4>{heading}</h4>
      {children}
    </section>
  )
}

/**
 * What this scan observed that bears on the decision, in the approved pack's
 * finding-card grammar (`docs/design/approved/anatomy/plan-step-v1.html` `.findings`):
 * a key naming what kind of finding this is, over the finding itself.
 *
 * Conditional, and never padded. The pack's sample draws three cards because
 * its sample step had three things to say; production renders exactly the
 * findings `stepContract.foundOf` built and no placeholder card stands in for
 * one it did not. The grid takes its column count from that number, so one
 * finding is one full-width card rather than a third of a row with two gaps
 * beside it.
 *
 * The card carries no bold headline over its sentence. The pack's sample splits
 * a finding into a value and an explanation because its samples were written
 * that way; production writes one sentence per finding, and cutting it in two
 * here would be this component deciding which half matters.
 */
export function WhatIamaiFound({ found }: { found: ContractFound[] }) {
  if (found.length === 0) return null
  return (
    <StepSection heading={CONTRACT.foundHeading}>
      <ul className="findings">
        {found.map((f) => (
          <li key={f.key} className="finding">
            <span className="key-label">{f.label}</span>
            <span className="finding-text">{f.text}</span>
          </li>
        ))}
      </ul>
    </StepSection>
  )
}

/**
 * An emergency account slot's detail (B10 P0-7, S-BG-1): its minimum safety
 * blockers while any remain, then its hardening recommendations — secondary, and
 * never a block. Once minimum emergency access is available the operator may
 * defer the hardening — the rollout continues and it moves to Cleanup, never out
 * of view — and may undo that. The deferral is set-wide, so it is handed to one
 * slot (`hardening` is null on the others). The tile's own note is the lead;
 * nothing here says the state twice.
 */
export function EmergencySlotBody({ slot, hardening, onDefer, onUndo }: { slot: ContractEmergencySlot; hardening: ContractHardening | null; onDefer: (() => void) | null; onUndo: (() => void) | null }) {
  const H = CONTRACT.hardening
  const lines = slot.state === 'minimum' ? { title: H.minimumHeading, items: slot.minimum } : slot.state === 'hardening' ? { title: H.heading, items: slot.hardening } : null
  if (lines === null) return null
  return (
    <div className="hardening">
      {lines.items.length > 0 && (
        <div className="hardening-group">
          <h5>{lines.title}</h5>
          <ul className="sections">
            {lines.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {hardening && slot.state === 'hardening' && hardening.unchecked > 0 && <p className="reason">{fillText(H.unchecked, { n: hardening.unchecked })}</p>}
      {hardening && !hardening.deferredAt && hardening.canDefer && onDefer && (
        <p className="actions">
          <Button variant="secondary" onClick={onDefer}>{H.defer}</Button>
        </p>
      )}
      {hardening?.deferredAt && onUndo && (
        <p className="actions">
          <Button variant="secondary" onClick={onUndo}>{H.undo}</Button>
        </p>
      )}
    </div>
  )
}

/** The one next operator action under the Readiness bar, or nothing where it is filler (content review R2). */
export function WhatToDoLead({ contract }: { contract: StepContract }) {
  const text = readinessLeadOf(contract)
  if (text === null) return null
  return <p className={`do-lead do-${contract.whatToDo.kind}`}>{text}</p>
}

/**
 * How the operator will know the step is finished. Always at least one concrete
 * line, drawn as the approved Done when draws it: prose under its heading, one
 * paragraph per line.
 */
export function DoneWhen({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <StepSection heading={heading}>
      {lines.map((l, i) => (
        <p key={i} className="done-line">
          {l}
        </p>
      ))}
    </StepSection>
  )
}

/** Keep prerequisite titles in the opened readiness detail, not in the narrow state cell. */
function compactLane(label: string): string { return label.startsWith('Up Next ·') ? 'Up Next' : label.startsWith('On Hold · After ') ? 'On Hold' : label }
