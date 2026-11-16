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
import { guidanceFor, type Direction } from './guidance';
import {
  BASELINE,
  CHECK_IN_FLAG_THRESHOLDS,
  CORE_VITALS,
  EXPECTED_METRICS,
  FRESHNESS_MS,
  MIN_CORE_VITALS_FOR_ASSESSMENT,
  RANGE_RULES,
  SLEEP_RULE,
  RADIATION_RULE,
  SUSTAINED_SELF_REPORT_RULE,
  rangeStatus,
} from './rules';

export interface AssessmentInput {
  /** Validated measurements for ONE profile. */
  measurements: Measurement[];
  checkIns?: CheckIn[];
  /** Required so results are reproducible (simulator, tests). */
  now: Date;
  /**
   * Offset from UTC in minutes used to decide which calendar day (night) an
   * entry belongs to. Defaults to the runtime's local offset. The simulator
   * passes 0 because the mission clock is UTC.
   */
  utcOffsetMinutes?: number;
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
  const offsetMin = input.utcOffsetMinutes ?? -now.getTimezoneOffset();
  const dayOf = (t: number) => Math.floor((t + offsetMin * 60_000) / DAY_MS);

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
    const status = rangeStatus(rule, v);
    if (!status) continue;
    rangeFlagged.add(rule.metric);
    const highs = [rule.review.highAtOrAbove, rule.attention.highAtOrAbove].filter((x): x is number => x !== undefined);
    const direction: Direction = highs.length > 0 && v >= Math.min(...highs) ? 'high' : 'low';
    findings.push({
      guidance: guidanceFor(rule.id, direction),
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

  // --- Radiation: dose rate and cumulative dose ------------------------------
  const radReadings = (byMetric.get('radiationDose') ?? []).filter((m) => typeof m.value === 'number');
  let radiation: AssessmentResult['radiation'];
  if (radReadings.length > 0) {
    const total = radReadings.reduce((sum, m) => sum + (m.value as number), 0);
    const last = radReadings[radReadings.length - 1];
    const lastFresh = latestFresh('radiationDose');
    // A reading without a stated period is treated as covering ≤ 24 h (conservative).
    const rate = lastFresh ? ((lastFresh.value as number) * 24) / Math.min(24, lastFresh.exposurePeriodHours ?? 24) : undefined;
    radiation = {
      totalMSv: total,
      readings: radReadings.length,
      latestDailyRateMSv: rate,
      firstAt: radReadings[0].measuredAt,
      lastAt: last.measuredAt,
    };
    if (lastFresh && rate !== undefined) {
      const R = RADIATION_RULE.dailyRate;
      const st = rate >= R.attentionAtOrAbove ? 'attention' : rate >= R.reviewAtOrAbove ? 'review' : undefined;
      if (st) {
        usedRefs.add(lastFresh.id);
        findings.push({
          ruleId: 'R-RAD-DOSE-RATE',
          status: st,
          explanation: `Latest dosimeter reading ${fmt3(lastFresh.value as number)} mSv${
            lastFresh.exposurePeriodHours ? ` over ${fmt(lastFresh.exposurePeriodHours)} h` : ' (period not stated)'
          } ≈ ${fmt3(rate)} mSv per day, in the demonstration ${st} range.`,
          evidenceRefs: [lastFresh.id],
          evidence: 'demonstration-only',
          nextStep: st === 'attention' ? 'consult-flight-surgeon' : 'verify-measurement',
        });
      }
    }
    const C = RADIATION_RULE.cumulative;
    const cst = total >= C.attentionAtOrAbove ? 'attention' : total >= C.reviewAtOrAbove ? 'review' : undefined;
    if (cst) {
      findings.push({
        ruleId: 'R-RAD-CUMULATIVE',
        status: cst,
        explanation: `Recorded radiation dose adds up to ${fmt(total)} mSv across ${radReadings.length} readings, in the demonstration ${cst} range. Periods without a reading are not included.`,
        evidenceRefs: [last.id],
        evidence: 'demonstration-only',
        nextStep: cst === 'attention' ? 'consult-flight-surgeon' : 'review-guidance',
      });
    }
  }

  // --- Self-report patterns -------------------------------------------------
  const sleep = selfReportSeries('sleepDuration', byMetric, checkIns);
  const stress = selfReportSeries('stress', byMetric, checkIns);
  const mood = selfReportSeries('mood', byMetric, checkIns);
  const energy = selfReportSeries('energy', byMetric, checkIns);
  const sleepQuality = selfReportSeries('sleepQuality', byMetric, checkIns);

  const sleepFinding = evaluateSleep(sleep, nowMs, dayOf);
  if (sleepFinding) findings.push(sleepFinding);

  const stressRecent = lastConsecutiveDays(stress, SUSTAINED_SELF_REPORT_RULE.count, nowMs, dayOf);
  if (stressRecent && stressRecent.every((p) => p.value >= SUSTAINED_SELF_REPORT_RULE.stressAtOrAbove)) {
    findings.push({
      ruleId: 'R-STRESS-SUSTAINED',
      status: 'review',
      explanation: `Stress self-reported at ${stressRecent.map((p) => p.value).join(', ')}/5 on each of the last ${stressRecent.length} days.`,
      evidenceRefs: stressRecent.map((p) => p.ref),
      evidence: 'demonstration-only',
      nextStep: 'review-guidance',
    });
  }

  const moodRecent = lastConsecutiveDays(mood, SUSTAINED_SELF_REPORT_RULE.count, nowMs, dayOf);
  if (moodRecent && moodRecent.every((p) => p.value <= SUSTAINED_SELF_REPORT_RULE.moodAtOrBelow)) {
    findings.push({
      ruleId: 'R-MOOD-LOW',
      status: 'review',
      explanation: `Mood self-reported at ${moodRecent.map((p) => p.value).join(', ')}/5 on each of the last ${moodRecent.length} days.`,
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

  // Explain "unknown" caused by old readings (e.g. entered the night before a demo).
  let staleNote: string | undefined;
  const newestCore = CORE_VITALS.map((m) => byMetric.get(m)?.at(-1)).filter((m): m is Measurement => !!m);
  if (!adequate && newestCore.length > 0) {
    const newest = Math.max(...newestCore.map((m) => Date.parse(m.measuredAt)));
    const hours = Math.round((nowMs - newest) / 3_600_000);
    if (hours * 3_600_000 > FRESHNESS_MS.physiological) {
      staleNote = `Your latest core readings are from ${hours} h ago, and readings count as current for ${FRESHNESS_MS.physiological / 3_600_000} h. Take today's measurements to get a current result.`;
    }
  }

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

  // Attach practical guidance to every finding that doesn't have it yet.
  for (const f of findings) f.guidance ??= guidanceFor(f.ruleId);

  return {
    status,
    assessedAt: now.toISOString(),
    findings,
    explanation: summarize(status, findings, freshCore.length, staleNote),
    confidence,
    limitations,
    missingData,
    nextStep: pickNextStep(status, findings),
    basedOnSyntheticData,
    checkInFlags,
    ...(radiation ? { radiation } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface Point {
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

const DAY_MS = 24 * 60 * 60 * 1000;
type DayOf = (t: number) => number;

/**
 * One point per calendar day: when several entries share a day (e.g. the
 * same check-in submitted three times), only the latest counts. Oldest first.
 */
export function onePerDay(series: Point[], dayOf: DayOf): (Point & { day: number })[] {
  const byDay = new Map<number, Point>();
  for (const p of series) {
    const d = dayOf(p.at);
    const prev = byDay.get(d);
    if (!prev || p.at >= prev.at) byDay.set(d, p);
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, p]) => ({ ...p, day }));
}

/**
 * The last `n` days, if they are n CONSECUTIVE calendar days ending today or
 * yesterday. A skipped day breaks the streak.
 */
function lastConsecutiveDays(series: Point[], n: number, nowMs: number, dayOf: DayOf): Point[] | undefined {
  const days = onePerDay(series, dayOf);
  if (days.length < n) return undefined;
  const lastN = days.slice(-n);
  if (dayOf(nowMs) - lastN[n - 1].day > 1) return undefined; // not recent
  for (let i = 1; i < n; i++) if (lastN[i].day !== lastN[i - 1].day + 1) return undefined;
  return lastN;
}

function evaluateSleep(sleep: Point[], nowMs: number, dayOf: DayOf): RuleFinding | undefined {
  const latest = sleep[sleep.length - 1];
  if (!latest || nowMs - latest.at > FRESHNESS_MS.selfReport) return undefined;
  const recent = lastConsecutiveDays(sleep, SLEEP_RULE.consecutiveNights, nowMs, dayOf);
  if (recent && recent.every((p) => p.value < SLEEP_RULE.consecutiveBelowHours)) {
    return {
      ruleId: 'R-SLEEP-SHORT',
      status: 'review',
      explanation: `Sleep under ${SLEEP_RULE.consecutiveBelowHours} h on each of the last ${recent.length} consecutive nights (${recent
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

function summarize(status: AssessmentStatus, findings: RuleFinding[], freshCore: number, staleNote?: string): string {
  switch (status) {
    case 'unknown':
      return staleNote ?? 'Not enough current, reliable readings to assess. Record more measurements.';
    case 'stable':
      return `No demonstration rule was triggered across ${freshCore} current core vitals. This is not proof of good health.`;
    default:
      return `${findings.length} item${findings.length === 1 ? '' : 's'} flagged for ${
        status === 'attention' ? 'human medical review' : 'review'
      }. This is a monitoring flag, not a diagnosis.`;
  }
}

function fmt3(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
