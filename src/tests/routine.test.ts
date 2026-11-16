import { describe, expect, it } from 'vitest';
import { METRICS } from '../features/health/metrics';
import type { CheckIn, Measurement, MetricId } from '../features/health/types';
import { ROUTINE_TASKS, routineStatus } from '../features/routine/routine';

const NOW = new Date('2026-11-15T18:00:00.000Z');
let n = 0;
const m = (metric: MetricId, iso: string, value: Measurement['value'] = 1): Measurement => ({
  id: `m${++n}`, profileId: 'p', metric, kind: METRICS[metric].kind, value, unit: METRICS[metric].canonicalUnit,
  measuredAt: iso, recordedAt: iso, source: 'manual', isSynthetic: false, qualityStatus: 'valid',
});
const c = (iso: string, extra: Partial<CheckIn> = {}): CheckIn => ({ id: `c${++n}`, profileId: 'p', submittedAt: iso, symptoms: [], isSynthetic: false, ...extra });
const fullDay = (date: string) => [
  ...(['heartRate', 'bloodPressure', 'bodyTemperature', 'spo2', 'radiationDose'] as MetricId[]).map((k) => m(k, `${date}T08:00:00.000Z`)),
];
const run = (ms: Measurement[], cs: CheckIn[] = []) => routineStatus(ms, cs, NOW, 0);

describe('daily routine', () => {
  it('starts with nothing done', () => {
    const r = run([]);
    expect(r).toMatchObject({ done: 0, total: ROUTINE_TASKS.length, complete: false, streakDays: 0 });
  });

  it('counts tasks logged today only', () => {
    const r = run([m('heartRate', '2026-11-15T07:00:00Z'), m('bloodPressure', '2026-11-14T07:00:00Z')]);
    expect(r.tasks.find((t) => t.id === 'heartRate')?.done).toBe(true);
    expect(r.tasks.find((t) => t.id === 'bloodPressure')?.done).toBe(false);
    expect(r.done).toBe(1);
  });

  it('a check-in that reports symptoms or bad values earns the same credit', () => {
    const r = run([m('heartRate', '2026-11-15T07:00:00Z', 140)], [c('2026-11-15T07:30:00Z', { symptoms: ['headache'], mood: 1 })]);
    expect(r.done).toBe(2);
  });

  it('completes and builds a streak of consecutive full days', () => {
    const ms = [...fullDay('2026-11-13'), ...fullDay('2026-11-14'), ...fullDay('2026-11-15')];
    const cs = [c('2026-11-13T09:00:00Z'), c('2026-11-14T09:00:00Z'), c('2026-11-15T09:00:00Z')];
    const r = run(ms, cs);
    expect(r.complete).toBe(true);
    expect(r.streakDays).toBe(3);
  });

  it('keeps yesterday’s streak while today is still in progress, and a gap breaks it', () => {
    const ms = [...fullDay('2026-11-12'), ...fullDay('2026-11-14'), m('heartRate', '2026-11-15T07:00:00Z')];
    const cs = [c('2026-11-12T09:00:00Z'), c('2026-11-14T09:00:00Z')];
    expect(run(ms, cs).streakDays).toBe(1);
  });

  it('ignores future-dated entries', () => {
    expect(run([m('heartRate', '2026-11-15T23:00:00Z')]).done).toBe(0);
  });
});
