// Per-page error boundary (prompt 20 §2): a render error shows the error page
// (pages.app.error): the title, the lead, what is intact, Reload (primary),
// the redacted diagnostics download (secondary), Start over (tertiary), and
// where to send the diagnostics. Never a white screen. Saved data on this
// device is untouched; Reload draws the page again, Start over only drops what
// is in memory by reloading at Connect. A chunk the new build no longer ships
// reloads once before this page is reached (ui/preloadError.ts).
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { REDACTED, exportDownload } from '../exportGuard.ts'
import { Button } from './Button.tsx'

const E = app.error

type Props = { route: string; children: ReactNode }
type State = { error: Error | null; componentStack: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, componentStack: info.componentStack ?? null })
  }

  download = (): void => {
    const { error, componentStack } = this.state
    const bundle = {
      at: new Date().toISOString(),
      route: this.props.route,
      message: error?.message ?? null,
      stack: error?.stack ?? null,
      componentStack,
      userAgent: navigator.userAgent,
    }
    exportDownload(`iamai-error-${Date.now()}.json`, JSON.stringify(bundle, null, 2), 'application/json', REDACTED)
  }

  reload = (): void => {
    window.location.reload()
  }

  startOver = (): void => {
    window.location.hash = '#/connect'
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <section className="surface error-page">
        <h2>{E.title}</h2>
        <p>{E.lead}</p>
        <p>{E.body}</p>
        <div className="actions">
          <Button variant="primary" onClick={this.reload}>
            {E.reload}
          </Button>
          <Button variant="secondary" icon="download" onClick={this.download}>
            {E.diagnostics}
          </Button>
          <Button variant="tertiary" onClick={this.startOver}>
            {E.startOver}
          </Button>
        </div>
        {/* One of the two places the feedback address appears; the other is the last line of How IAMAI works' Limits. */}
        <p className="quiet">{E.send}</p>
        <p className="reason">{fillText(E.detail, { message: this.state.error.message })}</p>
      </section>
    )
  }
}
