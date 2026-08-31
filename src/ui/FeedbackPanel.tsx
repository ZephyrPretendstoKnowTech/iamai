// The feedback channel: a quiet footer link, and a panel that shows exactly
// what an email would contain before the mail app opens (prompt 34 §2).
//
// Nothing is sent from here. The panel builds text, shows it, and hands it to
// the person's own mail client.
import { useState } from 'react'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { diagnosticsSummary, feedbackBody, mailtoHref } from '../feedback.ts'
import { FEEDBACK as C } from '../copy/feedback.ts'
import { Button, Card } from './components/index.ts'
import { REPO_URL } from './shell/AppShell.tsx'

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

export function FeedbackPanel({ snapshot }: { snapshot: TenantSnapshot | null }) {
  const [open, setOpen] = useState(false)
  const [include, setInclude] = useState(false)

  if (!open) {
    return (
      <button type="button" className="link-quiet" onClick={() => setOpen(true)}>
        {C.link}
      </button>
    )
  }

  const ctx = {
    page: typeof window === 'undefined' ? '' : window.location.hash || '#/',
    version: VERSION,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  }
  const summary = include ? diagnosticsSummary(snapshot) : null
  const body = feedbackBody(ctx, summary)

  return (
    <Card title={C.title} className="feedback-panel">
      <p>{C.intro}</p>
      <label className="row">
        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.currentTarget.checked)} />
        <span>
          {C.includeLabel}
          <span className="reason"> {C.includeHint}</span>
        </span>
      </label>
      <h4>{C.previewTitle}</h4>
      <pre className="code-block feedback-preview">{body}</pre>
      <p className="reason">{C.nothingAutomatic}</p>
      <div className="row">
        <Button variant="primary" onClick={() => { window.location.href = mailtoHref(ctx, summary) }}>
          {C.send}
        </Button>
        <a className="button-like" href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
          {C.issue}
        </a>
        <Button variant="tertiary" onClick={() => setOpen(false)}>
          {C.close}
        </Button>
      </div>
    </Card>
  )
}
