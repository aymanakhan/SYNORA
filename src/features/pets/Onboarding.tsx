import { useState } from 'react';
import { defaultPetName, useSynora } from '../../app/state';
import { Button } from '../../components/ui';
import type { PetSpecies } from '../health/types';
import { PetSprite } from './PetSprite';
import { SPECIES_LABEL } from './sprites';

const BLURB: Record<PetSpecies, string> = {
  cat: 'A calm silver-gray cat.',
  dog: 'A loyal tan pup.',
  axolotl: 'A pink axolotl that loves zero-g.',
};

/** First run: explain Demo Mode and choose a companion. No account needed. */
export function Onboarding({ onDone }: { onDone?: () => void }) {
  const { savePet, profile } = useSynora();
  const [species, setSpecies] = useState<PetSpecies>(profile?.petSpecies ?? 'cat');
  const [name, setName] = useState(profile?.petName ?? '');

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div>
        <h2 className="font-pixel text-2xl tracking-widest text-cyan">WELCOME TO SYNORA</h2>
        <p className="mt-2 text-text-secondary">
          You're in <strong className="text-review">Demo Mode</strong>: everything runs offline in this browser for a fictional demo astronaut.
          No account is needed, and the demo uses synthetic data only. Please don't enter real medical records.
        </p>
      </div>
      <fieldset>
        <legend className="mb-3 font-semibold">Choose your companion</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['cat', 'dog', 'axolotl'] as PetSpecies[]).map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center focus-within:outline-2 focus-within:outline-cyan ${species === s ? 'border-mint bg-mint/10' : 'border-white/10 bg-card hover:border-white/30'}`}
            >
              <input type="radio" name="species" value={s} checked={species === s} onChange={() => setSpecies(s)} className="sr-only" />
              <PetSprite species={s} wellness="happy" size={112} label={`${SPECIES_LABEL[s]} sprite`} />
              <span className="font-pixel text-sm tracking-wider text-mint">{SPECIES_LABEL[s].toUpperCase()}</span>
              <span className="text-xs text-text-muted">{BLURB[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block max-w-sm text-sm">
        <span className="text-text-secondary">Name your companion</span>
        <input
          className="w-full rounded border border-white/15 bg-panel px-3 py-2"
          value={name}
          maxLength={20}
          placeholder={defaultPetName(species)}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button
        onClick={async () => {
          await savePet(species, name);
          onDone?.();
        }}
      >
        Start demo mission →
      </Button>
      <p className="text-xs text-text-muted">
        Your companion reacts to the same monitoring result as the dashboard. It's there for support and does not diagnose anything.
      </p>
    </div>
  );
}
