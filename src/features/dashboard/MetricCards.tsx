import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Pill, SourceBadge } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { formatIn } from '../health/units';
import { statusStyle } from '../../theme/tokens';
import { METRICS } from '../health/metrics';
import type { MetricId } from '../health/types';
import { useLatestReadings } from './useLatestReadings';

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

export function MetricCards() {
  const { now, assessment, displayUnits } = useSynora();

  const { latest, flagFor, isStale } = useLatestReadings();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {DASHBOARD_METRICS.map((id) => {
        const def = METRICS[id];
        const l = latest.get(id);
        const stale = l ? isStale(id, l) : false;
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
                {id === 'radiationDose' && assessment?.radiation && (
                  <p className="mt-1 text-xs text-text-secondary">
                    Recorded total: <strong className="tabular-nums">{formatIn('radiationDose', assessment.radiation.totalMSv, displayUnits)}</strong>{' '}
                    <span className="text-text-muted">from {assessment.radiation.readings} reading{assessment.radiation.readings === 1 ? '' : 's'}</span>
                  </p>
                )}
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
