// Export (prompt 49 Part 2, target-state §7): six cards, each a title, one line,
// one button. The exporters are the existing ones, moved here from the Roadmap
// page, not rewritten: the ICS, the plan file (v2, round-tripped), the CSVs,
// the prompt pack, the grounding bundle, and the print layout.
import { useLayoutEffect, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { SizeBand } from '../../roadmap/constants.ts'
import { BANDS } from '../../roadmap/constants.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { operatorIdOf, usePlanData } from './planData.ts'
import { inventoryTables, todayTable } from './inventoryTables.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import { decisionsOf } from '../../roadmap/progress.ts'
import type { PlanDecisions } from '../../roadmap/progress.ts'
import { summarizeTenant } from '../../scoring/mfaViability.ts'
import { groundingBundle, promptPack, promptPackMarkdown } from '../../roadmap/prompts.ts'
import { savePlanRecord } from '../../graph/collect/cache.ts'
import { saveMappingState } from '../../mapping/store.ts'
import { REDACTED, exportClipboard, exportDownload, exportPrint, unredactedFrom } from '../exportGuard.ts'
import { GROUNDING } from '../../copy/comms.ts'
import { absoluteDate, toCsv } from '../format.ts'
import { Button, Callout, Card } from '../components/index.ts'
import { PrintPlan } from './PrintPlan.tsx'
import { stepExportView } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'

// The em dash in the saved-PDF name, built at runtime so no em-dash lives in the
// source (the copy lint forbids one as punctuation).
const DASH = String.fromCharCode(0x2014)

// The six cards from pages.export.cards: each a title, one line, and its buttons joined by ' · '.
type ExportPage = { h1: string; cards: Record<'print' | 'calendar' | 'planFile' | 'csv' | 'prompts' | 'bundle', [string, string, string]> }
const P = pages.export as unknown as ExportPage
const buttons = (card: keyof ExportPage['cards']): string[] => P.cards[card][2].split(' · ')
const A = app.export
const S = app.shell

export function Export({ scan, baseline, account }: { scan: { snapshot: TenantSnapshot; at: string } | null; baseline: BaselineResult | null; account: AccountInfo | null }) {
  const operatorId = operatorIdOf(scan?.snapshot ?? null, account)
  const data = usePlanData(scan, baseline, operatorId)
  const [copied, setCopied] = useState<string | null>(null)
  const [showPrompts, setShowPrompts] = useState(false)
  const [bundleRedacted, setBundleRedacted] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const [printing, setPrinting] = useState(false)
  const c = data.computed
  const snapshot = scan?.snapshot ?? null

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
      <section className="surface">
        <h1>{P.h1}</h1>
        <p>
          {S.scanNeedsConnect} <a href="#/connect">{S.connectLink}</a>
        </p>
      </section>
    )
  }
  if (!c) {
    return (
      <section className="surface">
        <h1>{P.h1}</h1>
        <p className="reason">{S.loading}</p>
      </section>
    )
  }

  const { steps, schedule, coverage, viability, names } = c
  const nameOf = (id: string): string => names.label(id)
  const tenantName = (snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account.username
  const planId = `plan-${snapshot.tenantId.slice(0, 8)}`
  const operator = { userId: account.localAccountId, userPrincipalName: account.username }
  const rollout = summarizeTenant(viability).rollout
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
    const baselineSource = { kind: 'github' as const, owner: baselineIndex.owner, repo: baselineIndex.repo, commit: baselineIndex.commit ?? '' }
    const file = buildPlanFile({ planId, snapshot, operator, baselineSource, mapping: data.mapping, steps, checkpoints: [checkpoint], schedule: { startDate: data.startDate ?? schedule.start, band: data.band ?? undefined, freeze: data.freeze }, stepDecisions: data.stepDecisions, startedAt: data.startedAt ?? undefined, signature: data.signature })
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

  const csvTables = [todayTable(snapshot, new Set(data.mapping?.serviceAccountUserIds ?? [])), ...inventoryTables(snapshot)]
  // Every export speaks from the content-driven step (prompt 53 queue item 7):
  // the same variables the Plan builds for a step, then the same view.
  const firstEnforce = steps.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
  const stepCtx = (s: typeof steps[number]): StepVarContext => ({ snapshot, mapping: data.mapping ?? ({ breakGlassUserIds: [], serviceAccountUserIds: [] } as never), nameOf, signature: data.signature, operatorId, now: snapshot.asOf, firstEnforce, reportOnlyAt: schedule.reportOnlyAt[s.id] ?? null, groups: data.groups, naming: coverage.organisation.naming })
  const view = (s: typeof steps[number]) => stepExportView(s, stepCtx(s))
  const pack = promptPack({ view, tenant: tenantName, steps, schedule, changeRecord: '', planSummary: schedule.derivation.criticalPath, announcement: steps.find((s) => s.comms)?.comms ?? null })

  return (
    <section className="surface export">
      <h1>{P.h1}</h1>
      <div className="export-grid">
        <Card className="export-card" title={P.cards.print[0]}>
          <p className="reason">{P.cards.print[1]}</p>
          <p className="actions no-print">
            <Button variant="primary" onClick={() => setPrinting(true)}>
              {buttons('print')[0]}
            </Button>
          </p>
        </Card>

        <Card className="export-card" title={P.cards.calendar[0]}>
          <p className="reason">{P.cards.calendar[1]}</p>
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.ics`, buildIcs(steps, tenantName, planId, view), 'text/calendar', REDACTED)}>
              {buttons('calendar')[0]}
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

        <Card className="export-card" title={P.cards.csv[0]}>
          <p className="reason">{P.cards.csv[1]}</p>
          <p className="actions">
            {csvTables.map((t) => (
              <Button key={t.id} variant="tertiary" onClick={() => exportDownload(t.csvName, toCsv(t.header, t.rows), 'text/csv', REDACTED)}>
                {t.id === 'today' ? buttons('csv')[0] : fillText(A.csvTab, { label: t.label })}
              </Button>
            ))}
          </p>
        </Card>

        <Card className="export-card" title={P.cards.prompts[0]}>
          <p className="reason">{P.cards.prompts[1]}</p>
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-prompts-${snapshot.tenantId.slice(0, 8)}.md`, promptPackMarkdown(pack, tenantName), 'text/markdown', REDACTED)}>
              {buttons('prompts')[0]}
            </Button>
          </p>
          <details onToggle={(e) => setShowPrompts(e.currentTarget.open)}>
            <summary>{buttons('prompts')[1]}</summary>
            {showPrompts &&
              pack.map((item, i) => (
                <p key={i} className="reason">
                  {item.title}{' '}
                  <Button variant="tertiary" onClick={() => copy(`p${i}`, item.prompt)}>
                    {copied === `p${i}` ? A.copied : A.promptCopy}
                  </Button>
                </p>
              ))}
          </details>
        </Card>

        <Card className="export-card" title={P.cards.bundle[0]}>
          <p className="reason">{P.cards.bundle[1]}</p>
          <Callout kind="warning">{GROUNDING.warning}</Callout>
          <label className="rows no-print">
            <input type="checkbox" checked={!bundleRedacted} onChange={(e) => setBundleRedacted(!e.currentTarget.checked)} /> {A.redactedLabel}
          </label>
          <p className="actions no-print">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-bundle-${snapshot.tenantId.slice(0, 8)}${bundleRedacted ? '-redacted' : ''}.json`, JSON.stringify(groundingBundle({ view, tenant: tenantName, snapshot, coverage, steps, schedule, redacted: bundleRedacted, generated: absoluteDate(new Date().toISOString()) }), null, 2), 'application/json', bundleRedacted ? REDACTED : unredactedFrom('grounding-bundle'))}>
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
          baselinePin={baselineIndex.commit ?? null}
          steps={steps}
          schedule={schedule}
          verificationNote={rollout.toSetUp > 0 ? `${rollout.toSetUp} of ${rollout.active} active people still to set up.` : 'Everyone active is ready.'}
          scanAt={scan.at}
          coverage={coverage}
          goalMap={c.goalMap}
          stepCtx={stepCtx}
        />
      )}
    </section>
  )
}
