import { useEffect, useState } from 'react';
import { hashParam, navigate } from '../../app/nav';
import { isMetricId } from '../health/metrics';
import { useSynora } from '../../app/state';
import { Button, Card, Pill, SourceBadge } from '../../components/ui';
import { formatDateTime, formatUnit, formatValue, timeAgo } from '../../lib/format';
import { METRICS } from '../health/metrics';
import type { Measurement, MetricId } from '../health/types';
import { MISSION_DAYS, SCENARIOS, type ScenarioId } from '../simulation/scenarios';
import { ManualEntryForm } from './ManualEntryForm';

type Source = 'simulated' | 'manual' | 'device';

const SOURCES: { id: Source; title: string; subtitle: string }[] = [
  { id: 'simulated', title: 'Simulated Sensor Feed', subtitle: 'Synthetic mission data for demos' },
  { id: 'manual', title: 'Manual Measurement', subtitle: 'Type in values from your instruments' },
  { id: 'device', title: 'Connected Monitoring Device', subtitle: 'Future / Not connected' },
];

export function LiveMonitoring() {
  const { mode, setMode } = useSynora();
  // A reminder can link here with ?metric=… to open the manual form on that measurement.
  const requested = hashParam('metric');
  const initialMetric = requested && isMetricId(requested) ? requested : undefined;
  const [source, setSource] = useState<Source>(initialMetric ? 'manual' : mode);
  useEffect(() => {
    if (initialMetric && mode !== 'manual') setMode('manual');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMetric]);

  const choose = (s: Source) => {
    setSource(s);
    if (s !== 'device') setMode(s);
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Data source" className="grid gap-3 md:grid-cols-3">
        {SOURCES.map((s) => {
          const active = source === s.id;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={active}
              onClick={() => choose(s.id)}
              className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan ${
                active ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-card hover:border-white/30'
              } ${s.id === 'device' ? 'border-dashed' : ''}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden className={active ? 'text-cyan' : 'text-text-muted'}>{active ? '◉' : '○'}</span>
                {s.title}
              </span>
              <span className={`mt-1 block text-xs ${s.id === 'device' ? 'text-review' : 'text-text-muted'}`}>{s.subtitle}</span>
            </button>
          );
        })}
      </div>

      {source === 'simulated' && <SimulatedFeed />}
      {source === 'manual' && <ManualPanel initialMetric={initialMetric} />}
      {source === 'device' && <DevicePanel />}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate('dashboard')}>View dashboard</Button>
        <Button variant="secondary" onClick={() => navigate('trends')}>View trends</Button>
      </div>
    </div>
  );
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-1.5 text-sm last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function SimulatedFeed() {
  const { sim, setScenario, setDay, setPlaying, setSpeed, measurements, now, lastUpdate, displayUnits } = useSynora();
  const today = measurements.filter((m) => m.missionDay === sim.day);
  const last = measurements[measurements.length - 1];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Simulated sensor feed" actions={<SourceBadge source="simulated" />}>
        <p className="mb-3 rounded border border-purple/40 bg-purple/10 p-2 text-xs text-text-secondary">
          These readings are <strong>generated</strong> for a fictional 180-day Mars mission. They are not real astronaut measurements and no sensor is connected.
        </p>
        <StatusRow label="Mode">Simulated (synthetic)</StatusRow>
        <StatusRow label="Feed status">
          {sim.playing ? <span className="text-stable">▶ Playing</span> : <span className="text-text-secondary">❚❚ Paused</span>}
        </StatusRow>
        <StatusRow label="Mission day"><span className="font-pixel">{sim.day} / {MISSION_DAYS}</span></StatusRow>
        <StatusRow label="Last reading">{last ? `${formatDateTime(last.measuredAt)} (mission clock) · ${timeAgo(last.measuredAt, now)}` : '—'}</StatusRow>
        <StatusRow label="Provenance">Simulated sensor feed · scenario “{SCENARIOS.find((s) => s.id === sim.scenarioId)?.name}”</StatusRow>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-text-secondary">Scenario</span>
            <select
              className="w-full rounded border border-white/15 bg-panel px-3 py-2 text-sm"
              value={sim.scenarioId}
              onChange={(e) => setScenario(e.target.value as ScenarioId)}
            >
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setPlaying(!sim.playing)} ariaPressed={sim.playing} disabled={sim.day >= MISSION_DAYS && !sim.playing}>
              {sim.playing ? '❚❚ Pause feed' : '▶ Start feed'}
            </Button>
            <Button variant="secondary" onClick={() => setDay(sim.day + 1)} disabled={sim.day >= MISSION_DAYS || sim.playing}>
              Next day →
            </Button>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Speed
              <select className="rounded border border-white/15 bg-panel px-2 py-1" value={sim.speedMs} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={3000}>1 day / 3 s</option>
                <option value={1500}>1 day / 1.5 s</option>
                <option value={700}>1 day / 0.7 s</option>
              </select>
            </label>
          </div>
          {lastUpdate && <p className="text-xs text-text-muted" aria-live="polite">{lastUpdate.label}</p>}
        </div>
      </Card>

      <Card title={`Readings received · day ${sim.day}`}>
        {today.length === 0 ? (
          <p className="text-sm text-text-muted">No readings for this day yet.</p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {today.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>{METRICS[m.metric].label}</span>
                <span className="flex items-center gap-2">
                  <strong className="tabular-nums">{formatValue(m, displayUnits)}</strong>
                  <span className="text-text-muted">{formatUnit(m, displayUnits)}</span>
                  <SourceBadge source={m.source} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ManualPanel({ initialMetric }: { initialMetric?: MetricId }) {
  const { measurements, now, lastUpdate, deleteMeasurement, displayUnits } = useSynora();
  const [editing, setEditing] = useState<Measurement>();
  const recent = [...measurements].reverse().filter((m) => m.source === 'manual').slice(0, 10);

  async function onDelete(m: Measurement) {
    const label = `${METRICS[m.metric].label} ${formatValue(m, displayUnits)} ${formatUnit(m, displayUnits)} (${formatDateTime(m.measuredAt)})`;
    if (!window.confirm(`Delete ${label}? Other readings and check-ins are not affected.`)) return;
    await deleteMeasurement(m.id);
    if (editing?.id === m.id) setEditing(undefined);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card
        title={editing ? `Correcting ${METRICS[editing.metric].label.toLowerCase()} · ${formatDateTime(editing.measuredAt)}` : 'Manual measurement'}
        actions={<SourceBadge source="manual" />}
      >
        {/* key resets the form when switching between new entry and editing */}
        <ManualEntryForm key={editing?.id ?? `new-${initialMetric ?? ''}`} editing={editing} initialMetric={initialMetric} onDone={() => setEditing(undefined)} />
      </Card>
      <Card title="Recent manual entries">
        <StatusRow label="Mode">Manual entry</StatusRow>
        <StatusRow label="Connection">No sensor needed: values are typed in</StatusRow>
        <StatusRow label="Last reading">{recent[0] ? `${formatDateTime(recent[0].measuredAt)} · ${timeAgo(recent[0].measuredAt, now)}` : '—'}</StatusRow>
        {lastUpdate?.kind === 'measurement' && <p className="mt-1 text-xs text-stable">{lastUpdate.label}</p>}
        <ul className="mt-3 divide-y divide-white/5 text-sm">
          {recent.length === 0 && <li className="py-2 text-text-muted">No manual entries yet.</li>}
          {recent.map((m) => (
            <li key={m.id} className={`py-1.5 ${editing?.id === m.id ? 'rounded bg-cyan/5 px-2' : ''}`}>
              <div className="flex justify-between gap-2">
                <span>{METRICS[m.metric].label}</span>
                <span className="tabular-nums">
                  <strong>{formatValue(m, displayUnits)}</strong> <span className="text-text-muted">{formatUnit(m, displayUnits)}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-text-muted">
                <span>{formatDateTime(m.measuredAt)}</span>
                {m.deviceOrMethod && <span>· {m.deviceOrMethod}</span>}
                {m.original && typeof m.original.value === 'number' && <span>· entered as {m.original.value} {m.original.unit}</span>}
                {m.qualityStatus === 'suspect' && <Pill tone="review">Re-measure suggested</Pill>}
                {m.editedAt && <Pill>edited</Pill>}
              </div>
              <div className="mt-0.5 flex gap-3 text-xs">
                <button className="text-cyan underline" onClick={() => setEditing(m)} aria-label={`Edit ${METRICS[m.metric].label} from ${formatDateTime(m.measuredAt)}`}>
                  Edit
                </button>
                <button className="text-attention underline" onClick={() => onDelete(m)} aria-label={`Delete ${METRICS[m.metric].label} from ${formatDateTime(m.measuredAt)}`}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function DevicePanel() {
  return (
    <Card title="Connected monitoring device" actions={<Pill tone="review">Future / Stretch</Pill>}>
      <StatusRow label="Connection status"><span className="text-text-muted">○ Not connected</span></StatusRow>
      <StatusRow label="Supported devices">None yet</StatusRow>
      <div className="mt-3 space-y-2 text-sm text-text-secondary">
        <p>SYNORA cannot connect to a device yet, and it will not pretend to. Use <strong>Manual Measurement</strong> to enter readings from your instruments, or the <strong>Simulated Sensor Feed</strong> for a demo.</p>
        <p>Planned: an adapter for Bluetooth Low Energy health devices, file imports, and authorized health-data APIs. All of them would feed the same validation and assessment pipeline.</p>
        <p className="text-xs text-text-muted">Note: consumer wearables do not measure every indicator (radiation dose needs a dosimeter, for example), and they are not validated for spaceflight.</p>
      </div>
    </Card>
  );
}
