import { START } from '../../copy/pages.ts'
import { demoUrl } from '../demo.ts'
import { Card, Icon, LinkButton } from '../components/index.ts'
import { REPO_URL } from '../shell/AppShell.tsx'

export function StartPage() {
  return (
    <div>
      <div className="band hero">
        <h1>{START.headline}</h1>
        <p>{START.subhead}</p>
      </div>

      <div className="band">
        <h2>{START.howTitle}</h2>
        <div className="grid-cards">
          {START.how.map((h) => (
            <Card key={h.title}>
              <Icon name={h.icon} size={28} />
              <h3>{h.title}</h3>
              <p className="muted">{h.text}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="band">
        <h2>{START.needTitle}</h2>
        <ul>
          {START.need.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="band">
        <h2>{START.readsTitle}</h2>
        <ul>
          {START.reads.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p>
          <a href="#/reads">{START.readsLink}</a>
        </p>
      </div>

      <div className="band">
        <h2>{START.neverTitle}</h2>
        <ul>
          {START.never.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="muted">
          {START.sourceBefore}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            {START.sourceLink}
          </a>
          {START.sourceAfter}
        </p>
        <p className="muted">{START.caveat}</p>
      </div>
      <p className="step-next">
        <LinkButton href="#/connect">{START.cta}</LinkButton>{' '}
        {/* Beside Get started, not instead of it (prompt 45 item 1): a stranger
            should be able to see the tool work before connecting a tenant. */}
        <a className="demo-link" href={demoUrl()}>
          {START.demoCta}
        </a>
      </p>
    </div>
  )
}
