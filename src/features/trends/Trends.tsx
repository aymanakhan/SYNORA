import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSynora } from '../../app/state';
import { Card, Pill, SourceBadge } from '../../components/ui';
import { colors, statusStyle } from '../../theme/tokens';
import { RANGE_RULES, componentValue, rangeStatus } from '../health/assessment';
import { METRICS } from '../health/metrics';
import type { AssessmentStatus, MetricId } from '../health/types';
import { DataContextBanner } from '../dashboard/DataContextBanner';
import { MISSION_START_MS } from '../simulation/scenarios';

interface Point {
  t: number;
  a?: number | null;
  b?: number | null;
  status?: AssessmentStatus;
  day?: number;
}

/**
 * Break the line where readings are much further apart than this metric's
 * usual interval (min 36 h), instead of drawing across a gap in the data.
 */
const MIN_GAP_MS = 36 * 3600_000;
const DAY = 86_400_000;

function withGaps(points: Point[]): Point[] {
  const intervals = points.slice(1).map((p, i) => p.t - points[i].t).sort((a, b) => a - b);
  const median = intervals.length ? intervals[Math.floor(intervals.length / 2)] : 0;
  const gap = Math.max(MIN_GAP_MS, median * 1.5);
  const out: Point[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev && p.t - prev.t > gap) out.push({ t: prev.t + (p.t - prev.t) / 2, a: null, b: null });
    out.push(p);
  });
  return out;
}

const CHARTS: { metric: MetricId; title: string }[] = [
  { metric: 'heartRate', title: 'Heart rate' },
  { metric: 'bloodPressure', title: 'Blood pressure' },
  { metric: 'bodyTemperature', title: 'Body temperature' },
  { metric: 'spo2', title: 'Blood oxygen (SpO₂)' },
  { metric: 'bloodGlucose', title: 'Blood glucose' },
  { metric: 'sleepDuration', title: 'Sleep duration' },
  { metric: 'stress', title: 'Stress (self-report)' },
  { metric: 'mood', title: 'Mood (self-report)' },
  { metric: 'radiationDose', title: 'Radiation dose (per reading period)' },
];

const RANGES = [
  { id: '7', label: '7 days', ms: 7 * DAY },
  { id: '14', label: '14 days', ms: 14 * DAY },
  { id: 'all', label: 'All', ms: Infinity },
] as const;

export function Trends() {
  const { measurements, checkIns, now, mode } = useSynora();
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('14');
  const since = now.getTime() - RANGES.find((r) => r.id === range)!.ms;

  const series = useMemo(() => {
    const map = new Map<MetricId, Point[]>();
    const push = (metric: MetricId, p: Point) => {
      if (p.t < since || p.t > now.getTime()) return;
      const list = map.get(metric) ?? [];
      list.push(p);
      map.set(metric, list);
    };
    for (const m of measurements) {
      const t = Date.parse(m.measuredAt);
      if (m.metric === 'bloodPressure') {
        const s = componentValue(m, 'systolic')!;
        const d = componentValue(m, 'diastolic')!;
        const st = worst(RANGE_RULES.filter((r) => r.metric === 'bloodPressure').map((r) => rangeStatus(r, r.component === 'systolic' ? s : d)));
        push('bloodPressure', { t, a: s, b: d, status: st, day: m.missionDay });
      } else if (typeof m.value === 'number') {
        const rule = RANGE_RULES.find((r) => r.metric === m.metric);
        push(m.metric, { t, a: m.value, status: rule ? rangeStatus(rule, m.value) : undefined, day: m.missionDay });
      }
    }
    for (const c of checkIns) {
      const t = Date.parse(c.submittedAt);
      if (c.sleepHours !== undefined) push('sleepDuration', { t, a: c.sleepHours, day: c.missionDay });
      if (c.stress !== undefined) push('stress', { t, a: c.stress, day: c.missionDay });
      if (c.mood !== undefined) push('mood', { t, a: c.mood, day: c.missionDay });
    }
    for (const [k, v] of map) map.set(k, withGaps(v.sort((x, y) => x.t - y.t)));
    return map;
  }, [measurements, checkIns, since, now]);

  return (
    <div className="space-y-4">
      <DataContextBanner />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Time range" className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
              className={`rounded border px-3 py-1 text-sm ${range === r.id ? 'border-cyan bg-cyan/15 text-cyan' : 'border-white/15 text-text-secondary'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Dashed lines = demonstration thresholds (not clinical). Gaps in the data are left blank, not joined.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {CHARTS.map((c) => (
          <MetricChart key={c.metric} metric={c.metric} title={c.title} data={series.get(c.metric) ?? []} simulated={mode === 'simulated'} />
        ))}
      </div>
    </div>
  );
}

function worst(list: (AssessmentStatus | undefined)[]): AssessmentStatus | undefined {
  if (list.includes('attention')) return 'attention';
  if (list.includes('review')) return 'review';
  return undefined;
}

function MetricChart({ metric, title, data, simulated }: { metric: MetricId; title: string; data: Point[]; simulated: boolean }) {
  const def = METRICS[metric];
  const unit = def.canonicalUnit.replace('scale 1–5', '/5');
  const rules = RANGE_RULES.filter((r) => r.metric === metric);
  const thresholds = rules.flatMap((r) => [r.review.highAtOrAbove, r.review.lowBelow].filter((x): x is number => x !== undefined));
  const real = data.filter((p) => p.a != null);
  const flagged = real.filter((p) => p.status).length;

  const fmtTick = (t: number) => {
    if (simulated) return `Day ${Math.floor((t - MISSION_START_MS) / DAY) + 1}`;
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const dot = (props: { cx?: number; cy?: number; payload?: Point; index?: number }) => {
    const { cx, cy, payload, index } = props;
    if (cx === undefined || cy === undefined || payload?.a == null) return <g key={index} />;
    const s = payload.status;
    if (!s) return <circle key={index} cx={cx} cy={cy} r={2.5} fill={colors.cyan} />;
    const c = statusStyle[s].color;
    // Shape as well as colour: square = review, diamond = attention.
    return s === 'attention' ? (
      <rect key={index} x={cx - 4} y={cy - 4} width={8} height={8} fill={c} transform={`rotate(45 ${cx} ${cy})`} />
    ) : (
      <rect key={index} x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={c} />
    );
  };

  return (
    <Card
      title={title}
      actions={
        <span className="flex items-center gap-1.5">
          {real.length > 0 && <SourceBadge source={simulated ? 'simulated' : 'manual'} />}
          {flagged > 0 && <Pill tone="review">{flagged} outside demo range</Pill>}
        </span>
      }
    >
      {real.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">No readings in this time range.</p>
      ) : (
        <div className="h-48" role="img" aria-label={`${title} chart with ${real.length} readings, ${flagged} outside demonstration range`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#ffffff12" />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick} stroke={colors.textMuted} fontSize={11} />
              <YAxis stroke={colors.textMuted} fontSize={11} domain={def.integer ? [1, 5] : ['auto', 'auto']} allowDecimals={!def.integer} width={48} tickFormatter={(v: number) => String(Number(v.toFixed(3)))} />
              <Tooltip
                contentStyle={{ background: colors.panel, border: '1px solid #ffffff22', fontSize: 12 }}
                labelFormatter={(t: number) => new Date(t).toLocaleString()}
                formatter={(v: number, n: string) => [`${v} ${unit}`, metric === 'bloodPressure' ? (n === 'a' ? 'Systolic' : 'Diastolic') : def.label]}
              />
              {thresholds.map((y) => (
                <ReferenceLine key={y} y={y} stroke={colors.review} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `demo ${y}`, fill: colors.textMuted, fontSize: 10, position: rules.some((r) => r.review.lowBelow === y) ? 'insideBottomLeft' : 'insideTopLeft' }} />
              ))}
              <Line dataKey="a" stroke={colors.cyan} strokeWidth={2} dot={dot} connectNulls={false} isAnimationActive={false} />
              {metric === 'bloodPressure' && <Line dataKey="b" stroke={colors.teal} strokeWidth={2} dot={dot} connectNulls={false} isAnimationActive={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-1 text-[11px] text-text-muted">
        {real.length} reading{real.length === 1 ? '' : 's'} · unit {unit}
        {metric === 'bloodPressure' && ' · cyan = systolic, teal = diastolic'}
        {flagged > 0 && ' · ■ review / ◆ attention (demonstration ranges)'}
      </p>
    </Card>
  );
}
