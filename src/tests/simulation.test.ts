import { describe, expect, it } from 'vitest';
import { assess } from '../features/health/assessment';
import type { CheckIn, Measurement } from '../features/health/types';
import { derivePetWellness } from '../features/pets/wellness';
import { MISSION_DAYS, SCENARIOS, generateDay, generateWindow, simulatedNow, type ScenarioId } from '../features/simulation/scenarios';
import { validateCheckIn } from '../services/ingestion/validateCheckIn';
import { validateMeasurement } from '../services/ingestion/validate';

/** Run a scenario window through the real validation + assessment path. */
function assessDay(id: ScenarioId, day: number) {
  const now = simulatedNow(day);
  let n = 0;
  const gen = () => `${id}-${day}-${++n}`;
  const measurements: Measurement[] = [];
  const checkIns: CheckIn[] = [];
  for (const d of generateWindow(id, day)) {
    for (const raw of d.measurements) {
      const r = validateMeasurement(raw, { profileId: 'sim', now, generateId: gen });
      if (!r.ok) throw new Error(`invalid simulated reading day ${d.day}: ${JSON.stringify(r.errors)}`);
      measurements.push(r.measurement);
    }
    const c = validateCheckIn(d.checkIn, { profileId: 'sim', now, generateId: gen });
    if (!c.ok) throw new Error(`invalid simulated check-in day ${d.day}: ${JSON.stringify(c.errors)}`);
    checkIns.push(c.checkIn);
  }
  return assess({ measurements, checkIns, now, utcOffsetMinutes: 0 });
}

describe('mission simulator', () => {
  it('is deterministic', () => {
    expect(generateDay('atypical-vital', 123)).toEqual(generateDay('atypical-vital', 123));
  });

  it('labels every reading as simulated with scenario and day', () => {
    const d = generateDay('stable', 10);
    for (const m of d.measurements) expect(m).toMatchObject({ source: 'simulated', scenarioId: 'stable', missionDay: 10 });
    expect(d.checkIn).toMatchObject({ synthetic: true, scenarioId: 'stable', missionDay: 10 });
  });

  it('rejects days outside the mission', () => {
    expect(() => generateDay('stable', 0)).toThrow(RangeError);
    expect(() => generateDay('stable', MISSION_DAYS + 1)).toThrow(RangeError);
  });

  it('generates a window that starts at day 1 when needed', () => {
    expect(generateWindow('stable', 3).map((d) => d.day)).toEqual([1, 2, 3]);
    expect(generateWindow('stable', 50)).toHaveLength(30);
  });

  it.each(SCENARIOS.map((s) => s.id))('every day of "%s" passes validation', (id) => {
    for (let day = 1; day <= MISSION_DAYS; day++) {
      const now = simulatedNow(day);
      const d = generateDay(id, day);
      for (const raw of d.measurements) expect(validateMeasurement(raw, { profileId: 'p', now }).ok).toBe(true);
      expect(validateCheckIn(d.checkIn, { profileId: 'p', now }).ok).toBe(true);
    }
  });

  it('stable scenario stays stable and the pet is happy at every key day and day 180', () => {
    for (const day of [1, 30, 90, 150, 180]) {
      const r = assessDay('stable', day);
      expect({ day, status: r.status, findings: r.findings.map((f) => f.ruleId) }).toEqual({ day, status: 'stable', findings: [] });
      expect(derivePetWellness(r)).toBe('happy');
      expect(r.basedOnSyntheticData).toBe(true);
    }
  });

  it('stable scenario never triggers a finding on any day', () => {
    for (let day = 1; day <= MISSION_DAYS; day++) {
      expect({ day, findings: assessDay('stable', day).findings.map((f) => f.ruleId) }).toEqual({ day, findings: [] });
    }
  });

  it('worsening sleep: stable before onset, short-sleep review later', () => {
    expect(assessDay('worsening-sleep', 35).status).toBe('stable');
    const late = assessDay('worsening-sleep', 110);
    expect(late.findings.map((f) => f.ruleId)).toContain('R-SLEEP-SHORT');
    expect(derivePetWellness(late)).toBe('concerned');
  });

  it('elevated stress: sustained-stress review', () => {
    expect(assessDay('elevated-stress', 65).status).toBe('stable');
    expect(assessDay('elevated-stress', 100).findings.map((f) => f.ruleId)).toContain('R-STRESS-SUSTAINED');
  });

  it('atypical vital: attention at peak, stable before and after', () => {
    expect(assessDay('atypical-vital', 118).status).toBe('stable');
    const peak = assessDay('atypical-vital', 124);
    expect(peak.status).toBe('attention');
    expect(peak.nextStep).toBe('consult-flight-surgeon');
    expect(assessDay('atypical-vital', 132).status).toBe('stable');
  });

  it('recovery: flagged early, stable after recovering', () => {
    expect(assessDay('recovery', 20).status).toBe('review');
    expect(assessDay('recovery', 90).status).toBe('stable');
  });
});

describe('solar particle event scenario', () => {
  it('stable before, attention at the storm peak, and a mission total that keeps growing', async () => {
    const { assessSimulatedDay } = await import('../features/simulation/timeline');
    expect(assessSimulatedDay('radiation-event', 93).status).toBe('stable');
    const peak = assessSimulatedDay('radiation-event', 96);
    expect(peak.status).toBe('attention');
    expect(peak.findings.map((f) => f.ruleId)).toContain('R-RAD-DOSE-RATE');
    expect(assessSimulatedDay('radiation-event', 100).status).toBe('stable');
    const late = assessSimulatedDay('radiation-event', 175);
    expect(late.findings.map((f) => f.ruleId)).toContain('R-RAD-CUMULATIVE');
    expect(late.radiation!.readings).toBe(175);
  });

  it('the stable scenario never reaches the cumulative threshold', async () => {
    const { assessSimulatedDay } = await import('../features/simulation/timeline');
    const end = assessSimulatedDay('stable', 180);
    expect(end.radiation!.readings).toBe(180);
    expect(end.radiation!.totalMSv).toBeLessThan(150);
    expect(end.status).toBe('stable');
  });
});
