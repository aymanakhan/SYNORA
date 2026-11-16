/**
 * SYNORA shared data contract.
 *
 * Every feature (ingestion, storage, assessment, dashboard, pet, simulator)
 * depends on these types. Coordinate with the team before changing them.
 */

// ---------------------------------------------------------------------------
// Spaceflight context
// ---------------------------------------------------------------------------

/** NASA Human Research Program's five hazards of human spaceflight. */
export type SpaceflightHazard =
  | 'radiation'
  | 'isolation-confinement'
  | 'distance-from-earth'
  | 'gravity-fields'
  | 'hostile-closed-environment';

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export type MetricId =
  | 'heartRate'
  | 'bloodPressure'
  | 'bodyTemperature'
  | 'spo2'
  | 'bloodGlucose'
  | 'sleepDuration'
  | 'sleepQuality'
  | 'mood'
  | 'stress'
  | 'energy'
  | 'radiationDose';

/** physiological = instrument reading; selfReport = subjective; exposure = environmental/dosimeter. */
export type MeasurementKind = 'physiological' | 'selfReport' | 'exposure';

/** Where a reading came from. `device` and `import` are future/stretch sources. */
export type MeasurementSource = 'manual' | 'simulated' | 'device' | 'import';

/**
 * Data-quality flag set by ingestion (not a clinical judgement).
 * - valid:   passed all checks
 * - suspect: accepted, but a data-quality heuristic suggests re-measuring
 */
export type QualityStatus = 'valid' | 'suspect';

export interface BloodPressureValue {
  systolic: number;
  diastolic: number;
}

export type MeasurementValue = number | BloodPressureValue;

/** Normalized, validated reading. The only shape stored and assessed. */
export interface Measurement {
  id: string;
  profileId: string;
  metric: MetricId;
  kind: MeasurementKind;
  /** Value in the metric's canonical unit. */
  value: MeasurementValue;
  /** Canonical unit, e.g. "bpm", "mmHg", "°C", "mg/dL". */
  unit: string;
  /** Present when the input unit differed from the canonical unit. */
  original?: { value: MeasurementValue; unit: string };
  /** When the measurement was taken (ISO 8601). */
  measuredAt: string;
  /** When SYNORA received it (ISO 8601). */
  recordedAt: string;
  source: MeasurementSource;
  /** True for every simulated reading. Never true for manual entries. */
  isSynthetic: boolean;
  qualityStatus: QualityStatus;
  /** Human-readable reasons for `suspect` quality. */
  qualityNotes?: string[];
  deviceOrMethod?: string;
  notes?: string;
  /** Simulator scenario that produced this reading (simulated source only). */
  scenarioId?: string;
  /** Simulated mission day (simulated source only). */
  missionDay?: number;
  /** Radiation: exposure period the dose covers, in hours. */
  exposurePeriodHours?: number;
  /** Set when a manual entry was corrected after saving (ISO 8601). */
  editedAt?: string;
}

/** Un-validated input from any source adapter (form, simulator, future device). */
export interface RawMeasurementInput {
  metric: string;
  value: unknown;
  unit: string;
  /** ISO 8601 string or epoch milliseconds. */
  measuredAt: string | number;
  source: MeasurementSource;
  deviceOrMethod?: string;
  notes?: string;
  scenarioId?: string;
  missionDay?: number;
  exposurePeriodHours?: number;
}

// ---------------------------------------------------------------------------
// Daily check-in
// ---------------------------------------------------------------------------

/** 1 (lowest) … 5 (highest). */
export type Scale5 = 1 | 2 | 3 | 4 | 5;

export interface CheckIn {
  id: string;
  profileId: string;
  submittedAt: string;
  sleepHours?: number;
  sleepQuality?: Scale5;
  mood?: Scale5;
  stress?: Scale5;
  energy?: Scale5;
  symptoms: string[];
  exerciseMinutes?: number;
  notes?: string;
  isSynthetic: boolean;
  scenarioId?: string;
  missionDay?: number;
  /** Set when the check-in was corrected after saving (ISO 8601). */
  editedAt?: string;
}

// ---------------------------------------------------------------------------
// Assessment engine output — consumed by dashboard, alerts, and pet
// ---------------------------------------------------------------------------

/** The only four monitoring categories. There is no "critical" category. */
export type AssessmentStatus = 'stable' | 'review' | 'attention' | 'unknown';

/** Non-prescriptive next-step categories. */
export type NextStepCategory =
  | 'none'
  | 'record-more-data'
  | 'verify-measurement'
  | 'review-guidance'
  | 'consult-flight-surgeon';

/** Is the rule threshold backed by a cited source, or illustrative only? */
export type EvidenceLevel = 'sourced' | 'demonstration-only';

export interface RuleDefinition {
  id: string;
  title: string;
  metrics: MetricId[];
  hazards: SpaceflightHazard[];
  evidence: EvidenceLevel;
  /** Required when evidence is 'sourced'. */
  citation?: { title: string; url: string };
  description: string;
}

export interface RuleFinding {
  ruleId: string;
  status: Exclude<AssessmentStatus, 'unknown'>;
  explanation: string;
  /** IDs of the measurements that triggered the rule. */
  evidenceRefs: string[];
  evidence: EvidenceLevel;
  nextStep: NextStepCategory;
}

/** Wellbeing signals from recent self-reports/check-ins (not clinical findings). */
export type CheckInFlag =
  | 'short-sleep'
  | 'poor-sleep-quality'
  | 'low-energy'
  | 'high-stress'
  | 'low-mood'
  | 'symptoms-reported';

export interface AssessmentResult {
  status: AssessmentStatus;
  assessedAt: string;
  findings: RuleFinding[];
  /** Plain-language summary of the overall result. */
  explanation: string;
  confidence: 'low' | 'moderate' | 'high';
  limitations: string[];
  /** Metrics with no recent, usable reading. */
  missingData: MetricId[];
  /** Highest-priority next step across findings. */
  nextStep: NextStepCategory;
  /** True if any input reading was synthetic. */
  basedOnSyntheticData: boolean;
  /** Recent self-report signals; used by the pet's `tired` state. */
  checkInFlags: CheckInFlag[];
  /** Radiation dose recorded so far (sum of dosimeter readings in the input). */
  radiation?: RadiationSummary;
}

export interface RadiationSummary {
  /** Sum of all recorded doses, mSv. Gaps are not filled in. */
  totalMSv: number;
  readings: number;
  /** Latest reading normalised to a 24 h rate, mSv/day (if it has a period). */
  latestDailyRateMSv?: number;
  firstAt?: string;
  lastAt?: string;
}

// ---------------------------------------------------------------------------
// Pet companion
// ---------------------------------------------------------------------------

export type PetSpecies = 'cat' | 'dog' | 'axolotl';

/** Derived ONLY from AssessmentResult + check-in flags. */
export type PetWellness = 'happy' | 'tired' | 'concerned' | 'unknown';

/** User-triggered commands. Never affect health state or readings. */
export type PetCommand = 'sit' | 'stand' | 'jump' | 'pet' | 'play' | 'float';

/** Temporary animation state produced by a command. */
export type PetAction = 'idle' | PetCommand;

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * Local, clearly fictional demo profile. Real (Auth0) accounts are a later
 * phase and must never be merged with demo records automatically.
 */
export interface DemoProfile {
  id: string;
  displayName: string;
  kind: 'demo';
  petSpecies?: PetSpecies;
  petName?: string;
  createdAt: string;
}

/** Raw check-in from the form or the simulator, before validation. */
export interface RawCheckInInput {
  submittedAt: string | number;
  sleepHours?: unknown;
  sleepQuality?: unknown;
  mood?: unknown;
  stress?: unknown;
  energy?: unknown;
  symptoms?: unknown;
  exerciseMinutes?: unknown;
  notes?: unknown;
  /** true only when produced by the simulator. */
  synthetic: boolean;
  scenarioId?: string;
  missionDay?: number;
}
