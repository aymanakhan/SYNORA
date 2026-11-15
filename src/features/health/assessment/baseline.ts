import type { Measurement } from '../types';
import { BASELINE, type ValueComponent } from './rules';

export function componentValue(m: Measurement, component: ValueComponent): number | undefined {
  const v = m.value;
  if (component === 'value') return typeof v === 'number' ? v : undefined;
  return typeof v === 'object' ? v[component] : undefined;
}

export interface Baseline {
  mean: number;
  sd: number;
  /** max(sd, minSpread) — the spread actually used for deviation. */
  effectiveSpread: number;
  n: number;
  distinctDays: number;
}

export type BaselineResult =
  | { established: true; baseline: Baseline }
  | { established: false; reason: string; n: number; distinctDays: number };

/**
 * Personal baseline from prior readings.
 *
 * Safeguards: excludes the reading being evaluated, `suspect` readings, and
 * anything outside the lookback window; requires a minimum count spread over
 * several days so one bad morning cannot become "normal"; floors the SD so a
 * tiny observed spread cannot turn small changes into alerts.
 */
export function computeBaseline(
  history: Measurement[],
  component: ValueComponent,
  minSpread: number,
  excludeId: string,
  now: Date,
): BaselineResult {
  const since = now.getTime() - BASELINE.lookbackMs;
  const values: number[] = [];
  const days = new Set<string>();

  for (const m of history) {
    if (m.id === excludeId || m.qualityStatus !== 'valid') continue;
    const t = Date.parse(m.measuredAt);
    if (t < since || t > now.getTime()) continue;
    const v = componentValue(m, component);
    if (v === undefined) continue;
    values.push(v);
    days.add(m.measuredAt.slice(0, 10));
  }

  const n = values.length;
  if (n < BASELINE.minReadings || days.size < BASELINE.minDistinctDays) {
    return {
      established: false,
      reason: `needs ≥ ${BASELINE.minReadings} readings over ≥ ${BASELINE.minDistinctDays} days (have ${n} over ${days.size})`,
      n,
      distinctDays: days.size,
    };
  }

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  return {
    established: true,
    baseline: { mean, sd, effectiveSpread: Math.max(sd, minSpread), n, distinctDays: days.size },
  };
}
