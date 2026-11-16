import { displayUnit, formatNumberIn, type DisplayUnits } from '../features/health/units';
import type { Measurement, MeasurementSource, NextStepCategory } from '../features/health/types';

/** Value in the user's display unit (pass `units`), e.g. "98.6" for °F. */
export function formatValue(m: Pick<Measurement, 'metric' | 'value'>, units?: DisplayUnits): string {
  const v = m.value;
  if (typeof v === 'object') return `${v.systolic}/${v.diastolic}`;
  return formatNumberIn(m.metric, v, units);
}

/** Unit label matching formatValue, e.g. "°F". */
export function formatUnit(m: Pick<Measurement, 'metric'>, units?: DisplayUnits): string {
  return displayUnit(m.metric, units).replace('scale 1–5', '/ 5');
}

export function timeAgo(iso: string, now: Date): string {
  const diff = now.getTime() - Date.parse(iso);
  if (diff < 0) return 'just now';
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SOURCE_LABEL: Record<MeasurementSource, string> = {
  manual: 'Manual entry',
  simulated: 'Simulated (synthetic)',
  device: 'Device',
  import: 'Imported',
};

export const NEXT_STEP_TEXT: Record<NextStepCategory, string> = {
  none: 'No action suggested. Keep up your routine measurements.',
  'record-more-data': 'Record more measurements so SYNORA can assess your status.',
  'verify-measurement': 'Re-take the measurement to rule out a measurement error.',
  'review-guidance': 'Review the guidance below and consider discussing it with your crew medical officer.',
  'consult-flight-surgeon':
    'Verify the reading, then contact your crew medical officer / flight surgeon according to mission protocol.',
};
