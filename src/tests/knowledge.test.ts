import { describe, expect, it } from 'vitest';
import { KNOWLEDGE, SOURCES, SYMPTOM_KNOWLEDGE } from '../features/health/knowledge';
import { RULE_DEFINITIONS } from '../features/health/assessment/rules';

describe('knowledge base', () => {
  it('cites only registered sources', () => {
    for (const k of [...Object.values(KNOWLEDGE), SYMPTOM_KNOWLEDGE]) {
      for (const s of k!.inSpace) expect(SOURCES[s.sourceId]).toBeDefined();
      expect(k!.howTo.length).toBeGreaterThan(10);
    }
  });

  it('covers the indicators named by the challenge', () => {
    for (const m of ['heartRate', 'bloodPressure', 'bodyTemperature', 'bloodGlucose', 'sleepDuration', 'mood'] as const) {
      expect(KNOWLEDGE[m]).toBeDefined();
    }
  });

  it('does not upgrade any rule to "sourced" (sources give no thresholds)', () => {
    expect(RULE_DEFINITIONS.every((r) => r.evidence === 'demonstration-only')).toBe(true);
  });
});
