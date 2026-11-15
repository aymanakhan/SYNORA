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

  const existing = (await repo.listMeasurements(m.profileId, { synthetic: m.isSynthetic })).find(
    (e) => e.metric === m.metric && e.measuredAt === m.measuredAt && e.source === m.source && sameValue(e.value, m.value),
  );
  if (existing) return { status: 'duplicate', existing };

  await repo.addMeasurement(m);
  return { status: 'saved', measurement: m };
}

export type IngestCheckInResult =
  | { status: 'saved'; checkIn: CheckIn }
  | { status: 'rejected'; errors: CheckInError[] };

export async function ingestCheckIn(
  raw: RawCheckInInput,
  ctx: { profileId: string; now?: Date; generateId?: () => string },
  repo: HealthRepository,
): Promise<IngestCheckInResult> {
  const v = validateCheckIn(raw, ctx);
  if (!v.ok) return { status: 'rejected', errors: v.errors };
  await repo.addCheckIn(v.checkIn);
  return { status: 'saved', checkIn: v.checkIn };
}
