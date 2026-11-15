import type { AssessmentResult, CheckInFlag, PetWellness } from '../health/types';

const TIRED_FLAGS: CheckInFlag[] = ['short-sleep', 'poor-sleep-quality', 'low-energy', 'high-stress'];

/**
 * Pet wellness is derived ONLY from the shared AssessmentResult.
 * Precedence: concerned > tired > unknown > happy (tired is based on self-reports,
 * so it can show even when instrument vitals are insufficient).
 * A cheerful pet must never mask a review/attention result, and the pet
 * never contains its own medical logic.
 */
export function derivePetWellness(result: AssessmentResult | undefined): PetWellness {
  if (!result) return 'unknown';
  if (result.status === 'review' || result.status === 'attention') return 'concerned';
  if (result.checkInFlags.some((f) => TIRED_FLAGS.includes(f))) return 'tired';
  return result.status === 'stable' ? 'happy' : 'unknown';
}

/** Supportive, non-judgemental messages. Never blame, never discourage reporting. */
export const PET_MESSAGES: Record<PetWellness, string> = {
  happy: "Your readings look steady today. I'm right here with you!",
  tired: "Looks like rest has been short lately. Let's take it easy together.",
  concerned: "Something in your readings is worth a closer look. Let's check it together — you're doing the right thing.",
  unknown: "I don't have enough recent readings yet. Want to log a measurement?",
};
