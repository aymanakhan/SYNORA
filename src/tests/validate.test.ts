import { describe, expect, it } from 'vitest';
import type { RawMeasurementInput } from '../features/health/types';
import { validateMeasurement, type ValidationContext } from '../services/ingestion/validate';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const ctx: ValidationContext = { profileId: 'demo-1', now: NOW, generateId: () => 'id-1' };

function input(overrides: Partial<RawMeasurementInput>): RawMeasurementInput {
  return {
    metric: 'heartRate',
    value: 72,
    unit: 'bpm',
    measuredAt: '2026-11-15T11:55:00.000Z',
    source: 'manual',
    ...overrides,
  };
}

function expectOk(raw: RawMeasurementInput) {
  const r = validateMeasurement(raw, ctx);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.errors)}`);
  return r.measurement;
}

function expectErrorOn(raw: RawMeasurementInput, field: string) {
  const r = validateMeasurement(raw, ctx);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.map((e) => e.field)).toContain(field);
}

describe('validateMeasurement — valid input', () => {
  it('normalizes a manual heart-rate reading with provenance and timestamps', () => {
    const m = expectOk(input({ deviceOrMethod: 'Chest strap', notes: 'after rest' }));
    expect(m).toMatchObject({
      id: 'id-1',
      profileId: 'demo-1',
      metric: 'heartRate',
      kind: 'physiological',
      value: 72,
      unit: 'bpm',
      measuredAt: '2026-11-15T11:55:00.000Z',
      recordedAt: '2026-11-15T12:00:00.000Z',
      source: 'manual',
      isSynthetic: false,
      qualityStatus: 'valid',
      deviceOrMethod: 'Chest strap',
      notes: 'after rest',
    });
  });

  it('accepts numeric strings from form fields', () => {
    expect(expectOk(input({ value: ' 64.5 ' })).value).toBe(64.5);
  });

  it('accepts epoch-millisecond timestamps', () => {
    const m = expectOk(input({ measuredAt: NOW.getTime() - 60_000 }));
    expect(m.measuredAt).toBe('2026-11-15T11:59:00.000Z');
  });

  it('accepts structured blood pressure', () => {
    const m = expectOk(input({ metric: 'bloodPressure', value: { systolic: 118, diastolic: 76 }, unit: 'mmHg' }));
    expect(m.value).toEqual({ systolic: 118, diastolic: 76 });
    expect(m.qualityStatus).toBe('valid');
  });

  it('accepts blood glucose in mg/dL', () => {
    const m = expectOk(input({ metric: 'bloodGlucose', value: 95, unit: 'mg/dL' }));
    expect(m).toMatchObject({ value: 95, unit: 'mg/dL' });
    expect(m.original).toBeUndefined();
  });
});

describe('validateMeasurement — unit normalization', () => {
  it('converts °F to °C and keeps the original value', () => {
    const m = expectOk(input({ metric: 'bodyTemperature', value: 98.6, unit: '°F' }));
    expect(m.unit).toBe('°C');
    expect(m.value as number).toBeCloseTo(37, 5);
    expect(m.original).toEqual({ value: 98.6, unit: '°F' });
  });

  it('converts glucose mmol/L to mg/dL', () => {
    const m = expectOk(input({ metric: 'bloodGlucose', value: 5.5, unit: 'mmol/L' }));
    expect(m.value as number).toBeCloseTo(99.088, 3);
    expect(m.original).toEqual({ value: 5.5, unit: 'mmol/L' });
  });

  it('converts sleep minutes to hours', () => {
    expect(expectOk(input({ metric: 'sleepDuration', value: 450, unit: 'min' })).value).toBe(7.5);
  });

  it('converts µSv to mSv, including the "uSv" alias', () => {
    const m = expectOk(input({ metric: 'radiationDose', value: 500, unit: 'uSv', exposurePeriodHours: 24 }));
    expect(m).toMatchObject({ value: 0.5, unit: 'mSv', kind: 'exposure', exposurePeriodHours: 24 });
  });

  it('accepts case-insensitive unit spellings', () => {
    expect(expectOk(input({ unit: 'BPM' })).unit).toBe('bpm');
  });
});

describe('validateMeasurement — rejection', () => {
  it('rejects unknown metrics', () => expectErrorOn(input({ metric: 'cortisol' }), 'metric'));
  it('rejects a missing unit', () => expectErrorOn(input({ unit: '' }), 'unit'));
  it('rejects a unit not accepted for the metric', () => expectErrorOn(input({ unit: 'mg/dL' }), 'unit'));
  it('rejects non-numeric values', () => expectErrorOn(input({ value: 'fast' }), 'value'));
  it('rejects NaN and Infinity', () => {
    expectErrorOn(input({ value: Number.NaN }), 'value');
    expectErrorOn(input({ value: Number.POSITIVE_INFINITY }), 'value');
  });
  it('rejects implausible values instead of clamping', () => {
    expectErrorOn(input({ value: 400 }), 'value');
    expectErrorOn(input({ metric: 'spo2', value: 101, unit: '%' }), 'value');
  });
  it('checks plausibility after unit conversion', () => {
    expectErrorOn(input({ metric: 'bodyTemperature', value: 120, unit: '°F' }), 'value');
  });
  it('rejects non-integer 1–5 scale values', () => {
    expectErrorOn(input({ metric: 'mood', value: 3.5, unit: 'scale 1-5' }), 'value');
    expectErrorOn(input({ metric: 'stress', value: 0, unit: 'scale 1-5' }), 'value');
  });
  it('rejects malformed blood pressure', () => {
    expectErrorOn(input({ metric: 'bloodPressure', value: 120, unit: 'mmHg' }), 'value');
    expectErrorOn(input({ metric: 'bloodPressure', value: { systolic: 120 }, unit: 'mmHg' }), 'value');
    expectErrorOn(input({ metric: 'bloodPressure', value: null, unit: 'mmHg' }), 'value');
  });
  it('rejects diastolic >= systolic', () => {
    expectErrorOn(input({ metric: 'bloodPressure', value: { systolic: 80, diastolic: 90 }, unit: 'mmHg' }), 'value');
  });
  it('rejects blood pressure in other units', () => {
    expectErrorOn(input({ metric: 'bloodPressure', value: { systolic: 120, diastolic: 80 }, unit: 'kPa' }), 'unit');
  });
  it('rejects missing, invalid, and future timestamps', () => {
    expectErrorOn(input({ measuredAt: '' }), 'measuredAt');
    expectErrorOn(input({ measuredAt: 'yesterday-ish' }), 'measuredAt');
    expectErrorOn(input({ measuredAt: '2026-11-15T13:00:00.000Z' }), 'measuredAt');
  });
  it('tolerates small clock skew', () => {
    expectOk(input({ measuredAt: '2026-11-15T12:02:00.000Z' }));
  });
  it('rejects an unknown source', () => {
    expectErrorOn(input({ source: 'satellite' as never }), 'source');
  });
  it('requires a profile', () => {
    const r = validateMeasurement(input({}), { ...ctx, profileId: ' ' });
    expect(r.ok).toBe(false);
  });
  it('rejects overly long notes', () => expectErrorOn(input({ notes: 'x'.repeat(501) }), 'notes'));
  it('rejects exposure period on non-radiation metrics', () =>
    expectErrorOn(input({ exposurePeriodHours: 24 }), 'exposurePeriodHours'));
  it('rejects a non-positive exposure period', () =>
    expectErrorOn(input({ metric: 'radiationDose', value: 0.5, unit: 'mSv', exposurePeriodHours: 0 }), 'exposurePeriodHours'));
});

describe('validateMeasurement — provenance and synthetic labeling', () => {
  it('marks simulated readings synthetic and keeps scenario context', () => {
    const m = expectOk(input({ source: 'simulated', scenarioId: 'stable', missionDay: 42 }));
    expect(m).toMatchObject({ source: 'simulated', isSynthetic: true, scenarioId: 'stable', missionDay: 42 });
  });

  it('never marks manual readings synthetic', () => {
    expect(expectOk(input({ source: 'manual' })).isSynthetic).toBe(false);
  });

  it('ignores any caller attempt to mark simulated data as real', () => {
    const raw = { ...input({ source: 'simulated' }), isSynthetic: false } as RawMeasurementInput;
    expect(expectOk(raw).isSynthetic).toBe(true);
  });

  it('rejects scenario or mission-day tags on non-simulated readings', () => {
    expectErrorOn(input({ source: 'manual', scenarioId: 'stable' }), 'scenarioId');
    expectErrorOn(input({ source: 'manual', missionDay: 3 }), 'missionDay');
  });
});

describe('validateMeasurement — data-quality flags', () => {
  it('flags a very narrow blood-pressure gap as suspect, not rejected', () => {
    const m = expectOk(input({ metric: 'bloodPressure', value: { systolic: 100, diastolic: 92 }, unit: 'mmHg' }));
    expect(m.qualityStatus).toBe('suspect');
    expect(m.qualityNotes?.[0]).toMatch(/re-measuring/);
  });

  it('flags a radiation dose with no exposure period as suspect', () => {
    const m = expectOk(input({ metric: 'radiationDose', value: 0.4, unit: 'mSv' }));
    expect(m.qualityStatus).toBe('suspect');
  });
});

describe('manual-entry limits (team-agreed)', () => {
  const temp = (value: number, unit: string) => validateMeasurement(input({ metric: 'bodyTemperature', value, unit }), ctx);
  const bp = (systolic: number, diastolic: number) =>
    validateMeasurement(input({ metric: 'bloodPressure', value: { systolic, diastolic }, unit: 'mmHg' }), ctx);

  it.each([
    [25, '°C', true],
    [24.9, '°C', false],
    [43, '°C', true],
    [43.1, '°C', false],
    [77, '°F', true],
    [76.9, '°F', false],
    [109.4, '°F', true],
    [109.5, '°F', false],
  ])('temperature %s %s accepted=%s', (v, u, ok) => expect(temp(v, u).ok).toBe(ok));

  it('reports temperature limits in the unit the user entered', () => {
    const f = temp(110, '°F');
    expect(!f.ok && f.errors[0].message).toBe('Body temperature must be between 77 and 109.4 °F.');
    const c = temp(44, '°C');
    expect(!c.ok && c.errors[0].message).toBe('Body temperature must be between 25 and 43 °C.');
  });

  it('reports other converted limits in the entered unit', () => {
    const g = validateMeasurement(input({ metric: 'bloodGlucose', value: 40, unit: 'mmol/L' }), ctx);
    expect(!g.ok && g.errors[0].message).toMatch(/mmol\/L\.$/);
  });

  it.each([
    [50, 30, true],
    [300, 200, true],
    [49, 30, false],
    [301, 120, false],
    [120, 29, false],
    [250, 201, false],
  ])('blood pressure %s/%s accepted=%s', (s, d, ok) => expect(bp(s, d).ok).toBe(ok));
});
