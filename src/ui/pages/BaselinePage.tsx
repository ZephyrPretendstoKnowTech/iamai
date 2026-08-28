import { useMemo, useState } from 'react'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { fetchBaselineFiles, loadBaseline } from '../../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../../baseline/index.ts'
import { CATALOGUE } from '../../coverage/coverage.ts'
import { matchesSignature } from '../../coverage/classify.ts'
import { policyFacts } from '../../coverage/facts.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { activeWizardQuestions } from '../../mapping/wizard.ts'
import { BASELINE } from '../../copy/pages.ts'
import { Button, Card, Callout, ExpandCard } from '../components/index.ts'
import { absoluteDate } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'

export type BaselineResult = {
  source: string
  pkg: BaselinePackage
  fetchFailures: number
  /** How to restore it on reload (prompt 14 §6). */
  origin: { kind: 'github'; owner: string; repo: string; commit: string } | { kind: 'upload'; files: BaselineFile[] }
}

const index = baselineIndex as BaselineIndex

/** Load the bundled, pinned baseline (used by the page and by the reload restore). */
export async function loadPinnedBaseline(): Promise<BaselineResult> {
  const { files, failures } = await fetchBaselineFiles(index)
  return {
    source: index.label,
    pkg: loadBaseline(files),
    fetchFailures: failures.length,
    origin: { kind: 'github', owner: index.owner, repo: index.repo, commit: index.commit },
  }
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
}: {
  result: BaselineResult | null
  onLoaded: (r: BaselineResult) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPinned = async () => {
    setBusy(BASELINE.fetching(index.files.length))
    setError(null)
    try {
      onLoaded(await loadPinnedBaseline())
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
      <AboutCard index={index} />
      <p className="row">
        <Button variant="primary" onClick={() => void loadPinned()} loading={busy !== null}>
          {BASELINE.load}
        </Button>
        <span className="muted">
          {BASELINE.orUpload} (<a href="#/baseline/package">{BASELINE.howToPackage}</a>):
        </span>
        <input type="file" accept=".json" multiple onChange={(e) => void loadUpload(e.currentTarget.files)} disabled={busy !== null} />
      </p>
      {busy && <p className="muted">{busy}</p>}
      {error && <Callout kind="danger" title={BASELINE.loadFailed}>{error}</Callout>}
      {result && <LoadReportView result={result} />}
    </StepFrame>
  )
}

function AboutCard({ index }: { index: BaselineIndex }) {
  return (
    <Card title={BASELINE.aboutTitle}>
      <p>
        <strong>{index.label}</strong>
        {index.author && (
          <>
            {' '}
            {BASELINE.by}{' '}
            {index.authorUrl ? (
              <a href={index.authorUrl} target="_blank" rel="noreferrer">
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
            <a href={index.repoUrl} target="_blank" rel="noreferrer">
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
        {BASELINE.filesIn(index.files.length)}
        {index.tiers && index.tiers.length > 0 && <> · {BASELINE.targets(index.tiers.join(', '))}</>}
      </p>
    </Card>
  )
}

// The load report in plain English (ux-review-03 §B): one line for the
// operator; everything author-facing under Technical details.
function LoadReportView({ result }: { result: BaselineResult }) {
  const { pkg, source, fetchFailures } = result
  const { report } = pkg
  const goals = useMemo(() => goalsCoveredBy(pkg), [pkg])
  const questions = activeWizardQuestions(pkg).length
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
