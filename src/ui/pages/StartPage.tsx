import { START } from '../../copy/pages.ts'
import { Card, Icon, LinkButton } from '../components/index.ts'
import { REPO_URL } from '../shell/AppShell.tsx'

export function StartPage() {
  return (
    <div>
      <div className="band hero">
        <h1>{START.headline}</h1>
        <p>{START.subhead}</p>
        <p>
          <LinkButton href="#/connect">{START.cta}</LinkButton>
        </p>
      </div>

      <div className="band">
        <h3>{START.howTitle}</h3>
        <div className="grid-cards">
          {START.how.map((h) => (
            <Card key={h.title}>
              <Icon name={h.icon} size={28} />
              <h4>{h.title}</h4>
              <p className="muted">{h.text}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="band">
        <h3>{START.needTitle}</h3>
        <ul>
          {START.need.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="band">
        <h3>{START.readsTitle}</h3>
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
        <h3>{START.neverTitle}</h3>
        <ul>
          {START.never.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="muted">
          {START.sourceBefore}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {START.sourceLink}
          </a>
          {START.sourceAfter}
        </p>
        <p className="muted">{START.caveat}</p>
      </div>
    </div>
  )
}
