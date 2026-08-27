import { useState } from 'react'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { fetchBaselineFiles, loadBaseline, unresolvedReferences } from '../../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../../baseline/index.ts'
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
    setBusy(`Fetching ${index.files.length} files from GitHub at the pinned commit…`)
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
    setBusy(`Reading ${fileList.length} uploaded file(s)…`)
    setError(null)
    try {
      const files: BaselineFile[] = await Promise.all(
        [...fileList].map(async (f) => ({ path: f.name, text: await f.text() })),
      )
      onLoaded({ source: `uploaded package (${fileList.length} files)`, pkg: loadBaseline(files), fetchFailures: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <StepFrame title="Baseline" does="Picks the target policy set your rollout plan aims for." next={result ? 'scan' : undefined} nextLabel="Scan">
      <AboutCard index={index} />
      <p className="row">
        <Button variant="primary" onClick={() => void loadPinned()} loading={busy !== null}>
          Load this baseline
        </Button>
        <span className="muted">or upload a package (Graph <code>conditionalAccessPolicy</code> JSON, one per file or arrays):</span>
        <input type="file" accept=".json" multiple onChange={(e) => void loadUpload(e.currentTarget.files)} disabled={busy !== null} />
      </p>
      {busy && <p className="muted">{busy}</p>}
      {error && <Callout kind="danger" title="Load failed.">{error}</Callout>}
      {result && <LoadReportView result={result} />}
    </StepFrame>
  )
}

function AboutCard({ index }: { index: BaselineIndex }) {
  return (
    <Card title="About this baseline">
      <p>
        <strong>{index.label}</strong>
        {index.author && (
          <>
            {' '}
            by{' '}
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
              repository
            </a>
          </>
        )}
      </p>
      <p>
        Snapshot from {absoluteDate(index.generatedAt)}
        <br />
        <span className="mono muted">commit {index.commit}</span>
      </p>
      <p>{index.description ?? 'No description provided.'}</p>
      {index.goal && <p className="muted">{index.goal}</p>}
      <p className="muted">
        {index.files.length} files in the snapshot
        {index.tiers && index.tiers.length > 0 && <> · targets {index.tiers.join(', ')}</>}
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
    <Card title={`Loaded — ${source}`}>
      <ul>
        <li>
          <strong>{pkg.policies.length} policies ready to compare.</strong>
        </li>
        {report.warnings.length > 0 && (
          <li>
            {report.warnings.length} polic{report.warnings.length === 1 ? 'y' : 'ies'} in the source can't be used yet (exported without targets) — this doesn't affect your plan.
          </li>
        )}
        {variantSets.length > 0 && (
          <li>
            {variantSets.length} choice{variantSets.length === 1 ? '' : 's'} to make in Setup ({variantSets.length === 1 ? 'two styles of the same policy' : 'alternative styles of the same policies'}).
          </li>
        )}
        <li>{unresolved.length} references to your tenant — Setup resolves the ones that need a human; the rest are automatic.</li>
      </ul>
      <ExpandCard summary="Technical details">
        <ul className="sections">
          <li>
            {report.considered} files considered, {report.parsed} parsed cleanly.
          </li>
          {duplicateSets.length > 0 && <li>{duplicateSets.length} duplicate pair(s) collapsed.</li>}
          {report.errors.length > 0 && (
            <li>
              {report.errors.length} file(s) failed to parse and were skipped: {report.errors.map((e) => e.path).join('; ')}
            </li>
          )}
          {report.warnings.length > 0 && <li>Unusable as written: {report.warnings.map((w) => w.policyName).join('; ')}</li>}
          {fetchFailures > 0 && <li>{fetchFailures} file(s) could not be fetched from the source repo.</li>}
          <li>Baseline policy states are the author's lab state; every baseline policy is treated as intended-enforced unless a manifest says otherwise.</li>
        </ul>
      </ExpandCard>
    </Card>
  )
}
