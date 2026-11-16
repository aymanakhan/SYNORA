import { CheckInPage } from '../features/checkins/CheckInPage';
import { Dashboard } from '../features/dashboard/Dashboard';
import { LiveMonitoring } from '../features/monitoring/LiveMonitoring';
import { Onboarding } from '../features/pets/Onboarding';
import { PetPage } from '../features/pets/PetPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { MISSION_DAYS } from '../features/simulation/scenarios';
import { SimulatorPage } from '../features/simulation/SimulatorPage';
import { SummaryPage } from '../features/summary/SummaryPage';
import { Trends } from '../features/trends/Trends';
import { StatusBadge } from '../components/ui';
import { SECTIONS, navigate, useSection, type SectionId } from './nav';
import { StartupScreen } from './StartupScreen';
import { SynoraProvider, useSynora } from './state';

const SCREENS: Record<SectionId, () => JSX.Element | null> = {
  dashboard: Dashboard,
  live: LiveMonitoring,
  checkin: CheckInPage,
  trends: Trends,
  pet: PetPage,
  simulator: SimulatorPage,
  summary: SummaryPage,
  settings: SettingsPage,
};

export default function App() {
  return (
    <SynoraProvider>
      <Shell />
    </SynoraProvider>
  );
}

function Shell() {
  const section = useSection();
  const { ready, profile, mode, sim, assessment, storageWarning, replacedByNewerVersion } = useSynora();
  const Screen = SCREENS[section];
  const needsOnboarding = ready && profile && !profile.petSpecies;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:bg-cyan focus:px-3 focus:py-1 focus:text-space">
        Skip to content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-navy px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="font-pixel text-xl font-bold tracking-widest text-cyan">SYNORA</h1>
            <p className="text-xs text-text-muted">Your Health. Beyond Earth.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {assessment && !needsOnboarding && (
            <button onClick={() => navigate('dashboard')} title="Current monitoring result">
              <StatusBadge status={assessment.status} />
            </button>
          )}
          {mode === 'simulated' ? (
            <span className="rounded border border-purple/50 bg-purple/10 px-2 py-1 font-semibold text-purple">
              SIMULATED · <span className="font-pixel">DAY {sim.day}/{MISSION_DAYS}</span>
            </span>
          ) : (
            <span className="rounded border border-teal/50 bg-teal/10 px-2 py-1 font-semibold text-teal">MANUAL ENTRIES</span>
          )}
          <span className="rounded border border-review/60 bg-review/10 px-2 py-1 font-semibold text-review" role="status">
            ▲ DEMO MODE · Offline
          </span>
        </div>
      </header>

      <p className="border-b border-white/10 bg-panel px-4 py-2 text-xs text-text-secondary sm:px-6">
        Educational prototype, not a medical device. SYNORA does not diagnose or prescribe treatment. Demo data is synthetic.
        {storageWarning && <span className="ml-2 text-review">{storageWarning}</span>}
      </p>
      {replacedByNewerVersion && (
        <p className="flex flex-wrap items-center gap-2 border-b border-review/40 bg-review/10 px-4 py-2 text-sm text-review sm:px-6" role="alert">
          A newer version of SYNORA was opened in another tab. Reload this tab to keep saving changes.
          <button className="underline" onClick={() => window.location.reload()}>Reload now</button>
        </p>
      )}

      <div className="flex flex-1 flex-col md:flex-row">
        {!needsOnboarding && (
          <nav aria-label="Main" className="border-b border-white/10 bg-navy md:w-52 md:shrink-0 md:border-r md:border-b-0">
            <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#/${s.id}`}
                    aria-current={section === s.id ? 'page' : undefined}
                    className={`block w-full rounded px-3 py-2 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan ${
                      section === s.id ? 'bg-card text-cyan' : 'text-text-secondary hover:bg-panel hover:text-text-primary'
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {!ready ? (
            <StartupScreen />
          ) : needsOnboarding ? (
            <Onboarding onDone={() => navigate('dashboard')} />
          ) : (
            <>
              <h2 className="mb-4 text-lg font-semibold">{SECTIONS.find((s) => s.id === section)?.label}</h2>
              <Screen />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/** Original wordmark icon: a pixel planet with an orbit. */
function Logo() {
  const px: [number, number, string][] = [];
  const planet = ['..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..'];
  planet.forEach((row, y) => [...row].forEach((c, x) => c === 'x' && px.push([x + 4, y + 4, (x + y) % 5 === 0 ? '#2DD4BF' : '#38BDF8'])));
  return (
    <svg viewBox="0 0 16 16" width={36} height={36} shapeRendering="crispEdges" aria-hidden className="pixelated">
      {px.map(([x, y, c]) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c} />)}
      {[[1, 9], [2, 10], [3, 10], [12, 6], [13, 6], [14, 5], [2, 2], [13, 13]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill={i > 5 ? '#86EFAC' : '#A78BFA'} />
      ))}
    </svg>
  );
}
