// Per-page error boundary (prompt 20 §2): a render error shows a plain
// message, a redacted diagnostics download, and Start over. Never a white
// screen. Saved data on this device is untouched; Start over only drops what
// is in memory by reloading at the Start step.
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { SHELL } from '../../copy/pages.ts'
import { redactIdentifiers } from '../../redact.ts'
import { downloadFile } from '../format.ts'
import { Button } from './Button.tsx'
import { Callout } from './Callout.tsx'

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
    downloadFile(`iamai-error-${Date.now()}.json`, redactIdentifiers(JSON.stringify(bundle, null, 2)), 'application/json')
  }

  startOver = (): void => {
    window.location.hash = '#/start'
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <section>
        <h2>{SHELL.errorTitle}</h2>
        <Callout kind="danger" title={SHELL.errorCalloutTitle}>
          {SHELL.errorBody}
        </Callout>
        <p className="row">
          <Button icon="download" onClick={this.download}>
            {SHELL.errorDiagnostics}
          </Button>
          <Button variant="primary" onClick={this.startOver}>
            {SHELL.errorStartOver}
          </Button>
        </p>
        <p className="reason">{SHELL.errorDetail(this.state.error.message)}</p>
      </section>
    )
  }
}
