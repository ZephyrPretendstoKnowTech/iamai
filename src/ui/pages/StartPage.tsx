import { REPO_URL } from '../shell/AppShell.tsx'

const ICONS = {
  connect: (
    <svg className="card-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  baseline: (
    <svg className="card-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  scan: (
    <svg className="card-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l4-3" />
      <path d="M12 4v2M20 12h-2M12 20v-2M4 12h2" />
    </svg>
  ),
  roadmap: (
    <svg className="card-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 19V5M4 17c4-3 6 1 10-2M4 9c4-3 6 1 10-2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="19" cy="14" r="2" />
    </svg>
  ),
}

export function StartPage() {
  return (
    <div>
      <div className="band hero">
        <h1>Turn your Conditional Access baseline into a rollout plan that won't lock anyone out.</h1>
        <p>
          I read your tenant's real policies, people, and sign-ins, compare them with a proven
          baseline, and hand you a dated plan — who each step touches, what could go wrong, the exact
          change to make, and the email to send first. Predicted impact, confirmed in report-only.
        </p>
        <p>
          <a href="#/connect">
            <button className="primary">Get started</button>
          </a>
        </p>
      </div>

      <div className="band">
        <h3>How it works</h3>
        <div className="cards-row">
          <div className="card">
            {ICONS.connect}
            <h4>Connect</h4>
            <p className="reason">A read-only sign-in. IAMAI can never change anything in your tenant.</p>
          </div>
          <div className="card">
            {ICONS.baseline}
            <h4>Choose a baseline</h4>
            <p className="reason">Start from a maintained policy set, or upload your own package.</p>
          </div>
          <div className="card">
            {ICONS.scan}
            <h4>Scan and see readiness</h4>
            <p className="reason">Who could pass MFA today, who needs a hand, and who's blocked right now — by name.</p>
          </div>
          <div className="card">
            {ICONS.roadmap}
            <h4>Follow the roadmap</h4>
            <p className="reason">Dated phases, the safe wins to ship today, danger areas called out, and the announcement to send.</p>
          </div>
        </div>
      </div>

      <div className="band">
        <h3>What you'll need</h3>
        <ul>
          <li>A Global Administrator or Global Reader account.</li>
          <li>Entra ID P1 for sign-in evidence — IAMAI works without it, with less evidence.</li>
          <li>About ten minutes for the first scan.</li>
        </ul>
      </div>

      <div className="band">
        <h3>What IAMAI reads, and why</h3>
        <ul>
          <li>Your Conditional Access configuration — to compare it against the baseline.</li>
          <li>User, device, and licence inventory — to size every step's real impact.</li>
          <li>Recent interactive sign-ins — to verify MFA actually works before anything is enforced.</li>
        </ul>
        <p>
          <a href="#/reads">The full list, with every endpoint and scope →</a>
        </p>
      </div>

      <div className="band">
        <h3>What it never does</h3>
        <ul>
          <li>No changes to your tenant, ever — the app holds read-only permissions only.</li>
          <li>Nothing leaves your browser. There is no server.</li>
          <li>No account required with us.</li>
        </ul>
        <p className="reason">
          IAMAI runs entirely in your browser and only reads.{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            The source is public
          </a>{' '}
          so anyone can verify that.
        </p>
      </div>
    </div>
  )
}
