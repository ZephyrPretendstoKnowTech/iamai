// Export: take this plan somewhere else.
//
// Six artifacts, each a title, one line and its buttons, grouped by the job the
// artifact does rather than by its format (task 013): the plan itself, doing the
// work, timing, and what another tool reads. The exporters are the existing ones
// — the ICS, the plan file (v2, round-tripped), the CSVs, the prompt pack, the
// grounding bundle and the print layout — and every one of them speaks from the
// same export view of a step, which is the frozen Step Contract's own answers
// (ui/surfaces/stepExport.ts). Nothing on this page decides anything about a
// policy; the Plan has already decided it.
//
// The one thing the page says for itself is where an artifact's scope is not its
// label: the JSON and the PowerShell belong to one step and are on that step in
// the Plan, and three of the eight prompts in the pack are grounded in a single
// step, which the pack now names.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { PINNED, PINNED_BASELINE } from '../baseline.ts'
import type { BaselineResult } from '../baseline.ts'
import type { SizeBand } from '../../roadmap/constants.ts'
import { BANDS } from '../../roadmap/constants.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { operatorIdOf, usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { inventoryTables, readinessTable } from './inventoryTables.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import type { Checkpoint } from '../../roadmap/plan.ts'
import { decisionsOf } from '../../roadmap/progress.ts'
import type { PlanDecisions } from '../../roadmap/progress.ts'
import { planIdFor } from '../../roadmap/generate.ts'
import { summarizeTenant } from '../../scoring/mfaViability.ts'
import { facts } from '../../derive/facts.ts'
import { announcementDraft, groundingBundle, promptPack, promptPackMarkdown } from '../../roadmap/prompts.ts'
import type { PackItem } from '../../roadmap/prompts.ts'
import { savePlanRecord } from '../../graph/collect/cache.ts'
import { saveMappingState } from '../../mapping/store.ts'
import { REDACTED, exportClipboard, exportDownload, exportPrint, unredactedFrom } from '../exportGuard.ts'
import { GROUNDING } from '../../copy/comms.ts'
import { absoluteDate, toCsv } from '../format.ts'
import { Button, Callout, Card, PageTip } from '../components/index.ts'
import { PrintPlan } from './PrintPlan.tsx'
import { stepExportView } from './stepExport.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

// The em dash in the saved-PDF name, built at runtime so no em-dash lives in the
// source (the copy lint forbids one as punctuation).
const DASH = String.fromCharCode(0x2014)

// The six cards from pages.export.cards: each a title, one line, and its buttons joined by ' · '.
type ExportGroups = { plan: string; implementation: string; implementationNote: string; schedule: string; technical: string }
type ExportPage = { h1: string; intro: string; groups: ExportGroups; cards: Record<'print' | 'calendar' | 'planFile' | 'csv' | 'prompts' | 'bundle', [string, string, string]> }
const P = pages.export as unknown as ExportPage
const buttons = (card: keyof ExportPage['cards']): string[] => P.cards[card][2].split(' · ')
const G = P.groups
const A = app.export
const S = app.shell

/** The commit the plan was derived from: the active baseline's own, never the index's. */
function pinOf(baseline: BaselineResult | null): string | null {
  const origin = baseline?.origin ?? null
  if (origin !== null && origin.kind === 'upload') return null
  return origin?.commit ?? PINNED.commit
}

/** The plan record's baseline source: one fact, read from the baseline the plan used. */
function planBaselineSource(baseline: BaselineResult | null): { kind: 'github'; owner: string; repo: string; commit: string } | { kind: 'upload'; fileName: string } {
  const origin = baseline?.origin ?? null
  if (origin !== null && origin.kind === 'upload') return { kind: 'upload', fileName: baseline?.source ?? '' }
  return { kind: 'github', owner: origin?.owner ?? PINNED_BASELINE.owner, repo: origin?.repo ?? PINNED_BASELINE.repo, commit: origin?.commit ?? PINNED.commit }
}

export function Export({ scan, baseline, account }: { scan: { snapshot: TenantSnapshot; at: string } | null; baseline: BaselineResult | null; account: AccountInfo | null }) {
  const operatorId = operatorIdOf(scan?.snapshot ?? null, account)
  const data = usePlanData(scan, baseline)
  const [copied, setCopied] = useState<string | null>(null)
  const [showPrompts, setShowPrompts] = useState(false)
  const [bundleRedacted, setBundleRedacted] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const [printing, setPrinting] = useState(false)
  const c = data.computed
  const snapshot = scan?.snapshot ?? null

  // The CSV tables are a row per account, per device and per policy in the
  // tenant. The page renders their names, not their contents, so building them
  // again for every copy confirmation and every checkbox was work nobody had
  // asked for: on a five-thousand-person tenant it was 42 ms of every render.
  // They are built once for the scan and the groups they read, which is what
  // they are made of.
  const csvTables = useMemo(
    () => (snapshot ? [readinessTable(snapshot, data.mapping ?? undefined), ...inventoryTables(snapshot, data.groups)] : []),
    [snapshot, data.mapping, data.groups],
  )
  // The prompt pack is the whole plan rendered through the export view, once per
  // prompt: 63 ms on that same tenant, for eight prompts that are behind a
  // Download and a closed list. It is built when one of those is asked for, and
  // kept for as long as the plan it speaks for is the plan on screen — every
  // fact it reads comes from `computed`, which is a new object whenever any of
  // them changes, so a kept pack can never speak for a plan that has moved.
  const packCache = useRef<{ plan: PlanComputed; pack: PackItem[] } | null>(null)

  // The print document is mounted only while printing (prompt 49.1 item 4): it is
  // not in the screen DOM otherwise. Setting `printing` mounts it and hides the
  // app; the layout effect runs after it is in the DOM, names the PDF, prints,
  // and tears everything down on afterprint.
  const printTenantName = (snapshot?.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account?.username ?? ''
  useLayoutEffect(() => {
    if (!printing) return
    document.body.classList.add('has-print-plan')
    const prevTitle = document.title
    // The saved PDF is named IAMAI Planner (em dash) tenant (em dash) date.
    document.title = `IAMAI Planner ${DASH} ${printTenantName} ${DASH} ${absoluteDate(new Date().toISOString())}`
    const after = (): void => {
      document.body.classList.remove('has-print-plan')
      document.title = prevTitle
      setPrinting(false)
    }
    window.addEventListener('afterprint', after)
    exportPrint(unredactedFrom('print-document'))
    return () => window.removeEventListener('afterprint', after)
  }, [printing, printTenantName])

  if (!scan || !account || !snapshot) {
    return (
      <section className="surface export">
        <h1>{P.h1}</h1>
        <p>
          {S.scanNeedsConnect} <a href="#/connect">{S.connectLink}</a>
        </p>
      </section>
    )
  }
  if (!c) {
    return (
      <section className="surface export">
        <h1>{P.h1}</h1>
        <p className="reason">{S.loading}</p>
      </section>
    )
  }

  const { steps, schedule, coverage, viability, names } = c
  const nameOf = (id: string): string => names.label(id)
  const tenantName = (snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account.username
  const planId = planIdFor(snapshot.tenantId)
  const operator = { userId: account.localAccountId, userPrincipalName: account.username }
  // The verification window's people, from the one facts function
  // (derive/facts.ts). The page hands the counts over and words nothing: which
  // sentence the window's note carries is the printed document's, out of its own
  // content entries, and how many people are still to set up is
  // derive/facts.ts's (task 042).
  const tenantFacts = data.mapping ? facts(snapshot, data.mapping) : null
  const copy = (id: string, text: string): void => {
    void exportClipboard(text, REDACTED).then((ok) => {
      if (!ok) return
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const savePlan = (): void => {
    if (!data.mapping) return
    const summary = summarizeTenant(viability)
    const exclusionGroups = [...data.groups.entries()].map(([groupId, g]) => ({ groupId, memberCount: g.memberCount, memberIds: g.memberIds }))
    const checkpoint = makeCheckpoint({ snapshot, coverage, summary, exclusionGroups, breakGlassIds: data.mapping.breakGlassUserIds })
    // The plan's provenance is the baseline the plan was derived FROM: the pinned
    // package's own commit (pinned.json), never the index's file-list commit,
    // which is the previous pin and would name a source this plan never read.
    // An uploaded baseline is recorded as an upload, not attributed to the author.
    const baselineSource = planBaselineSource(baseline)
    // The saved checkpoints travel (each Cleanup row's Done is one, E3), then this save's own.
    const file = buildPlanFile({ planId, snapshot, operator, baselineSource, mapping: data.mapping, steps, checkpoints: [...(data.checkpoints as Checkpoint[]), checkpoint], schedule: { startDate: data.startDate ?? schedule.start, band: data.band ?? undefined, freeze: data.freeze }, stepDecisions: data.stepDecisions, confirmations: data.confirmations, startedAt: data.startedAt ?? undefined, signature: data.signature })
    // The person's own working state, to load back on this tenant: names in full (the card says so).
    exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.json`, JSON.stringify(file, null, 2), 'application/json', unredactedFrom('plan-file'))
  }

  const loadPlan = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    await loadPlanInner(files)
  }
  const loadPlanInner = async (files: FileList): Promise<void> => {
    const { plan, error } = parsePlanFile(await files[0].text())
    if (!plan) {
      window.alert?.(error ?? A.couldNotRead)
      return
    }
    // The tenant check runs before anything is persisted (planTenant.test.ts).
    const planTenantId = plan.tenant?.id || plan.mappings?.tenantId || ''
    if (!planTenantId) {
      window.alert?.(fillText(A.planTenantUnknown, { current: tenantName || A.thisTenant }))
      return
    }
    if (planTenantId !== snapshot.tenantId) {
      window.alert?.(fillText(A.planFromAnotherTenant, { planTenant: plan.tenant?.name || A.anotherTenant, current: tenantName || A.differentTenant, madeFor: plan.tenant?.name || A.madeFor }))
      return
    }
    // Take the decisions and regenerate: a 50.1 file carries a decisions block;
    // a pre-50.1 file has none, so recover the decisions from its steps and
    // schedule (decisionsOf reads either shape). Nothing generated is trusted back.
    const loadedBand = plan.schedule?.band && BANDS[plan.schedule.band as SizeBand] ? (plan.schedule.band as SizeBand) : data.band ?? undefined
    const record: PlanDecisions = decisionsOf(
      plan.decisions ?? {
        steps: Object.fromEntries(plan.steps.map((s) => [s.id, { status: s.status, skipReason: s.skipReason, history: s.history }])),
        startDate: plan.schedule?.startDate ?? data.startDate ?? undefined,
        band: loadedBand,
        freeze: plan.schedule?.freeze ?? null,
        checkpoints: plan.checkpoints,
      },
      plan.planId,
    )
    await savePlanRecord(snapshot.tenantId, record)
    if (plan.mappings && plan.mappings.tenantId === snapshot.tenantId) await saveMappingState(plan.mappings)
    window.location.hash = '#/plan'
  }

  // Every export speaks from the content-driven step (prompt 53 queue item 7):
  // the same variables the Plan builds for a step, then the same view.
  const dates = planDates(steps, schedule.start, coverage.organisation.naming, snapshot)
  const stepCtx = (s: typeof steps[number]): StepVarContext => ({ snapshot, mapping: data.mapping ?? ({ breakGlassUserIds: [], serviceAccountUserIds: [] } as never), nameOf, signature: data.signature, operatorId, now: snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: data.groups, directory: data.directory, naming: coverage.organisation.naming })
  const view = (s: typeof steps[number]) => stepExportView(s, stepCtx(s))
  // The Cleanup rows as the screen says them (E4): calendar entries, the pack's and the bundle's cleanup list.
  const cleanupViews = cleanupExportViews(schedule.cleanup, data.mapping?.notAssessedNotes ?? {})
  const getPack = (): PackItem[] => {
    if (packCache.current?.plan === c) return packCache.current.pack
    const built = promptPack({ view, tenant: tenantName, steps, schedule, changeRecord: '', planSummary: schedule.derivation.criticalPath, announcement: announcementDraft(steps), cleanup: cleanupViews })
    packCache.current = { plan: c, pack: built }
    return built
  }

  return (
    <section className="surface export">
      <h1>{P.h1}</h1>
      <p className="reason">{P.intro}</p>
      <PageTip page="export" text={(pages.export as Record<string, string>).tip} />

      <h2>{G.plan}</h2>
      <div className="export-grid">
        <Card className="export-card" title={P.cards.print[0]}>
          <p className="reason">{P.cards.print[1]}</p>
          <p className="actions no-print">
            <Button variant="primary" onClick={() => setPrinting(true)}>
              {buttons('print')[0]}
            </Button>
          </p>
        </Card>

        <Card className="export-card" title={P.cards.planFile[0]}>
          <p className="reason">{P.cards.planFile[1]}</p>
          <p className="actions no-print">
            <Button variant="secondary" onClick={savePlan}>
              {buttons('planFile')[0]}
            </Button>
            <Button variant="tertiary" onClick={() => fileInput.current?.click()}>
              {buttons('planFile')[1]}
            </Button>
            <input ref={fileInput} type="file" accept=".json" hidden aria-hidden onChange={(e) => void loadPlan(e.currentTarget.files)} />
          </p>
        </Card>
      </div>

      {/* Doing the work. The machine artifacts for a policy are on that policy's
          own step in the Plan, because they are one step's, and the note says so
          rather than the page implying it exports them for the whole plan. */}
      <h2>{G.implementation}</h2>
      <p className="reason">{G.implementationNote}</p>
      <div className="export-grid">
        <Card className="export-card" title={P.cards.prompts[0]}>
          <p className="reason">{P.cards.prompts[1]}</p>
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-prompts-${snapshot.tenantId.slice(0, 8)}.md`, promptPackMarkdown(getPack(), tenantName), 'text/markdown', REDACTED)}>
              {buttons('prompts')[0]}
            </Button>
          </p>
          <details onToggle={(e) => setShowPrompts(e.currentTarget.open)}>
            <summary>{buttons('prompts')[1]}</summary>
            {/* Which step a prompt speaks for, beside its title: three of the
                eight are grounded in one step and five in the plan, and the
                list used to read as though every one of them were the plan's. */}
            {showPrompts &&
              getPack().map((item, i) => (
                <p key={i} className="reason">
                  {item.title} <span className="muted">({item.scope === null ? A.promptWholePlan : fillText(A.promptScope, { step: item.scope })})</span>{' '}
                  {/* Eight rows, eight controls reading "Copy prompt": the
                      accessible name says which prompt (task 017), while the
                      visible words stay the short ones the row can carry. */}
                  <Button variant="tertiary" aria-label={fillText(A.promptCopyOf, { title: item.title })} onClick={() => copy(`p${i}`, item.prompt)}>
                    {copied === `p${i}` ? A.copied : A.promptCopy}
                  </Button>
                </p>
              ))}
          </details>
        </Card>
      </div>

      {/* Timing. */}
      <h2>{G.schedule}</h2>
      <div className="export-grid">
        <Card className="export-card" title={P.cards.calendar[0]}>
          <p className="reason">{P.cards.calendar[1]}</p>
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.ics`, buildIcs(steps, tenantName, planId, view, cleanupViews), 'text/calendar', REDACTED)}>
              {buttons('calendar')[0]}
            </Button>
          </p>
        </Card>
      </div>

      {/* For another tool: the tables as they are, and the bundle. */}
      <h2>{G.technical}</h2>
      <div className="export-grid">
        <Card className="export-card" title={P.cards.csv[0]}>
          <p className="reason">{P.cards.csv[1]}</p>
          <p className="actions">
            {csvTables.map((t) => (
              <Button key={t.id} variant="tertiary" onClick={() => exportDownload(t.csvName, toCsv(t.header, t.rows), 'text/csv', REDACTED)}>
                {t.id === 'readiness' ? buttons('csv')[0] : fillText(A.csvTab, { label: t.label })}
              </Button>
            ))}
          </p>
        </Card>

        <Card className="export-card" title={P.cards.bundle[0]}>
          <p className="reason">{P.cards.bundle[1]}</p>
          <Callout kind="warning">{GROUNDING.warning}</Callout>
          <label className="rows no-print">
            <input type="checkbox" checked={!bundleRedacted} onChange={(e) => setBundleRedacted(!e.currentTarget.checked)} /> {A.redactedLabel}
          </label>
          <p className="actions no-print">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-bundle-${snapshot.tenantId.slice(0, 8)}${bundleRedacted ? '-redacted' : ''}.json`, JSON.stringify(groundingBundle({ view, tenant: tenantName, snapshot, coverage, steps, schedule, redacted: bundleRedacted, generated: absoluteDate(new Date().toISOString()), cleanup: cleanupViews }), null, 2), 'application/json', bundleRedacted ? REDACTED : unredactedFrom('grounding-bundle'))}>
              {buttons('bundle')[0]}
            </Button>
          </p>
        </Card>
      </div>

      {printing && (
        <PrintPlan
          tenantName={tenantName}
          baselineLabel={baseline?.source ?? ''}
          operator={operator.userPrincipalName}
          baselinePin={pinOf(baseline)}
          steps={steps}
          schedule={schedule}
          facts={tenantFacts}
          scanAt={scan.at}
          coverage={coverage}
          goalMap={c.goalMap}
          stepCtx={stepCtx}
          notes={data.mapping?.notAssessedNotes ?? {}}
          answers={data.mapping?.breakGlassAnswers ?? null}
        />
      )}
    </section>
  )
}
