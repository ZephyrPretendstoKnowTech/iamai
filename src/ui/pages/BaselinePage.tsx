import { useState } from 'react'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { fetchBaselineFiles, loadBaseline, unresolvedReferences } from '../../baseline/index.ts'
import type { BaselineFile, BaselinePackage } from '../../baseline/index.ts'

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading'; note: string }
  | { kind: 'loaded'; source: string; pkg: BaselinePackage; fetchFailures: number }
  | { kind: 'failed'; error: string }

export function BaselinePage() {
  const [state, setState] = useState<LoadState>({ kind: 'idle' })

  const loadPinned = async () => {
    setState({ kind: 'loading', note: `fetching ${baselineIndex.files.length} files from GitHub at the pinned commit…` })
    try {
      const { files, failures } = await fetchBaselineFiles(baselineIndex)
      const pkg = loadBaseline(files)
      setState({ kind: 'loaded', source: baselineIndex.label, pkg, fetchFailures: failures.length })
    } catch (e) {
      setState({ kind: 'failed', error: e instanceof Error ? e.message : String(e) })
    }
  }

  const loadUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setState({ kind: 'loading', note: `reading ${fileList.length} uploaded file(s)…` })
    try {
      const files: BaselineFile[] = await Promise.all(
        [...fileList].map(async (f) => ({ path: f.name, text: await f.text() })),
      )
      const pkg = loadBaseline(files)
      setState({ kind: 'loaded', source: `uploaded package (${fileList.length} files)`, pkg, fetchFailures: 0 })
    } catch (e) {
      setState({ kind: 'failed', error: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <section>
      <h2>Baseline</h2>
      <p>
        The baseline is the policy set your rollout plan aims for. The default is{' '}
        <strong>{baselineIndex.label}</strong> — loaded live from{' '}
        <a href={`https://github.com/${baselineIndex.owner}/${baselineIndex.repo}`} target="_blank" rel="noreferrer">
          {baselineIndex.owner}/{baselineIndex.repo}
        </a>{' '}
        at pinned commit <code>{baselineIndex.commit.slice(0, 10)}</code>. IAMAI ships only a path
        index; policy content is fetched from the source repo and never bundled.
      </p>
      <p>
        <button onClick={() => void loadPinned()} disabled={state.kind === 'loading'}>
          {state.kind === 'loading' ? 'Loading…' : 'Load the default baseline'}
        </button>
      </p>
      <p>
        Or upload a package: Graph <code>conditionalAccessPolicy</code> JSON exports (one per file
        or arrays, any casing).{' '}
        <input
          type="file"
          accept=".json"
          multiple
          onChange={(e) => void loadUpload(e.currentTarget.files)}
          disabled={state.kind === 'loading'}
        />
      </p>

      {state.kind === 'loading' && <p className="reason">{state.note}</p>}
      {state.kind === 'failed' && <p className="error">Load failed: {state.error}</p>}
      {state.kind === 'loaded' && <LoadReportView source={state.source} pkg={state.pkg} fetchFailures={state.fetchFailures} />}
    </section>
  )
}

// The adapter's load report, in plain language.
function LoadReportView({ source, pkg, fetchFailures }: { source: string; pkg: BaselinePackage; fetchFailures: number }) {
  const { report } = pkg
  const unresolved = unresolvedReferences(pkg.references)
  const variantSets = pkg.variantSets.filter((v) => v.relation === 'variant')
  const duplicateSets = pkg.variantSets.filter((v) => v.relation === 'duplicate')
  return (
    <div>
      <h3>Load report — {source}</h3>
      <ul>
        <li>
          <strong>{pkg.policies.length} policies kept</strong> out of {report.considered} files
          considered ({report.parsed} parsed cleanly).
        </li>
        {report.warnings.length > 0 && (
          <li>
            <strong>{report.warnings.length} unusable as written</strong> — kept but flagged (for
            example, exported without any targets):{' '}
            {report.warnings.map((w) => w.policyName).join('; ')}
          </li>
        )}
        {variantSets.length > 0 && (
          <li>
            <strong>{variantSets.length} choose-one variant set(s)</strong> — same intent, different
            scoping; the plan will ask you to pick one from each set.
          </li>
        )}
        {duplicateSets.length > 0 && <li>{duplicateSets.length} duplicate pair(s) collapsed.</li>}
        <li>
          <strong>{unresolved.length} reference(s) need mapping</strong> to your tenant (groups,
          locations, custom strengths and similar that only exist per-tenant). The Mapping step
          resolves these.
        </li>
        {report.errors.length > 0 && (
          <li>
            {report.errors.length} file(s) failed to parse and were skipped:{' '}
            {report.errors.map((e) => e.path).join('; ')}
          </li>
        )}
        {fetchFailures > 0 && <li>{fetchFailures} file(s) could not be fetched from the source repo.</li>}
      </ul>
      <p className="reason">
        Baseline policy states are the author's lab state; every baseline policy is treated as
        intended-enforced unless a manifest says otherwise.
      </p>
    </div>
  )
}
