// On/off switch with a visible label; keyboard: Space/Enter toggles.
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'toggle-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="toggle-knob" />
    </button>
  )
}
