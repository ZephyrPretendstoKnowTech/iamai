import { Card, Icon, LinkButton } from '../components/index.ts'
import { REPO_URL } from '../shell/AppShell.tsx'

export function StartPage() {
  return (
    <div>
      <div className="band hero">
        <h1>Turn your Conditional Access baseline into a rollout plan that won't lock anyone out.</h1>
        <p>
          IAMAI reads your tenant's real policies, people, and sign-ins, compares them with a proven
          baseline, and produces a dated plan — who each step touches, what could go wrong, and the
          exact change to make. Predicted impact, confirmed in report-only.
        </p>
        <p>
          <LinkButton href="#/connect">Get started</LinkButton>
        </p>
      </div>

      <div className="band">
        <h3>How it works</h3>
        <div className="grid-cards">
          <Card>
            <Icon name="shield" size={28} />
            <h4>Connect</h4>
            <p className="muted">A read-only sign-in. IAMAI can never change anything in your tenant.</p>
          </Card>
          <Card>
            <Icon name="policy" size={28} />
            <h4>Choose a baseline</h4>
            <p className="muted">Start from a maintained policy set, or upload your own package.</p>
          </Card>
          <Card>
            <Icon name="chart" size={28} />
            <h4>Scan and see readiness</h4>
            <p className="muted">Who could pass MFA today, who needs a hand, and who is blocked right now — by name.</p>
          </Card>
          <Card>
            <Icon name="check" size={28} />
            <h4>Follow the roadmap</h4>
            <p className="muted">Dated phases, the safe wins to ship today, and danger areas called out.</p>
          </Card>
        </div>
      </div>

      <div className="band">
        <h3>What you'll need</h3>
        <ul>
          <li>A Global Administrator or Global Reader account.</li>
          <li>Entra ID P1 for sign-in records — IAMAI works without it, with less evidence.</li>
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
        <p className="muted">
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
