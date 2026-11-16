import { Card } from '../../components/ui';
import { BodyMap } from '../body/BodyMap';
import { RoutineCard } from '../routine/RoutineCard';
import { PetPanel } from '../pets/PetPanel';
import { AssessmentPanel } from './AssessmentPanel';
import { DataContextBanner } from './DataContextBanner';
import { MetricCards } from './MetricCards';

export function Dashboard() {
  return (
    <div className="space-y-4">
      <DataContextBanner />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <AssessmentPanel />
          <RoutineCard />
          <BodyMap />
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
