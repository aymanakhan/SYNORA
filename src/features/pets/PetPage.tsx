import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { Onboarding } from './Onboarding';
import { PetPanel } from './PetPanel';

export function PetPage() {
  const [changing, setChanging] = useState(false);
  if (changing) return <Onboarding onDone={() => setChanging(false)} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card title="Your companion">
        <PetPanel withGestures />
      </Card>
      <Card title="How your companion works">
        <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
          <li><strong>Mood</strong> (happy, tired, concerned, waiting for data) comes only from SYNORA's monitoring result and your check-ins.</li>
          <li><strong>Concerned</strong> whenever the monitoring result is review or attention, even if you play with it. A cheerful pet never hides a flagged reading.</li>
          <li><strong>Tired</strong> when recent check-ins show short or poor sleep, low energy or high stress.</li>
          <li><strong>Commands</strong> (sit, stand, jump, pet, play, float) are just for fun. They never change readings, alerts or mood.</li>
          <li>The axolotl drifts and wiggles its gills instead of sitting or standing; the action label says so.</li>
          <li><strong>Camera gestures</strong> (optional): open palm, pointing up or a fist. The camera is off until you enable it, and video never leaves this device. Buttons and keys 1–6 always work.</li>
        </ul>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setChanging(true)}>Change companion</Button>
        </div>
      </Card>
    </div>
  );
}
