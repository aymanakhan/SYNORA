import { useMemo, useState, type FormEvent } from 'react';
import { useSynora } from '../../app/state';
import { Button, Card, Pill, SourceBadge } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import type { CheckIn } from '../health/types';
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

interface FormState {
  sleepHours: string;
  scales: Partial<Record<ScaleKey, number>>;
  symptoms: string;
  exercise: string;
  notes: string;
}

const EMPTY: FormState = { sleepHours: '', scales: {}, symptoms: '', exercise: '', notes: '' };

function fromCheckIn(c: CheckIn): FormState {
  return {
    sleepHours: c.sleepHours?.toString() ?? '',
    scales: { sleepQuality: c.sleepQuality, mood: c.mood, stress: c.stress, energy: c.energy },
    symptoms: c.symptoms.join(', '),
    exercise: c.exerciseMinutes?.toString() ?? '',
    notes: c.notes ?? '',
  };
}

const sameLocalDay = (a: string, b: Date) => new Date(a).toDateString() === b.toDateString();

export function CheckInPage() {
  const { mode, submitCheckIn, editCheckIn, deleteCheckIn, checkIns } = useSynora();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<CheckIn>();
  const [errors, setErrors] = useState<CheckInError[]>([]);
  const [message, setMessage] = useState<string>();

  const todays = useMemo(
    () => (mode === 'manual' ? [...checkIns].reverse().find((c) => !c.isSynthetic && sameLocalDay(c.submittedAt, new Date())) : undefined),
    [checkIns, mode],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function startEdit(c: CheckIn) {
    setEditing(c);
    setForm(fromCheckIn(c));
    setErrors([]);
    setMessage(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(undefined);
    setForm(EMPTY);
    setErrors([]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(undefined);
    const values = {
      sleepHours: form.sleepHours || undefined,
      exerciseMinutes: form.exercise || undefined,
      ...form.scales,
      symptoms: form.symptoms.split(',').map((s) => s.trim()).filter(Boolean),
      notes: form.notes || undefined,
    };
    const r = editing
      ? await editCheckIn(editing.id, values)
      : await submitCheckIn({ submittedAt: new Date().toISOString(), ...values });
    if (r.status === 'rejected') return setErrors(r.errors);
    setErrors([]);
    setMessage(editing ? 'Check-in updated.' : r.replaced ? "Today's check-in updated. Thank you!" : 'Check-in saved. Thank you!');
    setEditing(undefined);
    setForm(EMPTY);
  }

  async function onDelete(c: CheckIn) {
    const when = formatDateTime(c.submittedAt);
    if (!window.confirm(`Delete the check-in from ${when}? Other check-ins and readings are not affected.`)) return;
    if (await deleteCheckIn(c.id)) {
      if (editing?.id === c.id) cancelEdit();
      setMessage(`Check-in from ${when} deleted.`);
    }
  }

  const history = [...checkIns].reverse().slice(0, 14);

  return (
    <div className="space-y-4">
      <DataContextBanner />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card
          title={editing ? `Editing check-in · ${formatDateTime(editing.submittedAt)}` : 'Daily check-in'}
          actions={<span className="text-xs text-text-muted">About 1 minute · every field optional</span>}
        >
          {mode === 'simulated' && !editing && (
            <p className="mb-3 rounded border border-teal/40 bg-teal/10 p-2 text-xs text-text-secondary">
              You're viewing the simulated mission. Saving a check-in stores it with your own manual entries and switches the dashboard to them.
            </p>
          )}
          {!editing && todays && (
            <p className="mb-3 flex flex-wrap items-center gap-2 rounded border border-cyan/30 bg-cyan/5 p-2 text-xs text-text-secondary">
              You already checked in today. Saving again updates today's entry (one check-in per day).
              <button className="text-cyan underline" onClick={() => startEdit(todays)}>Load today's answers</button>
            </p>
          )}
          {editing && (
            <p className="mb-3 text-xs text-text-muted">The check-in keeps its original date. Only the values change.</p>
          )}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-text-secondary">Hours slept last night</span>
                <input className={inputCls} inputMode="decimal" value={form.sleepHours} onChange={(e) => set('sleepHours', e.target.value)} placeholder="e.g. 7.5" />
              </label>
              <label className="block text-sm">
                <span className="text-text-secondary">Exercise today (minutes)</span>
                <input className={inputCls} inputMode="numeric" value={form.exercise} onChange={(e) => set('exercise', e.target.value)} placeholder="e.g. 120" />
              </label>
            </div>
            {SCALES.map((s) => (
              <fieldset key={s.key} className="text-sm">
                <legend className="text-text-secondary">
                  {s.label} <span className="text-xs text-text-muted">(1 = {s.low}, 5 = {s.high})</span>
                </legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className={`cursor-pointer rounded border px-3 py-1.5 ${form.scales[s.key] === n ? 'border-cyan bg-cyan/15 text-cyan' : 'border-white/15'}`}>
                      <input type="radio" className="sr-only" name={s.key} checked={form.scales[s.key] === n} onChange={() => set('scales', { ...form.scales, [s.key]: n })} />
                      {n}
                    </label>
                  ))}
                  {form.scales[s.key] !== undefined && (
                    <button type="button" className="text-xs text-text-muted underline" onClick={() => set('scales', { ...form.scales, [s.key]: undefined })}>
                      clear
                    </button>
                  )}
                </div>
              </fieldset>
            ))}
            <label className="block text-sm">
              <span className="text-text-secondary">Any symptoms? (comma-separated)</span>
              <input className={inputCls} value={form.symptoms} onChange={(e) => set('symptoms', e.target.value)} placeholder="e.g. headache, congestion" />
              <span className="text-xs text-text-muted">Reporting symptoms is always a good thing, never a failure.</span>
            </label>
            <label className="block text-sm">
              <span className="text-text-secondary">Notes</span>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
            </label>
            {errors.length > 0 && (
              <ul role="alert" className="text-xs text-attention">
                {errors.map((er) => <li key={er.field + er.message}>{er.field}: {er.message}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">{editing ? 'Save changes' : todays ? "Update today's check-in" : 'Save check-in'}</Button>
              {editing && <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>}
              <span aria-live="polite" className="text-sm text-stable">{message}</span>
            </div>
          </form>
        </Card>

        <Card title="Check-in history">
          {history.length === 0 ? (
            <p className="text-sm text-text-muted">No check-ins yet.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {history.map((c) => (
                <li key={c.id} className={`py-2 ${editing?.id === c.id ? 'rounded bg-cyan/5 px-2' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-text-secondary">{c.missionDay ? `Mission day ${c.missionDay}` : formatDateTime(c.submittedAt)}</span>
                    <span className="flex items-center gap-1.5">
                      {c.editedAt && <Pill>edited</Pill>}
                      <SourceBadge source={c.isSynthetic ? 'simulated' : 'manual'} />
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    {[
                      c.sleepHours !== undefined && `sleep ${c.sleepHours} h`,
                      c.sleepQuality && `quality ${c.sleepQuality}/5`,
                      c.mood && `mood ${c.mood}/5`,
                      c.stress && `stress ${c.stress}/5`,
                      c.energy && `energy ${c.energy}/5`,
                      c.exerciseMinutes !== undefined && `exercise ${c.exerciseMinutes} min`,
                      c.symptoms.length > 0 && `symptoms: ${c.symptoms.join(', ')}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No values'}
                  </p>
                  {!c.isSynthetic && (
                    <div className="mt-1 flex gap-3 text-xs">
                      <button className="text-cyan underline" onClick={() => startEdit(c)} aria-label={`Edit check-in from ${formatDateTime(c.submittedAt)}`}>
                        Edit
                      </button>
                      <button className="text-attention underline" onClick={() => onDelete(c)} aria-label={`Delete check-in from ${formatDateTime(c.submittedAt)}`}>
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {mode === 'simulated' && <p className="mt-2 text-[11px] text-text-muted">Simulated check-ins are generated and can't be edited.</p>}
        </Card>
      </div>
    </div>
  );
}
