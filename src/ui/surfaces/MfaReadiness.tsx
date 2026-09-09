// MFA Readiness (task 012, restored to the approved pack by task 037): the
// surface that replaced Today.
//
// One job, and the page is arranged around it — see who is ready for passkeys,
// who still needs to prove one, and who still needs a stronger method. It is
// diagnostic before it is operational: the answer should be readable without
// opening a row.
//
// The anatomy is `docs/design/approved/mfa-readiness-v2.html` and is asserted
// against it, both ways, in surfaces/readinessAnatomy.test.ts: an eyebrow and a
// display heading, one supporting sentence, ONE integrated summary panel (a
// dominant cell over the answer in a sentence, then the three counts as cells
// of the same panel — not four cards), one callout under it, a search with the
// filters as pills, the six-zone person table, and a footer note.
//
// What the pack does NOT own is what any of it means. The counts are the
// groupings derive/mfaReadiness.ts partitions the active people into; the
// callout is derive/stepMfaReadiness.ts's hold; every cell in the table is a
// field the row already carries. Nothing here reads a method, a sign-in record
// or a rung a second time, and the restoration changed none of them.
//
// What it is not: the old five-tile ladder page. The rung a person stands on is
// still the truth and still shows, as the badge in their row and in the tooltip
// on it — Connect's Plan tile still links here filtered to a rung, and that
// filter still works. What the page counts is the three groupings
// (derive/mfaReadiness.ts), because "which of the five rungs is everyone on" is
// a different question from "who still needs a passkey".
//
// Every number is derive/facts.ts and derive/mfaReadiness.ts over the
// population's mapping (planData.ts useAppliedMapping), the same facts the Plan
// and Connect read, so the three surfaces cannot disagree.
//
// Remediation (task 014) is the operational half, and it stays behind a click:
// a person's Next step is a button, and the guidance for the method they need
// opens in one panel under the table. The guidance itself is
// content/methodGuides.ts over shared.methodGuides — the same lines the help
// desk copies and the campaign step's email points at — and which guide a
// person is offered follows their group, which is task 002's evidence and not a
// second reading of it. Nothing here proves a method or moves a rung.
//
// The Plan handoff: #/readiness/step/<id> filters to the people one step is
// waiting on. The hash carries the step's id and nothing else; who it reaches is
// resolved here from the plan this page computes, over the same rows the table
// shows (derive/stepMfaReadiness.ts). The counts above the table stay the whole
// tenant's — the callout says what the filter is.
//
// The callout is one element on every scanned page and its WORDS carry the
// state (noticeWords): the step this page was opened from, or the plan's own
// current dependency — a step with the people it is waiting on, a step whose
// people this scan could not settle, the settled answer that nothing is
// waiting, or, before the plan has computed here, that no step is named yet.
// The anatomy is the pack's and does not vary with what the scan found; only
// the sentence does.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { Rung } from '../../derive/ladder.ts'
import { READINESS_GROUPS, SHOW_KEYS, actionable, showKeyOf, shows, readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessGroup, ReadinessRow, ShowKey } from '../../derive/mfaReadiness.ts'
import { firstMfaDependency, stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import type { PlanMfaDependency } from '../../derive/stepMfaReadiness.ts'
import { app, pages } from '../../content/content.ts'
import { PASSKEY_TARGET, TENANT_PREREQUISITE, guideText, methodGuide, remediationFor } from '../../content/methodGuides.ts'
import type { MethodGuideId, Remediation } from '../../content/methodGuides.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import { groupWords, ledgerParts, methodWord, nextStateWord, notActiveWord, readinessWord, roleWord, rowEvidenceText, rungWords, showWord } from './readinessCells.ts'
import { READINESS_CSV } from './inventoryTables.ts'
import { useAppliedMapping, usePlanData } from './planData.ts'
import { PLAN_HREF, readinessHref, showFromReadinessHash, stepFromReadinessHash } from '../shell/routes.ts'
import { Button, Callout, DataTable, InfoTip, PageTip } from '../components/index.ts'
import type { Column } from '../components/index.ts'
import { REDACTED, exportClipboard } from '../exportGuard.ts'
import { scan } from '../actions.ts'
import { useAction } from '../useAction.ts'
import { W as CONNECT_WORDS } from '../scan/connectView.ts'

type ReadinessCopy = {
  h1: string
  eyebrow: string
  lead: string
  summaryEyebrow: string
  summary: string
  summaryNone: string
  summarySub: string
  summarySubNone: string
  summarySubUnknown: string
  adminsOnly: string
  columns: string[]
  notAPerson: string
  separate: string
  unknownMethods: string
  inventory: string
  tip: string
  planContext: { filtered: string; unknown: string; back: string; dependencyTitle: string; dependency: string; dependencyLink: string; dependencyNoneTitle: string; dependencyNone: string; dependencyPending: string; planLink: string }
  remediation: { heading: string; choose: string; other: string; copy: string; copied: string; close: string; learn: string }
}
const T = pages.readiness as unknown as ReadinessCopy
const C = app.readiness

/**
 * The rung's badge: the number in the rung's colour, its title as the
 * accessible name; a grey dash where nothing is set up on an uncounted account.
 *
 * `role="img"` is what makes the label carry (task 017): `aria-label` on a bare
 * span is ignored by most assistive technology, so the badge read as the bare
 * digit "3" beside the group word instead of the rung it names.
 */
function RungBadge({ rung }: { rung: Rung | null }) {
  return (
    <span className={`rung-badge rung-${rung ?? 0}`} role={rung ? 'img' : undefined} title={rung ? rungWords(rung).title : undefined} aria-label={rung ? rungWords(rung).title : undefined}>
      {rung ?? '–'}
    </span>
  )
}

/**
 * The Plan step this page is scoped to, once the plan has computed: the people
 * it is waiting on, resolved from the rows on screen.
 *
 * `ids: null` is unknown reach and stays unknown — a step whose readiness this
 * scan could not measure shows the callout with no number and no filter, never
 * an empty table claiming nobody is affected.
 */
type PlanContext = { title: string; stepId: string; ids: string[] | null }

/**
 * The plan dependency the unscoped page states (task 037, corrected): the
 * relationship derive/stepMfaReadiness.ts's `firstMfaDependency` settled, plus
 * the one state that is not its answer to give — `pending`, before the plan has
 * computed on this device at all.
 *
 * It is the same relationship the Plan step's own handoff draws
 * (surfaces/MfaHandoff.tsx), read from this side. `stepMfaHold` is the one
 * authority for both, so the number here and the number on the step are the
 * same number; nothing is measured a second time.
 *
 * Every state is stated. The page used to render this callout only where a
 * known, non-empty hold existed, so an all-ready tenant, a tenant whose reach
 * this scan could not settle, and a tenant with nothing on the plan waiting all
 * lost the supporting panel entirely — the anatomy changed with the tenant, and
 * the state hardest to read (unknown) was the one that said nothing. The four
 * states below are exhaustive, and each says only what it has.
 */
type PlanDependency = PlanMfaDependency | { kind: 'pending' }

/**
 * The one supporting notice under the summary, as words: the tone it is drawn
 * in, the title it leads with where it has one, the sentence, and the way to
 * the Plan it holds apart from it.
 *
 * One notice and one shape, whatever the tenant is: the page's anatomy is the
 * approved pack's and does not vary with what the scan found. What varies is
 * this — and only among sentences production owns, each of them a fact
 * something already settled.
 */
type ReadinessNotice = { kind: 'info' | 'warning'; title: string | null; text: string; href: string; link: string }

const stepHref = (stepId: string): string => `#/plan/${encodeURIComponent(stepId)}`

/**
 * The notice for the page as it stands: the step it was opened from where there
 * is one, and the plan's own current dependency otherwise.
 *
 * The scoped branch leads with no title — the sentence is about the page in
 * front of the reader — and its action is the way back to the step. The
 * dependency branch names itself, because it is a fact about somewhere else.
 */
function noticeWords(context: PlanContext | null, dependency: PlanDependency): ReadinessNotice {
  const P = T.planContext
  if (context) {
    // An unknown reach stays unknown: no number, and the table is not filtered.
    const text = context.ids === null ? fillText(P.unknown, { step: context.title }) : fillText(P.filtered, { n: context.ids.length, step: context.title })
    return { kind: 'info', title: null, text, href: stepHref(context.stepId), link: P.back }
  }
  if (dependency.kind === 'holding') return { kind: 'warning', title: P.dependencyTitle, text: fillText(P.dependency, { n: dependency.n, step: contentTitle(dependency.step) }), href: stepHref(dependency.step.id), link: P.dependencyLink }
  // A hold whose people this scan could not settle: the same words the
  // step-scoped page says on the same fact (planContext.unknown), because it is
  // the same fact. No number is invented for it and no filter is offered.
  if (dependency.kind === 'unknown') return { kind: 'info', title: P.dependencyTitle, text: fillText(P.unknown, { step: contentTitle(dependency.step) }), href: stepHref(dependency.step.id), link: P.dependencyLink }
  // Nothing on the plan is waiting on anybody's method. A settled, empty answer
  // the plan computation proved, which is why it is a state and not a silence.
  if (dependency.kind === 'none') return { kind: 'info', title: P.dependencyNoneTitle, text: P.dependencyNone, href: PLAN_HREF, link: P.planLink }
  // The plan has not computed here yet, so there is no dependency to name —
  // and, in particular, no basis for saying there is none.
  return { kind: 'info', title: P.dependencyTitle, text: P.dependencyPending, href: PLAN_HREF, link: P.planLink }
}

export function MfaReadiness({ scan: lastScan, baseline }: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
}) {
  const [stepId, setStepId] = useState<string | null>(() => stepFromReadinessHash(window.location.hash))
  useEffect(() => {
    const onHash = () => setStepId(stepFromReadinessHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // The plan, computed read-only (never touching the plan record) exactly as
  // Connect's Plan tile does. It is computed whether or not the page arrived
  // scoped to a step, because the approved pack's callout is the Plan
  // relationship and the unscoped page has to be able to state it.
  const data = usePlanData(lastScan, baseline, true)
  const steps = data.computed?.steps ?? []
  const scored = data.computed?.viability ?? []
  const step = stepId === null ? null : (steps.find((s) => s.id === stepId) ?? null)
  // The plan's own scoring, the one the readiness percentage that holds the step
  // was taken over (planData.ts): the people it names cannot disagree with it.
  const hold = step && data.computed ? stepMfaHold(step, scored) : null
  // No scope where there is no relationship: a step that is not on this plan, or
  // one nothing about anybody's authentication method is holding. Such a page is
  // the unfiltered page, and it states the plan's dependency like any other.
  const context: PlanContext | null = step && hold ? { title: contentTitle(step), stepId: step.id, ids: hold.ids } : null
  // The plan's own current dependency, whichever of its states this scan and
  // this plan settled; `pending` before the plan has computed here, because
  // nothing may report an absence the plan never proved.
  //
  // Memoised on the plan itself: it walks every step, and the answer can only
  // change when the plan does.
  const dependency = useMemo<PlanDependency>(() => (data.computed ? firstMfaDependency(data.computed.steps, data.computed.viability) : { kind: 'pending' }), [data.computed])
  const notice = noticeWords(context, dependency)
  if (!lastScan) return <ReadinessPage snapshot={null} context={null} notice={notice} />
  return <ReadinessPage snapshot={lastScan.snapshot} context={context} notice={notice} />
}

/**
 * Who the panel is open for and which guide is showing. The person is held by
 * the account id the row already carries — the display name is shown and never
 * relied on, so a rename or two people with the same name cannot move guidance
 * onto the wrong account.
 */
type OpenGuide = { userId: string; guideId: MethodGuideId | null }

/** The one remediation panel on the page: the row control that opens it names it. */
const GUIDE_PANEL_ID = 'readiness-guide-panel'

/** The guide's title as a choice: pressed shows it, pressed again puts it away. */
function GuideChoice({ id, on, onPick }: { id: MethodGuideId; on: boolean; onPick: (id: MethodGuideId | null) => void }) {
  return (
    <Button variant="tertiary" aria-pressed={on} onClick={() => onPick(on ? null : id)}>
      {methodGuide(id).title}
    </Button>
  )
}

/**
 * The remediation panel: one person, the action their evidence earns, and the
 * guidance for it.
 *
 * It reads `row.group` and asks content/methodGuides.ts what that group is
 * offered. It never looks at the methods, the records or the rung itself, so it
 * cannot come to a different answer from the table above it: somebody the page
 * calls "Needs proof" is asked to use what they already hold, never to register
 * a second passkey.
 *
 * The two guides that do not reach the page's target stand under their own line
 * (a Temporary Access Pass is a way in; Windows Hello for Business works on one
 * PC). They are offered, and they are not offered as finishing the job.
 *
 * It passes the row itself, because whether a guide applies is also the person:
 * a guest's methods are their home tenant's, so this tenant cannot issue them a
 * Temporary Access Pass and the panel says so instead of offering one.
 */
function RemediationPanel({ row, guideId, onPick, onClose }: {
  row: ReadinessRow
  guideId: MethodGuideId | null
  onPick: (id: MethodGuideId | null) => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const R = T.remediation
  const r: Remediation = remediationFor(row.group, row)
  if (r.kind === 'none' || r.kind === 'unknown') return null
  const guide = guideId === null ? null : methodGuide(guideId)
  const name = row.user.displayName ?? row.user.userPrincipalName ?? ''
  const copy = (): void => {
    if (!guide) return
    void exportClipboard(guideText(guide.id), REDACTED).then((ok) => {
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <section className="guide-panel card" id={GUIDE_PANEL_ID} tabIndex={-1}>
      <h3>{fillText(R.heading, { name })}</h3>
      <p className="reason">{PASSKEY_TARGET}</p>
      {r.kind === 'setUp' && (
        <>
          <p className="reason">{TENANT_PREREQUISITE}</p>
          <p className="line">{R.choose}</p>
          <p className="actions">{r.guides.map((id) => <GuideChoice key={id} id={id} on={id === guideId} onPick={onPick} />)}</p>
          <p className="line">{R.other}</p>
          <p className="actions">{r.other.map((id) => <GuideChoice key={id} id={id} on={id === guideId} onPick={onPick} />)}</p>
          {/* Why a choice the panel would otherwise offer is absent: a guest gets
              no Temporary Access Pass from this tenant. The sentence is the one
              the campaign step already carries (shared.methodGuides.guest). */}
          {r.note && <p className="reason">{r.note}</p>}
        </>
      )}
      {guide && (
        <div className="guide">
          <h4>{guide.title}</h4>
          <ol className="sections">{guide.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
          <p className="line">
            <a href={guide.learn.url} target="_blank" rel="noopener noreferrer">
              {R.learn}
            </a>
          </p>
          {/* The help desk gets the words on screen, not a second version of
              them: the copied text is this guide, and it carries no name. */}
          <p className="actions">
            <Button variant="secondary" onClick={copy}>
              {copied ? R.copied : R.copy}
            </Button>
          </p>
        </div>
      )}
      <p className="actions">
        <Button variant="tertiary" onClick={onClose}>
          {R.close}
        </Button>
      </p>
    </section>
  )
}

function ReadinessPage({ snapshot, context, notice }: { snapshot: TenantSnapshot | null; context: PlanContext | null; notice: ReadinessNotice }) {
  // The population's mapping (the detected emergency and service accounts, and every saved decision): the Plan's and Connect's.
  const mapping = useAppliedMapping(snapshot)
  // Scan again, beside the heading (ui/actions.ts): the scan's line shows under the header, and it returns here with the filter kept.
  const again = useAction()
  const view = useMemo(() => (snapshot && mapping ? readinessView(snapshot, snapshot.asOf, mapping) : null), [snapshot, mapping])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<ShowKey>(() => showKeyOf(showFromReadinessHash(window.location.hash)) ?? 'all')
  const [adminsOnly, setAdminsOnly] = useState(false)
  // The remediation panel: closed until a person's Next step is pressed, so the
  // page's first screen stays the diagnostic it was built as.
  const [open, setOpen] = useState<OpenGuide | null>(null)
  // The control the panel was opened from, so Close puts focus back on it
  // instead of dropping it on the body at the top of the page.
  const trigger = useRef<HTMLElement | null>(null)
  const closeGuide = (): void => {
    setOpen(null)
    trigger.current?.focus()
  }
  useEffect(() => {
    const onHash = () => setShow(showKeyOf(showFromReadinessHash(window.location.hash)) ?? 'all')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const select = (key: ShowKey): void => {
    setShow(key)
    // A step-scoped view keeps its hash: the scope is what the URL means, and a
    // filter inside it narrows what is already narrowed. Leaving the scope is a
    // link (the quiet line below the table), which is navigation, not a filter.
    if (!context) window.history.replaceState(null, '', readinessHref(key))
  }
  const source = snapshot?.sources.signInEvidence
  const window_ = source?.coveredWindow ? fillText(C.lineRecords, { from: monthDay(source.coveredWindow.from), to: monthDay(source.coveredWindow.to) }) : source?.status === 'disabled' && source.reason ? fillText(C.lineNoRecordsReason, { reason: source.reason }) : C.lineNoRecords
  // A Plan step's people are a filter over the same rows, never a set of their
  // own: the ids came from these rows in the first place.
  const scoped = context?.ids ? new Set(context.ids) : null
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (view?.rows ?? []).filter(
      (r) =>
        (!scoped || scoped.has(r.user.id)) &&
        shows(r, show) &&
        (!adminsOnly || r.admin) &&
        (!q || `${r.user.displayName ?? ''} ${r.user.userPrincipalName ?? ''} ${methodWord(r.method)}`.toLowerCase().includes(q)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, query, show, adminsOnly, context?.ids])

  // The approved pack's six person zones, in its order (task 037): Person,
  // Role, Strongest method, Proof, Readiness, Action. Two keep production's own
  // words, because the pack owns the anatomy and not the copy — the identity
  // column is "Account" on a table that also lists shared devices and service
  // accounts, and the last column is a state before it is ever an action.
  //
  // Every cell consumes an authority already made: the name and the sign-in
  // address are the directory's, the role is roles.ts's through `r.admin`, the
  // method word is derive/ladder.ts's `methodWordOf`, the proof line is the
  // row's own evidence, and the readiness word is the group derive/mfaReadiness
  // .ts put the row in. Nothing here reads a method, a record or a rung again.
  const columns: Column<ReadinessRow>[] = [
    {
      key: 'account',
      header: T.columns[0],
      minWidth: '14rem',
      sortValue: (r) => (r.user.displayName ?? r.user.userPrincipalName ?? '').toLowerCase(),
      csv: (r) => r.user.displayName ?? r.user.userPrincipalName ?? '',
      // The pack draws the name over the sign-in address. The address carries
      // `.tenant-object`, so a long UPN breaks inside its column instead of
      // pushing the page out (task 030).
      render: (r) => (
        <>
          <strong className="person-name">{r.user.displayName ?? r.user.userPrincipalName}</strong>
          {r.user.displayName && r.user.userPrincipalName && <span className="person-upn tenant-object">{r.user.userPrincipalName}</span>}
        </>
      ),
    },
    { key: 'upn', header: C.signInAddress, hidden: true, render: () => null, csv: (r) => r.user.userPrincipalName ?? '' },
    {
      key: 'role',
      header: T.columns[1],
      minWidth: '7rem',
      sortValue: (r) => roleWord(r),
      csv: (r) => roleWord(r),
      // The word is the role. `.role-admin` tints it the admin ink the pack
      // draws, over the word and never instead of it; a guest keeps the tag it
      // has always had, because where the methods live is a different fact from
      // what the account is.
      render: (r) => (
        <>
          <span className={`role${r.kind === 'person' && r.admin ? ' role-admin' : ''}`}>{roleWord(r)}</span>
          {r.guest && <span className="chip tag">{C.guest}</span>}
        </>
      ),
    },
    { key: 'method', header: T.columns[2], minWidth: '9rem', sortValue: (r) => methodWord(r.method), csv: (r) => methodWord(r.method), render: (r) => methodWord(r.method) },
    { key: 'proof', header: T.columns[3], minWidth: '8rem', csv: (r) => rowEvidenceText(r), render: (r) => rowEvidenceText(r) },
    {
      key: 'readiness',
      header: T.columns[4],
      minWidth: '12rem',
      // Passkey-ready first, then the people with the most to do: the group is
      // the page's order and the rung breaks the tie inside it.
      sortValue: (r) => (r.kind !== 'person' ? -1 : !r.active ? 0 : r.rung ?? 0),
      csv: (r) => readinessWord(r),
      // The pack draws this cell as ONE bounded status object — a marker and a
      // word inside a full-round outline — and production drew a loose badge
      // beside loose text, so the column read as two things rather than one
      // state. The outline is the shared `.pill` role (task 031), which is
      // geometry and never a state colour; what is inside it is unchanged, and
      // that is the point: the marker is still the rung's own badge, carrying
      // the rung's number and its accessible name, and the word beside it is
      // still the group derive/mfaReadiness.ts put the row in. The word is what
      // says the state — the pill bounds it and the badge colours the rung, and
      // neither is ever the only signal.
      render: (r) => (
        <span className="readiness-status pill">
          <RungBadge rung={r.rung} />
          {r.group !== null ? (
            <span className="group-word">{readinessWord(r)}</span>
          ) : (
            <span className="not-person">{r.kind !== 'person' ? T.notAPerson : notActiveWord()}</span>
          )}
        </span>
      ),
    },
    {
      key: 'next',
      header: T.columns[5],
      minWidth: '9rem',
      csv: (r) => nextStateWord(r),
      // The state stays the words it always was; where there is remediation to
      // open, it is also the control that opens it. A person already
      // passkey-ready is asked for nothing, and an account whose methods this
      // scan could not read gets no setup path invented for it — the page's own
      // "scan again" is the action there.
      render: (r) => {
        const kind = remediationFor(r.group, r).kind
        // Nothing to do, and the pack draws that as an em rule rather than an
        // empty cell. It is a mark, not a word: a screen reader hears the cell
        // as empty, which is the fact.
        if (kind === 'none' || kind === 'unknown') return nextStateWord(r) || <span className="no-action" aria-hidden="true">&mdash;</span>
        const on = open?.userId === r.user.id
        return (
          <Button
            variant="tertiary"
            aria-expanded={on}
            aria-controls={GUIDE_PANEL_ID}
            onClick={(e) => {
              // Where focus goes back to when the panel closes: the row's own
              // control, not the top of the document (task 017).
              trigger.current = e.currentTarget
              setOpen(on ? null : { userId: r.user.id, guideId: kind === 'prove' ? 'prove' : null })
            }}
          >
            {nextStateWord(r)}
            <span aria-hidden="true"> →</span>
          </Button>
        )
      },
    },
  ]
  // The person the panel is open for, found again among the rows on screen: a
  // scan that changes who is listed closes it rather than leaving guidance
  // standing over an account that is no longer there.
  const openRow = open === null ? null : (view?.rows.find((r) => r.user.id === open.userId) ?? null)

  // The pack's page head: an eyebrow, the display heading, the page's own action
  // beside it, then one supporting sentence.
  const heading = (
    <>
      <div className="eyebrow">{T.eyebrow}</div>
      <div className="page-head">
        <h1 className="display">{T.h1}</h1>
        <span className="page-head-actions">
          <Button variant="tertiary" onClick={() => again.run(scan(readinessHref(show)))}>
            {CONNECT_WORDS.scan.complete.again}
          </Button>
          {again.error && <span className="quiet" role="status">{again.error}</span>}
        </span>
      </div>
    </>
  )
  if (!view) {
    return (
      <section className="surface readiness">
        {heading}
        <p className="reason">{app.shell.loading}</p>
      </section>
    )
  }
  const { facts, groups } = view
  const ledger = ledgerParts(facts)
  const summary = facts.active > 0 ? fillText(T.summary, { ready: groups.ready, active: facts.active }) : T.summaryNone
  // The second line of the summary's main cell: how many of the active people
  // this scan established still need something done. It is
  // derive/mfaReadiness.ts's `actionable` — the two settled groups — and never a
  // second count of anybody.
  //
  // It used to be `active - ready`, which silently swept `unknown` in with them:
  // a tenant whose registration report could not be read was told in the
  // page's most prominent sentence that all of those people "still need action",
  // when IAMAI does not know whether any of them holds a passkey. Unknown is
  // stated as unknown, in its own sentence under the panel, and is not counted
  // as a finding here.
  //
  // The same reason there are three sub-lines and not two: with nobody settled
  // as needing action and somebody unknown, "Nobody is waiting on a method" is
  // a claim about people this scan could not read, so the page says what it can
  // instead — nobody it could read is waiting.
  const needAction = actionable(groups)
  const summarySub = facts.active === 0 ? '' : needAction > 0 ? fillText(T.summarySub, { n: needAction }) : groups.unknown > 0 ? T.summarySubUnknown : T.summarySubNone
  // The Show list, as the pack's filter pills. A link that arrived filtered to a
  // rung or to a separate population keeps its own pill on the end, so the
  // control still says what is on screen.
  const pills: ShowKey[] = SHOW_KEYS.includes(show) ? [...SHOW_KEYS] : [...SHOW_KEYS, show]
  return (
    <section className="surface readiness">
      {heading}
      <p className="line intro">{T.lead}</p>
      <PageTip page="readiness" text={T.tip} />
      {/* The approved pack's integrated summary: one panel, a dominant cell that
          says the answer in a sentence, and the three counts beside it divided
          by the panel's own hairlines rather than boxed as separate cards. The
          counts are the groups derive/mfaReadiness.ts partitions the active
          people into; the panel states them and filters nothing — the pills
          below are the controls. */}
      <section className="readiness-summary panel">
        <div className="summary-main">
          <div className="eyebrow">{T.summaryEyebrow}</div>
          <p className="headline display">{summary}</p>
          {summarySub && <p className="sub">{summarySub}</p>}
        </div>
        {READINESS_GROUPS.map((g: ReadinessGroup) => {
          const w = groupWords(g)
          return (
            <div key={g} className="summary-stat">
              <div className={`stat-n stat-num group-${g}`}>{groups[g]}</div>
              <div className="stat-k">
                <span className="stat-title">{w.title}</span>
                <InfoTip title={w.title} text={w.tip} />
              </div>
              <div className="stat-hint">{w.hint}</div>
            </div>
          )
        })}
      </section>
      {/* The pack's one callout, under the summary and in its place — one
          element, drawn on every scanned page, whose WORDS say which
          relationship this page has to the Plan (noticeWords). It used to be
          two conditional callouts, and both conditions could be false, so a
          tenant with nothing known holding the plan lost the panel and the page
          had a different anatomy depending on what the scan found. The pack's
          shape, never its sample sentence — every branch is production's own
          fact, and nothing is drawn here to fill the panel.

          The pack divides it: what is true on the left, the way to the Plan
          held apart on the right, and the two stacked once the notice is too
          narrow to hold both. So the notice names its own two parts —
          `.callout-explain` and `.callout-action` — and the readiness rules in
          app.css lay them out.

          The space between the two parts stays in the DOM, so the notice reads
          as the one sentence it always did to anything reading its text rather
          than its layout. A whitespace-only node is not a flex item, so it
          draws nothing. */}
      <Callout kind={notice.kind}>
        <span className="callout-explain">
          {notice.title !== null && <strong>{notice.title} </strong>}
          {notice.text}
        </span>{' '}
        <a className="callout-action" href={notice.href}>
          {notice.link}
        </a>
      </Callout>
      {/* Unknown stays a sentence, never a fourth count: the page will not put a
          number beside a state it could not establish. */}
      {groups.unknown > 0 && <p className="reason">{fillText(T.unknownMethods, { n: groups.unknown })}</p>}
      {/* The pack's toolbar: the search, then the filters as pills. Each pill is
          a real control over the same Show key the hash carries, so what the URL
          says and what is pressed cannot part. Pressed is `aria-pressed` and a
          check mark as well as the accent, never the colour alone (task 017). */}
      <div className="toolbar no-print">
        <input type="search" placeholder={C.search} aria-label={C.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        {pills.map((k) => (
          <Button key={k} variant="tertiary" className="pill" aria-pressed={show === k} onClick={() => select(k)}>
            {showWord(k)}
          </Button>
        ))}
        <Button variant="tertiary" className="pill" aria-pressed={adminsOnly} onClick={() => setAdminsOnly((v) => !v)}>
          {T.adminsOnly}
        </Button>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.user.id} csvName={READINESS_CSV} empty={C.noMatch} panel stacked />
      {openRow && open && (
        <RemediationPanel
          row={openRow}
          guideId={open.guideId}
          onPick={(guideId) => setOpen({ userId: open.userId, guideId })}
          onClose={closeGuide}
        />
      )}
      {/* The pack closes the table with a footer note: a quiet line about what
          the counts above do not include, and one link out of the surface. The
          line is the ledger production already had — every account once, then
          the populations the campaign does not count, each a link to itself.
          They stay reachable for context and never appear as a failed employee
          passkey adoption. */}
      <div className="footer-note">
        <p className="line ledger">
          {ledger.lead} {ledger.parts.filter((part) => part.show === null).map((part) => part.text).join(' · ')}
          {ledger.parts.some((part) => part.show !== null) && (
            <>
              {' · '}
              <span className="quiet">{T.separate}</span>{' '}
              {ledger.parts
                .filter((part) => part.show !== null)
                .map((part, i) => (
                  <span key={part.key}>
                    {i > 0 && ' · '}
                    <a href={readinessHref(part.show as ShowKey)}>{part.text}</a>
                  </span>
                ))}
            </>
          )}{' '}
          <span className="quiet">{window_}</span>
        </p>
        <p className="footer-link">
          <a href="#/inventory">{T.inventory}</a>
        </p>
      </div>
    </section>
  )
}
