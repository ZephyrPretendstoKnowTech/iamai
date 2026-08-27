import { StepFrame } from '../shell/AppShell.tsx'
import { relative, absolute } from '../format.ts'

// Step pages that are not implemented yet — each explains what to do first
// and links there (prompt 04). Mapping and Coverage are real now, in their
// own files under pages/.

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
