import type { CheckIn, RawCheckInInput, Scale5 } from '../../features/health/types';

export interface CheckInError {
  field: keyof RawCheckInInput | 'profileId';
  message: string;
}

export type CheckInResult = { ok: true; checkIn: CheckIn } | { ok: false; errors: CheckInError[] };

const MAX_SYMPTOMS = 10;
const MAX_TEXT = 500;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function optionalNumber(v: unknown): number | undefined | null {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return null; // present but malformed
}

/** Validate a daily check-in. Every field except the timestamp is optional — keep check-ins short. */
export function validateCheckIn(
  input: RawCheckInInput,
  ctx: { profileId: string; now?: Date; generateId?: () => string },
): CheckInResult {
  const errors: CheckInError[] = [];
  const now = ctx.now ?? new Date();

  if (!ctx.profileId?.trim()) errors.push({ field: 'profileId', message: 'A profile is required.' });

  const at = typeof input.submittedAt === 'number' ? new Date(input.submittedAt) : new Date(input.submittedAt ?? '');
  if (Number.isNaN(at.getTime()) || input.submittedAt === '') {
    errors.push({ field: 'submittedAt', message: 'Check-in time is missing or invalid.' });
  } else if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.push({ field: 'submittedAt', message: 'Check-in time is in the future.' });
  }

  const num = (field: 'sleepHours' | 'exerciseMinutes', min: number, max: number) => {
    const v = optionalNumber(input[field]);
    if (v === null || (v !== undefined && (v < min || v > max))) {
      errors.push({ field, message: `Must be a number between ${min} and ${max}.` });
      return undefined;
    }
    return v;
  };
  const scale = (field: 'sleepQuality' | 'mood' | 'stress' | 'energy') => {
    const v = optionalNumber(input[field]);
    if (v === null || (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 5))) {
      errors.push({ field, message: 'Must be a whole number from 1 to 5.' });
      return undefined;
    }
    return v as Scale5 | undefined;
  };

  const sleepHours = num('sleepHours', 0, 24);
  const exerciseMinutes = num('exerciseMinutes', 0, 600);
  const sleepQuality = scale('sleepQuality');
  const mood = scale('mood');
  const stress = scale('stress');
  const energy = scale('energy');

  let symptoms: string[] = [];
  if (input.symptoms !== undefined) {
    if (
      !Array.isArray(input.symptoms) ||
      input.symptoms.length > MAX_SYMPTOMS ||
      input.symptoms.some((s) => typeof s !== 'string' || s.length > 100)
    ) {
      errors.push({ field: 'symptoms', message: `Up to ${MAX_SYMPTOMS} short symptom descriptions.` });
    } else {
      symptoms = [...new Set((input.symptoms as string[]).map((s) => s.trim()).filter(Boolean))];
    }
  }

  if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > MAX_TEXT)) {
    errors.push({ field: 'notes', message: `Notes must be text of at most ${MAX_TEXT} characters.` });
  }
  if (!input.synthetic && (input.scenarioId !== undefined || input.missionDay !== undefined)) {
    errors.push({ field: 'scenarioId', message: 'Only simulated check-ins may carry scenario data.' });
  }

  if (errors.length > 0) return { ok: false, errors };

  const checkIn: CheckIn = {
    id: (ctx.generateId ?? (() => globalThis.crypto.randomUUID()))(),
    profileId: ctx.profileId,
    submittedAt: at.toISOString(),
    symptoms,
    isSynthetic: input.synthetic === true,
  };
  if (sleepHours !== undefined) checkIn.sleepHours = sleepHours;
  if (sleepQuality !== undefined) checkIn.sleepQuality = sleepQuality;
  if (mood !== undefined) checkIn.mood = mood;
  if (stress !== undefined) checkIn.stress = stress;
  if (energy !== undefined) checkIn.energy = energy;
  if (exerciseMinutes !== undefined) checkIn.exerciseMinutes = exerciseMinutes;
  if (typeof input.notes === 'string' && input.notes.trim()) checkIn.notes = input.notes.trim();
  if (input.scenarioId !== undefined) checkIn.scenarioId = input.scenarioId;
  if (input.missionDay !== undefined) checkIn.missionDay = input.missionDay;
  return { ok: true, checkIn };
}
