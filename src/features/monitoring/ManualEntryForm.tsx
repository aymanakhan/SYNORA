import { useId, useState, type FormEvent } from 'react';
import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Button } from '../../components/ui';
import { formatUnit, formatValue } from '../../lib/format';
import { METRICS } from '../health/metrics';
import type { MetricId } from '../health/types';
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
function localNowInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const inputCls =
  'w-full rounded border border-white/15 bg-panel px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-cyan';

export function ManualEntryForm() {
  const { addManualMeasurement } = useSynora();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;
  const [metric, setMetric] = useState<MetricId>('heartRate');
  const def = METRICS[metric];
  const [unit, setUnit] = useState(def.canonicalUnit);
  const [value, setValue] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [measuredAt, setMeasuredAt] = useState(localNowInput);
  const [method, setMethod] = useState(def.typicalMethod);
  const [notes, setNotes] = useState('');
  const [period, setPeriod] = useState('24');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);

  const isScale = def.integer === true;
  const changeMetric = (m: MetricId) => {
    setMetric(m);
    setUnit(METRICS[m].canonicalUnit);
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
    const result = await addManualMeasurement({
      metric,
      unit,
      value: metric === 'bloodPressure' ? { systolic, diastolic } : value,
      measuredAt: measuredAt ? new Date(measuredAt).toISOString() : '',
      deviceOrMethod: method.trim() || undefined,
      notes: notes.trim() || undefined,
      exposurePeriodHours: metric === 'radiationDose' && period ? Number(period) : undefined,
    });
    setBusy(false);
    if (result.status === 'rejected') {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const m = result.status === 'saved' ? result.measurement : result.existing;
    setSaved(
      result.status === 'duplicate'
        ? 'This exact reading was already saved, so it was not added twice.'
        : `Saved ${def.label}: ${formatValue(m)} ${formatUnit(m)} (manual entry). The monitoring result has been updated.`,
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
          <select id={fid('metric')} className={inputCls} value={metric} onChange={(e) => changeMetric(e.target.value as MetricId)}>
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
      {errFor('value') && <p className="text-xs text-attention" role="alert">{errFor('value')}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text-secondary">Measured at</span>
          <input type="datetime-local" className={inputCls} value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
          {errFor('measuredAt') && <span className="text-xs text-attention">{errFor('measuredAt')}</span>}
        </label>
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
        <Button type="submit" disabled={busy}>Save measurement</Button>
        <span className="text-xs text-text-muted">Saved as a manual entry with your time stamp and method.</span>
      </div>
      <p aria-live="polite" className="text-sm text-stable">{saved}</p>
    </form>
  );
}
