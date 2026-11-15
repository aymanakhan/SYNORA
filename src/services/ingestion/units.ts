import { METRICS } from '../../features/health/metrics';
import type { MetricId } from '../../features/health/types';

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
