import { useCallback, useEffect, useRef, useState } from 'react';
import { useSynora } from '../../app/state';
import { Button, StatusBadge } from '../../components/ui';
import type { PetCommand } from '../health/types';
import { ACTION_DURATION_MS, COMMANDS, COMMAND_KEYS, acceptCommand, commandLabel, resolveCommand, type ResolvedAction } from './commands';
import { GestureControl } from '../pet-input/GestureControl';
import { VoiceControl } from '../pet-input/VoiceControl';
import { PetSprite } from './PetSprite';
import { TREAT } from '../routine/routine';
import { useRoutine } from '../routine/useRoutine';
import { playPetSound, useSoundPrefs } from './sound';
import { SPECIES_LABEL } from './sprites';
import { PET_MESSAGES, derivePetWellness } from './wellness';

const WELLNESS_LABEL = { happy: 'Happy', tired: 'Tired', concerned: 'Concerned', unknown: 'Waiting for data' } as const;

/** Pet companion. Wellness comes from the shared assessment; commands are animation only. */
export function PetPanel({ compact = false, withGestures = false }: { compact?: boolean; withGestures?: boolean }) {
  const { profile, assessment } = useSynora();
  const sound = useSoundPrefs();
  const routine = useRoutine();
  const [celebrating, setCelebrating] = useState(false);
  const [action, setAction] = useState<{ cmd: PetCommand; resolved: ResolvedAction }>();
  const lastAt = useRef<number>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const species = profile?.petSpecies ?? 'cat';
  const name = profile?.petName ?? 'Your pet';
  const wellness = derivePetWellness(assessment);

  const dispatch = useCallback(
    (cmd: PetCommand) => {
      const now = Date.now();
      if (!acceptCommand(lastAt.current, now)) return;
      lastAt.current = now;
      setAction({ cmd, resolved: resolveCommand(species, cmd) });
      if (sound.enabled) playPetSound(species, cmd, sound.volume);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAction(undefined), ACTION_DURATION_MS);
    },
    [species, sound.enabled, sound.volume],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // Celebrate once per day when the manual routine is complete: the next time
  // the pet is on screen. Cosmetic only; wellness is unchanged.
  const { mode } = useSynora();
  useEffect(() => {
    if (mode !== 'manual' || !routine.complete) return;
    const key = 'synora.celebrated.v1';
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      /* storage unavailable: celebrate anyway */
    }
    setCelebrating(true);
    setAction({ cmd: 'jump', resolved: resolveCommand(species, 'jump') });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAction(undefined);
      setCelebrating(false);
    }, 3000);
  }, [routine.complete, mode, species]);

  // Keyboard shortcuts 1–4 (ignored while typing in a form field).
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const cmd = COMMAND_KEYS[e.key];
      if (cmd) dispatch(cmd);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, compact]);

  if (!profile?.petSpecies) return null;

  return (
    <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col items-center gap-3 text-center'}`}>
      <div className="rounded-lg border border-white/10 bg-panel p-2 [background-image:radial-gradient(circle_at_30%_20%,#ffffff10_1px,transparent_1px)] [background-size:12px_12px]">
        <PetSprite
          species={species}
          wellness={wellness}
          animation={action?.resolved.animation}
          size={compact ? 72 : 168}
          label={`${name} the ${SPECIES_LABEL[species].toLowerCase()}, looking ${WELLNESS_LABEL[wellness].toLowerCase()}`}
        />
      </div>
      <div className={compact ? 'min-w-0' : ''}>
        <p className="font-pixel text-sm tracking-wider text-mint">{name.toUpperCase()}</p>
        <p className="text-sm">
          Feeling: <strong>{WELLNESS_LABEL[wellness]}</strong>
        </p>
        <p className={`text-sm text-text-secondary ${compact ? 'line-clamp-2' : 'max-w-xs'}`}>{PET_MESSAGES[wellness]}</p>
        <p className="mt-1 text-xs text-text-muted" aria-label={`Routine: ${routine.done} of ${routine.total} tasks logged today`}>
          <span className="font-pixel text-mint">{'★'.repeat(routine.done)}</span>
          <span className="font-pixel">{'☆'.repeat(routine.total - routine.done)}</span>
          {routine.complete ? (
            <span className="ml-1 text-stable">
              {TREAT[species].emoji} treat earned{routine.streakDays > 1 ? ` · ${routine.streakDays}-day streak` : ''}
            </span>
          ) : (
            <span className="ml-1">{routine.done}/{routine.total} logged today</span>
          )}
        </p>
        {celebrating && (
          <p className="text-sm text-stable" role="status">Routine complete! {name} got {TREAT[species].name} {TREAT[species].emoji}</p>
        )}
        {!compact && assessment && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-text-muted">
            Mood follows the monitoring result: <StatusBadge status={assessment.status} />
          </p>
        )}
      </div>

      {!compact && (
        <>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Pet commands">
            {COMMANDS.map((c, i) => (
              <Button key={c} variant="pixel" onClick={() => dispatch(c)} title={`Shortcut: ${i + 1}`}>
                {commandLabel(species, c)}
              </Button>
            ))}
          </div>
          <p className="min-h-5 text-xs text-text-muted" aria-live="polite">
            {action ? `${name} ${action.resolved.verb}.` : 'Tap a command or press keys 1–4.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-text-muted">
            <button
              onClick={() => sound.setEnabled(!sound.enabled)}
              aria-pressed={sound.enabled}
              className="rounded border border-white/15 px-2 py-1 hover:border-white/30"
            >
              {sound.enabled ? '🔊 Sound on' : '🔇 Sound off'}
            </button>
            <label className="flex items-center gap-1">
              Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={sound.volume}
                disabled={!sound.enabled}
                onChange={(e) => sound.setVolume(Number(e.target.value))}
                className="w-20 accent-cyan"
              />
            </label>
          </div>
          <p className="text-[11px] text-text-muted">Commands are just for fun. They never change your readings or status.</p>
          {withGestures && <GestureControl species={species} onCommand={(c) => dispatch(c)} />}
          {withGestures && <VoiceControl species={species} onCommand={(c) => dispatch(c)} />}
        </>
      )}
    </div>
  );
}
