import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { RawMeasurementInput } from '../features/health/types';
import {
  deleteManualCheckIn,
  deleteManualMeasurement,
  ingestCheckIn,
  ingestMeasurement,
  updateCheckIn,
  updateMeasurement,
} from '../services/ingestion/ingest';
import { IndexedDbRepository } from '../services/storage/indexedDb';
import { MemoryRepository, type HealthRepository } from '../services/storage/repository';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const LATER = new Date('2026-11-15T15:00:00.000Z');
let n = 0;
const id = () => `e-${++n}`;
const ctx = { profileId: 'a', now: NOW, generateId: id };
const hr = (value: number | string, minutesAgo = 5, source: RawMeasurementInput['source'] = 'manual'): RawMeasurementInput => ({
  metric: 'heartRate',
  value,
  unit: 'bpm',
  measuredAt: NOW.getTime() - minutesAgo * 60_000,
  source,
});

let dbn = 0;
describe.each([
  ['MemoryRepository', async (): Promise<HealthRepository> => new MemoryRepository()],
  ['IndexedDbRepository', (): Promise<HealthRepository> => IndexedDbRepository.open(`edit-${++dbn}`)],
])('%s edit/delete', (_n, make) => {
  async function seed() {
    const repo = await make();
    const a = await ingestMeasurement(hr(720), ctx, repo); // typo: 720 → rejected
    expect(a.status).toBe('rejected');
    const m1 = await ingestMeasurement(hr(77, 30), ctx, repo); // typo meant 72
    const m2 = await ingestMeasurement({ ...hr(98), metric: 'spo2', unit: '%' }, ctx, repo);
    const sim = await ingestMeasurement({ ...hr(65, 10, 'simulated'), scenarioId: 'stable', missionDay: 1 }, ctx, repo);
    const c1 = await ingestCheckIn({ submittedAt: '2026-11-14T08:00:00Z', sleepHours: 5.5, mood: 3, synthetic: false }, ctx, repo);
    const c2 = await ingestCheckIn({ submittedAt: '2026-11-15T08:00:00Z', sleepHours: 7, synthetic: false }, ctx, repo);
    const cs = await ingestCheckIn({ submittedAt: '2026-11-15T07:00:00Z', sleepHours: 7, synthetic: true, scenarioId: 'stable', missionDay: 1 }, ctx, repo);
    const get = <T,>(r: { status: string } & Partial<Record<'measurement' | 'checkIn', T>>) => (r.measurement ?? r.checkIn)!;
    return { repo, m1: get(m1 as never), m2: get(m2 as never), sim: get(sim as never), c1: get(c1 as never), c2: get(c2 as never), cs: get(cs as never) } as never as {
      repo: HealthRepository;
      m1: { id: string; recordedAt: string; measuredAt: string };
      m2: { id: string };
      sim: { id: string };
      c1: { id: string; submittedAt: string };
      c2: { id: string };
      cs: { id: string };
    };
  }

  it('edits a manual measurement in place, keeping id and recordedAt', async () => {
    const { repo, m1 } = await seed();
    const r = await updateMeasurement(m1.id, { metric: 'heartRate', value: 72, unit: 'bpm', measuredAt: m1.measuredAt }, { profileId: 'a', now: LATER }, repo);
    expect(r.status).toBe('saved');
    const saved = await repo.getMeasurement(m1.id);
    expect(saved).toMatchObject({ id: m1.id, value: 72, recordedAt: m1.recordedAt, editedAt: LATER.toISOString(), source: 'manual' });
    expect((await repo.listMeasurements('a')).length).toBe(3); // nothing added
  });

  it('re-validates edits', async () => {
    const { repo, m1 } = await seed();
    const r = await updateMeasurement(m1.id, { metric: 'heartRate', value: 400, unit: 'bpm', measuredAt: m1.measuredAt }, { profileId: 'a', now: LATER }, repo);
    expect(r.status).toBe('rejected');
    expect((await repo.getMeasurement(m1.id))?.value).toBe(77);
  });

  it('refuses to edit or delete simulated readings', async () => {
    const { repo, sim, cs } = await seed();
    expect((await updateMeasurement(sim.id, { metric: 'heartRate', value: 70, unit: 'bpm', measuredAt: NOW.toISOString() }, { profileId: 'a' }, repo)).status).toBe('rejected');
    expect(await deleteManualMeasurement(sim.id, 'a', repo)).toBe(false);
    expect((await updateCheckIn(cs.id, { synthetic: false, sleepHours: 2 }, { profileId: 'a' }, repo)).status).toBe('rejected');
    expect(await deleteManualCheckIn(cs.id, 'a', repo)).toBe(false);
  });

  it('refuses edits from another profile', async () => {
    const { repo, m1 } = await seed();
    expect((await updateMeasurement(m1.id, { metric: 'heartRate', value: 70, unit: 'bpm', measuredAt: NOW.toISOString() }, { profileId: 'b' }, repo)).status).toBe('rejected');
    expect(await deleteManualMeasurement(m1.id, 'b', repo)).toBe(false);
  });

  it('deletes only the selected measurement', async () => {
    const { repo, m1, m2, sim } = await seed();
    expect(await deleteManualMeasurement(m1.id, 'a', repo)).toBe(true);
    expect((await repo.listMeasurements('a')).map((m) => m.id).sort()).toEqual([m2.id, sim.id].sort());
    expect(await repo.listCheckIns('a')).toHaveLength(3);
  });

  it('edits a check-in, keeping its original date', async () => {
    const { repo, c1 } = await seed();
    const r = await updateCheckIn(c1.id, { synthetic: false, sleepHours: 7.5, mood: 4, symptoms: [] }, { profileId: 'a', now: LATER }, repo);
    expect(r.status).toBe('saved');
    expect(await repo.getCheckIn(c1.id)).toMatchObject({ id: c1.id, submittedAt: c1.submittedAt, sleepHours: 7.5, mood: 4, editedAt: LATER.toISOString() });
  });

  it('a check-in edit cannot move its date even if one is supplied', async () => {
    const { repo, c1 } = await seed();
    await updateCheckIn(c1.id, { synthetic: false, sleepHours: 7, submittedAt: '2026-11-01T00:00:00Z' }, { profileId: 'a', now: LATER }, repo);
    expect((await repo.getCheckIn(c1.id))?.submittedAt).toBe(c1.submittedAt);
  });

  it('deletes only the selected check-in; vitals and simulated data stay', async () => {
    const { repo, c1, c2, cs } = await seed();
    expect(await deleteManualCheckIn(c1.id, 'a', repo)).toBe(true);
    expect((await repo.listCheckIns('a')).map((c) => c.id).sort()).toEqual([c2.id, cs.id].sort());
    expect(await repo.listMeasurements('a')).toHaveLength(3);
  });

  it('keeps one manual check-in per day: a second one updates that day', async () => {
    const { repo, c2 } = await seed();
    const r = await ingestCheckIn(
      { submittedAt: '2026-11-15T20:00:00Z', sleepHours: 5, stress: 4, synthetic: false },
      { profileId: 'a', now: new Date('2026-11-15T20:00:00Z') },
      repo,
      { onePerDay: { utcOffsetMinutes: 0 } },
    );
    expect(r.status === 'saved' && r.replaced).toBe(true);
    const manual = await repo.listCheckIns('a', { synthetic: false });
    expect(manual).toHaveLength(2);
    expect(await repo.getCheckIn(c2.id)).toMatchObject({ sleepHours: 5, stress: 4, submittedAt: '2026-11-15T08:00:00.000Z' });
  });

  it('uses the indexed lookup for duplicates', async () => {
    const { repo } = await seed();
    expect((await ingestMeasurement(hr(98, 5), { ...ctx }, repo)).status).toBe('saved');
    expect((await ingestMeasurement(hr(98, 5), { ...ctx }, repo)).status).toBe('duplicate');
  });
});

describe('IndexedDB v1 → v2 upgrade', () => {
  it('keeps existing records and adds the duplicate-check index', async () => {
    const name = 'upgrade-test';
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('checkIns', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
      },
    });
    await v1.put('measurements', {
      id: 'old', profileId: 'a', metric: 'heartRate', kind: 'physiological', value: 70, unit: 'bpm',
      measuredAt: '2026-11-15T11:00:00.000Z', recordedAt: '2026-11-15T11:00:00.000Z', source: 'manual', isSynthetic: false, qualityStatus: 'valid',
    });
    v1.close();
    const repo = await IndexedDbRepository.open(name);
    expect((await repo.listMeasurements('a')).map((m) => m.id)).toEqual(['old']);
    expect(await repo.findMeasurementsAt('a', 'heartRate', '2026-11-15T11:00:00.000Z')).toHaveLength(1);
  });
});
