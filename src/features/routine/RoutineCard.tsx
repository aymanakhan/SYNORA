import { navigate } from '../../app/nav';
import { useSynora } from '../../app/state';
import { Card } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { TREAT } from './routine';
import { useRoutine } from './useRoutine';

/** Today's measurement routine with reminders. Credit is for logging, never for the values. */
export function RoutineCard() {
  const { mode, profile } = useSynora();
  const r = useRoutine();
  const species = profile?.petSpecies ?? 'cat';
  const pet = profile?.petName ?? 'Your pet';
  const pct = Math.round((r.done / r.total) * 100);

  return (
    <Card
      title={mode === 'simulated' ? 'Today’s routine (simulated mission day)' : 'Today’s routine'}
      actions={
        <span className="font-pixel text-sm text-mint" aria-label={`${r.done} of ${r.total} tasks done`}>
          {'★'.repeat(r.done)}
          <span className="text-text-muted">{'☆'.repeat(r.total - r.done)}</span> {r.done}/{r.total}
        </span>
      }
    >
      <div className="mb-3 h-2 w-full overflow-hidden rounded bg-panel" role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done}>
        <div className="h-full bg-mint transition-all" style={{ width: `${pct}%` }} />
      </div>

      {r.complete ? (
        <p className="mb-2 text-sm text-stable">
          ✓ Routine complete! {pet} earned {TREAT[species].name} {TREAT[species].emoji}
          {r.streakDays > 1 && <> · {r.streakDays}-day streak</>}
        </p>
      ) : (
        <ul className="mb-2 space-y-1 text-sm">
          {r.tasks
            .filter((t) => !t.done)
            .map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-panel px-2 py-1.5">
                <span className="text-text-secondary">
                  <span aria-hidden className="mr-1 text-review">○</span>
                  {t.reminder}
                </span>
                {mode === 'manual' &&
                  (t.id === 'checkIn' ? (
                    <button className="text-xs text-cyan underline" onClick={() => navigate('checkin')}>Check in</button>
                  ) : (
                    <button className="text-xs text-cyan underline" onClick={() => navigate('live', { metric: t.id })}>Measure now</button>
                  ))}
              </li>
            ))}
        </ul>
      )}

      {r.done > 0 && (
        <p className="text-xs text-text-muted">
          Done today: {r.tasks.filter((t) => t.done).map((t) => `${t.label} (${formatDateTime(t.doneAt!)})`).join(' · ')}
        </p>
      )}
      <p className="mt-2 text-[11px] text-text-muted">
        {mode === 'simulated'
          ? 'In the simulation, the synthetic feed logs these automatically each mission day.'
          : `Each task logged earns ${pet} a star, whatever the value. Reporting a problem counts exactly the same.`}
        {r.streakDays > 0 && !r.complete && <> Current streak: {r.streakDays} day{r.streakDays === 1 ? '' : 's'}.</>}
      </p>
    </Card>
  );
}
