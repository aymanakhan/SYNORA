import type { MeasurementKind, MetricId, SpaceflightHazard } from './types';

/**
 * Metric catalog.
 *
 * `plausibleRange` is an INPUT-SANITY limit used to reject typos and
 * physically implausible values. It is NOT a clinical or NASA threshold and
 * must never be used to decide health status — that belongs to the
 * assessment engine's documented rules.
 */
export interface MetricDefinition {
  id: MetricId;
  label: string;
  kind: MeasurementKind;
  canonicalUnit: string;
  /** Units accepted on input (canonical first). */
  acceptedUnits: string[];
  plausibleRange?: { min: number; max: number };
  /** Values must be whole numbers (e.g. 1–5 scales). */
  integer?: boolean;
  hazards: SpaceflightHazard[];
  /** Typical instrument or method, for labels and how-to cards. */
  typicalMethod: string;
}

export const METRICS: Record<MetricId, MetricDefinition> = {
  heartRate: {
    id: 'heartRate',
    label: 'Heart rate',
    kind: 'physiological',
    canonicalUnit: 'bpm',
    acceptedUnits: ['bpm'],
    plausibleRange: { min: 20, max: 250 },
    hazards: ['gravity-fields', 'isolation-confinement'],
    typicalMethod: 'Heart-rate monitor or pulse oximeter',
  },
  bloodPressure: {
    id: 'bloodPressure',
    label: 'Blood pressure',
    kind: 'physiological',
    canonicalUnit: 'mmHg',
    acceptedUnits: ['mmHg'],
    // Applied to systolic and diastolic separately; see validate.ts.
    hazards: ['gravity-fields'],
    typicalMethod: 'Blood pressure cuff',
  },
  bodyTemperature: {
    id: 'bodyTemperature',
    label: 'Body temperature',
    kind: 'physiological',
    canonicalUnit: '°C',
    acceptedUnits: ['°C', '°F'],
    // 25–43 °C (= 77–109.4 °F): team-agreed manual-entry limits; values outside are rejected as likely typos.
    plausibleRange: { min: 25, max: 43 },
    hazards: ['hostile-closed-environment'],
    typicalMethod: 'Thermometer',
  },
  spo2: {
    id: 'spo2',
    label: 'Blood oxygen (SpO₂)',
    kind: 'physiological',
    canonicalUnit: '%',
    acceptedUnits: ['%'],
    plausibleRange: { min: 50, max: 100 },
    hazards: ['hostile-closed-environment'],
    typicalMethod: 'Pulse oximeter',
  },
  bloodGlucose: {
    id: 'bloodGlucose',
    label: 'Blood glucose',
    kind: 'physiological',
    canonicalUnit: 'mg/dL',
    acceptedUnits: ['mg/dL', 'mmol/L'],
    plausibleRange: { min: 20, max: 600 },
    hazards: ['hostile-closed-environment', 'distance-from-earth'],
    typicalMethod: 'Glucose meter (finger-stick)',
  },
  sleepDuration: {
    id: 'sleepDuration',
    label: 'Sleep duration',
    kind: 'selfReport',
    canonicalUnit: 'h',
    acceptedUnits: ['h', 'min'],
    plausibleRange: { min: 0, max: 24 },
    hazards: ['isolation-confinement', 'hostile-closed-environment'],
    typicalMethod: 'Self-report or sleep log',
  },
  sleepQuality: {
    id: 'sleepQuality',
    label: 'Sleep quality',
    kind: 'selfReport',
    canonicalUnit: 'scale 1–5',
    acceptedUnits: ['scale 1–5'],
    plausibleRange: { min: 1, max: 5 },
    integer: true,
    hazards: ['isolation-confinement'],
    typicalMethod: 'Self-report',
  },
  mood: {
    id: 'mood',
    label: 'Mood',
    kind: 'selfReport',
    canonicalUnit: 'scale 1–5',
    acceptedUnits: ['scale 1–5'],
    plausibleRange: { min: 1, max: 5 },
    integer: true,
    hazards: ['isolation-confinement', 'distance-from-earth'],
    typicalMethod: 'Self-report',
  },
  stress: {
    id: 'stress',
    label: 'Stress',
    kind: 'selfReport',
    canonicalUnit: 'scale 1–5',
    acceptedUnits: ['scale 1–5'],
    plausibleRange: { min: 1, max: 5 },
    integer: true,
    hazards: ['isolation-confinement', 'distance-from-earth'],
    typicalMethod: 'Self-report',
  },
  energy: {
    id: 'energy',
    label: 'Energy',
    kind: 'selfReport',
    canonicalUnit: 'scale 1–5',
    acceptedUnits: ['scale 1–5'],
    plausibleRange: { min: 1, max: 5 },
    integer: true,
    hazards: ['isolation-confinement'],
    typicalMethod: 'Self-report',
  },
  radiationDose: {
    id: 'radiationDose',
    label: 'Radiation dose',
    kind: 'exposure',
    canonicalUnit: 'mSv',
    acceptedUnits: ['mSv', 'µSv'],
    plausibleRange: { min: 0, max: 1000 },
    hazards: ['radiation'],
    typicalMethod: 'Personal dosimeter',
  },
};

/** Input-sanity limits for blood pressure (not clinical thresholds). */
export const BLOOD_PRESSURE_PLAUSIBLE = {
  systolic: { min: 50, max: 300 },
  diastolic: { min: 30, max: 200 },
} as const;

export function isMetricId(value: string): value is MetricId {
  return Object.prototype.hasOwnProperty.call(METRICS, value);
}
