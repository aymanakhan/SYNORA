import type { ReactNode } from 'react';
import type { AssessmentStatus, MeasurementSource } from '../features/health/types';
import { statusStyle } from '../theme/tokens';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-white/10 bg-card p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold tracking-wide text-text-secondary uppercase">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Status is always icon + text + color, never color alone. */
export function StatusBadge({ status, size = 'sm' }: { status: AssessmentStatus; size?: 'sm' | 'lg' }) {
  const s = statusStyle[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-semibold ${size === 'lg' ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-xs'}`}
      style={{ color: s.color, borderColor: `${s.color}88`, backgroundColor: `${s.color}1a` }}
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: MeasurementSource }) {
  if (source === 'simulated') {
    return (
      <span className="rounded border border-purple/50 bg-purple/10 px-1.5 py-0.5 text-[11px] font-semibold text-purple">
        SIMULATED · synthetic
      </span>
    );
  }
  return (
    <span className="rounded border border-teal/40 bg-teal/10 px-1.5 py-0.5 text-[11px] font-semibold text-teal">
      {source === 'manual' ? 'MANUAL entry' : source.toUpperCase()}
    </span>
  );
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'review' | 'cyan' }) {
  const cls = {
    muted: 'border-white/15 text-text-muted',
    review: 'border-review/50 text-review',
    cyan: 'border-cyan/50 text-cyan',
  }[tone];
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] ${cls}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  ariaPressed,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'pixel';
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaPressed?: boolean;
  title?: string;
}) {
  const cls = {
    primary: 'bg-cyan text-space hover:bg-cyan/90 font-semibold',
    secondary: 'border border-white/20 text-text-primary hover:bg-white/5',
    pixel: 'pixel-btn font-pixel text-xs uppercase tracking-wider text-mint hover:bg-mint/10',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      title={title}
      className={`rounded px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}
