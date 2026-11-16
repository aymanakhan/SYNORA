import type { CheckIn, Measurement, RawCheckInInput, RawMeasurementInput } from '../../features/health/types';
import type { HealthRepository } from '../storage/repository';
import { validateCheckIn, type CheckInError } from './validateCheckIn';
import { validateMeasurement, type ValidationContext, type ValidationError } from './validate';

export type IngestResult =
  | { status: 'saved'; measurement: Measurement }
  | { status: 'duplicate'; existing: Measurement }
  | { status: 'rejected'; errors: ValidationError[] };

function sameValue(a: Measurement['value'], b: Measurement['value']) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function findDuplicate(m: Measurement, repo: HealthRepository, ignoreId?: string) {
  const sameTime = await repo.findMeasurementsAt(m.profileId, m.metric, m.measuredAt);
  return sameTime.find(
    (e) => e.id !== ignoreId && e.source === m.source && e.isSynthetic === m.isSynthetic && sameValue(e.value, m.value),
  );
}

/**
 * Unified ingestion: source adapter → validation/normalization → duplicate
 * check → storage. Manual entries, the simulated feed and any future device
 * adapter MUST all call this. Callers re-run the assessment afterwards.
 */
export async function ingestMeasurement(
  raw: RawMeasurementInput,
  ctx: ValidationContext,
  repo: HealthRepository,
): Promise<IngestResult> {
  const v = validateMeasurement(raw, ctx);
  if (!v.ok) return { status: 'rejected', errors: v.errors };
  const m = v.measurement;
  const existing = await findDuplicate(m, repo);
  if (existing) return { status: 'duplicate', existing };
  await repo.addMeasurement(m);
  return { status: 'saved', measurement: m };
}

const notEditable = (message: string) => ({ status: 'rejected' as const, errors: [{ field: 'source' as const, message }] });

/**
 * Correct a saved MANUAL measurement (e.g. a typo). Re-validated through the
 * same rules; keeps its id and original recordedAt, and records editedAt.
 * Simulated readings cannot be edited.
 */
export async function updateMeasurement(
  id: string,
  raw: Omit<RawMeasurementInput, 'source'>,
  ctx: Omit<ValidationContext, 'generateId'>,
  repo: HealthRepository,
): Promise<IngestResult> {
  const prev = await repo.getMeasurement(id);
  if (!prev || prev.profileId !== ctx.profileId) return notEditable('That entry no longer exists.');
  if (prev.source !== 'manual' || prev.isSynthetic) return notEditable('Only manual entries can be edited.');
  const v = validateMeasurement({ ...raw, source: 'manual' }, { ...ctx, generateId: () => id });
  if (!v.ok) return { status: 'rejected', errors: v.errors };
  const m: Measurement = { ...v.measurement, recordedAt: prev.recordedAt, editedAt: (ctx.now ?? new Date()).toISOString() };
  const dup = await findDuplicate(m, repo, id);
  if (dup) return { status: 'duplicate', existing: dup };
  await repo.addMeasurement(m);
  return { status: 'saved', measurement: m };
}

export async function deleteManualMeasurement(id: string, profileId: string, repo: HealthRepository): Promise<boolean> {
  const prev = await repo.getMeasurement(id);
  if (!prev || prev.profileId !== profileId || prev.source !== 'manual' || prev.isSynthetic) return false;
  await repo.deleteMeasurement(id);
  return true;
}

export type IngestCheckInResult =
  | { status: 'saved'; checkIn: CheckIn; replaced?: boolean }
  | { status: 'rejected'; errors: CheckInError[] };

type CheckInCtx = { profileId: string; now?: Date; generateId?: () => string };

/**
 * Save a check-in. With `onePerDay`, a manual check-in on a day that already
 * has one updates that day's entry instead of adding a second one.
 */
export async function ingestCheckIn(
  raw: RawCheckInInput,
  ctx: CheckInCtx,
  repo: HealthRepository,
  opts: { onePerDay?: { utcOffsetMinutes: number } } = {},
): Promise<IngestCheckInResult> {
  if (opts.onePerDay && !raw.synthetic) {
    const at = typeof raw.submittedAt === 'number' ? raw.submittedAt : Date.parse(raw.submittedAt);
    const day = (t: number) => Math.floor((t + opts.onePerDay!.utcOffsetMinutes * 60_000) / 86_400_000);
    const sameDay = (await repo.listCheckIns(ctx.profileId, { synthetic: false })).filter(
      (c) => Number.isFinite(at) && day(Date.parse(c.submittedAt)) === day(at),
    );
    const target = sameDay[sameDay.length - 1];
    if (target) {
      const r = await updateCheckIn(target.id, raw, ctx, repo);
      return r.status === 'saved' ? { ...r, replaced: true } : r;
    }
  }
  const v = validateCheckIn(raw, ctx);
  if (!v.ok) return { status: 'rejected', errors: v.errors };
  await repo.addCheckIn(v.checkIn);
  return { status: 'saved', checkIn: v.checkIn };
}

/**
 * Correct a saved MANUAL check-in. Keeps its id and original check-in date
 * (submittedAt), re-validates the new values, and records editedAt.
 */
export async function updateCheckIn(
  id: string,
  raw: Omit<RawCheckInInput, 'submittedAt'> & { submittedAt?: string | number },
  ctx: CheckInCtx,
  repo: HealthRepository,
): Promise<IngestCheckInResult> {
  const prev = await repo.getCheckIn(id);
  if (!prev || prev.profileId !== ctx.profileId) {
    return { status: 'rejected', errors: [{ field: 'submittedAt', message: 'That check-in no longer exists.' }] };
  }
  if (prev.isSynthetic) {
    return { status: 'rejected', errors: [{ field: 'submittedAt', message: 'Simulated check-ins cannot be edited.' }] };
  }
  const v = validateCheckIn({ ...raw, synthetic: false, submittedAt: prev.submittedAt }, { ...ctx, generateId: () => id });
  if (!v.ok) return { status: 'rejected', errors: v.errors };
  const c: CheckIn = { ...v.checkIn, editedAt: (ctx.now ?? new Date()).toISOString() };
  await repo.addCheckIn(c);
  return { status: 'saved', checkIn: c };
}

export async function deleteManualCheckIn(id: string, profileId: string, repo: HealthRepository): Promise<boolean> {
  const prev = await repo.getCheckIn(id);
  if (!prev || prev.profileId !== profileId || prev.isSynthetic) return false;
  await repo.deleteCheckIn(id);
  return true;
}
