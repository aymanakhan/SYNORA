import { useMemo, useState, type KeyboardEvent } from 'react';
import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Card, SourceBadge, StatusBadge } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { statusStyle } from '../../theme/tokens';
import { useLatestReadings } from '../dashboard/useLatestReadings';
import { SOURCES } from '../health/knowledge';
import { METRICS } from '../health/metrics';
import type { AssessmentStatus } from '../health/types';
import { formatIn } from '../health/units';
import { REGIONS, type BodyRegion, type RegionId } from './regions';

type RegionStatus = AssessmentStatus | 'not-tracked';

const FIG_W = 24;
const FIG_H = 40;
const SEAM = '#0B1020';

/** Solid colour = `hex` blended over the panel background (avoids see-through overlaps). */
function blend(hex: string, amount: number, base = '#172033'): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = [0, 1, 2].map((i) => Math.round(c(base, i) + (c(hex, i) - c(base, i)) * amount));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Shorter names for the diagram labels (full names are used in the details). */
const SHORT: Partial<Record<RegionId, string>> = {
  skin: 'Immune & temperature',
  radiation: 'Radiation (whole body)',
  metabolism: 'Metabolism',
};

/**
 * Where each region's label sits in the wide layout, and the point on the
 * body its leader line points to (figure coordinates).
 */
const LABELS: Record<RegionId, { side: 'left' | 'right'; y: number; anchor: [number, number] }> = {
  brain: { side: 'left', y: 4, anchor: [9.2, 4] },
  lungs: { side: 'left', y: 12, anchor: [7.6, 12] },
  metabolism: { side: 'left', y: 19, anchor: [7.6, 19] },
  bones: { side: 'left', y: 30, anchor: [8.6, 30] },
  heart: { side: 'right', y: 9, anchor: [13.2, 11.5] },
  skin: { side: 'right', y: 16, anchor: [19.6, 15] },
  radiation: { side: 'right', y: 34, anchor: [25, 34] },
};

/** Rasterise regions into a cell map so we can draw seams only between DIFFERENT regions. */
function buildCells() {
  const cells = new Map<string, RegionId>();
  for (const r of REGIONS) {
    for (const [x, y, w, h] of r.rects) {
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) cells.set(`${i},${j}`, r.id);
    }
  }
  const at = (x: number, y: number) => cells.get(`${x},${y}`);
  const seams: [number, number, number, number][] = [];
  const outlines = new Map<RegionId, [number, number, number, number][]>();
  for (const [key, id] of cells) {
    const [x, y] = key.split(',').map(Number);
    // Seams: a hairline where this cell meets a different region (right/bottom only, to avoid duplicates).
    const right = at(x + 1, y);
    const below = at(x, y + 1);
    if (right && right !== id) seams.push([x + 1, y, x + 1, y + 1]);
    if (below && below !== id) seams.push([x, y + 1, x + 1, y + 1]);
    // Outline: every edge that leaves this region (used to highlight the selected one).
    const edges = outlines.get(id) ?? [];
    if (at(x - 1, y) !== id) edges.push([x, y, x, y + 1]);
    if (at(x + 1, y) !== id) edges.push([x + 1, y, x + 1, y + 1]);
    if (at(x, y - 1) !== id) edges.push([x, y, x + 1, y]);
    if (at(x, y + 1) !== id) edges.push([x, y + 1, x + 1, y + 1]);
    outlines.set(id, edges);
  }
  return { cells: [...cells.entries()].map(([k, id]) => ({ x: +k.split(',')[0], y: +k.split(',')[1], id })), seams, outlines };
}

/**
 * Clickable body overview. Region status is derived from the SAME assessment
 * flags as the metric cards. No region has its own medical logic.
 */
export function BodyMap() {
  const { now, assessment, displayUnits } = useSynora();
  const { latest, flagFor, isStale } = useLatestReadings();
  const [selected, setSelected] = useState<RegionId>('heart');
  const geo = useMemo(buildCells, []);

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
  const statusById = Object.fromEntries(REGIONS.map((r) => [r.id, regionStatus(r)])) as Record<RegionId, RegionStatus>;

  const colorFor = (s: RegionStatus) => (s === 'not-tracked' ? '#475569' : statusStyle[s].color);
  const labelFor = (s: RegionStatus) => (s === 'not-tracked' ? 'Not tracked' : statusStyle[s].label);
  const iconFor = (s: RegionStatus) => (s === 'not-tracked' ? '–' : statusStyle[s].icon);
  const sel = REGIONS.find((r) => r.id === selected)!;
  const selStatus = statusById[sel.id];

  const select = (id: RegionId) => () => setSelected(id);
  const onKey = (id: RegionId) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(id);
    }
  };
  const a11y = (r: BodyRegion) => ({
    role: 'button',
    tabIndex: 0,
    'aria-pressed': r.id === selected,
    'aria-label': `${r.label}: ${labelFor(statusById[r.id])}`,
    onClick: select(r.id),
    onKeyDown: onKey(r.id),
  });

  /** The figure itself (shared by the wide and compact layouts). */
  const figure = (interactive: boolean) => (
    <g>
      {/* Whole-body radiation: faint dashed outline around the figure. */}
      <rect
        x={-1}
        y={-1}
        width={FIG_W + 2}
        height={FIG_H + 2}
        fill="none"
        stroke={colorFor(statusById.radiation)}
        strokeOpacity={selected === 'radiation' ? 0.9 : 0.3}
        strokeWidth={0.15}
        strokeDasharray="0.6 0.6"
      />
      {REGIONS.filter((r) => r.rects.length > 0).map((r) => {
        const st = statusById[r.id];
        const active = r.id === selected;
        return (
          <g key={r.id} className="body-region cursor-pointer outline-none" {...(interactive ? a11y(r) : { 'aria-hidden': true })}>
            {geo.cells
              .filter((c) => c.id === r.id)
              .map((c) => (
                <rect
                  key={`${c.x},${c.y}`}
                  x={c.x}
                  y={c.y}
                  width={1.02}
                  height={1.02}
                  fill={blend(colorFor(st), active ? 0.95 : st === 'stable' ? 0.5 : 0.78)}
                />
              ))}
          </g>
        );
      })}
      {/* Very subtle seams between different regions. */}
      <g aria-hidden pointerEvents="none" stroke={SEAM} strokeOpacity={0.45} strokeWidth={0.09} strokeLinecap="square">
        {geo.seams.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* Selected region outline. */}
      <g aria-hidden pointerEvents="none" stroke="#F8FAFC" strokeOpacity={0.9} strokeWidth={0.16} strokeLinecap="square">
        {(geo.outlines.get(selected) ?? []).map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </g>
  );

  // Wide layout geometry: labels in columns either side of the centred figure.
  const PAD = 21; // label column width (viewBox units)
  const VB_X = -PAD - 2;
  const VB_W = FIG_W + 2 * PAD + 4;
  const labelX = (side: 'left' | 'right') => (side === 'left' ? -4 : FIG_W + 4);

  return (
    <Card title="Body overview" actions={<span className="text-xs text-text-muted">Click a region or a label</span>}>
      {/* Wide screens: full-width body scan with labelled regions. */}
      <div className="hidden rounded-lg border border-white/10 bg-panel sm:block [background-image:linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] [background-size:24px_24px]">
        <svg
          viewBox={`${VB_X} -2.5 ${VB_W} ${FIG_H + 5}`}
          className="pixelated block h-auto w-full"
          shapeRendering="crispEdges"
          role="group"
          aria-label="Body regions"
        >
          {figure(true)}
          {REGIONS.map((r) => {
            const L = LABELS[r.id];
            const st = statusById[r.id];
            const active = r.id === selected;
            const x = labelX(L.side);
            const anchorEnd = L.side === 'left';
            return (
              <g key={r.id} className="body-label cursor-pointer outline-none" {...a11y(r)} shapeRendering="geometricPrecision">
                <polyline
                  points={`${x + (anchorEnd ? 0.6 : -0.6)},${L.y - 0.45} ${L.anchor[0]},${L.anchor[1]}`}
                  fill="none"
                  stroke={active ? '#F8FAFC' : '#94A3B8'}
                  strokeOpacity={active ? 0.8 : 0.35}
                  strokeWidth={0.08}
                />
                <circle cx={L.anchor[0]} cy={L.anchor[1]} r={0.22} fill={active ? '#F8FAFC' : '#94A3B8'} fillOpacity={active ? 0.9 : 0.5} />
                {/* generous invisible hit area */}
                <rect x={anchorEnd ? x - PAD + 2 : x - 0.5} y={L.y - 1.9} width={PAD - 1.5} height={3.6} fill="transparent" />
                <text
                  x={x}
                  y={L.y - 0.2}
                  textAnchor={anchorEnd ? 'end' : 'start'}
                  fontSize={1.45}
                  fontWeight={active ? 700 : 500}
                  fill={active ? '#F8FAFC' : '#CBD5E1'}
                  className="font-sans"
                >
                  {SHORT[r.id] ?? r.label}
                </text>
                <text x={x} y={L.y + 1.35} textAnchor={anchorEnd ? 'end' : 'start'} fontSize={1.15} fill={colorFor(st)} className="font-sans">
                  {iconFor(st)} {labelFor(st)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Phones: figure only, with tappable region chips underneath. */}
      <div className="sm:hidden">
        <div className="mx-auto max-w-[220px] rounded-lg border border-white/10 bg-panel p-2">
          <svg viewBox={`-1.5 -1.5 ${FIG_W + 3} ${FIG_H + 3}`} className="pixelated block h-auto w-full" shapeRendering="crispEdges" role="group" aria-label="Body regions">
            {figure(true)}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={select(r.id)}
              aria-pressed={r.id === selected}
              className={`rounded border px-2 py-1 text-xs ${r.id === selected ? 'border-cyan text-text-primary' : 'border-white/15 text-text-secondary'}`}
            >
              <span style={{ color: colorFor(statusById[r.id]) }}>{iconFor(statusById[r.id])}</span> {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-text-muted">
        Brighter = flagged · grey = no current data or not tracked · the dashed outline is whole-body radiation
      </p>

      {/* Details for the selected region, below the display. */}
      <div className="mt-4 border-t border-white/10 pt-4">
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
          <ul className="mt-3 grid gap-x-6 divide-y divide-white/5 text-sm md:grid-cols-2 md:divide-y-0">
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
                      <span className={isStale(m, l) ? 'text-review' : 'text-text-muted'}>
                        {isStale(m, l) ? 'not current · ' : ''}
                        {timeAgo(l.at, now)}
                      </span>
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
        <div className="grid gap-x-6 md:grid-cols-2">
          {sel.metrics.map((m) => <LearnMore key={m} metric={m} summary={`${METRICS[m].label}: why it matters in space`} />)}
        </div>
      </div>
    </Card>
  );
}
