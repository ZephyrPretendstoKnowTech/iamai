import { useState } from 'react'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { fetchBaselineFiles, loadBaseline, unresolvedReferences } from '../../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../../baseline/index.ts'
import { BASELINE } from '../../copy/pages.ts'
import { Button, Card, Callout, ExpandCard } from '../components/index.ts'
import { absoluteDate } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'

export type BaselineResult = { source: string; pkg: BaselinePackage; fetchFailures: number }

const index = baselineIndex as BaselineIndex

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
      const { files, failures } = await fetchBaselineFiles(index)
      onLoaded({ source: index.label, pkg: loadBaseline(files), fetchFailures: failures.length })
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
      onLoaded({ source: BASELINE.uploadedSource(fileList.length), pkg: loadBaseline(files), fetchFailures: 0 })
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
        <span className="muted">{BASELINE.orUpload}</span>
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

function LoadReportView({ result }: { result: BaselineResult }) {
  const { pkg, source, fetchFailures } = result
  const { report } = pkg
  const unresolved = unresolvedReferences(pkg.references)
  const variantSets = pkg.variantSets.filter((v) => v.relation === 'variant')
  const duplicateSets = pkg.variantSets.filter((v) => v.relation === 'duplicate')
  return (
    <Card title={BASELINE.loadedTitle(source)}>
      <ul>
        <li>
          <strong>{BASELINE.policiesReady(pkg.policies.length)}</strong>
        </li>
        {report.warnings.length > 0 && <li>{BASELINE.unusable(report.warnings.length)}</li>}
        {variantSets.length > 0 && <li>{BASELINE.choices(variantSets.length)}</li>}
        <li>{BASELINE.references(unresolved.length)}</li>
      </ul>
      <ExpandCard summary={BASELINE.technical}>
        <ul className="sections">
          <li>{BASELINE.considered(report.considered, report.parsed)}</li>
          {duplicateSets.length > 0 && <li>{BASELINE.duplicates(duplicateSets.length)}</li>}
          {report.errors.length > 0 && <li>{BASELINE.parseErrors(report.errors.length, report.errors.map((e) => e.path).join('; '))}</li>}
          {report.warnings.length > 0 && <li>{BASELINE.unusableList(report.warnings.map((w) => w.policyName).join('; '))}</li>}
          {fetchFailures > 0 && <li>{BASELINE.fetchFailures(fetchFailures)}</li>}
          <li>{BASELINE.labState}</li>
        </ul>
      </ExpandCard>
    </Card>
  )
}
