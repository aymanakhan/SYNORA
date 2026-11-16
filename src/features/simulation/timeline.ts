import { assess } from '../health/assessment';
import type { AssessmentResult, AssessmentStatus, CheckIn, Measurement } from '../health/types';
import { validateCheckIn } from '../../services/ingestion/validateCheckIn';
import { validateMeasurement } from '../../services/ingestion/validate';
import { MISSION_DAYS, generateWindow, radiationHistory, simulatedNow, type ScenarioId } from './scenarios';

/**
 * Assess one simulated day through the real validation and assessment code,
 * without touching storage. Used for the scenario timeline preview and tests.
 */
export function assessSimulatedDay(id: ScenarioId, day: number): AssessmentResult {
  const now = simulatedNow(day);
  let n = 0;
  const gen = () => `${id}-${day}-${++n}`;
  const measurements: Measurement[] = [];
  const checkIns: CheckIn[] = [];
  const window = generateWindow(id, day);
  for (const raw of radiationHistory(id, window[0].day)) {
    const r = validateMeasurement(raw, { profileId: 'preview', now, generateId: gen });
    if (r.ok) measurements.push(r.measurement);
  }
  for (const d of window) {
    for (const raw of d.measurements) {
      const r = validateMeasurement(raw, { profileId: 'preview', now, generateId: gen });
      if (r.ok) measurements.push(r.measurement);
    }
    const c = validateCheckIn(d.checkIn, { profileId: 'preview', now, generateId: gen });
    if (c.ok) checkIns.push(c.checkIn);
  }
  return assess({ measurements, checkIns, now, utcOffsetMinutes: 0 });
}

const cache = new Map<ScenarioId, AssessmentStatus[]>();

/** Status for every mission day of a scenario (index 0 = day 1). */
export function scenarioTimeline(id: ScenarioId): AssessmentStatus[] {
  let t = cache.get(id);
  if (!t) {
    t = Array.from({ length: MISSION_DAYS }, (_, i) => assessSimulatedDay(id, i + 1).status);
    cache.set(id, t);
  }
  return t;
}
