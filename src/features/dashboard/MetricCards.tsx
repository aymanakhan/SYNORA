import { useMemo } from 'react';
import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Pill, SourceBadge } from '../../components/ui';
import { formatUnit, formatValue, timeAgo } from '../../lib/format';
import { statusStyle } from '../../theme/tokens';
import { FRESHNESS_MS, getRuleDefinition } from '../health/assessment';
import { METRICS } from '../health/metrics';
import type { AssessmentStatus, Measurement, MetricId } from '../health/types';

const DASHBOARD_METRICS: MetricId[] = [
  'heartRate',
  'bloodPressure',
  'bodyTemperature',
  'spo2',
  'bloodGlucose',
  'sleepDuration',
  'stress',
  'mood',
  'radiationDose',
];

const CHECKIN_FIELD: Partial<Record<MetricId, 'sleepHours' | 'stress' | 'mood'>> = {
  sleepDuration: 'sleepHours',
  stress: 'stress',
  mood: 'mood',
};

interface Latest {
  value: string;
  unit: string;
  at: string;
  source: Measurement['source'];
  ref: string;
  suspect: boolean;
  method?: string;
  fromCheckIn: boolean;
}

export function MetricCards() {
  const { measurements, checkIns, assessment, now } = useSynora();

  const latest = useMemo(() => {
    const out = new Map<MetricId, Latest>();
    for (const m of measurements) {
      if (Date.parse(m.measuredAt) > now.getTime()) continue;
      out.set(m.metric, {
        value: formatValue(m),
        unit: formatUnit(m),
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
          value: field === 'sleepHours' ? v.toFixed(1) : String(v),
          unit: field === 'sleepHours' ? 'h' : '/ 5',
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
  }, [measurements, checkIns, now]);

  /**
   * A card is highlighted only when a finding is about THAT metric. A check-in
   * holds several values, so e.g. a symptoms finding must not flag its sleep value.
   */
  const flagFor = (metric: MetricId, l: Latest): AssessmentStatus | undefined => {
    let worst: AssessmentStatus | undefined;
    for (const f of assessment?.findings ?? []) {
      if (!f.evidenceRefs.includes(l.ref)) continue;
      const metrics = getRuleDefinition(f.ruleId)?.metrics ?? [];
      const relevant = metrics.length > 0 ? metrics.includes(metric) : !l.fromCheckIn;
      if (relevant && worst !== 'attention') worst = f.status;
    }
    return worst;
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {DASHBOARD_METRICS.map((id) => {
        const def = METRICS[id];
        const l = latest.get(id);
        const stale = l ? now.getTime() - Date.parse(l.at) > FRESHNESS_MS[def.kind] : false;
        const flag = l ? flagFor(id, l) : undefined;
        const accent = flag ? statusStyle[flag].color : undefined;
        return (
          <div
            key={id}
            className="rounded-lg border border-white/10 bg-card p-3"
            style={accent ? { borderColor: `${accent}aa`, boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm text-text-secondary">{def.label}</h4>
              {flag && (
                <span className="text-xs font-semibold" style={{ color: accent }}>
                  {statusStyle[flag].icon} {statusStyle[flag].label}
                </span>
              )}
            </div>
            {l ? (
              <>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${stale ? 'text-text-muted' : ''}`}>
                  {l.value} <span className="text-sm font-normal text-text-muted">{l.unit}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
                  <SourceBadge source={l.source} />
                  {stale ? <Pill tone="review">Not current · {timeAgo(l.at, now)}</Pill> : <span>{timeAgo(l.at, now)}</span>}
                  {l.suspect && <Pill tone="review">Re-measure suggested</Pill>}
                </div>
                {l.method && <p className="mt-1 text-[11px] text-text-muted">{l.method}</p>}
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl text-text-muted">—</p>
                <p className="mt-2 text-[11px] text-text-muted">No reading yet · {def.typicalMethod}</p>
              </>
            )}
            <LearnMore metric={id} />
          </div>
        );
      })}
    </div>
  );
}
