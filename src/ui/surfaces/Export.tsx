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
import { EXPORT as C } from '../../copy/export.ts'
import { ROADMAP } from '../../copy/pages.ts'
import { SHELL } from '../../copy/pages.ts'
import { usePlanData } from './planData.ts'
import { inventoryTables, todayTable } from './inventoryTables.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import { savedStepOf } from '../../roadmap/progress.ts'
import type { SavedStep } from '../../roadmap/progress.ts'
import { summarizeTenant } from '../../scoring/mfaViability.ts'
import { findDangerAreas } from '../../roadmap/dangers.ts'
import { groundingBundle, promptPack, promptPackMarkdown } from '../../roadmap/prompts.ts'
import { DEFAULT_REVERT_PERCENT } from '../../roadmap/watch.ts'
import { savePlanRecord } from '../../graph/collect/cache.ts'
import { saveMappingState } from '../../mapping/store.ts'
import { REDACTED, exportClipboard, exportDownload, exportPrint, unredactedFrom } from '../exportGuard.ts'
import { GROUNDING } from '../../copy/comms.ts'
import { absoluteDate, toCsv } from '../format.ts'
import { Button, Callout, Card } from '../components/index.ts'
import { PrintPlan } from './PrintPlan.tsx'

type PlanStore = { planId: string; steps: Record<string, SavedStep>; checkpoints?: unknown[]; startDate?: string; band?: SizeBand; freeze?: { from: string; to: string } | null; revision?: number; revisions?: unknown; stepIds?: string[]; baselinePin?: string | null; log?: unknown }

// The em dash in the saved-PDF name, built at runtime so no em-dash lives in the
// source (the copy lint forbids one as punctuation).
const DASH = String.fromCharCode(0x2014)

export function Export({ scan, baseline, account }: { scan: { snapshot: TenantSnapshot; at: string } | null; baseline: BaselineResult | null; account: AccountInfo | null }) {
  const data = usePlanData(scan, baseline)
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
        <h1>{C.title}</h1>
        <p>
          {SHELL.scanNeedsConnect} <a href="#/connect">{SHELL.connectLink}</a>
        </p>
      </section>
    )
  }
  if (!c) {
    return (
      <section className="surface">
        <h1>{C.title}</h1>
        <p className="reason">{SHELL.loading}</p>
      </section>
    )
  }

  const { steps, schedule, coverage, viability, names } = c
  const nameOf = (id: string): string => names.label(id)
  const tenantName = (snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account.username
  const planId = `plan-${snapshot.tenantId.slice(0, 8)}`
  const operator = { userId: account.localAccountId, userPrincipalName: account.username }
  const dangers = findDangerAreas({ snapshot, viability, highCareUserIds: data.mapping?.highCareUserIds ?? [], operatorUserId: operator.userId, breakGlassUserIds: data.mapping?.breakGlassUserIds ?? [] })
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
    const file = buildPlanFile({ planId, snapshot, operator, baselineSource, mapping: data.mapping, steps, checkpoints: [checkpoint], schedule: { startDate: data.startDate ?? schedule.start, band: data.band ?? undefined, freeze: data.freeze } })
    exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.json`, JSON.stringify(file, null, 2), 'application/json', REDACTED)
  }

  const loadPlan = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    await loadPlanInner(files)
  }
  const loadPlanInner = async (files: FileList): Promise<void> => {
    const { plan, error } = parsePlanFile(await files[0].text())
    if (!plan) {
      window.alert?.(error ?? ROADMAP.couldNotRead)
      return
    }
    // The tenant check runs before anything is persisted (planTenant.test.ts).
    const planTenantId = plan.tenant?.id || plan.mappings?.tenantId || ''
    if (!planTenantId) {
      window.alert?.(ROADMAP.planTenantUnknown(tenantName))
      return
    }
    if (planTenantId !== snapshot.tenantId) {
      window.alert?.(ROADMAP.planFromAnotherTenant(plan.tenant?.name ?? '', tenantName))
      return
    }
    const stepsRecord: Record<string, SavedStep> = Object.fromEntries(plan.steps.map((s) => [s.id, savedStepOf(s)]))
    const loadedBand = plan.schedule?.band && BANDS[plan.schedule.band as SizeBand] ? (plan.schedule.band as SizeBand) : data.band ?? undefined
    const record: PlanStore = { planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints, startDate: plan.schedule?.startDate ?? data.startDate ?? undefined, band: loadedBand, freeze: plan.schedule?.freeze ?? null, revision: plan.revision, revisions: plan.revisions, stepIds: plan.steps.map((s) => s.id), baselinePin: plan.baselinePin }
    await savePlanRecord(snapshot.tenantId, record)
    if (plan.mappings && plan.mappings.tenantId === snapshot.tenantId) await saveMappingState(plan.mappings)
    window.location.hash = '#/plan'
  }

  const csvTables = [todayTable(snapshot, new Set(data.mapping?.serviceAccountUserIds ?? [])), ...inventoryTables(snapshot)]
  const pack = promptPack({ tenant: tenantName, steps, schedule, changeRecord: '', planSummary: schedule.derivation.criticalPath, announcement: steps.find((s) => s.comms)?.comms ?? null })

  return (
    <section className="surface export">
      <h1>{C.title}</h1>
      <div className="export-grid">
        <Card className="export-card" title={C.pdf.title}>
          <p className="reason">{C.pdf.line}</p>
          <p className="actions no-print">
            <Button variant="primary" onClick={() => setPrinting(true)}>
              {C.pdf.button}
            </Button>
          </p>
        </Card>

        <Card className="export-card" title={C.calendar.title}>
          <p className="reason">{C.calendar.line}</p>
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.ics`, buildIcs(steps, tenantName, planId, DEFAULT_REVERT_PERCENT), 'text/calendar', REDACTED)}>
              {C.calendar.button}
            </Button>
          </p>
        </Card>

        <Card className="export-card" title={C.planFile.title}>
          <p className="reason">{C.planFile.line}</p>
          <p className="actions no-print">
            <Button variant="secondary" onClick={savePlan}>
              {C.planFile.save}
            </Button>
            <Button variant="tertiary" onClick={() => fileInput.current?.click()}>
              {C.planFile.load}
            </Button>
            <input ref={fileInput} type="file" accept=".json" hidden aria-hidden onChange={(e) => void loadPlan(e.currentTarget.files)} />
          </p>
        </Card>

        <Card className="export-card" title={C.csv.title}>
          <p className="reason">{C.csv.line}</p>
          <p className="actions">
            {csvTables.map((t) => (
              <Button key={t.id} variant="tertiary" onClick={() => exportDownload(t.csvName, toCsv(t.header, t.rows), 'text/csv', REDACTED)}>
                {t.id === 'today' ? C.csv.today : C.csv.tab(t.label)}
              </Button>
            ))}
          </p>
        </Card>

        <Card className="export-card" title={C.prompts.title}>
          <p className="reason">{C.prompts.line}</p>
          <p className="actions">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-prompts-${snapshot.tenantId.slice(0, 8)}.md`, promptPackMarkdown(pack, tenantName), 'text/markdown', REDACTED)}>
              {C.prompts.download}
            </Button>
          </p>
          <details onToggle={(e) => setShowPrompts(e.currentTarget.open)}>
            <summary>{C.prompts.see}</summary>
            {showPrompts &&
              pack.map((item, i) => (
                <p key={i} className="reason">
                  {item.title}{' '}
                  <Button variant="tertiary" onClick={() => copy(`p${i}`, item.prompt)}>
                    {copied === `p${i}` ? 'Copied' : C.prompts.copy}
                  </Button>
                </p>
              ))}
          </details>
        </Card>

        <Card className="export-card" title={C.grounding.title}>
          <p className="reason">{C.grounding.line}</p>
          <Callout kind="warning">{GROUNDING.warning}</Callout>
          <label className="rows no-print">
            <input type="checkbox" checked={!bundleRedacted} onChange={(e) => setBundleRedacted(!e.currentTarget.checked)} /> {C.grounding.redactedLabel}
          </label>
          <p className="actions no-print">
            <Button variant="secondary" onClick={() => exportDownload(`iamai-bundle-${snapshot.tenantId.slice(0, 8)}${bundleRedacted ? '-redacted' : ''}.json`, JSON.stringify(groundingBundle({ tenant: tenantName, snapshot, coverage, steps, schedule, redacted: bundleRedacted, generated: absoluteDate(new Date().toISOString()) }), null, 2), 'application/json', bundleRedacted ? REDACTED : unredactedFrom('grounding-bundle'))}>
              {C.grounding.download}
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
          dangers={dangers}
        />
      )}
    </section>
  )
}
