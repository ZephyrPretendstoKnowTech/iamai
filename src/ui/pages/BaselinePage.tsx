import { useEffect, useMemo, useState } from 'react'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { fetchBaselineFiles, loadBaseline } from '../../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../../baseline/index.ts'
import { CATALOGUE } from '../../coverage/coverage.ts'
import { matchesSignature } from '../../coverage/classify.ts'
import { policyFacts } from '../../coverage/facts.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { wizardQuestionCounts } from '../../mapping/wizard.ts'
import { loadMappingState } from '../../mapping/store.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { BASELINE } from '../../copy/pages.ts'
import { Button, Card, Callout, ExpandCard } from '../components/index.ts'
import { absoluteDate } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'

export type BaselineResult = {
  source: string
  pkg: BaselinePackage
  fetchFailures: number
  /** How to restore it on reload (prompt 14 §6). */
  /** The pinned baseline keeps its fetched files so a reload restores it without the network (ux-review-05 §8). */
  origin: { kind: 'github'; owner: string; repo: string; commit: string; files?: BaselineFile[] } | { kind: 'upload'; files: BaselineFile[] }
}

const index = baselineIndex as BaselineIndex

/** Load the bundled, pinned baseline (used by the page and by the reload restore). */
export async function loadPinnedBaseline(onProgress?: (done: number, total: number) => void): Promise<BaselineResult> {
  const { files, failures } = await fetchBaselineFiles(index, { onProgress })
  return {
    source: index.label,
    pkg: loadBaseline(files),
    fetchFailures: failures.length,
    origin: { kind: 'github', owner: index.owner, repo: index.repo, commit: index.commit, files },
  }
}

/** Restore a saved baseline from its stored files; the pinned one is refetched only when no files were kept. */
export async function restoreBaseline(origin: BaselineResult['origin']): Promise<BaselineResult> {
  if (origin.kind === 'upload') return loadUploadedBaseline(origin.files)
  if (origin.files && origin.files.length > 0) {
    return { source: index.label, pkg: loadBaseline(origin.files), fetchFailures: 0, origin }
  }
  return loadPinnedBaseline()
}

export function loadUploadedBaseline(files: BaselineFile[]): BaselineResult {
  return { source: BASELINE.uploadedSource(files.length), pkg: loadBaseline(files), fetchFailures: 0, origin: { kind: 'upload', files } }
}

/** Catalogue goals the baseline has a policy for, plus its ad-hoc goals. */
export function goalsCoveredBy(pkg: BaselinePackage): number {
  const strengths = buildStrengthLookup([])
  const facts = pkg.policies.map((p) => policyFacts(p, strengths))
  const matched = new Set<string>()
  let catalogueGoals = 0
  for (const goal of CATALOGUE) {
    const hits = facts.filter((f) => goal.implementations.some((impl) => matchesSignature(f, impl.signature)))
    if (hits.length > 0) catalogueGoals += 1
    for (const h of hits) matched.add(h.name)
  }
  return catalogueGoals + facts.filter((f) => !matched.has(f.name)).length
}

export function BaselinePage({
  result,
  onLoaded,
  scan = null,
  restoreError = null,
}: {
  result: BaselineResult | null
  onLoaded: (r: BaselineResult) => void
  scan?: { snapshot: TenantSnapshot; at: string } | null
  restoreError?: string | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPinned = async () => {
    if (busy !== null) return // one load at a time: a second click must not start a parallel fetch (ux-review-06 §1)
    setBusy(BASELINE.fetching(index.files.length))
    setError(null)
    try {
      onLoaded(await loadPinnedBaseline((done, total) => setBusy(BASELINE.readingProgress(done, total))))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const loadUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setBusy(BASELINE.reading(fileList.length))
    setError(null)
    try {
      const files: BaselineFile[] = await Promise.all(
        [...fileList].map(async (f) => ({ path: f.name, text: await f.text() })),
      )
      onLoaded(loadUploadedBaseline(files))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <StepFrame title={BASELINE.title} does={BASELINE.does} next={result ? 'scan' : undefined} nextLabel={BASELINE.next}>
      <AboutCard index={index} policies={result?.pkg.policies.length ?? null} />
      <p className="row">
        <Button variant="primary" onClick={() => void loadPinned()} loading={busy !== null}>
          {BASELINE.load}
        </Button>
        <span className="muted">
          {BASELINE.orUpload} (<a href="#/baseline/package">{BASELINE.howToPackage}</a>):
        </span>
        <input type="file" accept=".json" multiple aria-label={BASELINE.uploadLabel} onChange={(e) => void loadUpload(e.currentTarget.files)} disabled={busy !== null} />
      </p>
      {busy && <p className="muted">{busy}</p>}
      {error && <Callout kind="danger" title={BASELINE.loadFailed}>{error}</Callout>}
      {!result && restoreError && <Callout kind="warning" title={BASELINE.restoreFailed}>{restoreError}</Callout>}
      {result && <LoadReportView result={result} snapshot={scan?.snapshot ?? null} />}
    </StepFrame>
  )
}

function AboutCard({ index, policies }: { index: BaselineIndex; policies: number | null }) {
  return (
    <Card title={BASELINE.aboutTitle}>
      <p>
        <strong>{index.label}</strong>
        {index.author && (
          <>
            {' '}
            {BASELINE.by}{' '}
            {index.authorUrl ? (
              <a href={index.authorUrl} target="_blank" rel="noopener noreferrer">
                {index.author}
              </a>
            ) : (
              index.author
            )}
          </>
        )}
        {index.repoUrl && (
          <>
            {' · '}
            <a href={index.repoUrl} target="_blank" rel="noopener noreferrer">
              {BASELINE.repository}
            </a>
          </>
        )}
      </p>
      <p>
        {BASELINE.capturedOn(absoluteDate(index.generatedAt))}
        <br />
        <span className="mono muted" title={index.commit}>
          {BASELINE.commit(index.commit)}
        </span>
      </p>
      <p>{index.description ?? BASELINE.noDescription}</p>
      {index.goal && <p className="muted">{index.goal}</p>}
      <p className="muted">
        {BASELINE.filesIn(index.files.length, policies)}
        {index.tiers && index.tiers.length > 0 && <> · {BASELINE.targets(index.tiers.join(', '))}</>}
      </p>
    </Card>
  )
}

// The load report in plain English (ux-review-03 §B): one line for the
// operator; everything author-facing under Technical details.
function LoadReportView({ result, snapshot }: { result: BaselineResult; snapshot: TenantSnapshot | null }) {
  const { pkg, source, fetchFailures } = result
  const { report } = pkg
  const goals = useMemo(() => goalsCoveredBy(pkg), [pkg])
  // The count Setup will actually render: conditional questions depend on the
  // scan and on what is already confirmed (prompt 19 §A2).
  const [mappingState, setMappingState] = useState<MappingState | null>(null)
  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    void loadMappingState(snapshot.tenantId).then((s) => {
      if (!cancelled) setMappingState(s)
    })
    return () => {
      cancelled = true
    }
  }, [snapshot])
  const questions = wizardQuestionCounts(pkg, { snapshot, state: mappingState })
  const duplicateSets = pkg.variantSets.filter((v) => v.relation === 'duplicate')
  return (
    <Card title={BASELINE.loadedTitle(source)}>
      <p>
        <strong>{BASELINE.summaryLine(pkg.policies.length, goals, questions)}</strong>
      </p>
      <ExpandCard summary={BASELINE.technical}>
        <p className="reason">{BASELINE.authorNote}</p>
        <ul className="sections">
          <li>{BASELINE.considered(report.considered, report.parsed)}</li>
          {report.warnings.length > 0 && <li>{BASELINE.unusableList(report.warnings.map((w) => w.policyName).join('; '))}</li>}
          {duplicateSets.length > 0 && <li>{BASELINE.duplicates(duplicateSets.length)}</li>}
          {report.errors.length > 0 && <li>{BASELINE.parseErrors(report.errors.length, report.errors.map((e) => e.path).join('; '))}</li>}
          {fetchFailures > 0 && <li>{BASELINE.fetchFailures(fetchFailures)}</li>}
          <li>{BASELINE.labState}</li>
        </ul>
      </ExpandCard>
    </Card>
  )
}
