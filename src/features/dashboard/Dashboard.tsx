import { navigate } from '../../app/nav';
import { useSynora } from '../../app/state';
import { Button, Card } from '../../components/ui';
import { METRICS } from '../health/metrics';
import { PetPanel } from '../pets/PetPanel';
import { AssessmentPanel } from './AssessmentPanel';
import { DataContextBanner } from './DataContextBanner';
import { MetricCards } from './MetricCards';

export function Dashboard() {
  const { assessment, mode } = useSynora();
  const due = assessment?.missingData ?? [];

  return (
    <div className="space-y-4">
      <DataContextBanner />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <AssessmentPanel />
          {due.length > 0 && (
            <Card title="Due for measurement">
              <p className="mb-2 text-sm text-text-secondary">
                No current reading for: <strong>{due.map((m) => METRICS[m].label).join(', ')}</strong>.
              </p>
              {mode === 'manual' ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate('live')}>Enter a measurement</Button>
                  <Button variant="secondary" onClick={() => navigate('checkin')}>Daily check-in</Button>
                </div>
              ) : (
                <p className="text-xs text-text-muted">In the simulation, the synthetic feed supplies readings each mission day.</p>
              )}
            </Card>
          )}
          <MetricCards />
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Companion">
            <PetPanel />
          </Card>
        </aside>
      </div>
    </div>
  );
}
