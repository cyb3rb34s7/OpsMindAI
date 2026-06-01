import type { CSSProperties, ReactNode } from 'react';

// Ported verbatim from the app's design system so the video matches pixel-for-pixel.
export function Icon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
}) {
  const base =
    'px-5 py-2.5 rounded-md text-label-sm font-mono uppercase tracking-wide inline-flex items-center justify-center gap-2';
  const variants: Record<string, string> = {
    primary: 'bg-primary text-on-primary shadow-sm',
    ghost: 'bg-surface border border-outline-variant text-on-surface',
    danger: 'bg-error text-on-error shadow-sm',
  };
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>;
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'error' | 'primary' | 'warning';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-variant/80 text-on-surface-variant border-outline-variant/30',
    success: 'bg-tertiary-container/30 text-tertiary border-tertiary/20',
    error: 'bg-error-container/40 text-error border-error/20',
    primary: 'bg-primary-container/30 text-primary border-primary/20',
    warning: 'bg-[#fbbc04]/15 text-[#9a7400] border-[#fbbc04]/30',
  };
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wide border inline-flex items-center gap-1.5 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`bento-card ${className}`} style={style}>
      {children}
    </div>
  );
}
