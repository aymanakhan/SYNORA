import { useMemo } from 'react';
import { navigate } from '../../app/nav';
import { useSynora } from '../../app/state';
import { Button, Card, StatusBadge } from '../../components/ui';
import { statusStyle } from '../../theme/tokens';
import { PetPanel } from '../pets/PetPanel';
import { MISSION_DAYS, SCENARIOS } from './scenarios';
import { scenarioTimeline } from './timeline';

export function SimulatorPage() {
  const { sim, setScenario, setDay, setPlaying, mode, setMode, assessment } = useSynora();
  const scenario = SCENARIOS.find((s) => s.id === sim.scenarioId)!;
  const timeline = useMemo(() => scenarioTimeline(sim.scenarioId), [sim.scenarioId]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple/40 bg-purple/10 px-4 py-2 text-sm text-text-secondary">
        <strong className="text-purple">Fictional 180-day Mars mission.</strong> All data here is synthetic and generated deterministically.
        It is not a forecast of real astronaut physiology. It runs through the same validation, storage and assessment code as manual entries.
      </div>
      {mode !== 'simulated' && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-review/40 bg-review/10 px-4 py-2 text-sm">
          The dashboard is currently showing your manual entries.
          <Button onClick={() => setMode('simulated')}>Show simulated mission on dashboard</Button>
        </div>
      )}

      <Card title="Scenario">
        <div role="radiogroup" aria-label="Scenario" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={s.id === sim.scenarioId}
              onClick={() => setScenario(s.id)}
              className={`rounded border p-3 text-left text-sm ${s.id === sim.scenarioId ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-panel hover:border-white/30'}`}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="mt-1 block text-xs text-text-muted">{s.description}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card
          title="Mission timeline"
          actions={<span className="font-pixel text-sm text-mint">DAY {String(sim.day).padStart(3, '0')} / {MISSION_DAYS}</span>}
        >
          <div className="flex h-8 w-full overflow-hidden rounded border border-white/10" aria-hidden>
            {timeline.map((st, i) => (
              <button
                key={i}
                tabIndex={-1}
                onClick={() => setDay(i + 1)}
                className="h-full flex-1"
                style={{
                  backgroundColor: st === 'stable' ? `${statusStyle.stable.color}55` : statusStyle[st].color,
                  outline: i + 1 === sim.day ? '2px solid #F8FAFC' : undefined,
                  outlineOffset: -2,
                }}
                title={`Day ${i + 1}: ${statusStyle[st].label}`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Preview of the monitoring result for every day ({statusStyle.stable.icon} stable · {statusStyle.review.icon} review · {statusStyle.attention.icon} attention), computed with the same engine.
          </p>

          <label className="mt-4 block text-sm">
            <span className="text-text-secondary">Mission day</span>
            <input
              type="range"
              min={1}
              max={MISSION_DAYS}
              value={sim.day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full accent-cyan"
              aria-valuetext={`Day ${sim.day}: ${statusStyle[timeline[sim.day - 1]].label}`}
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setDay(sim.day - 1)} disabled={sim.day <= 1}>← Day</Button>
            <Button variant="secondary" onClick={() => setDay(sim.day + 1)} disabled={sim.day >= MISSION_DAYS}>Day →</Button>
            <Button onClick={() => setPlaying(!sim.playing)} ariaPressed={sim.playing}>{sim.playing ? '❚❚ Pause' : '▶ Play mission'}</Button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-text-muted uppercase">Key days for “{scenario.name}”</p>
            <div className="flex flex-wrap gap-2">
              {scenario.keyDays.map((k) => (
                <Button key={k.day} variant="pixel" onClick={() => setDay(k.day)} ariaPressed={sim.day === k.day}>
                  D{k.day} · {k.label}
                </Button>
              ))}
            </div>
          </div>

          {assessment && mode === 'simulated' && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded border border-white/10 bg-panel p-3 text-sm">
              <span className="text-text-muted">Day {sim.day} result:</span>
              <StatusBadge status={assessment.status} />
              <span className="min-w-0 flex-1 text-text-secondary">
                {assessment.findings.length > 0 ? assessment.findings.map((f) => f.explanation).join(' ') : assessment.explanation}
              </span>
              <Button variant="secondary" onClick={() => navigate('dashboard')}>Open dashboard</Button>
            </div>
          )}
        </Card>
        <Card title="Companion">
          <PetPanel />
        </Card>
      </div>
    </div>
  );
}
