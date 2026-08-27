import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet'
  size?: 'md' | 'sm'
  loading?: boolean
  icon?: IconName
  children?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', loading = false, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${loading ? 'btn-loading' : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  )
}

/** A link styled as a button (for hash navigation). */
export function LinkButton({ href, variant = 'primary', children }: { href: string; variant?: 'primary' | 'secondary' | 'quiet'; children: ReactNode }) {
  return (
    <a href={href} className={`btn btn-${variant}`} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  )
}
