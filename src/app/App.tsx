import { useState } from 'react';

const NAV = [
  'Dashboard',
  'Live Monitoring',
  'Check-In',
  'Trends',
  'Pet',
  'Mission Simulator',
  'Summary',
  'Settings',
] as const;

type Section = (typeof NAV)[number];

/**
 * App shell only. Feature screens are built in later tasks; each nav item
 * shows an honest "not built yet" placeholder until then.
 */
export default function App() {
  const [section, setSection] = useState<Section>('Dashboard');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-navy px-4 py-3 sm:px-6">
        <div>
          <h1 className="font-pixel text-xl font-bold tracking-widest text-cyan">SYNORA</h1>
          <p className="text-xs text-text-muted">Your Health. Beyond Earth.</p>
        </div>
        <span
          className="rounded border border-review/60 bg-review/10 px-2 py-1 text-xs font-semibold text-review"
          role="status"
        >
          ▲ DEMO MODE · Offline · Synthetic data only
        </span>
      </header>

      <p className="border-b border-white/10 bg-panel px-4 py-2 text-xs text-text-secondary sm:px-6">
        Educational prototype — not a medical device. SYNORA does not diagnose or prescribe treatment.
      </p>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label="Main" className="border-b border-white/10 bg-navy md:w-52 md:border-r md:border-b-0">
          <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col">
            {NAV.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => setSection(item)}
                  aria-current={section === item ? 'page' : undefined}
                  className={`w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-cyan ${
                    section === item
                      ? 'bg-card text-cyan'
                      : 'text-text-secondary hover:bg-panel hover:text-text-primary'
                  }`}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">{section}</h2>
          <div className="rounded-lg border border-white/10 bg-card p-6 text-text-secondary">
            <p>This screen is not built yet.</p>
            <p className="mt-2 text-sm text-text-muted">
              The shared data contract and measurement validation are in place; feature screens follow in the next tasks.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
