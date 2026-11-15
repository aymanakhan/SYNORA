import { METRICS } from '../metrics';
import type {
  AssessmentResult,
  AssessmentStatus,
  CheckIn,
  CheckInFlag,
  Measurement,
  MetricId,
  NextStepCategory,
  RuleFinding,
} from '../types';
import { componentValue, computeBaseline } from './baseline';
import {
  BASELINE,
  CHECK_IN_FLAG_THRESHOLDS,
  CORE_VITALS,
  EXPECTED_METRICS,
  FRESHNESS_MS,
  MIN_CORE_VITALS_FOR_ASSESSMENT,
  RANGE_RULES,
  SLEEP_RULE,
  SUSTAINED_SELF_REPORT_RULE,
  type RangeRule,
} from './rules';

export interface AssessmentInput {
  /** Validated measurements for ONE profile. */
  measurements: Measurement[];
  checkIns?: CheckIn[];
  /** Required so results are reproducible (simulator, tests). */
  now: Date;
}

/**
 * The single, pure SYNORA assessment engine.
 *
 * No UI, storage, network, or pet dependencies. The dashboard, alerts and
 * pet must all consume the returned object rather than re-deriving status.
 * Output is a non-diagnostic monitoring category, never a diagnosis.
 */
export function assess(input: AssessmentInput): AssessmentResult {
  const now = input.now;
  const nowMs = now.getTime();

  // Dedupe by id, ignore future-dated readings, sort by measurement time
  // (handles out-of-order arrival).
  const seen = new Set<string>();
  const measurements = input.measurements
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return Date.parse(m.measuredAt) <= nowMs;
    })
    .sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
  const checkIns = (input.checkIns ?? [])
    .filter((c) => Date.parse(c.submittedAt) <= nowMs)
    .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));

  const byMetric = new Map<MetricId, Measurement[]>();
  for (const m of measurements) {
    const list = byMetric.get(m.metric) ?? [];
    list.push(m);
    byMetric.set(m.metric, list);
  }

  const latestFresh = (metric: MetricId): Measurement | undefined => {
    const list = byMetric.get(metric);
    const last = list?.[list.length - 1];
    if (!last) return undefined;
    return nowMs - Date.parse(last.measuredAt) <= FRESHNESS_MS[METRICS[metric].kind] ? last : undefined;
  };

  const findings: RuleFinding[] = [];
  const limitations: string[] = [
    'All thresholds are demonstration-only and not clinically validated.',
  ];
  const usedRefs = new Set<string>();

  // --- Range rules on the latest fresh reading -----------------------------
  const rangeFlagged = new Set<MetricId>();
  for (const rule of RANGE_RULES) {
    const m = latestFresh(rule.metric);
    if (!m) continue;
    usedRefs.add(m.id);
    const v = componentValue(m, rule.component);
    if (v === undefined) continue;
    const status = bandStatus(rule, v);
    if (!status) continue;
    rangeFlagged.add(rule.metric);
    findings.push({
      ruleId: rule.id,
      status,
      explanation: `${rule.label} ${fmt(v)} ${rule.unit} is in the demonstration ${status} range.${
        m.qualityStatus === 'suspect' ? ' This reading was flagged as possibly inaccurate.' : ''
      }`,
      evidenceRefs: [m.id],
      evidence: 'demonstration-only',
      nextStep:
        m.qualityStatus === 'suspect'
          ? 'verify-measurement'
          : status === 'attention'
            ? 'consult-flight-surgeon'
            : 'verify-measurement',
    });
  }

  // --- Data quality ---------------------------------------------------------
  for (const metric of byMetric.keys()) {
    const m = latestFresh(metric);
    if (!m || m.qualityStatus !== 'suspect' || rangeFlagged.has(metric)) continue;
    usedRefs.add(m.id);
    findings.push({
      ruleId: 'R-DATA-QUALITY',
      status: 'review',
      explanation: `Latest ${METRICS[metric].label.toLowerCase()} reading was flagged: ${(m.qualityNotes ?? []).join(' ')}`.trim(),
      evidenceRefs: [m.id],
      evidence: 'demonstration-only',
      nextStep: 'verify-measurement',
    });
  }

  // --- Personal baseline ---------------------------------------------------
  const noBaseline: string[] = [];
  for (const cfg of BASELINE.metrics) {
    const m = latestFresh(cfg.metric);
    if (!m || m.qualityStatus !== 'valid' || rangeFlagged.has(cfg.metric)) continue;
    const v = componentValue(m, cfg.component);
    if (v === undefined) continue;
    const b = computeBaseline(byMetric.get(cfg.metric) ?? [], cfg.component, cfg.minSpread, m.id, now);
    if (!b.established) {
      noBaseline.push(cfg.label.toLowerCase());
      continue;
    }
    const z = (v - b.baseline.mean) / b.baseline.effectiveSpread;
    if (Math.abs(z) >= BASELINE.deviationThreshold) {
      usedRefs.add(m.id);
      findings.push({
        ruleId: 'R-BASELINE-DEVIATION',
        status: 'review',
        explanation: `${cfg.label} ${fmt(v)} ${cfg.unit} is ${z > 0 ? 'above' : 'below'} this profile's usual ${fmt(
          b.baseline.mean,
        )} ${cfg.unit} (based on ${b.baseline.n} readings).`,
        evidenceRefs: [m.id],
        evidence: 'demonstration-only',
        nextStep: 'verify-measurement',
      });
    }
  }
  if (noBaseline.length > 0) {
    limitations.push(`Personal baseline not yet established for: ${noBaseline.join(', ')}.`);
  }

  // --- Self-report patterns -------------------------------------------------
  const sleep = selfReportSeries('sleepDuration', byMetric, checkIns);
  const stress = selfReportSeries('stress', byMetric, checkIns);
  const mood = selfReportSeries('mood', byMetric, checkIns);
  const energy = selfReportSeries('energy', byMetric, checkIns);
  const sleepQuality = selfReportSeries('sleepQuality', byMetric, checkIns);

  const sleepFinding = evaluateSleep(sleep, nowMs);
  if (sleepFinding) findings.push(sleepFinding);

  const stressRecent = lastNWithin(stress, SUSTAINED_SELF_REPORT_RULE.count, SUSTAINED_SELF_REPORT_RULE.windowMs, nowMs);
  if (stressRecent && stressRecent.every((p) => p.value >= SUSTAINED_SELF_REPORT_RULE.stressAtOrAbove)) {
    findings.push({
      ruleId: 'R-STRESS-SUSTAINED',
      status: 'review',
      explanation: `Stress self-reported at ${stressRecent.map((p) => p.value).join(', ')}/5 in the last ${stressRecent.length} reports.`,
      evidenceRefs: stressRecent.map((p) => p.ref),
      evidence: 'demonstration-only',
      nextStep: 'review-guidance',
    });
  }

  const moodRecent = lastNWithin(mood, SUSTAINED_SELF_REPORT_RULE.count, SUSTAINED_SELF_REPORT_RULE.windowMs, nowMs);
  if (moodRecent && moodRecent.every((p) => p.value <= SUSTAINED_SELF_REPORT_RULE.moodAtOrBelow)) {
    findings.push({
      ruleId: 'R-MOOD-LOW',
      status: 'review',
      explanation: `Mood self-reported at ${moodRecent.map((p) => p.value).join(', ')}/5 in the last ${moodRecent.length} reports.`,
      evidenceRefs: moodRecent.map((p) => p.ref),
      evidence: 'demonstration-only',
      nextStep: 'review-guidance',
    });
  }

  const latestCheckIn = checkIns[checkIns.length - 1];
  const checkInFresh =
    latestCheckIn && nowMs - Date.parse(latestCheckIn.submittedAt) <= FRESHNESS_MS.selfReport ? latestCheckIn : undefined;
  if (checkInFresh && checkInFresh.symptoms.length > 0) {
    findings.push({
      ruleId: 'R-SYMPTOMS-REPORTED',
      status: 'review',
      explanation: `Symptoms reported: ${checkInFresh.symptoms.join(', ')}. Thank you for reporting them.`,
      evidenceRefs: [checkInFresh.id],
      evidence: 'demonstration-only',
      nextStep: 'review-guidance',
    });
  }

  // --- Check-in flags (for pet `tired`; not findings) -----------------------
  const T = CHECK_IN_FLAG_THRESHOLDS;
  const freshSelf = (s: Point[]) => {
    const p = s[s.length - 1];
    return p && nowMs - p.at <= FRESHNESS_MS.selfReport ? p.value : undefined;
  };
  const checkInFlags: CheckInFlag[] = [];
  const sleepNow = freshSelf(sleep);
  if (sleepNow !== undefined && sleepNow < T.shortSleepBelowHours) checkInFlags.push('short-sleep');
  const sq = freshSelf(sleepQuality);
  if (sq !== undefined && sq <= T.poorSleepQualityAtOrBelow) checkInFlags.push('poor-sleep-quality');
  const en = freshSelf(energy);
  if (en !== undefined && en <= T.lowEnergyAtOrBelow) checkInFlags.push('low-energy');
  const st = freshSelf(stress);
  if (st !== undefined && st >= T.highStressAtOrAbove) checkInFlags.push('high-stress');
  const md = freshSelf(mood);
  if (md !== undefined && md <= T.lowMoodAtOrBelow) checkInFlags.push('low-mood');
  if (checkInFresh && checkInFresh.symptoms.length > 0) checkInFlags.push('symptoms-reported');

  // --- Adequacy, missing data, overall status -------------------------------
  const freshCore = CORE_VITALS.filter((m) => latestFresh(m));
  for (const m of freshCore) usedRefs.add(latestFresh(m)!.id);
  const adequate = freshCore.length >= MIN_CORE_VITALS_FOR_ASSESSMENT;

  const missingData = EXPECTED_METRICS.filter((metric) => {
    if (latestFresh(metric)) return false;
    const series = metric === 'sleepDuration' ? sleep : metric === 'stress' ? stress : metric === 'mood' ? mood : [];
    return freshSelf(series) === undefined;
  });

  const severity: Record<AssessmentStatus, number> = { unknown: 0, stable: 1, review: 2, attention: 3 };
  let status: AssessmentStatus;
  if (findings.length > 0) {
    status = findings.reduce<AssessmentStatus>(
      (acc, f) => (severity[f.status] > severity[acc] ? f.status : acc),
      'review',
    );
  } else {
    status = adequate ? 'stable' : 'unknown';
  }

  const anySuspect = measurements.some((m) => usedRefs.has(m.id) && m.qualityStatus === 'suspect');
  const confidence: AssessmentResult['confidence'] =
    !adequate ? 'low' : freshCore.length >= CORE_VITALS.length && !anySuspect ? 'high' : 'moderate';

  if (!adequate) {
    limitations.push(
      `Only ${freshCore.length} of ${CORE_VITALS.length} core vitals have a current reading; at least ${MIN_CORE_VITALS_FOR_ASSESSMENT} are needed for a stable result.`,
    );
  }

  const basedOnSyntheticData =
    measurements.some((m) => usedRefs.has(m.id) && m.isSynthetic) ||
    findings.some((f) => f.evidenceRefs.some((r) => measurements.find((m) => m.id === r)?.isSynthetic)) ||
    (checkInFresh?.isSynthetic ?? false);
  if (basedOnSyntheticData) limitations.push('Includes synthetic (simulated) data — not real astronaut measurements.');

  return {
    status,
    assessedAt: now.toISOString(),
    findings,
    explanation: summarize(status, findings, freshCore.length),
    confidence,
    limitations,
    missingData,
    nextStep: pickNextStep(status, findings),
    basedOnSyntheticData,
    checkInFlags,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Point {
  value: number;
  at: number;
  ref: string;
}

type SelfMetric = 'sleepDuration' | 'stress' | 'mood' | 'energy' | 'sleepQuality';
const CHECK_IN_FIELD: Record<SelfMetric, keyof CheckIn> = {
  sleepDuration: 'sleepHours',
  stress: 'stress',
  mood: 'mood',
  energy: 'energy',
  sleepQuality: 'sleepQuality',
};

/** Merge a self-report metric from measurements and check-ins, oldest first. */
function selfReportSeries(metric: SelfMetric, byMetric: Map<MetricId, Measurement[]>, checkIns: CheckIn[]): Point[] {
  const points: Point[] = [];
  for (const m of byMetric.get(metric) ?? []) {
    if (typeof m.value === 'number') points.push({ value: m.value, at: Date.parse(m.measuredAt), ref: m.id });
  }
  for (const c of checkIns) {
    const v = c[CHECK_IN_FIELD[metric]];
    if (typeof v === 'number') points.push({ value: v, at: Date.parse(c.submittedAt), ref: c.id });
  }
  return points.sort((a, b) => a.at - b.at);
}

function lastNWithin(series: Point[], n: number, windowMs: number, nowMs: number): Point[] | undefined {
  if (series.length < n) return undefined;
  const lastN = series.slice(-n);
  return lastN.every((p) => nowMs - p.at <= windowMs) ? lastN : undefined;
}

function evaluateSleep(sleep: Point[], nowMs: number): RuleFinding | undefined {
  const latest = sleep[sleep.length - 1];
  if (!latest || nowMs - latest.at > FRESHNESS_MS.selfReport) return undefined;
  const recent = lastNWithin(sleep, SLEEP_RULE.consecutiveNights, SLEEP_RULE.windowMs, nowMs);
  if (recent && recent.every((p) => p.value < SLEEP_RULE.consecutiveBelowHours)) {
    return {
      ruleId: 'R-SLEEP-SHORT',
      status: 'review',
      explanation: `Sleep under ${SLEEP_RULE.consecutiveBelowHours} h for the last ${recent.length} nights (${recent
        .map((p) => fmt(p.value))
        .join(', ')} h).`,
      evidenceRefs: recent.map((p) => p.ref),
      evidence: 'demonstration-only',
      nextStep: 'review-guidance',
    };
  }
  if (latest.value < SLEEP_RULE.singleNightBelowHours) {
    return {
      ruleId: 'R-SLEEP-SHORT',
      status: 'review',
      explanation: `Last night's sleep was ${fmt(latest.value)} h, under ${SLEEP_RULE.singleNightBelowHours} h.`,
      evidenceRefs: [latest.ref],
      evidence: 'demonstration-only',
      nextStep: 'review-guidance',
    };
  }
  return undefined;
}

function bandStatus(rule: RangeRule, v: number): 'review' | 'attention' | undefined {
  const hit = (b: RangeRule['review']) =>
    (b.highAtOrAbove !== undefined && v >= b.highAtOrAbove) || (b.lowBelow !== undefined && v < b.lowBelow);
  if (hit(rule.attention)) return 'attention';
  if (hit(rule.review)) return 'review';
  return undefined;
}

const NEXT_STEP_PRIORITY: NextStepCategory[] = [
  'none',
  'record-more-data',
  'review-guidance',
  'verify-measurement',
  'consult-flight-surgeon',
];

function pickNextStep(status: AssessmentStatus, findings: RuleFinding[]): NextStepCategory {
  if (status === 'unknown') return 'record-more-data';
  return findings.reduce<NextStepCategory>(
    (acc, f) => (NEXT_STEP_PRIORITY.indexOf(f.nextStep) > NEXT_STEP_PRIORITY.indexOf(acc) ? f.nextStep : acc),
    'none',
  );
}

function summarize(status: AssessmentStatus, findings: RuleFinding[], freshCore: number): string {
  switch (status) {
    case 'unknown':
      return 'Not enough current, reliable readings to assess. Record more measurements.';
    case 'stable':
      return `No demonstration rule was triggered across ${freshCore} current core vitals. This is not proof of good health.`;
    default:
      return `${findings.length} item${findings.length === 1 ? '' : 's'} flagged for ${
        status === 'attention' ? 'human medical review' : 'review'
      }. This is a monitoring flag, not a diagnosis.`;
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
