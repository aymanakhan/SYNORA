import { METRICS } from './metrics';
import type { MetricId } from './types';

/** Unit aliases accepted on input, mapped to the catalog spelling. */
const UNIT_ALIASES: Record<string, string> = {
  bpm: 'bpm',
  'beats/min': 'bpm',
  mmhg: 'mmHg',
  '°c': '°C',
  c: '°C',
  degc: '°C',
  '°f': '°F',
  f: '°F',
  degf: '°F',
  '%': '%',
  'mg/dl': 'mg/dL',
  'mmol/l': 'mmol/L',
  h: 'h',
  hr: 'h',
  hrs: 'h',
  hours: 'h',
  min: 'min',
  mins: 'min',
  minutes: 'min',
  'scale 1–5': 'scale 1–5',
  'scale 1-5': 'scale 1–5',
  msv: 'mSv',
  'µsv': 'µSv',
  'μsv': 'µSv', // Greek mu
  usv: 'µSv',
};

/** Glucose molar mass factor: 1 mmol/L ≈ 18.016 mg/dL. */
export const GLUCOSE_MG_DL_PER_MMOL_L = 18.016;

export function canonicalizeUnitSpelling(unit: string): string | undefined {
  return UNIT_ALIASES[unit.trim().toLowerCase()];
}

export type UnitResult =
  | { ok: true; value: number; unit: string; converted: boolean }
  | { ok: false; error: string };

/** Convert a canonical value back to the unit the user typed (for messages and hints). */
export function fromCanonical(metric: MetricId, value: number, unit: string): number {
  switch (`${metric}:${canonicalizeUnitSpelling(unit) ?? unit}`) {
    case 'bodyTemperature:°F':
      return (value * 9) / 5 + 32;
    case 'bloodGlucose:mmol/L':
      return value / GLUCOSE_MG_DL_PER_MMOL_L;
    case 'sleepDuration:min':
      return value * 60;
    case 'radiationDose:µSv':
      return value * 1000;
    default:
      return value;
  }
}

/** Allowed input range for a metric expressed in the given unit, e.g. "77–109.4 °F". */
export function rangeInUnit(metric: MetricId, unit: string): { min: number; max: number; unit: string } | undefined {
  const r = METRICS[metric].plausibleRange;
  if (!r) return undefined;
  const u = canonicalizeUnitSpelling(unit) ?? METRICS[metric].canonicalUnit;
  const round = (n: number) => Number(n.toFixed(2));
  return { min: round(fromCanonical(metric, r.min, u)), max: round(fromCanonical(metric, r.max, u)), unit: u };
}

/**
 * Convert a scalar value in `unit` to the metric's canonical unit.
 * No rounding is applied, so precision is preserved for storage.
 */
export function toCanonical(metric: MetricId, value: number, unit: string): UnitResult {
  const def = METRICS[metric];
  const spelled = canonicalizeUnitSpelling(unit);
  if (!spelled || !def.acceptedUnits.includes(spelled)) {
    return {
      ok: false,
      error: `Unit "${unit}" is not accepted for ${def.label}. Use: ${def.acceptedUnits.join(', ')}.`,
    };
  }
  if (spelled === def.canonicalUnit) {
    return { ok: true, value, unit: def.canonicalUnit, converted: false };
  }

  let converted: number;
  switch (`${metric}:${spelled}`) {
    case 'bodyTemperature:°F':
      converted = ((value - 32) * 5) / 9;
      break;
    case 'bloodGlucose:mmol/L':
      converted = value * GLUCOSE_MG_DL_PER_MMOL_L;
      break;
    case 'sleepDuration:min':
      converted = value / 60;
      break;
    case 'radiationDose:µSv':
      converted = value / 1000;
      break;
    default:
      return { ok: false, error: `No conversion defined from ${spelled} for ${def.label}.` };
  }
  return { ok: true, value: converted, unit: def.canonicalUnit, converted: true };
}

// ---------------------------------------------------------------------------
// Display units: how values are SHOWN. Storage and rules stay canonical.
// ---------------------------------------------------------------------------

/** Preferred display unit per metric (only metrics with more than one unit). */
export type DisplayUnits = Partial<Record<MetricId, string>>;

/** Metrics the user can choose a unit for. */
export const UNIT_CHOICE_METRICS: MetricId[] = (Object.keys(METRICS) as MetricId[]).filter(
  (m) => METRICS[m].acceptedUnits.length > 1,
);

/** Decimal places that suit each unit. */
const DECIMALS: Record<string, number> = {
  '°C': 1,
  '°F': 1,
  'mg/dL': 0,
  'mmol/L': 1,
  h: 1,
  min: 0,
  mSv: 3,
  'µSv': 0,
  bpm: 0,
  mmHg: 0,
  '%': 0,
};

export function displayUnit(metric: MetricId, units?: DisplayUnits): string {
  const u = units?.[metric];
  return u && METRICS[metric].acceptedUnits.includes(u) ? u : METRICS[metric].canonicalUnit;
}

/** Convert a canonical value for display. */
export function toDisplay(metric: MetricId, canonical: number, units?: DisplayUnits): { value: number; unit: string } {
  const unit = displayUnit(metric, units);
  return { value: fromCanonical(metric, canonical, unit), unit };
}

/** Number only, rounded for the display unit, e.g. "98.6". */
export function formatNumberIn(metric: MetricId, canonical: number, units?: DisplayUnits): string {
  const { value, unit } = toDisplay(metric, canonical, units);
  const dp = DECIMALS[unit] ?? (Number.isInteger(value) ? 0 : 1);
  return Number(value.toFixed(dp)).toString();
}

/** Number with unit, e.g. "98.6 °F". Scales are shown as "/5". */
export function formatIn(metric: MetricId, canonical: number, units?: DisplayUnits): string {
  const unit = displayUnit(metric, units);
  return unit === 'scale 1–5'
    ? `${formatNumberIn(metric, canonical, units)}/5`
    : `${formatNumberIn(metric, canonical, units)} ${unit}`;
}
