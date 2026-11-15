import type { RawCheckInInput, RawMeasurementInput } from '../health/types';

/**
 * Deterministic, FICTIONAL 180-day Mars mission.
 *
 * Every value is synthetic. The physiology here is a hand-tuned
 * illustration for demonstrating SYNORA's pipeline; it is not a forecast or
 * model of real astronaut physiology and is not derived from NASA data.
 */

export const MISSION_DAYS = 180;
/** Fictional mission epoch (UTC). */
export const MISSION_START_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type ScenarioId = 'stable' | 'worsening-sleep' | 'elevated-stress' | 'atypical-vital' | 'recovery';

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  /** Suggested days that show the scenario's story. */
  keyDays: { day: number; label: string }[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'stable',
    name: 'Stable mission',
    description: 'Readings vary a little day to day but stay within demonstration ranges.',
    keyDays: [
      { day: 1, label: 'Launch' },
      { day: 90, label: 'Mid-mission' },
      { day: 180, label: 'Arrival' },
    ],
  },
  {
    id: 'worsening-sleep',
    name: 'Worsening sleep',
    description: 'From day 40, sleep gradually shortens and energy falls.',
    keyDays: [
      { day: 35, label: 'Before' },
      { day: 75, label: 'Sleep debt builds' },
      { day: 110, label: 'Severe' },
    ],
  },
  {
    id: 'elevated-stress',
    name: 'Elevated stress',
    description: 'From day 70, self-reported stress rises and mood drops.',
    keyDays: [
      { day: 65, label: 'Before' },
      { day: 88, label: 'First flag' },
      { day: 100, label: 'Sustained' },
    ],
  },
  {
    id: 'atypical-vital',
    name: 'Atypical vital sign',
    description: 'Around days 120–127, heart rate, temperature and SpO₂ move away from usual values.',
    keyDays: [
      { day: 118, label: 'Before' },
      { day: 121, label: 'Early change' },
      { day: 124, label: 'Peak' },
      { day: 132, label: 'After' },
    ],
  },
  {
    id: 'recovery',
    name: 'Recovery',
    description: 'Poor sleep and high stress early in the mission, recovering between days 45 and 75.',
    keyDays: [
      { day: 20, label: 'Struggling' },
      { day: 55, label: 'Recovering' },
      { day: 90, label: 'Recovered' },
    ],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function dayStartMs(day: number): number {
  return MISSION_START_MS + (day - 1) * DAY_MS;
}

/** The simulated "current time" when viewing a mission day (20:00 that day). */
export function simulatedNow(day: number): Date {
  return new Date(dayStartMs(day) + 20 * HOUR_MS);
}

// ---------------------------------------------------------------------------
// Deterministic noise
// ---------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Uniform noise in [-amp, amp], fixed for a given key. */
function noise(key: string, amp: number): number {
  let t = (hash(key) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return (u * 2 - 1) * amp;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number, dp = 0) => Number(x.toFixed(dp));
const scale = (x: number) => Math.min(5, Math.max(1, Math.round(x)));

// ---------------------------------------------------------------------------
// Scenario effects
// ---------------------------------------------------------------------------

interface Effects {
  hr: number;
  sys: number;
  dia: number;
  temp: number;
  spo2: number;
  sleep: number;
  sleepQuality: number;
  stress: number;
  mood: number;
  energy: number;
  symptoms: string[];
}

function effects(id: ScenarioId, day: number): Effects {
  const e: Effects = { hr: 0, sys: 0, dia: 0, temp: 0, spo2: 0, sleep: 0, sleepQuality: 0, stress: 0, mood: 0, energy: 0, symptoms: [] };
  switch (id) {
    case 'stable':
      break;
    case 'worsening-sleep': {
      const f = clamp01((day - 40) / 60);
      e.sleep = -2.9 * f;
      e.sleepQuality = -2 * f;
      e.energy = -2 * f;
      e.stress = 1 * f;
      e.hr = 3 * f;
      break;
    }
    case 'elevated-stress': {
      const f = clamp01((day - 70) / 20);
      e.stress = 2.6 * f;
      e.mood = -2.2 * f;
      e.sleep = -0.8 * f;
      e.hr = 5 * f;
      e.sys = 6 * f;
      break;
    }
    case 'atypical-vital': {
      // Plateau on days 123–124, ramping over 3 days either side (zero outside 120–127).
      const g = clamp01(1 - Math.max(0, Math.abs(day - 123.5) - 0.5) / 3);
      e.hr = 64 * g;
      e.temp = 1.6 * g;
      e.spo2 = -6 * g;
      e.energy = -2 * g;
      if (g >= 0.5) e.symptoms = ['headache', 'fatigue'];
      break;
    }
    case 'recovery': {
      const f = day <= 45 ? 1 : clamp01(1 - (day - 45) / 30);
      e.sleep = -2.3 * f;
      e.sleepQuality = -2 * f;
      e.stress = 2.4 * f;
      e.mood = -1.6 * f;
      e.energy = -1.8 * f;
      e.hr = 8 * f;
      break;
    }
  }
  return e;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface SimulatedDay {
  day: number;
  measurements: RawMeasurementInput[];
  checkIn: RawCheckInInput;
}

/** Synthetic readings for one mission day. Pure and deterministic. */
export function generateDay(id: ScenarioId, day: number): SimulatedDay {
  if (!Number.isInteger(day) || day < 1 || day > MISSION_DAYS) {
    throw new RangeError(`Mission day must be an integer from 1 to ${MISSION_DAYS}.`);
  }
  const e = effects(id, day);
  const k = (metric: string) => `${id}|${day}|${metric}`;
  const start = dayStartMs(day);
  const vitalsAt = start + 7 * HOUR_MS;
  const common = { source: 'simulated' as const, scenarioId: id, missionDay: day, deviceOrMethod: 'Simulated sensor feed' };

  const measurements: RawMeasurementInput[] = [
    { ...common, metric: 'heartRate', unit: 'bpm', measuredAt: vitalsAt, value: round(62 + e.hr + noise(k('hr'), 3)) },
    {
      ...common,
      metric: 'bloodPressure',
      unit: 'mmHg',
      measuredAt: vitalsAt,
      value: { systolic: round(116 + e.sys + noise(k('sys'), 4)), diastolic: round(75 + e.dia + noise(k('dia'), 3)) },
    },
    { ...common, metric: 'bodyTemperature', unit: '°C', measuredAt: vitalsAt, value: round(36.7 + e.temp + noise(k('t'), 0.15), 1) },
    { ...common, metric: 'spo2', unit: '%', measuredAt: vitalsAt, value: Math.min(100, round(98 + e.spo2 + noise(k('o2'), 0.8))) },
    {
      ...common,
      metric: 'radiationDose',
      unit: 'mSv',
      measuredAt: start + 6 * HOUR_MS, // dose for the preceding 24 h
      exposurePeriodHours: 24,
      deviceOrMethod: 'Simulated dosimeter',
      value: round(0.6 + noise(k('rad'), 0.05), 3),
    },
  ];
  if (day % 3 === 1) {
    measurements.push({ ...common, metric: 'bloodGlucose', unit: 'mg/dL', measuredAt: vitalsAt, value: round(92 + noise(k('glu'), 8)) });
  }

  const checkIn: RawCheckInInput = {
    submittedAt: start + 7.5 * HOUR_MS,
    synthetic: true,
    scenarioId: id,
    missionDay: day,
    sleepHours: round(7.4 + e.sleep + noise(k('sleep'), 0.3), 1),
    sleepQuality: scale(4 + e.sleepQuality + noise(k('sq'), 0.4)),
    mood: scale(4 + e.mood + noise(k('mood'), 0.4)),
    stress: scale(2 + e.stress + noise(k('stress'), 0.4)),
    energy: scale(4 + e.energy + noise(k('energy'), 0.4)),
    symptoms: e.symptoms,
    exerciseMinutes: round(120 + noise(k('ex'), 20)),
  };

  return { day, measurements, checkIn };
}

/** Days [max(1, endDay - windowDays + 1) … endDay], oldest first. */
export function generateWindow(id: ScenarioId, endDay: number, windowDays = 14): SimulatedDay[] {
  const from = Math.max(1, endDay - windowDays + 1);
  const days: SimulatedDay[] = [];
  for (let d = from; d <= endDay; d++) days.push(generateDay(id, d));
  return days;
}
