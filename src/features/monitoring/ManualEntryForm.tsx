import { useId, useState, type FormEvent } from 'react';
import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Button } from '../../components/ui';
import { formatUnit, formatValue } from '../../lib/format';
import { BLOOD_PRESSURE_PLAUSIBLE, METRICS } from '../health/metrics';
import { displayUnit, rangeInUnit } from '../health/units';
import type { Measurement, MetricId } from '../health/types';
import type { ValidationError } from '../../services/ingestion/validate';

const ENTRY_METRICS: MetricId[] = [
  'heartRate',
  'bloodPressure',
  'bodyTemperature',
  'spo2',
  'bloodGlucose',
  'radiationDose',
  'sleepDuration',
  'mood',
  'stress',
  'energy',
];

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const inputCls =
  'w-full rounded border border-white/15 bg-panel px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-cyan';

/**
 * Manual measurement form. With `editing`, it corrects that saved entry
 * (same id, same measurement type) instead of adding a new one.
 */
export function ManualEntryForm({
  editing,
  initialMetric,
  onDone,
}: { editing?: Measurement; initialMetric?: MetricId; onDone?: () => void } = {}) {
  const { addManualMeasurement, editManualMeasurement, displayUnits } = useSynora();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;
  const orig = editing?.original;
  const shown = orig ?? (editing ? { value: editing.value, unit: editing.unit } : undefined);
  const [metric, setMetric] = useState<MetricId>(editing?.metric ?? initialMetric ?? 'heartRate');
  const def = METRICS[metric];
  const [unit, setUnit] = useState(shown?.unit ?? displayUnit(def.id, displayUnits));
  const [value, setValue] = useState(shown && typeof shown.value === 'number' ? String(shown.value) : '');
  const [systolic, setSystolic] = useState(shown && typeof shown.value === 'object' ? String(shown.value.systolic) : '');
  const [diastolic, setDiastolic] = useState(shown && typeof shown.value === 'object' ? String(shown.value.diastolic) : '');
  // New entries default to "now" at the moment of saving, so the time never goes stale.
  const [useNow, setUseNow] = useState(!editing);
  const [measuredAt, setMeasuredAt] = useState(() => toLocalInput(editing ? new Date(editing.measuredAt) : new Date()));
  const [method, setMethod] = useState(editing ? editing.deviceOrMethod ?? '' : def.typicalMethod);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [period, setPeriod] = useState(editing?.exposurePeriodHours?.toString() ?? '24');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);

  const isScale = def.integer === true;
  const changeMetric = (m: MetricId) => {
    setMetric(m);
    setUnit(displayUnit(m, displayUnits));
    setMethod(METRICS[m].typicalMethod);
    setValue('');
    setErrors([]);
    setSaved(undefined);
  };

  const errFor = (field: string) => errors.filter((e) => e.field === field).map((e) => e.message).join(' ');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(undefined);
    const raw = {
      metric,
      unit,
      value: metric === 'bloodPressure' ? { systolic, diastolic } : value,
      measuredAt: useNow ? new Date().toISOString() : measuredAt ? new Date(measuredAt).toISOString() : '',
      deviceOrMethod: method.trim() || undefined,
      notes: notes.trim() || undefined,
      exposurePeriodHours: metric === 'radiationDose' && period ? Number(period) : undefined,
    };
    const result = editing ? await editManualMeasurement(editing.id, raw) : await addManualMeasurement(raw);
    setBusy(false);
    if (result.status === 'rejected') {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const m = result.status === 'saved' ? result.measurement : result.existing;
    if (editing && result.status === 'saved') {
      onDone?.();
      return;
    }
    setSaved(
      result.status === 'duplicate'
        ? 'An identical reading with the same time is already saved, so it was not added twice.'
        : `Saved ${def.label}: ${formatValue(m, { ...displayUnits, [m.metric]: unit })} ${formatUnit(m, { ...displayUnits, [m.metric]: unit })} (manual entry). The monitoring result has been updated.`,
    );
    setValue('');
    setSystolic('');
    setDiastolic('');
    setNotes('');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block text-sm">
          <label htmlFor={fid('metric')} className="text-text-secondary">Measurement</label>
          <select id={fid('metric')} className={inputCls} value={metric} disabled={!!editing} onChange={(e) => changeMetric(e.target.value as MetricId)}>
            {ENTRY_METRICS.map((m) => (
              <option key={m} value={m}>{METRICS[m].label}</option>
            ))}
          </select>
        </div>
        <div className="block text-sm">
          <label htmlFor={fid('unit')} className="text-text-secondary">Unit</label>
          <select id={fid('unit')} className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} disabled={def.acceptedUnits.length < 2}>
            {def.acceptedUnits.map((u) => <option key={u}>{u}</option>)}
          </select>
          {errFor('unit') && <span className="text-xs text-attention">{errFor('unit')}</span>}
        </div>
      </div>

      <LearnMore metric={metric} summary={`How to measure ${def.label.toLowerCase()} · why it matters in space`} />

      {metric === 'bloodPressure' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-text-secondary">Systolic (mmHg)</span>
            <input className={inputCls} inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Diastolic (mmHg)</span>
            <input className={inputCls} inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} required />
          </label>
        </div>
      ) : isScale ? (
        <fieldset className="text-sm">
          <legend className="text-text-secondary">{def.label} (1 = lowest, 5 = highest)</legend>
          <div className="mt-1 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={`cursor-pointer rounded border px-3 py-1.5 ${value === String(n) ? 'border-cyan bg-cyan/15 text-cyan' : 'border-white/15'}`}>
                <input type="radio" name="scale" className="sr-only" value={n} checked={value === String(n)} onChange={() => setValue(String(n))} />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="block text-sm">
          <span className="text-text-secondary">Value ({unit})</span>
          <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required />
        </label>
      )}
      <p className="text-[11px] text-text-muted">
        {metric === 'bloodPressure'
          ? `Accepted: systolic ${BLOOD_PRESSURE_PLAUSIBLE.systolic.min}–${BLOOD_PRESSURE_PLAUSIBLE.systolic.max}, diastolic ${BLOOD_PRESSURE_PLAUSIBLE.diastolic.min}–${BLOOD_PRESSURE_PLAUSIBLE.diastolic.max} mmHg (input check, not a health range).`
          : (() => {
              const r = rangeInUnit(metric, unit);
              return r ? `Accepted: ${r.min}–${r.max} ${r.unit.replace('scale 1–5', '')} (input check, not a health range).` : null;
            })()}
      </p>
      {errFor('value') && <p className="text-xs text-attention" role="alert">{errFor('value')}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block text-sm">
          <label htmlFor={fid('time')} className="text-text-secondary">Measured at</label>
          <input
            id={fid('time')}
            type="datetime-local"
            className={`${inputCls} disabled:opacity-50`}
            value={measuredAt}
            disabled={useNow}
            onChange={(e) => setMeasuredAt(e.target.value)}
          />
          <label className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={useNow}
              onChange={(e) => {
                setUseNow(e.target.checked);
                if (!e.target.checked) setMeasuredAt(toLocalInput(new Date()));
              }}
            />
            Use the current time when I save
          </label>
          {errFor('measuredAt') && <span className="text-xs text-attention">{errFor('measuredAt')}</span>}
        </div>
        <label className="block text-sm">
          <span className="text-text-secondary">Instrument / method</span>
          <input className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)} maxLength={500} />
        </label>
      </div>
      {metric === 'radiationDose' && (
        <label className="block text-sm">
          <span className="text-text-secondary">Exposure period covered (hours)</span>
          <input className={inputCls} inputMode="decimal" value={period} onChange={(e) => setPeriod(e.target.value)} />
          {errFor('exposurePeriodHours') && <span className="text-xs text-attention">{errFor('exposurePeriodHours')}</span>}
        </label>
      )}
      <label className="block text-sm">
        <span className="text-text-secondary">Notes (optional)</span>
        <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="e.g. after exercise, seated" />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{editing ? 'Save changes' : 'Save measurement'}</Button>
        {editing ? (
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
        ) : (
          <span className="text-xs text-text-muted">Saved as a manual entry with your time stamp and method.</span>
        )}
      </div>
      <p aria-live="polite" className="text-sm text-stable">{saved}</p>
    </form>
  );
}
