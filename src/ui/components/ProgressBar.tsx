// Determinate (0–100) or indeterminate progress. The caption is optional: the
// Scan tile carries the line itself (docs/design/connect-mockup.html), so it
// passes the lane as the bar's label only, never as a second line.
export function ProgressBar({ percent, caption, label }: { percent: number | null; caption?: string; label?: string }) {
  const indeterminate = percent === null
  return (
    <div className={`progress ${indeterminate ? 'progress-indeterminate' : ''}`}>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(percent)}
        aria-label={label ?? caption}
      >
        <div className="progress-fill" style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      {caption && <div className="progress-caption">{caption}</div>}
    </div>
  )
}
