import { StepFrame } from '../shell/AppShell.tsx'
import { relative, absolute } from '../format.ts'

// Step pages that are not implemented yet. Not placeholders in the old sense:
// each explains what to do first and links there, per prompt 04.

export function MappingPage({ baselineLoaded, scanDone }: { baselineLoaded: boolean; scanDone: boolean }) {
  return (
    <StepFrame
      title="Mapping"
      does="Matches every tenant-specific reference in the baseline — break-glass accounts, exclusion groups, trusted locations — to your tenant, with validation of each pick."
      needs={[
        { met: baselineLoaded, text: baselineLoaded ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
        { met: scanDone, text: scanDone ? 'scan complete' : 'run a scan', href: '#/scan' },
      ]}
      next="coverage"
      nextLabel="Coverage"
    >
      <div className="card">
        <p>
          Mapping isn't built yet. When it is, it opens as a short questionnaire: IAMAI suggests
          matches from your scan (groups named like break-glass, users excluded from most policies,
          trusted locations) and validates every confirmed pick. Anything that doesn't exist yet
          becomes a Phase 0 step with a how-to.
        </p>
        {!baselineLoaded && (
          <p>
            First, <a href="#/baseline">load a baseline</a> so there is something to map.
          </p>
        )}
        {!scanDone && (
          <p>
            {baselineLoaded ? 'Then' : 'And'} <a href="#/scan">run a scan</a> so IAMAI can suggest
            matches from your tenant.
          </p>
        )}
      </div>
    </StepFrame>
  )
}

export function CoveragePage({ scanAt }: { scanAt: string | null }) {
  return (
    <StepFrame
      title="Coverage"
      does="Shows which baseline intents your tenant's enabled policies already cover — enforced, partial, or absent — ignoring policy names."
      needs={[{ met: scanAt !== null, text: scanAt !== null ? 'scan complete' : 'run a scan', href: '#/scan' }]}
      next="roadmap"
      nextLabel="Roadmap"
    >
      {scanAt !== null && (
        <p className="reason">
          Based on the scan from <span title={absolute(scanAt)}>{relative(scanAt)}</span> —{' '}
          <a href="#/scan">Re-scan</a>
        </p>
      )}
      <div className="card">
        <p>
          Coverage isn't built yet. When it is, each baseline policy is compiled to intents and
          scored against the effective union of your enabled policies minus exclusions, with
          statements like "no policy named X, but Y and Z cover it, except one group is excluded
          from both."
        </p>
        {scanAt === null && (
          <p>
            First, <a href="#/scan">run a scan</a> — coverage reads from the scan snapshot.
          </p>
        )}
      </div>
    </StepFrame>
  )
}

export function RoadmapPage({ scanAt }: { scanAt: string | null }) {
  return (
    <StepFrame
      title="Roadmap"
      does="Builds the phased plan: each step with prerequisites, affected population, pilot, report-only exit criteria, rollback, and comms."
      needs={[
        { met: scanAt !== null, text: scanAt !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
        { met: false, text: 'complete Mapping', href: '#/mapping' },
      ]}
    >
      {scanAt !== null && (
        <p className="reason">
          Based on the scan from <span title={absolute(scanAt)}>{relative(scanAt)}</span> —{' '}
          <a href="#/scan">Re-scan</a>
        </p>
      )}
      <div className="card">
        <p>
          The roadmap isn't built yet. When it is, phases order themselves from dependencies —
          prerequisites → foundations → MFA → admin hardening → device → sessions — printable, and
          saveable as a single plan file that re-imports.
        </p>
        <p>
          Work through <a href="#/mapping">Mapping</a> and <a href="#/coverage">Coverage</a> first.
        </p>
      </div>
    </StepFrame>
  )
}

export function LicensingGuidePage() {
  return (
    <section>
      <h2>Licensing guide</h2>
      <div className="card">
        <p>
          This page will show what your licence enables and how coverage is scored against the best
          implementation your tier allows — plus a separate educational catalog of what higher
          tiers add, grounded in numbers from your own tenant. Nothing is locked or marked
          accepted-risk because of licence.
        </p>
      </div>
    </section>
  )
}
