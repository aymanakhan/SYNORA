import { useState, type KeyboardEvent } from 'react';
import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Card, SourceBadge, StatusBadge } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { formatIn } from '../health/units';
import { statusStyle } from '../../theme/tokens';
import { useLatestReadings } from '../dashboard/useLatestReadings';
import { SOURCES } from '../health/knowledge';
import { METRICS } from '../health/metrics';
import type { AssessmentStatus } from '../health/types';
import { REGIONS, type BodyRegion, type RegionId } from './regions';

type RegionStatus = AssessmentStatus | 'not-tracked';

/**
 * Clickable body overview. Region status is derived from the SAME assessment
 * flags as the metric cards. No region has its own medical logic.
 */
export function BodyMap() {
  const { now, assessment, displayUnits } = useSynora();
  const { latest, flagFor, isStale } = useLatestReadings();
  const [selected, setSelected] = useState<RegionId>('heart');

  const regionStatus = (r: BodyRegion): RegionStatus => {
    if (r.metrics.length === 0) return 'not-tracked';
    let worst: RegionStatus = 'unknown';
    let anyFresh = false;
    for (const m of r.metrics) {
      const l = latest.get(m);
      if (!l || isStale(m, l)) continue;
      anyFresh = true;
      const f = flagFor(m, l);
      if (f === 'attention') return 'attention';
      if (f === 'review') worst = 'review';
    }
    return worst === 'review' ? 'review' : anyFresh ? 'stable' : 'unknown';
  };

  const colorFor = (s: RegionStatus) => (s === 'not-tracked' ? '#475569' : statusStyle[s].color);
  const labelFor = (s: RegionStatus) => (s === 'not-tracked' ? 'Not tracked' : statusStyle[s].label);
  const sel = REGIONS.find((r) => r.id === selected)!;
  const selStatus = regionStatus(sel);
  const onKey = (id: RegionId) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(id);
    }
  };

  const radiation = REGIONS.find((r) => r.id === 'radiation')!;
  const radStatus = regionStatus(radiation);

  return (
    <Card title="Body overview" actions={<span className="text-xs text-text-muted">Click a region</span>}>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="-1 -1 26 42" width={170} height={275} shapeRendering="crispEdges" className="pixelated" role="group" aria-label="Body regions">
            {/* faint outline glow for radiation (whole body) */}
            <rect x={-1} y={-1} width={26} height={42} fill="none" stroke={colorFor(radStatus)} strokeOpacity={selected === 'radiation' ? 0.9 : 0.25} strokeWidth={0.4} strokeDasharray="1 1" />
            {REGIONS.filter((r) => r.rects.length > 0).map((r) => {
              const st = regionStatus(r);
              const active = r.id === selected;
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${r.label}: ${labelFor(st)}`}
                  onClick={() => setSelected(r.id)}
                  onKeyDown={onKey(r.id)}
                  className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-cyan"
                >
                  {r.rects.map(([x, y, w, h], i) => (
                    <rect
                      key={i}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={colorFor(st)}
                      fillOpacity={active ? 0.95 : st === 'stable' ? 0.45 : 0.75}
                      stroke={active ? '#F8FAFC' : 'transparent'}
                      strokeWidth={0.25}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          <button
            onClick={() => setSelected('radiation')}
            aria-pressed={selected === 'radiation'}
            className={`rounded border px-2 py-1 text-xs ${selected === 'radiation' ? 'border-cyan text-cyan' : 'border-white/15 text-text-secondary'}`}
          >
            ☢ Radiation (whole body)
          </button>
          <p className="text-center text-[10px] text-text-muted">Brighter = flagged · grey = no current data or not tracked</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{sel.label}</h4>
            {selStatus === 'not-tracked' ? (
              <span className="rounded border border-white/20 px-2 py-0.5 text-xs text-text-muted">Not tracked</span>
            ) : (
              <StatusBadge status={selStatus} />
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{sel.role}</p>

          {sel.metrics.length > 0 && (
            <ul className="mt-3 divide-y divide-white/5 text-sm">
              {sel.metrics.map((m) => {
                const l = latest.get(m);
                const f = l ? flagFor(m, l) : undefined;
                return (
                  <li key={m} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span>{METRICS[m].label}</span>
                    {l ? (
                      <span className="flex flex-wrap items-center gap-2 text-xs">
                        <strong className="text-sm tabular-nums">{l.value}</strong>
                        <span className="text-text-muted">{l.unit}</span>
                        {f && <span style={{ color: statusStyle[f].color }}>{statusStyle[f].icon} {statusStyle[f].label}</span>}
                        <SourceBadge source={l.source} />
                        <span className={isStale(m, l) ? 'text-review' : 'text-text-muted'}>{isStale(m, l) ? 'not current · ' : ''}{timeAgo(l.at, now)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">No reading yet</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {sel.id === 'radiation' && assessment?.radiation && (
            <p className="mt-2 text-sm text-text-secondary">
              Recorded total: <strong>{formatIn('radiationDose', assessment.radiation.totalMSv, displayUnits)}</strong> from {assessment.radiation.readings} dosimeter readings
              {assessment.radiation.latestDailyRateMSv !== undefined && <> · latest ≈ {formatIn('radiationDose', assessment.radiation.latestDailyRateMSv, displayUnits)}/day</>}.
            </p>
          )}
          {sel.notTracked && <p className="mt-3 rounded border border-white/10 bg-panel p-2 text-xs text-text-secondary">{sel.notTracked}</p>}
          {sel.note && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-secondary">
              {sel.note.map((n) => (
                <li key={n.text}>
                  {n.text}{' '}
                  <a className="text-cyan underline" href={SOURCES[n.sourceId].url} target="_blank" rel="noreferrer">{SOURCES[n.sourceId].publisher}</a>
                </li>
              ))}
            </ul>
          )}
          {sel.metrics.map((m) => <LearnMore key={m} metric={m} summary={`${METRICS[m].label}: why it matters in space`} />)}
        </div>
      </div>
    </Card>
  );
}
