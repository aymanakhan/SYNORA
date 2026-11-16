import { useMemo } from 'react';
import { useSynora } from '../../app/state';
import { routineStatus } from './routine';

/** Today's routine for the data in view (mission clock in simulated mode). */
export function useRoutine() {
  const { measurements, checkIns, now, mode } = useSynora();
  return useMemo(
    () => routineStatus(measurements, checkIns, now, mode === 'simulated' ? 0 : -now.getTimezoneOffset()),
    [measurements, checkIns, now, mode],
  );
}
