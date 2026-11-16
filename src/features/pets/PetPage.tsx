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
          <li><strong>Concerned</strong> whenever the monitoring result is review or attention, even if you give it commands. A cheerful pet never hides a flagged reading.</li>
          <li><strong>Tired</strong> when recent check-ins show short or poor sleep, low energy or high stress.</li>
          <li><strong>Commands</strong> (sit, stand, jump, pet) are just for fun. They never change readings, alerts or mood. For the axolotl, Stand is called <strong>Float</strong>.</li>
          <li>The axolotl floats, settles, bobs and wiggles its gills instead of standing, sitting or jumping; the action label says so.</li>
          <li><strong>Camera gestures</strong> (optional): point up to stand (float), point down to sit, make a fist to jump, and hold an open palm still to pet. The camera is off until you enable it, and video never leaves this device. Buttons and keys 1–4 always work.</li>
          <li><strong>Voice</strong> (optional): press <em>Push to talk</em> and say a command. It listens only after you press, for one phrase. Your browser's speech service may process the audio.</li>
        </ul>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setChanging(true)}>Change companion</Button>
        </div>
      </Card>
    </div>
  );
}
