import { useSynora } from '../../app/state';
import { navigate } from '../../app/nav';
import { MISSION_DAYS, getScenario } from '../simulation/scenarios';

/** Always states which data is in view, so synthetic data is never mistaken for real. */
export function DataContextBanner() {
  const { mode, sim, setMode } = useSynora();
  if (mode === 'simulated') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple/40 bg-purple/10 px-4 py-2 text-sm">
        <p>
          <strong className="text-purple">Viewing SIMULATED mission data</strong>{' '}
          <span className="text-text-secondary">
            · {getScenario(sim.scenarioId)?.name} · <span className="font-pixel">DAY {sim.day}/{MISSION_DAYS}</span> · synthetic, not real astronaut data
          </span>
        </p>
        <div className="flex gap-3 text-xs">
          <button className="text-cyan underline" onClick={() => navigate('simulator')}>Change scenario/day</button>
          <button className="text-cyan underline" onClick={() => setMode('manual')}>Switch to my manual entries</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal/40 bg-teal/10 px-4 py-2 text-sm">
      <p>
        <strong className="text-teal">Viewing your MANUAL entries</strong>{' '}
        <span className="text-text-secondary">· values you typed in from instruments and check-ins</span>
      </p>
      <button className="text-xs text-cyan underline" onClick={() => setMode('simulated')}>Switch to simulated mission</button>
    </div>
  );
}
