import { describe, expect, it } from 'vitest';
import { assess } from '../features/health/assessment';
import { RULE_DEFINITIONS } from '../features/health/assessment/rules';
import { METRICS } from '../features/health/metrics';
import type { CheckIn, Measurement, MeasurementValue, MetricId } from '../features/health/types';
import { derivePetWellness } from '../features/pets/wellness';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const HOUR = 3_600_000;
let seq = 0;

function m(
  metric: MetricId,
  value: MeasurementValue,
  hoursAgo = 1,
  extra: Partial<Measurement> = {},
): Measurement {
  const at = new Date(NOW.getTime() - hoursAgo * HOUR).toISOString();
  return {
    id: `m${++seq}`,
    profileId: 'demo-1',
    metric,
    kind: METRICS[metric].kind,
    value,
    unit: METRICS[metric].canonicalUnit,
    measuredAt: at,
    recordedAt: at,
    source: 'manual',
    isSynthetic: false,
    qualityStatus: 'valid',
    ...extra,
  };
}

function checkIn(hoursAgo: number, fields: Partial<CheckIn> = {}): CheckIn {
  return {
    id: `c${++seq}`,
    profileId: 'demo-1',
    submittedAt: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString(),
    symptoms: [],
    isSynthetic: false,
    ...fields,
  };
}

const normalVitals = () => [
  m('heartRate', 68),
  m('bloodPressure', { systolic: 118, diastolic: 76 }),
  m('bodyTemperature', 36.8),
  m('spo2', 98),
];

const run = (measurements: Measurement[], checkIns: CheckIn[] = []) =>
  assess({ measurements, checkIns, now: NOW, utcOffsetMinutes: 0 });
const ruleIds = (r: ReturnType<typeof run>) => r.findings.map((f) => f.ruleId);

describe('data adequacy and unknown', () => {
  it('returns unknown with no data', () => {
    const r = run([]);
    expect(r.status).toBe('unknown');
    expect(r.nextStep).toBe('record-more-data');
    expect(r.confidence).toBe('low');
    expect(r.missingData).toEqual(expect.arrayContaining(['heartRate', 'bloodPressure', 'bodyTemperature', 'spo2']));
  });

  it('returns unknown (not stable) with only one normal vital', () => {
    const r = run([m('heartRate', 70)]);
    expect(r.status).toBe('unknown');
    expect(r.limitations.join(' ')).toMatch(/Only 1 of 4 core vitals/);
  });

  it('returns stable with high confidence for four normal vitals', () => {
    const r = run(normalVitals());
    expect(r.status).toBe('stable');
    expect(r.confidence).toBe('high');
    expect(r.findings).toEqual([]);
    expect(r.nextStep).toBe('none');
    expect(r.explanation).toMatch(/not proof of good health/);
  });

  it('returns stable with moderate confidence for two normal vitals', () => {
    const r = run([m('heartRate', 70), m('spo2', 98)]);
    expect(r.status).toBe('stable');
    expect(r.confidence).toBe('moderate');
  });

  it('ignores stale readings', () => {
    const r = run([m('heartRate', 130, 25), m('spo2', 98, 30)]);
    expect(r.status).toBe('unknown');
    expect(r.findings).toEqual([]);
  });

  it('ignores future-dated readings', () => {
    expect(run([m('heartRate', 130, -2)]).status).toBe('unknown');
  });

  it('still surfaces a concerning reading when other data is missing', () => {
    const r = run([m('spo2', 90)]);
    expect(r.status).toBe('attention');
    expect(r.confidence).toBe('low');
  });
});

describe('range rules (demonstration-only)', () => {
  it.each([
    [100, 'review'],
    [99.9, 'stable'],
    [120, 'attention'],
    [50, 'stable'],
    [49, 'review'],
    [39, 'attention'],
  ])('heart rate %s → %s', (hr, expected) => {
    const r = run([m('heartRate', hr), m('spo2', 98)]);
    expect(r.status).toBe(expected);
  });

  it('flags high blood pressure on both components', () => {
    const r = run([m('bloodPressure', { systolic: 165, diastolic: 105 }), m('heartRate', 70)]);
    expect(r.status).toBe('attention');
    expect(ruleIds(r)).toEqual(expect.arrayContaining(['R-BP-SYSTOLIC', 'R-BP-DIASTOLIC']));
    expect(r.nextStep).toBe('consult-flight-surgeon');
  });

  it('review-level findings suggest verifying the measurement', () => {
    const r = run([m('bloodPressure', { systolic: 145, diastolic: 85 }), m('heartRate', 70)]);
    expect(r.status).toBe('review');
    expect(r.nextStep).toBe('verify-measurement');
  });

  it.each([
    ['bodyTemperature', 38.5, 'review'],
    ['bodyTemperature', 34.8, 'attention'],
    ['spo2', 94, 'review'],
    ['spo2', 91, 'attention'],
    ['bloodGlucose', 65, 'review'],
    ['bloodGlucose', 50, 'attention'],
    ['bloodGlucose', 260, 'attention'],
    ['bloodGlucose', 110, 'stable'],
  ] as const)('%s %s → %s', (metric, value, expected) => {
    const r = run([m(metric, value), m('heartRate', 70), m('spo2' === metric ? 'bodyTemperature' : 'spo2', metric === 'spo2' ? 36.8 : 98)]);
    expect(r.status).toBe(expected);
  });

  it('uses the latest reading by measurement time, not arrival order', () => {
    const late = m('heartRate', 130, 3);
    const recent = m('heartRate', 70, 1);
    expect(run([recent, late, m('spo2', 98)]).status).toBe('stable');
  });

  it('ignores duplicate ids', () => {
    const hr = m('heartRate', 105);
    const r = run([hr, { ...hr }, m('spo2', 98)]);
    expect(r.findings.filter((f) => f.ruleId === 'R-HR-RANGE')).toHaveLength(1);
  });
});

describe('data quality', () => {
  it('turns a suspect reading into a verify-measurement review', () => {
    const r = run([
      ...normalVitals().filter((x) => x.metric !== 'bloodPressure'),
      m('bloodPressure', { systolic: 100, diastolic: 88 }, 1, {
        qualityStatus: 'suspect',
        qualityNotes: ['Very narrow systolic–diastolic gap; consider re-measuring.'],
      }),
    ]);
    expect(r.status).toBe('review');
    expect(ruleIds(r)).toContain('R-DATA-QUALITY');
    expect(r.nextStep).toBe('verify-measurement');
    expect(r.confidence).toBe('moderate');
  });

  it('asks to verify (not consult) when an out-of-range reading is suspect', () => {
    const r = run([m('heartRate', 130, 1, { qualityStatus: 'suspect' }), m('spo2', 98)]);
    expect(r.findings[0]).toMatchObject({ ruleId: 'R-HR-RANGE', status: 'attention', nextStep: 'verify-measurement' });
  });
});

describe('personal baseline', () => {
  const history = (values: number[], daysSpread = 5) =>
    values.map((v, i) => m('heartRate', v, 24 * ((i % daysSpread) + 1) + i * 0.1));

  it('flags a large deviation from an established baseline', () => {
    const hist = history([58, 60, 62, 59, 61, 60, 58, 62, 61, 59]);
    const r = run([...hist, m('heartRate', 85), m('spo2', 98)]);
    expect(r.status).toBe('review');
    expect(ruleIds(r)).toEqual(['R-BASELINE-DEVIATION']);
    expect(r.findings[0].explanation).toMatch(/usual 60/);
  });

  it('does not use a baseline with too few readings', () => {
    const r = run([...history([60, 60, 60, 60, 60]), m('heartRate', 85), m('spo2', 98)]);
    expect(r.status).toBe('stable');
    expect(r.limitations.join(' ')).toMatch(/baseline not yet established for: heart rate/);
  });

  it('does not use a baseline from a single day', () => {
    const sameDay = [60, 60, 61, 59, 60, 60, 61, 59].map((v, i) => m('heartRate', v, 2 + i * 0.1));
    const r = run([...sameDay, m('heartRate', 85, 1), m('spo2', 98)]);
    expect(ruleIds(r)).not.toContain('R-BASELINE-DEVIATION');
  });

  it('floors the spread so tiny variation does not cause false alarms', () => {
    const flat = history([60, 60, 60, 60, 60, 60, 60, 60]);
    expect(ruleIds(run([...flat, m('heartRate', 66), m('spo2', 98)]))).not.toContain('R-BASELINE-DEVIATION');
    expect(ruleIds(run([...flat, m('heartRate', 73), m('spo2', 98)]))).toContain('R-BASELINE-DEVIATION');
  });

  it('excludes suspect readings from the baseline', () => {
    const hist = history([60, 60, 60, 60, 60, 60]).concat(
      history([95, 95, 95]).map((x) => ({ ...x, qualityStatus: 'suspect' as const })),
    );
    const r = run([...hist, m('heartRate', 85), m('spo2', 98)]);
    expect(ruleIds(r)).not.toContain('R-BASELINE-DEVIATION');
  });
});

describe('self-report patterns and check-ins', () => {
  it('flags three short nights from check-ins', () => {
    const r = run(normalVitals(), [
      checkIn(50, { sleepHours: 5.5 }),
      checkIn(26, { sleepHours: 5.2 }),
      checkIn(2, { sleepHours: 5.8 }),
    ]);
    expect(ruleIds(r)).toEqual(['R-SLEEP-SHORT']);
    expect(r.nextStep).toBe('review-guidance');
  });

  it('flags a single very short night', () => {
    expect(ruleIds(run(normalVitals(), [checkIn(2, { sleepHours: 4.5 })]))).toEqual(['R-SLEEP-SHORT']);
  });

  it('combines sleep from measurements and check-ins', () => {
    const r = run(
      [...normalVitals(), m('sleepDuration', 5.5, 50), m('sleepDuration', 5.5, 26)],
      [checkIn(2, { sleepHours: 5.5 })],
    );
    expect(ruleIds(r)).toEqual(['R-SLEEP-SHORT']);
  });

  it('flags sustained stress and low mood', () => {
    const r = run(normalVitals(), [
      checkIn(50, { stress: 4, mood: 2 }),
      checkIn(26, { stress: 5, mood: 1 }),
      checkIn(2, { stress: 4, mood: 2 }),
    ]);
    expect(ruleIds(r)).toEqual(expect.arrayContaining(['R-STRESS-SUSTAINED', 'R-MOOD-LOW']));
    expect(r.status).toBe('review');
  });

  it('does not flag stress when one of the last three is lower', () => {
    const r = run(normalVitals(), [checkIn(50, { stress: 4 }), checkIn(26, { stress: 2 }), checkIn(2, { stress: 5 })]);
    expect(ruleIds(r)).not.toContain('R-STRESS-SUSTAINED');
  });

  it('treats reported symptoms supportively as review', () => {
    const r = run(normalVitals(), [checkIn(1, { symptoms: ['headache'] })]);
    expect(r.status).toBe('review');
    expect(r.findings[0].explanation).toMatch(/Thank you for reporting/);
    expect(r.checkInFlags).toContain('symptoms-reported');
  });

  it('sets check-in flags without creating findings for one mildly short night', () => {
    const r = run(normalVitals(), [checkIn(2, { sleepHours: 5.5, energy: 2 })]);
    expect(r.status).toBe('stable');
    expect(r.checkInFlags).toEqual(expect.arrayContaining(['short-sleep', 'low-energy']));
  });
});

describe('provenance, determinism, and rule catalog', () => {
  it('reports synthetic input', () => {
    const r = run(normalVitals().map((x) => ({ ...x, source: 'simulated' as const, isSynthetic: true })));
    expect(r.basedOnSyntheticData).toBe(true);
    expect(r.limitations.join(' ')).toMatch(/synthetic/);
  });

  it('does not report manual input as synthetic', () => {
    expect(run(normalVitals()).basedOnSyntheticData).toBe(false);
  });

  it('is deterministic for identical input', () => {
    const input = [...normalVitals(), m('heartRate', 110, 0.5)];
    expect(run(input)).toEqual(run(input));
  });

  it('picks the highest-priority next step', () => {
    const r = run([m('spo2', 90), m('heartRate', 70)], [checkIn(50, { stress: 5 }), checkIn(26, { stress: 5 }), checkIn(1, { stress: 5 })]);
    expect(r.nextStep).toBe('consult-flight-surgeon');
  });

  it('every finding references a documented, demonstration-only rule', () => {
    const r = run(
      [m('heartRate', 130), m('bloodPressure', { systolic: 170, diastolic: 105 }), m('spo2', 90), m('bodyTemperature', 39.5), m('bloodGlucose', 40)],
      [checkIn(1, { sleepHours: 3, symptoms: ['nausea'] })],
    );
    const ids = new Set(RULE_DEFINITIONS.map((d) => d.id));
    for (const f of r.findings) {
      expect(ids.has(f.ruleId)).toBe(true);
      expect(f.evidence).toBe('demonstration-only');
      expect(f.evidenceRefs.length).toBeGreaterThan(0);
    }
    expect(RULE_DEFINITIONS.every((d) => d.evidence === 'demonstration-only' || d.citation)).toBe(true);
  });

  it('never uses a "critical" status', () => {
    const r = run([m('heartRate', 200), m('spo2', 60)]);
    expect(['stable', 'review', 'attention', 'unknown']).toContain(r.status);
  });
});

describe('pet wellness derives only from the assessment result', () => {
  it('is unknown without an assessment', () => expect(derivePetWellness(undefined)).toBe('unknown'));
  it('is happy when stable with no fatigue flags', () => expect(derivePetWellness(run(normalVitals()))).toBe('happy'));
  it('is unknown when data is insufficient', () => expect(derivePetWellness(run([]))).toBe('unknown'));

  it('is tired when stable but sleep was short', () => {
    expect(derivePetWellness(run(normalVitals(), [checkIn(2, { sleepHours: 5.5 })]))).toBe('tired');
  });

  it('is tired from self-reports even when vitals are missing', () => {
    expect(derivePetWellness(run([], [checkIn(2, { energy: 1 })]))).toBe('tired');
  });

  it('is concerned on review or attention, overriding tired', () => {
    const r = run([m('heartRate', 130), m('spo2', 98)], [checkIn(2, { sleepHours: 5.5 })]);
    expect(r.checkInFlags).toContain('short-sleep');
    expect(derivePetWellness(r)).toBe('concerned');
  });

  it('is concerned when symptoms are reported (supportive, not punitive)', () => {
    expect(derivePetWellness(run(normalVitals(), [checkIn(1, { symptoms: ['dizzy'] })]))).toBe('concerned');
  });
});

describe('sleep / stress / mood count one entry per night (regression)', () => {
  // NOW = 2026-11-15 12:00 UTC. Hours-ago values below land on these UTC days:
  //   1–10 h ago → Nov 15 · 26–34 h ago → Nov 14 · 50 h → Nov 13 · 74 h → Nov 12
  const sleepIds = (cs: CheckIn[]) => ruleIds(run(normalVitals(), cs)).filter((r) => r === 'R-SLEEP-SHORT');

  it('three 5.5 h check-ins on the SAME day do not count as three nights', () => {
    const r = run(normalVitals(), [
      checkIn(3, { sleepHours: 5.5 }),
      checkIn(2, { sleepHours: 5.5 }),
      checkIn(1, { sleepHours: 5.5 }),
    ]);
    expect(ruleIds(r)).not.toContain('R-SLEEP-SHORT');
    expect(r.status).toBe('stable');
  });

  it('uses the latest entry when a night has several', () => {
    // Nov 13 and 14 short; Nov 15 first entered 5.5 h then corrected to 7.5 h.
    expect(sleepIds([
      checkIn(50, { sleepHours: 5.5 }),
      checkIn(26, { sleepHours: 5.5 }),
      checkIn(3, { sleepHours: 5.5 }),
      checkIn(1, { sleepHours: 7.5 }),
    ])).toEqual([]);
  });

  it('a skipped night breaks the streak', () => {
    // Nov 12, 13, 15 short — no entry for Nov 14.
    expect(sleepIds([
      checkIn(74, { sleepHours: 5.5 }),
      checkIn(50, { sleepHours: 5.5 }),
      checkIn(2, { sleepHours: 5.5 }),
    ])).toEqual([]);
  });

  it('three consecutive short nights trigger the multi-night review', () => {
    const r = run(normalVitals(), [
      checkIn(50, { sleepHours: 5.5 }),
      checkIn(26, { sleepHours: 5.8 }),
      checkIn(2, { sleepHours: 5.2 }),
    ]);
    const f = r.findings.find((x) => x.ruleId === 'R-SLEEP-SHORT')!;
    expect(f.status).toBe('review');
    expect(f.evidence).toBe('demonstration-only');
    expect(f.explanation).toMatch(/3 consecutive nights/);
    expect(f.evidenceRefs).toHaveLength(3);
  });

  it('one entry below 5 h still triggers the single-night review', () => {
    const r = run(normalVitals(), [checkIn(2, { sleepHours: 4.5 })]);
    const f = r.findings.find((x) => x.ruleId === 'R-SLEEP-SHORT')!;
    expect(f.explanation).toMatch(/under 5 h/);
  });

  it('three consecutive nights that ended more than a day ago do not count', () => {
    // Nov 11, 12, 13 short, nothing since.
    expect(sleepIds([
      checkIn(98, { sleepHours: 5.5 }),
      checkIn(74, { sleepHours: 5.5 }),
      checkIn(50, { sleepHours: 5.5 }),
    ])).toEqual([]);
  });

  it('applies the same per-day counting to stress and mood', () => {
    const sameDay = run(normalVitals(), [
      checkIn(3, { stress: 5, mood: 1 }),
      checkIn(2, { stress: 5, mood: 1 }),
      checkIn(1, { stress: 5, mood: 1 }),
    ]);
    expect(ruleIds(sameDay)).not.toContain('R-STRESS-SUSTAINED');
    expect(ruleIds(sameDay)).not.toContain('R-MOOD-LOW');
  });

  it('respects the local day boundary via utcOffsetMinutes', () => {
    // 23:00 and 01:00 UTC are different UTC days but the same day at UTC-5.
    const at = (iso: string, h: number) => ({ ...checkIn(0, { sleepHours: h }), submittedAt: iso });
    const cs = [at('2026-11-14T01:00:00Z', 5.5), at('2026-11-14T23:00:00Z', 5.5), at('2026-11-15T09:00:00Z', 5.5)];
    const utc = assess({ measurements: normalVitals(), checkIns: cs, now: NOW, utcOffsetMinutes: 0 });
    const est = assess({ measurements: normalVitals(), checkIns: cs, now: NOW, utcOffsetMinutes: -300 });
    expect(utc.findings.map((f) => f.ruleId)).not.toContain('R-SLEEP-SHORT'); // Nov 14 counted once, Nov 13 missing
    expect(est.findings.map((f) => f.ruleId)).toContain('R-SLEEP-SHORT'); // Nov 13, 14, 15 local
  });
});

describe('radiation rules (demonstration-only)', () => {
  const dose = (mSv: number, hoursAgo = 2, period?: number) =>
    m('radiationDose', mSv, hoursAgo, period === undefined ? {} : { exposurePeriodHours: period });
  const rad = (r: ReturnType<typeof run>) => r.findings.filter((f) => f.ruleId.startsWith('R-RAD'));

  it('a normal daily dose is stable and reported in the summary', () => {
    const r = run([...normalVitals(), dose(0.6, 2, 24)]);
    expect(rad(r)).toEqual([]);
    expect(r.status).toBe('stable');
    expect(r.radiation).toMatchObject({ totalMSv: 0.6, readings: 1, latestDailyRateMSv: 0.6 });
  });

  it('flags a high dose rate (review) and a very high one (attention)', () => {
    expect(rad(run([...normalVitals(), dose(3, 2, 24)]))[0]).toMatchObject({ ruleId: 'R-RAD-DOSE-RATE', status: 'review' });
    expect(rad(run([...normalVitals(), dose(12, 2, 24)]))[0]).toMatchObject({ ruleId: 'R-RAD-DOSE-RATE', status: 'attention', nextStep: 'consult-flight-surgeon' });
  });

  it('normalises by the exposure period', () => {
    // 6 mSv over 72 h = 2 mSv/day → review; 6 mSv over 12 h = 12 mSv/day → attention.
    expect(rad(run([...normalVitals(), dose(6, 2, 72)]))[0].status).toBe('review');
    expect(rad(run([...normalVitals(), dose(6, 2, 12)]))[0].status).toBe('attention');
  });

  it('treats a reading without a period as covering one day', () => {
    expect(rad(run([...normalVitals(), dose(3, 2)]))[0].status).toBe('review');
  });

  it('a huge single entry is never "stable"', () => {
    const r = run([...normalVitals(), dose(500, 2, 24)]);
    expect(r.status).toBe('attention');
    expect(rad(r).map((f) => f.ruleId).sort()).toEqual(['R-RAD-CUMULATIVE', 'R-RAD-DOSE-RATE']);
  });

  it('adds up the mission dose, including old readings', () => {
    // 160 daily readings of 1 mSv (each one is a normal rate) → 160 mSv cumulative → review
    const history = Array.from({ length: 160 }, (_, i) => dose(1, 24 * (i + 1), 24));
    const r = run([...normalVitals(), ...history]);
    expect(r.radiation?.totalMSv).toBe(160);
    expect(rad(r)).toEqual([expect.objectContaining({ ruleId: 'R-RAD-CUMULATIVE', status: 'review' })]);
  });

  it('a stale high reading still counts toward the total but not the rate', () => {
    const r = run([...normalVitals(), dose(12, 24 * 10, 24)]);
    expect(rad(r)).toEqual([]);
    expect(r.radiation?.totalMSv).toBe(12);
    expect(r.radiation?.latestDailyRateMSv).toBeUndefined();
  });
});
