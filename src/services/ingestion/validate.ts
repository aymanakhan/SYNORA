import { BLOOD_PRESSURE_PLAUSIBLE, METRICS, isMetricId } from '../../features/health/metrics';
import type {
  BloodPressureValue,
  Measurement,
  MeasurementSource,
  MeasurementValue,
  RawMeasurementInput,
} from '../../features/health/types';
import { canonicalizeUnitSpelling, rangeInUnit, toCanonical } from './units';

export interface ValidationError {
  field: keyof RawMeasurementInput | 'profileId';
  message: string;
}

export type ValidationResult =
  | { ok: true; measurement: Measurement }
  | { ok: false; errors: ValidationError[] };

export interface ValidationContext {
  profileId: string;
  /** Injected clock for deterministic tests and simulation. */
  now?: Date;
  /** Injected ID generator for deterministic tests. */
  generateId?: () => string;
}

const SOURCES: MeasurementSource[] = ['manual', 'simulated', 'device', 'import'];
/** Tolerated clock skew for timestamps slightly in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_TEXT_LENGTH = 500;
/**
 * Data-quality heuristic (demonstration-only, not a clinical rule): a very
 * narrow systolic–diastolic gap often indicates a cuff/entry error.
 */
const MIN_PLAUSIBLE_PULSE_PRESSURE = 15;
/** Tolerance for unit-conversion rounding (e.g. 109.4 °F → 43.000000000000004 °C). */
const EPS = 1e-9;

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return undefined;
}

function parseTimestamp(value: string | number): Date | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value) : undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function defaultId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Validate and normalize one raw reading from any source.
 *
 * This is the single entry point every source adapter must use, so manual
 * and simulated readings receive identical treatment. Malformed or
 * implausible input is rejected — values are never fabricated or clamped.
 */
export function validateMeasurement(
  input: RawMeasurementInput,
  ctx: ValidationContext,
): ValidationResult {
  const errors: ValidationError[] = [];
  const qualityNotes: string[] = [];
  const now = ctx.now ?? new Date();

  if (!ctx.profileId || ctx.profileId.trim() === '') {
    errors.push({ field: 'profileId', message: 'A profile is required.' });
  }

  if (!SOURCES.includes(input.source)) {
    errors.push({ field: 'source', message: `Unknown source "${String(input.source)}".` });
  }

  if (input.source !== 'simulated') {
    if (input.scenarioId !== undefined) {
      errors.push({ field: 'scenarioId', message: 'Only simulated readings may carry a scenario.' });
    }
    if (input.missionDay !== undefined) {
      errors.push({ field: 'missionDay', message: 'Only simulated readings may carry a mission day.' });
    }
  }

  const measuredAt = parseTimestamp(input.measuredAt);
  if (!measuredAt) {
    errors.push({ field: 'measuredAt', message: 'Measurement time is missing or invalid.' });
  } else if (measuredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.push({ field: 'measuredAt', message: 'Measurement time is in the future.' });
  }

  for (const field of ['notes', 'deviceOrMethod'] as const) {
    const text = input[field];
    if (text !== undefined && (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH)) {
      errors.push({ field, message: `Must be text of at most ${MAX_TEXT_LENGTH} characters.` });
    }
  }

  if (typeof input.metric !== 'string' || !isMetricId(input.metric)) {
    errors.push({ field: 'metric', message: `Unknown metric "${String(input.metric)}".` });
    return { ok: false, errors };
  }
  const metric = input.metric;
  const def = METRICS[metric];

  if (typeof input.unit !== 'string' || input.unit.trim() === '') {
    errors.push({ field: 'unit', message: `A unit is required for ${def.label}.` });
    return { ok: false, errors };
  }

  let value: MeasurementValue | undefined;
  let original: Measurement['original'];

  if (metric === 'bloodPressure') {
    const raw = input.value as Partial<Record<keyof BloodPressureValue, unknown>> | null;
    const systolic = raw && typeof raw === 'object' ? parseNumber(raw.systolic) : undefined;
    const diastolic = raw && typeof raw === 'object' ? parseNumber(raw.diastolic) : undefined;
    const spelled = canonicalizeUnitSpelling(input.unit);

    if (spelled !== 'mmHg') {
      errors.push({ field: 'unit', message: 'Blood pressure must be in mmHg.' });
    }
    if (systolic === undefined || diastolic === undefined) {
      errors.push({ field: 'value', message: 'Blood pressure needs numeric systolic and diastolic values.' });
    } else {
      const s = BLOOD_PRESSURE_PLAUSIBLE.systolic;
      const d = BLOOD_PRESSURE_PLAUSIBLE.diastolic;
      if (systolic < s.min || systolic > s.max) {
        errors.push({ field: 'value', message: `Systolic must be between ${s.min} and ${s.max} mmHg.` });
      }
      if (diastolic < d.min || diastolic > d.max) {
        errors.push({ field: 'value', message: `Diastolic must be between ${d.min} and ${d.max} mmHg.` });
      }
      if (diastolic >= systolic) {
        errors.push({ field: 'value', message: 'Diastolic must be lower than systolic.' });
      } else if (systolic - diastolic < MIN_PLAUSIBLE_PULSE_PRESSURE) {
        qualityNotes.push('Very narrow systolic–diastolic gap; consider re-measuring.');
      }
      value = { systolic, diastolic };
    }
  } else {
    const num = parseNumber(input.value);
    if (num === undefined) {
      errors.push({ field: 'value', message: `${def.label} needs a numeric value.` });
    } else {
      const conv = toCanonical(metric, num, input.unit);
      if (!conv.ok) {
        errors.push({ field: 'unit', message: conv.error });
      } else {
        if (conv.converted) {
          original = { value: num, unit: canonicalizeUnitSpelling(input.unit)! };
        }
        const range = def.plausibleRange;
        if (range && (conv.value < range.min - EPS || conv.value > range.max + EPS)) {
          // Report the limits in the unit the user entered.
          const shown = rangeInUnit(metric, input.unit)!;
          errors.push({
            field: 'value',
            message: `${def.label} must be between ${shown.min} and ${shown.max} ${shown.unit}.`,
          });
        }
        if (def.integer && !Number.isInteger(conv.value)) {
          errors.push({ field: 'value', message: `${def.label} must be a whole number.` });
        }
        value = conv.value;
      }
    }
  }

  if (metric === 'radiationDose') {
    const period = input.exposurePeriodHours;
    if (period !== undefined && (typeof period !== 'number' || !Number.isFinite(period) || period <= 0)) {
      errors.push({ field: 'exposurePeriodHours', message: 'Exposure period must be a positive number of hours.' });
    } else if (period === undefined) {
      qualityNotes.push('Exposure period not stated; dose cannot be compared over time.');
    }
  } else if (input.exposurePeriodHours !== undefined) {
    errors.push({ field: 'exposurePeriodHours', message: 'Exposure period applies to radiation dose only.' });
  }

  if (errors.length > 0 || value === undefined || !measuredAt) {
    return { ok: false, errors };
  }

  const measurement: Measurement = {
    id: (ctx.generateId ?? defaultId)(),
    profileId: ctx.profileId,
    metric,
    kind: def.kind,
    value,
    unit: def.canonicalUnit,
    measuredAt: measuredAt.toISOString(),
    recordedAt: now.toISOString(),
    source: input.source,
    // Derived from source only — callers cannot mark simulated data as real.
    isSynthetic: input.source === 'simulated',
    qualityStatus: qualityNotes.length > 0 ? 'suspect' : 'valid',
  };
  if (original) measurement.original = original;
  if (qualityNotes.length > 0) measurement.qualityNotes = qualityNotes;
  if (input.deviceOrMethod) measurement.deviceOrMethod = input.deviceOrMethod;
  if (input.notes) measurement.notes = input.notes;
  if (input.scenarioId !== undefined) measurement.scenarioId = input.scenarioId;
  if (input.missionDay !== undefined) measurement.missionDay = input.missionDay;
  if (input.exposurePeriodHours !== undefined) measurement.exposurePeriodHours = input.exposurePeriodHours;

  return { ok: true, measurement };
}
