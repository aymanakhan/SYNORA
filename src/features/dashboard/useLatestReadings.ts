import { useCallback, useMemo } from 'react';
import { useSynora } from '../../app/state';
import { formatUnit, formatValue } from '../../lib/format';
import { displayUnit, formatNumberIn } from '../health/units';
import { FRESHNESS_MS, getRuleDefinition } from '../health/assessment';
import { METRICS } from '../health/metrics';
import type { AssessmentStatus, Measurement, MetricId } from '../health/types';

const CHECKIN_FIELD: Partial<Record<MetricId, 'sleepHours' | 'stress' | 'mood'>> = {
  sleepDuration: 'sleepHours',
  stress: 'stress',
  mood: 'mood',
};

export interface Latest {
  value: string;
  unit: string;
  at: string;
  source: Measurement['source'];
  ref: string;
  suspect: boolean;
  method?: string;
  fromCheckIn: boolean;
}


/** Latest reading per metric (measurements + check-ins) and per-metric flags from the shared assessment. */
export function useLatestReadings() {
  const { measurements, checkIns, assessment, now, displayUnits } = useSynora();

  const latest = useMemo(() => {
    const out = new Map<MetricId, Latest>();
    for (const m of measurements) {
      if (Date.parse(m.measuredAt) > now.getTime()) continue;
      out.set(m.metric, {
        value: formatValue(m, displayUnits),
        unit: formatUnit(m, displayUnits),
        at: m.measuredAt,
        source: m.source,
        ref: m.id,
        suspect: m.qualityStatus === 'suspect',
        method: m.deviceOrMethod,
        fromCheckIn: false,
      });
    }
    // Self-reports may also come from check-ins; use whichever is newer.
    for (const c of checkIns) {
      if (Date.parse(c.submittedAt) > now.getTime()) continue;
      for (const [metric, field] of Object.entries(CHECKIN_FIELD) as [MetricId, 'sleepHours' | 'stress' | 'mood'][]) {
        const v = c[field];
        if (v === undefined) continue;
        const prev = out.get(metric);
        if (prev && prev.at >= c.submittedAt) continue;
        out.set(metric, {
          value: field === 'sleepHours' ? formatNumberIn('sleepDuration', v, displayUnits) : String(v),
          unit: field === 'sleepHours' ? displayUnit('sleepDuration', displayUnits) : '/ 5',
          at: c.submittedAt,
          source: c.isSynthetic ? 'simulated' : 'manual',
          ref: c.id,
          suspect: false,
          method: 'Daily check-in',
          fromCheckIn: true,
        });
      }
    }
    return out;
  }, [measurements, checkIns, now, displayUnits]);

  /**
   * A card is highlighted only when a finding is about THAT metric. A check-in
   * holds several values, so e.g. a symptoms finding must not flag its sleep value.
   */
  const flagFor = useCallback((metric: MetricId, l: Latest): AssessmentStatus | undefined => {
    let worst: AssessmentStatus | undefined;
    for (const f of assessment?.findings ?? []) {
      if (!f.evidenceRefs.includes(l.ref)) continue;
      const metrics = getRuleDefinition(f.ruleId)?.metrics ?? [];
      const relevant = metrics.length > 0 ? metrics.includes(metric) : !l.fromCheckIn;
      if (relevant && worst !== 'attention') worst = f.status;
    }
    return worst;
  }, [assessment]);


  const isStale = useCallback(
    (metric: MetricId, l: Latest) => now.getTime() - Date.parse(l.at) > FRESHNESS_MS[METRICS[metric].kind],
    [now],
  );

  return { latest, flagFor, isStale };
}
