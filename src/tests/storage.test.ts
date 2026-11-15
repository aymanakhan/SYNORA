import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { RawMeasurementInput } from '../features/health/types';
import { ingestCheckIn, ingestMeasurement } from '../services/ingestion/ingest';
import { validateCheckIn } from '../services/ingestion/validateCheckIn';
import { IndexedDbRepository } from '../services/storage/indexedDb';
import { MemoryRepository, type HealthRepository } from '../services/storage/repository';

const NOW = new Date('2026-11-15T12:00:00.000Z');
let n = 0;
const id = () => `id-${++n}`;
const hr = (value: number, source: RawMeasurementInput['source'] = 'manual', minutesAgo = 5): RawMeasurementInput => ({
  metric: 'heartRate',
  value,
  unit: 'bpm',
  measuredAt: NOW.getTime() - minutesAgo * 60_000,
  source,
});

let dbCount = 0;
const factories: [string, () => Promise<HealthRepository>][] = [
  ['MemoryRepository', async () => new MemoryRepository()],
  ['IndexedDbRepository', () => IndexedDbRepository.open(`test-${++dbCount}`)],
];

describe.each(factories)('%s', (_name, make) => {
  it('saves and lists measurements in time order', async () => {
    const repo = await make();
    await ingestMeasurement(hr(70, 'manual', 1), { profileId: 'a', now: NOW, generateId: id }, repo);
    await ingestMeasurement(hr(65, 'manual', 30), { profileId: 'a', now: NOW, generateId: id }, repo);
    const list = await repo.listMeasurements('a');
    expect(list.map((m) => m.value)).toEqual([65, 70]);
  });

  it('isolates profiles', async () => {
    const repo = await make();
    await ingestMeasurement(hr(70), { profileId: 'a', now: NOW, generateId: id }, repo);
    await ingestMeasurement(hr(90), { profileId: 'b', now: NOW, generateId: id }, repo);
    expect((await repo.listMeasurements('a')).map((m) => m.value)).toEqual([70]);
    expect((await repo.listMeasurements('b')).map((m) => m.value)).toEqual([90]);
  });

  it('filters and clears synthetic records without touching manual ones', async () => {
    const repo = await make();
    const ctx = { profileId: 'a', now: NOW, generateId: id };
    await ingestMeasurement(hr(70, 'manual'), ctx, repo);
    await ingestMeasurement(hr(80, 'simulated', 10), ctx, repo);
    await ingestCheckIn({ submittedAt: NOW.getTime(), mood: 4, synthetic: true }, ctx, repo);
    expect((await repo.listMeasurements('a', { synthetic: true })).map((m) => m.value)).toEqual([80]);
    await repo.clearRecords('a', { synthetic: true });
    expect((await repo.listMeasurements('a')).map((m) => m.source)).toEqual(['manual']);
    expect(await repo.listCheckIns('a')).toEqual([]);
  });

  it('rejects invalid input without storing it', async () => {
    const repo = await make();
    const r = await ingestMeasurement(hr(999), { profileId: 'a', now: NOW, generateId: id }, repo);
    expect(r.status).toBe('rejected');
    expect(await repo.listMeasurements('a')).toEqual([]);
  });

  it('detects duplicates of the same reading', async () => {
    const repo = await make();
    const ctx = { profileId: 'a', now: NOW, generateId: id };
    expect((await ingestMeasurement(hr(70), ctx, repo)).status).toBe('saved');
    expect((await ingestMeasurement(hr(70), ctx, repo)).status).toBe('duplicate');
    expect((await ingestMeasurement(hr(71), ctx, repo)).status).toBe('saved');
    expect(await repo.listMeasurements('a')).toHaveLength(2);
  });

  it('stores profiles with pet choice', async () => {
    const repo = await make();
    await repo.saveProfile({ id: 'a', displayName: 'Demo', kind: 'demo', petSpecies: 'axolotl', createdAt: NOW.toISOString() });
    expect((await repo.getProfile('a'))?.petSpecies).toBe('axolotl');
  });
});

describe('IndexedDB persistence', () => {
  it('keeps records and pet choice after reopening (simulates reload)', async () => {
    const name = 'reload-test';
    const first = await IndexedDbRepository.open(name);
    await first.saveProfile({ id: 'a', displayName: 'Demo', kind: 'demo', petSpecies: 'cat', createdAt: NOW.toISOString() });
    await ingestMeasurement(hr(72), { profileId: 'a', now: NOW, generateId: id }, first);
    const second = await IndexedDbRepository.open(name);
    expect((await second.getProfile('a'))?.petSpecies).toBe('cat');
    expect((await second.listMeasurements('a')).map((m) => m.value)).toEqual([72]);
  });
});

describe('validateCheckIn', () => {
  const ctx = { profileId: 'a', now: NOW, generateId: () => 'c1' };

  it('accepts a short check-in and trims symptoms', () => {
    const r = validateCheckIn(
      { submittedAt: NOW.toISOString(), sleepHours: '6.5', mood: 4, stress: '2', symptoms: [' headache ', '', 'headache'], synthetic: false },
      ctx,
    );
    expect(r.ok && r.checkIn).toMatchObject({ sleepHours: 6.5, mood: 4, stress: 2, symptoms: ['headache'], isSynthetic: false });
  });

  it('allows an otherwise empty check-in', () => {
    expect(validateCheckIn({ submittedAt: NOW.toISOString(), synthetic: false }, ctx).ok).toBe(true);
  });

  it.each([
    [{ mood: 6 }, 'mood'],
    [{ stress: 2.5 }, 'stress'],
    [{ sleepHours: 25 }, 'sleepHours'],
    [{ sleepHours: 'lots' }, 'sleepHours'],
    [{ symptoms: 'headache' }, 'symptoms'],
    [{ scenarioId: 'stable' }, 'scenarioId'],
    [{ submittedAt: '2026-11-16T00:00:00Z' }, 'submittedAt'],
  ])('rejects %j', (bad, field) => {
    const r = validateCheckIn({ submittedAt: NOW.toISOString(), synthetic: false, ...bad }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toContain(field);
  });
});
