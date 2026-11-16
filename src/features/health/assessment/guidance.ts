/**
 * Simple, practical next actions shown with each finding.
 *
 * These are general wellness and measurement suggestions, NOT medical
 * treatment: no medications or doses. Anything potentially serious points
 * to the crew medical officer and the mission's own procedures.
 */

export type Direction = 'high' | 'low';

const VERIFY_HR = 'Sit or lie down quietly for 5 minutes, then measure again.';
const CMO = 'your crew medical officer';

export const GUIDANCE: Record<string, Partial<Record<Direction | 'any', string[]>>> = {
  'R-HR-RANGE': {
    high: [
      VERIFY_HR,
      'Note anything that can raise heart rate: recent exercise, caffeine, stress, a warm cabin or feeling unwell.',
      `If it stays high, or you have chest pain, dizziness or shortness of breath, tell ${CMO} now.`,
    ],
    low: [
      'Re-measure after sitting quietly and check that the sensor is placed correctly.',
      'A low resting heart rate can be normal for very fit people, so compare it with your usual values.',
      `If you feel faint, dizzy or unusually tired, tell ${CMO}.`,
    ],
  },
  'R-BP-SYSTOLIC': {
    high: [
      'Sit for 5 minutes with your back supported and feet flat. Keep the cuff at heart level and don’t talk.',
      'Take two readings one minute apart and record both.',
      'Avoid caffeine and exercise for 30 minutes before the next reading.',
      `If readings stay high, or you have a severe headache, vision changes or chest pain, contact ${CMO}.`,
    ],
    low: [
      'Sit or lie down before re-measuring, and stand up slowly afterwards.',
      'Note any dizziness or light-headedness, especially when standing up.',
      `If you feel faint, tell a crewmate and ${CMO}.`,
    ],
  },
  'R-BP-DIASTOLIC': {
    high: [
      'Sit for 5 minutes with your back supported and feet flat. Keep the cuff at heart level and don’t talk.',
      'Take two readings one minute apart and record both.',
      `If readings stay high, contact ${CMO}.`,
    ],
  },
  'R-TEMP-RANGE': {
    high: [
      'Re-measure with the same thermometer. For oral readings, wait 15 minutes after eating or drinking.',
      'Rest, stay hydrated, and record any other symptoms (chills, cough, rash) in your check-in.',
      `If it keeps rising or you feel very unwell, contact ${CMO}.`,
    ],
    low: [
      'Re-measure, checking the thermometer and where you placed it.',
      'Add a layer and check the cabin temperature setting.',
      `If you are shivering hard, confused or very drowsy, tell a crewmate and ${CMO} now.`,
    ],
  },
  'R-SPO2-LOW': {
    low: [
      'Warm your hands, stay still, and re-measure on a clean finger with no nail polish.',
      'Breathe normally for a minute, then try a different finger.',
      `If it stays low or you are short of breath, tell ${CMO} now, and check the cabin atmosphere readings with your crew.`,
    ],
  },
  'R-GLUCOSE-RANGE': {
    high: [
      'Wash and dry your hands, then re-test with a fresh strip.',
      'Note when you last ate, because readings after a meal are higher.',
      `If it stays high, follow your mission’s medical procedures and tell ${CMO}.`,
    ],
    low: [
      'Re-test with a fresh strip.',
      'If you feel shaky, sweaty or confused, follow your mission’s low-blood-sugar procedure and tell a crewmate.',
      `Tell ${CMO} about repeated low readings.`,
    ],
  },
  'R-SLEEP-SHORT': {
    any: [
      'Keep a consistent sleep window, even on busy days.',
      'Cut light and noise: use an eye mask and earplugs, and dim screens before sleep.',
      'Avoid caffeine in the hours before your sleep period.',
      `If short sleep continues, discuss your schedule with ${CMO}.`,
    ],
  },
  'R-STRESS-SUSTAINED': {
    any: [
      'Take a short break: two minutes of slow breathing, or a few minutes of exercise.',
      'Talk with a crewmate, or schedule time with your mission’s support team.',
      'Keep your sleep and meal routine as regular as you can.',
    ],
  },
  'R-MOOD-LOW': {
    any: [
      'Connect with someone: a crewmate, or a scheduled call home.',
      'Do something you enjoy, even briefly.',
      `Persistently low mood is worth discussing with ${CMO} or your support team. You don’t have to handle it alone.`,
    ],
  },
  'R-SYMPTOMS-REPORTED': {
    any: [
      'Note when each symptom started and whether it is getting better or worse.',
      'Take your vital signs now so there is something to compare against later.',
      `Tell ${CMO}, especially if symptoms are severe or getting worse.`,
    ],
  },
  'R-BASELINE-DEVIATION': {
    any: [
      'Re-measure the way you usually do: same time of day, same position, same instrument.',
      'Note anything unusual today, such as exercise, poor sleep, illness or stress.',
      'If it stays different from your usual values, mention it at your next medical check.',
    ],
  },
  'R-DATA-QUALITY': {
    any: [
      'Re-take the measurement, checking the instrument is positioned correctly.',
      'If the instrument keeps giving odd readings, try a backup device.',
    ],
  },
  'R-RAD-DOSE-RATE': {
    any: [
      'Check that your dosimeter is worn correctly and that the reading period is right.',
      'If a radiation alert is active, follow your mission’s radiation protocol, for example moving to the designated shielded area.',
      `Report the reading to ${CMO} and mission control.`,
    ],
  },
  'R-RAD-CUMULATIVE': {
    any: [
      'Keep logging dosimeter readings every day so the total stays accurate.',
      `Review the mission’s radiation exposure plan with ${CMO}.`,
    ],
  },
};

export function guidanceFor(ruleId: string, direction?: Direction): string[] {
  const g = GUIDANCE[ruleId];
  if (!g) return [];
  return (direction && g[direction]) || g.any || g.high || g.low || [];
}
