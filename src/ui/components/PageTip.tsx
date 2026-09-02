// One tip line under a page's header line (or a step's title line), from the
// content file, with a ? control that collapses it and reopens it. The collapse
// is remembered per page in the browser (tipState.ts).
import { useState } from 'react'
import { app } from '../../content/content.ts'
import { setTipCollapsed, tipCollapsed } from '../tipState.ts'

export function PageTip({ page, text }: { page: string; text: string }) {
  const [collapsed, setCollapsed] = useState(() => tipCollapsed(page))
  const toggle = (): void => {
    setTipCollapsed(page, !collapsed)
    setCollapsed(!collapsed)
  }
  return (
    <p className="tip page-tip">
      {!collapsed && <span>{text}</span>}
      <button type="button" className="infotip-btn" aria-label={collapsed ? app.shell.tipShow : app.shell.tipHide} aria-expanded={!collapsed} onClick={toggle}>
        ?
      </button>
    </p>
  )
}
