import type { ReactNode } from 'react'

export function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  const base =
    'px-5 py-2.5 rounded-md text-label-sm font-mono uppercase tracking-wide transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants: Record<string, string> = {
    primary: 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm',
    ghost: 'bg-surface border border-outline-variant text-on-surface hover:border-primary hover:text-primary',
    danger: 'bg-error text-on-error hover:bg-error/90 shadow-sm',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'error' | 'primary' | 'warning'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-variant/80 text-on-surface-variant border-outline-variant/30',
    success: 'bg-tertiary-container/30 text-tertiary border-tertiary/20',
    error: 'bg-error-container/40 text-error border-error/20',
    primary: 'bg-primary-container/30 text-primary border-primary/20',
    warning: 'bg-[#fbbc04]/15 text-[#9a7400] border-[#fbbc04]/30',
  }
  return (
    <span
      className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wide border inline-flex items-center gap-1.5 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bento-card ${className}`}>{children}</div>
}

export function CardHeader({ icon, title, right }: { icon: string; title: string; right?: ReactNode }) {
  return (
    <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface/60">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="text-primary !text-base" />
        <h3 className="text-label-sm font-mono uppercase tracking-wider text-on-surface">{title}</h3>
      </div>
      {right}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-on-surface-variant text-sm">
      <Icon name="progress_activity" className="animate-spin text-primary" />
      {label}
    </div>
  )
}

export function Terminal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[#0f1115] rounded-xl p-4 font-mono text-xs text-[#c9d1d9] shadow-inner overflow-auto term-scroll ${className}`}
    >
      <div className="flex gap-1.5 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
      </div>
      {children}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container/40 border border-error/20 text-error text-sm">
      <Icon name="error" className="!text-base shrink-0 mt-0.5" />
      <span className="break-words">{message}</span>
    </div>
  )
}
