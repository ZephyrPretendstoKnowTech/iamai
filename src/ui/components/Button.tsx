import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'

// Three variants (prompt 47 Part 1): primary is filled accent and appears at
// most once per view; secondary is accent text, underlined; tertiary is
// ink-2 text. The class names keep the `btn-*` hooks the UI inventory and its
// rule 6 read. `size`, `icon` and `loading` remain accepted for the legacy
// pages until prompt 49; the height is one control height regardless.
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  loading?: boolean
  /** A spinner while a control warms up, without disabling it, so an early click still lands and queues (prompt 50.1 item 7). */
  busy?: boolean
  icon?: IconName
  children?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', loading = false, busy = false, icon, children, className, disabled, ...rest }: ButtonProps) {
  const spinner = loading || busy
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${spinner ? 'btn-loading' : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={spinner || undefined}
      {...rest}
    >
      {spinner ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  )
}

/** A hash link styled as a button. Counted as a button by the inventory (`a.btn`). */
export function LinkButton({ href, variant = 'primary', children }: { href: string; variant?: ButtonVariant; children: ReactNode }) {
  return (
    <a href={href} className={`btn btn-${variant}`}>
      {children}
    </a>
  )
}
