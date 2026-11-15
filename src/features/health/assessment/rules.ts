import type { MetricId, RuleDefinition } from '../types';

/**
 * Assessment rule catalog.
 *
 * EVERY threshold in this file is DEMONSTRATION-ONLY. They are round
 * numbers chosen to make the prototype's behaviour understandable; they are
 * not NASA medical standards, flight rules, or clinically validated limits.
 * A rule may only be marked `sourced` once a reviewed source in
 * resources/nasa/reference-links.md supports it and `citation` is set.
 */

// ---------------------------------------------------------------------------
// Freshness and data adequacy
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;

/** How long a reading counts as "current" for assessment. */
export const FRESHNESS_MS = {
  physiological: 24 * HOUR,
  selfReport: 36 * HOUR,
  exposure: 7 * 24 * HOUR,
} as const;

/** Instrument vitals used to judge whether data is adequate. */
export const CORE_VITALS: MetricId[] = ['heartRate', 'bloodPressure', 'bodyTemperature', 'spo2'];
/** Minimum fresh core vitals before the engine will say `stable`. */
export const MIN_CORE_VITALS_FOR_ASSESSMENT = 2;
/** Metrics reported as missing when no current value exists. */
export const EXPECTED_METRICS: MetricId[] = [...CORE_VITALS, 'sleepDuration', 'stress', 'mood'];

// ---------------------------------------------------------------------------
// Range rules
// ---------------------------------------------------------------------------

export type ValueComponent = 'value' | 'systolic' | 'diastolic';

export interface Band {
  /** Triggers when value >= highAtOrAbove. */
  highAtOrAbove?: number;
  /** Triggers when value < lowBelow. */
  lowBelow?: number;
}

export interface RangeRule {
  id: string;
  metric: MetricId;
  component: ValueComponent;
  label: string;
  unit: string;
  review: Band;
  attention: Band;
}

export const RANGE_RULES: RangeRule[] = [
  {
    id: 'R-HR-RANGE',
    metric: 'heartRate',
    component: 'value',
    label: 'Heart rate',
    unit: 'bpm',
    review: { highAtOrAbove: 100, lowBelow: 50 },
    attention: { highAtOrAbove: 120, lowBelow: 40 },
  },
  {
    id: 'R-BP-SYSTOLIC',
    metric: 'bloodPressure',
    component: 'systolic',
    label: 'Systolic blood pressure',
    unit: 'mmHg',
    review: { highAtOrAbove: 140, lowBelow: 90 },
    attention: { highAtOrAbove: 160 },
  },
  {
    id: 'R-BP-DIASTOLIC',
    metric: 'bloodPressure',
    component: 'diastolic',
    label: 'Diastolic blood pressure',
    unit: 'mmHg',
    review: { highAtOrAbove: 90 },
    attention: { highAtOrAbove: 100 },
  },
  {
    id: 'R-TEMP-RANGE',
    metric: 'bodyTemperature',
    component: 'value',
    label: 'Body temperature',
    unit: '°C',
    review: { highAtOrAbove: 38.0, lowBelow: 35.5 },
    attention: { highAtOrAbove: 39.0, lowBelow: 35.0 },
  },
  {
    id: 'R-SPO2-LOW',
    metric: 'spo2',
    component: 'value',
    label: 'Blood oxygen (SpO₂)',
    unit: '%',
    review: { lowBelow: 95 },
    attention: { lowBelow: 92 },
  },
  {
    id: 'R-GLUCOSE-RANGE',
    metric: 'bloodGlucose',
    component: 'value',
    label: 'Blood glucose',
    unit: 'mg/dL',
    review: { highAtOrAbove: 180, lowBelow: 70 },
    attention: { highAtOrAbove: 250, lowBelow: 54 },
  },
];

// ---------------------------------------------------------------------------
// Pattern rules (self-reports)
// ---------------------------------------------------------------------------

export const SLEEP_RULE = {
  /** A single night below this triggers review. */
  singleNightBelowHours: 5,
  /** This many consecutive recent nights below `consecutiveBelowHours`… */
  consecutiveNights: 3,
  consecutiveBelowHours: 6,
  /** …all within this window. */
  windowMs: 96 * HOUR,
} as const;

export const SUSTAINED_SELF_REPORT_RULE = {
  count: 3,
  windowMs: 96 * HOUR,
  stressAtOrAbove: 4,
  moodAtOrBelow: 2,
} as const;

/** Thresholds for check-in flags shown to the pet (not clinical findings). */
export const CHECK_IN_FLAG_THRESHOLDS = {
  shortSleepBelowHours: 6,
  poorSleepQualityAtOrBelow: 2,
  lowEnergyAtOrBelow: 2,
  highStressAtOrAbove: 4,
  lowMoodAtOrBelow: 2,
} as const;

// ---------------------------------------------------------------------------
// Personal baseline
// ---------------------------------------------------------------------------

export interface BaselineMetricConfig {
  metric: MetricId;
  component: ValueComponent;
  label: string;
  unit: string;
  /** Minimum spread used in place of a tiny observed SD (avoids false alarms). */
  minSpread: number;
}

export const BASELINE = {
  minReadings: 7,
  minDistinctDays: 3,
  lookbackMs: 30 * 24 * HOUR,
  /** Deviation, in (floored) standard deviations, that triggers review. */
  deviationThreshold: 3,
  metrics: [
    { metric: 'heartRate', component: 'value', label: 'Heart rate', unit: 'bpm', minSpread: 4 },
    { metric: 'bloodPressure', component: 'systolic', label: 'Systolic blood pressure', unit: 'mmHg', minSpread: 5 },
    { metric: 'bodyTemperature', component: 'value', label: 'Body temperature', unit: '°C', minSpread: 0.2 },
    { metric: 'spo2', component: 'value', label: 'Blood oxygen (SpO₂)', unit: '%', minSpread: 1 },
    { metric: 'bloodGlucose', component: 'value', label: 'Blood glucose', unit: 'mg/dL', minSpread: 8 },
  ] satisfies BaselineMetricConfig[],
} as const;

// ---------------------------------------------------------------------------
// Rule definitions (for UI explanations)
// ---------------------------------------------------------------------------

function describeBand(r: RangeRule): string {
  const parts: string[] = [];
  const { review: rv, attention: at } = r;
  if (rv.highAtOrAbove !== undefined) parts.push(`review at ≥ ${rv.highAtOrAbove} ${r.unit}`);
  if (rv.lowBelow !== undefined) parts.push(`review below ${rv.lowBelow} ${r.unit}`);
  if (at.highAtOrAbove !== undefined) parts.push(`attention at ≥ ${at.highAtOrAbove} ${r.unit}`);
  if (at.lowBelow !== undefined) parts.push(`attention below ${at.lowBelow} ${r.unit}`);
  return `${r.label}: ${parts.join('; ')}. Demonstration-only thresholds.`;
}

export const RULE_DEFINITIONS: RuleDefinition[] = [
  ...RANGE_RULES.map<RuleDefinition>((r) => ({
    id: r.id,
    title: `${r.label} outside demonstration range`,
    metrics: [r.metric],
    hazards:
      r.metric === 'bloodPressure' || r.metric === 'heartRate'
        ? ['gravity-fields']
        : ['hostile-closed-environment'],
    evidence: 'demonstration-only',
    description: describeBand(r),
  })),
  {
    id: 'R-SLEEP-SHORT',
    title: 'Short sleep',
    metrics: ['sleepDuration'],
    hazards: ['isolation-confinement', 'hostile-closed-environment'],
    evidence: 'demonstration-only',
    description: `Review if the latest night is under ${SLEEP_RULE.singleNightBelowHours} h, or the last ${SLEEP_RULE.consecutiveNights} nights are all under ${SLEEP_RULE.consecutiveBelowHours} h.`,
  },
  {
    id: 'R-STRESS-SUSTAINED',
    title: 'Sustained high stress',
    metrics: ['stress'],
    hazards: ['isolation-confinement', 'distance-from-earth'],
    evidence: 'demonstration-only',
    description: `Review if the last ${SUSTAINED_SELF_REPORT_RULE.count} stress self-reports are all ≥ ${SUSTAINED_SELF_REPORT_RULE.stressAtOrAbove}/5.`,
  },
  {
    id: 'R-MOOD-LOW',
    title: 'Persistently low mood',
    metrics: ['mood'],
    hazards: ['isolation-confinement', 'distance-from-earth'],
    evidence: 'demonstration-only',
    description: `Review if the last ${SUSTAINED_SELF_REPORT_RULE.count} mood self-reports are all ≤ ${SUSTAINED_SELF_REPORT_RULE.moodAtOrBelow}/5.`,
  },
  {
    id: 'R-SYMPTOMS-REPORTED',
    title: 'Symptoms reported',
    metrics: [],
    hazards: [],
    evidence: 'demonstration-only',
    description: 'Review when the latest check-in lists any symptom. Reporting symptoms is always encouraged.',
  },
  {
    id: 'R-BASELINE-DEVIATION',
    title: 'Unusual compared with personal baseline',
    metrics: BASELINE.metrics.map((m) => m.metric),
    hazards: [],
    evidence: 'demonstration-only',
    description: `Review if a reading is ≥ ${BASELINE.deviationThreshold} standard deviations from the personal average. Requires ≥ ${BASELINE.minReadings} prior readings over ≥ ${BASELINE.minDistinctDays} days.`,
  },
  {
    id: 'R-DATA-QUALITY',
    title: 'Reading flagged for re-measurement',
    metrics: [],
    hazards: [],
    evidence: 'demonstration-only',
    description: 'Review when the latest reading of a metric was flagged as suspect during ingestion.',
  },
];

export function getRuleDefinition(id: string): RuleDefinition | undefined {
  return RULE_DEFINITIONS.find((r) => r.id === id);
}
