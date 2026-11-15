import { useState } from 'react';
import { navigate } from '../../app/nav';
import { useSynora } from '../../app/state';
import { Button, Card } from '../../components/ui';
import { RULE_DEFINITIONS } from '../health/assessment';
import { SOURCES } from '../health/knowledge';

export function SettingsPage() {
  const { resetData, storageWarning, profile } = useSynora();
  const [done, setDone] = useState<string>();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Profile and data">
        <p className="text-sm text-text-secondary">
          Profile: <strong>{profile?.displayName}</strong> (local demo profile, stored only in this browser).
        </p>
        {storageWarning && <p className="mt-2 text-sm text-review">{storageWarning}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('pet')}>Change companion</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!confirm('Delete all of your manual entries and check-ins in this browser?')) return;
              await resetData('manual');
              setDone('Manual entries deleted.');
            }}
          >
            Delete manual entries
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await resetData('simulated');
              setDone('Simulation regenerated.');
            }}
          >
            Regenerate simulation
          </Button>
        </div>
        <p aria-live="polite" className="mt-2 text-sm text-stable">{done}</p>
        <p className="mt-4 text-xs text-text-muted">
          Accounts (Auth0) are planned for a later phase. Demo records will never be merged into a real account automatically.
        </p>
      </Card>

      <Card title="About SYNORA">
        <div className="space-y-2 text-sm text-text-secondary">
          <p>An educational prototype for the NASA Space Apps Challenge 2026. It is <strong>not a medical device</strong> and does not diagnose or prescribe treatment.</p>
          <p>Motion follows your system's reduced-motion setting. There is no sound yet.</p>
          <p>All {RULE_DEFINITIONS.length} monitoring rules use <strong>demonstration-only</strong> thresholds and are not clinically validated:</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {RULE_DEFINITIONS.map((r) => (
              <li key={r.id}>
                <strong>{r.id}</strong>: {r.description}
              </li>
            ))}
          </ul>
          <p className="pt-2">Sources for the “why it matters in space” explanations (read by the team; they do not provide SYNORA’s thresholds):</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {Object.values(SOURCES).map((s) => (
              <li key={s.id}>
                <a className="text-cyan underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.publisher}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
