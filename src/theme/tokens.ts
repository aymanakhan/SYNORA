/**
 * SYNORA design tokens (from CLAUDE.md). Mirrored as CSS variables in
 * src/index.css for Tailwind. Change both together.
 */
import type { AssessmentStatus } from '../features/health/types';

export const colors = {
  space: '#0B1020',
  navy: '#111827',
  panel: '#172033',
  card: '#1E293B',
  cyan: '#38BDF8',
  teal: '#2DD4BF',
  mint: '#86EFAC',
  purple: '#A78BFA',
  stable: '#22C55E',
  review: '#FACC15',
  attention: '#F97316',
  /** Illustration only — NOT an assessment category. */
  criticalIllustration: '#EF4444',
  unknown: '#94A3B8',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
} as const;

/** Status is never conveyed by color alone: always pair with icon + label. */
export const statusStyle: Record<AssessmentStatus, { color: string; label: string; icon: string }> = {
  stable: { color: colors.stable, label: 'Stable', icon: '●' },
  review: { color: colors.review, label: 'Review', icon: '▲' },
  attention: { color: colors.attention, label: 'Attention', icon: '◆' },
  unknown: { color: colors.unknown, label: 'Unknown', icon: '?' },
};
