import { useState, type FormEvent } from 'react';
import { useSynora } from '../../app/state';
import { Button, Card, SourceBadge } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import type { CheckInError } from '../../services/ingestion/validateCheckIn';
import { DataContextBanner } from '../dashboard/DataContextBanner';

const inputCls = 'w-full rounded border border-white/15 bg-panel px-3 py-2 text-sm';
const SCALES = [
  { key: 'sleepQuality', label: 'Sleep quality', low: 'poor', high: 'great' },
  { key: 'mood', label: 'Mood', low: 'low', high: 'great' },
  { key: 'stress', label: 'Stress', low: 'calm', high: 'very stressed' },
  { key: 'energy', label: 'Energy', low: 'drained', high: 'energetic' },
] as const;
type ScaleKey = (typeof SCALES)[number]['key'];

export function CheckInPage() {
  const { mode, setMode, submitCheckIn, checkIns } = useSynora();
  const [sleepHours, setSleepHours] = useState('');
  const [scales, setScales] = useState<Partial<Record<ScaleKey, number>>>({});
  const [symptoms, setSymptoms] = useState('');
  const [exercise, setExercise] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<CheckInError[]>([]);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const r = await submitCheckIn({
      submittedAt: new Date().toISOString(),
      sleepHours: sleepHours || undefined,
      exerciseMinutes: exercise || undefined,
      ...scales,
      symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes || undefined,
    });
    if (r.status === 'rejected') return setErrors(r.errors);
    setErrors([]);
    setSaved(true);
    setSleepHours('');
    setScales({});
    setSymptoms('');
    setExercise('');
    setNotes('');
  }

  const history = [...checkIns].reverse().slice(0, 10);

  return (
    <div className="space-y-4">
      <DataContextBanner />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="Daily check-in" actions={<span className="text-xs text-text-muted">About 1 minute · every field optional</span>}>
          {mode === 'simulated' ? (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>You're viewing the simulated mission, where check-ins are generated automatically. Your own check-ins are kept separately from synthetic data.</p>
              <Button onClick={() => setMode('manual')}>Switch to my manual entries to check in</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-text-secondary">Hours slept last night</span>
                  <input className={inputCls} inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="e.g. 7.5" />
                </label>
                <label className="block text-sm">
                  <span className="text-text-secondary">Exercise today (minutes)</span>
                  <input className={inputCls} inputMode="numeric" value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="e.g. 120" />
                </label>
              </div>
              {SCALES.map((s) => (
                <fieldset key={s.key} className="text-sm">
                  <legend className="text-text-secondary">
                    {s.label} <span className="text-xs text-text-muted">(1 = {s.low}, 5 = {s.high})</span>
                  </legend>
                  <div className="mt-1 flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className={`cursor-pointer rounded border px-3 py-1.5 ${scales[s.key] === n ? 'border-cyan bg-cyan/15 text-cyan' : 'border-white/15'}`}>
                        <input type="radio" className="sr-only" name={s.key} checked={scales[s.key] === n} onChange={() => setScales((x) => ({ ...x, [s.key]: n }))} />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <label className="block text-sm">
                <span className="text-text-secondary">Any symptoms? (comma-separated)</span>
                <input className={inputCls} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. headache, congestion" />
                <span className="text-xs text-text-muted">Reporting symptoms is always a good thing, never a failure.</span>
              </label>
              <label className="block text-sm">
                <span className="text-text-secondary">Notes</span>
                <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
              </label>
              {errors.length > 0 && (
                <ul role="alert" className="text-xs text-attention">
                  {errors.map((er) => <li key={er.field + er.message}>{er.field}: {er.message}</li>)}
                </ul>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit">Save check-in</Button>
                <span aria-live="polite" className="text-sm text-stable">{saved ? 'Check-in saved. Thank you!' : ''}</span>
              </div>
            </form>
          )}
        </Card>

        <Card title="Check-in history">
          {history.length === 0 ? (
            <p className="text-sm text-text-muted">No check-ins yet.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {history.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-text-secondary">{c.missionDay ? `Mission day ${c.missionDay}` : formatDateTime(c.submittedAt)}</span>
                    <SourceBadge source={c.isSynthetic ? 'simulated' : 'manual'} />
                  </div>
                  <p className="text-xs text-text-muted">
                    {[
                      c.sleepHours !== undefined && `sleep ${c.sleepHours} h`,
                      c.sleepQuality && `quality ${c.sleepQuality}/5`,
                      c.mood && `mood ${c.mood}/5`,
                      c.stress && `stress ${c.stress}/5`,
                      c.energy && `energy ${c.energy}/5`,
                      c.symptoms.length > 0 && `symptoms: ${c.symptoms.join(', ')}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No values'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
