// Package instructions (#/baseline/package): what a package is, three ways to
// make one, and what happens to the upload.
import { useState } from 'react'
import { REDACTED, exportClipboard } from '../exportGuard.ts'
import { PACKAGE as C } from '../../copy/inventory.ts'
import { Button, Card } from '../components/index.ts'
import { StepFrame } from '../shell/AppShell.tsx'

function CopyBlock({ text, id, copied, onCopy }: { text: string; id: string; copied: string | null; onCopy: (id: string, text: string) => void }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
      <pre className="code-block" style={{ flex: 1, margin: 0 }}>
        {text}
      </pre>
      <Button size="sm" icon="copy" onClick={() => onCopy(id, text)}>
        {copied === id ? C.copied : C.copy}
      </Button>
    </div>
  )
}

export function PackagePage() {
  const [copied, setCopied] = useState<string | null>(null)
  const onCopy = (id: string, text: string): void => {
    void exportClipboard(text, REDACTED).then((ok) => {
      if (!ok) return
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  return (
    <StepFrame title={C.title} does={C.does} next="baseline" nextLabel={C.next}>
      <Card title={C.whatTitle}>
        <ul>
          {C.what.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Card>

      <Card title={C.waysTitle}>
        <h4>{C.way1Title}</h4>
        <ol className="sections">
          {C.way1.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ol>
        <h4>{C.way2Title}</h4>
        <p className="reason">{C.way2Intro}</p>
        {C.way2Commands.map((cmd, i) => (
          <CopyBlock key={i} id={`ps-${i}`} text={cmd} copied={copied} onCopy={onCopy} />
        ))}
        <h4>{C.way3Title}</h4>
        <p>{C.way3}</p>
      </Card>

      <Card title={C.bestTitle}>
        <ul>
          {C.best.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="reason">{C.missing}</p>
      </Card>

      <Card title={C.doesTitle}>
        <ul>
          {C.doesList.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Card>
    </StepFrame>
  )
}
