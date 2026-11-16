import type { CheckIn, Measurement, MetricId, PetSpecies } from '../health/types';

/**
 * Daily measurement routine (the challenge suggests prompting measurements as
 * part of the mission routine). A task is done when that data was LOGGED
 * today, whatever the value: rewards are for logging, never for good
 * numbers, so reporting a problem earns exactly the same star.
 */
export interface RoutineTaskDef {
  id: MetricId | 'checkIn';
  label: string;
  reminder: string;
}

export const ROUTINE_TASKS: RoutineTaskDef[] = [
  { id: 'heartRate', label: 'Heart rate', reminder: 'You haven’t measured your heart rate today.' },
  { id: 'bloodPressure', label: 'Blood pressure', reminder: 'You haven’t measured your blood pressure today.' },
  { id: 'bodyTemperature', label: 'Temperature', reminder: 'You haven’t taken your temperature today.' },
  { id: 'spo2', label: 'Blood oxygen (SpO₂)', reminder: 'You haven’t checked your blood oxygen today.' },
  { id: 'radiationDose', label: 'Dosimeter reading', reminder: 'You haven’t logged your dosimeter reading today.' },
  { id: 'checkIn', label: 'Daily check-in', reminder: 'You haven’t done today’s check-in (sleep, mood, symptoms).' },
];

export interface RoutineStatus {
  tasks: (RoutineTaskDef & { done: boolean; doneAt?: string })[];
  done: number;
  total: number;
  complete: boolean;
  /** Consecutive days with the full routine done, ending today (or yesterday if today isn't finished yet). */
  streakDays: number;
}

const DAY_MS = 86_400_000;

export function routineStatus(
  measurements: Measurement[],
  checkIns: CheckIn[],
  now: Date,
  utcOffsetMinutes: number = -now.getTimezoneOffset(),
): RoutineStatus {
  const dayOf = (iso: string) => Math.floor((Date.parse(iso) + utcOffsetMinutes * 60_000) / DAY_MS);
  const nowMs = now.getTime();
  const today = Math.floor((nowMs + utcOffsetMinutes * 60_000) / DAY_MS);

  // day → set of task ids logged that day (ignore future-dated entries)
  const logged = new Map<number, Map<string, string>>();
  const mark = (iso: string, id: string) => {
    if (Date.parse(iso) > nowMs) return;
    const d = dayOf(iso);
    const m = logged.get(d) ?? new Map<string, string>();
    if (!m.has(id) || iso > m.get(id)!) m.set(id, iso);
    logged.set(d, m);
  };
  for (const m of measurements) mark(m.measuredAt, m.metric);
  for (const c of checkIns) mark(c.submittedAt, 'checkIn');

  const todays = logged.get(today) ?? new Map<string, string>();
  const tasks = ROUTINE_TASKS.map((t) => ({ ...t, done: todays.has(t.id), doneAt: todays.get(t.id) }));
  const done = tasks.filter((t) => t.done).length;
  const full = (d: number) => ROUTINE_TASKS.every((t) => logged.get(d)?.has(t.id));

  let streakDays = 0;
  let d = full(today) ? today : today - 1;
  while (full(d)) {
    streakDays++;
    d--;
  }
  return { tasks, done, total: tasks.length, complete: done === tasks.length, streakDays };
}

export const TREAT: Record<PetSpecies, { emoji: string; name: string }> = {
  cat: { emoji: '🐟', name: 'a fish snack' },
  dog: { emoji: '🦴', name: 'a bone' },
  axolotl: { emoji: '🦐', name: 'a shrimp treat' },
};
