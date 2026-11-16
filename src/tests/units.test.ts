import { describe, expect, it } from 'vitest';
import { assess } from '../features/health/assessment';
import { ruleDescription } from '../features/health/assessment/rules';
import { METRICS } from '../features/health/metrics';
import type { CheckIn, Measurement, MeasurementValue, MetricId } from '../features/health/types';
import { formatIn, toDisplay, UNIT_CHOICE_METRICS } from '../features/health/units';

const NOW = new Date('2026-11-15T12:00:00.000Z');
let n = 0;
const m = (metric: MetricId, value: MeasurementValue, extra: Partial<Measurement> = {}): Measurement => ({
  id: `u${++n}`, profileId: 'p', metric, kind: METRICS[metric].kind, value, unit: METRICS[metric].canonicalUnit,
  measuredAt: new Date(NOW.getTime() - 3_600_000).toISOString(), recordedAt: NOW.toISOString(), source: 'manual',
  isSynthetic: false, qualityStatus: 'valid', ...extra,
});
const vitals = () => [m('heartRate', 70), m('spo2', 98)];
const run = (ms: Measurement[], units = {}, cs: CheckIn[] = []) =>
  assess({ measurements: ms, checkIns: cs, now: NOW, utcOffsetMinutes: 0, displayUnits: units });

describe('display units', () => {
  it('offers a choice for every metric with more than one unit', () => {
    expect(UNIT_CHOICE_METRICS.sort()).toEqual(['bloodGlucose', 'bodyTemperature', 'radiationDose', 'sleepDuration']);
  });

  it('formats values in the chosen unit', () => {
    expect(formatIn('bodyTemperature', 37, { bodyTemperature: '°F' })).toBe('98.6 °F');
    expect(formatIn('bloodGlucose', 99.088, { bloodGlucose: 'mmol/L' })).toBe('5.5 mmol/L');
    expect(formatIn('sleepDuration', 7.5, { sleepDuration: 'min' })).toBe('450 min');
    expect(formatIn('radiationDose', 0.6, { radiationDose: 'µSv' })).toBe('600 µSv');
    expect(formatIn('bodyTemperature', 37)).toBe('37 °C');
    expect(toDisplay('bodyTemperature', 37, { bodyTemperature: 'kelvin' }).unit).toBe('°C'); // unknown unit ignored
  });

  it('temperature finding uses °F for both the value and the threshold', () => {
    const f = run([...vitals(), m('bodyTemperature', 38.5)], { bodyTemperature: '°F' }).findings[0];
    expect(f.explanation).toMatch(/Body temperature 101\.3 °F is in the demonstration review range \(review at ≥ 100\.4 °F\)/);
    expect(f.explanation).not.toMatch(/°C/);
  });

  it('defaults to canonical units', () => {
    expect(run([...vitals(), m('bodyTemperature', 38.5)]).findings[0].explanation).toMatch(/38\.5 °C .*≥ 38 °C/);
  });

  it('glucose finding in mmol/L', () => {
    const f = run([...vitals(), m('bloodGlucose', 50)], { bloodGlucose: 'mmol/L' }).findings[0];
    expect(f.explanation).toMatch(/2\.8 mmol\/L .*below 3 mmol\/L/);
  });

  it('sleep finding in minutes', () => {
    const c: CheckIn = { id: 'c1', profileId: 'p', submittedAt: new Date(NOW.getTime() - 3_600_000).toISOString(), sleepHours: 4.5, symptoms: [], isSynthetic: false };
    const f = run(vitals(), { sleepDuration: 'min' }, [c]).findings[0];
    expect(f.explanation).toBe("Last night's sleep was 270 min, under 300 min.");
  });

  it('radiation findings in µSv', () => {
    const r = run([...vitals(), m('radiationDose', 3, { exposurePeriodHours: 24 })], { radiationDose: 'µSv' });
    expect(r.findings[0].explanation).toMatch(/3000 µSv over 24 h ≈ 3000 µSv per day.*≥ 2000 µSv per day/);
  });

  it('rule descriptions follow the chosen units', () => {
    expect(ruleDescription('R-TEMP-RANGE', { bodyTemperature: '°F' })).toMatch(/review at ≥ 100\.4 °F.*attention below 95 °F/);
    expect(ruleDescription('R-GLUCOSE-RANGE', { bloodGlucose: 'mmol/L' })).toMatch(/review at ≥ 10 mmol\/L/);
    expect(ruleDescription('R-RAD-CUMULATIVE', { radiationDose: 'µSv' })).toMatch(/150000 µSv/);
    expect(ruleDescription('R-SLEEP-SHORT', { sleepDuration: 'min' })).toMatch(/under 300 min.*under 360 min/);
  });
});
