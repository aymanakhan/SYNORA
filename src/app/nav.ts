import { useEffect, useState } from 'react';

export const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'live', label: 'Live Monitoring' },
  { id: 'checkin', label: 'Check-In' },
  { id: 'trends', label: 'Trends' },
  { id: 'pet', label: 'Pet' },
  { id: 'simulator', label: 'Mission Simulator' },
  { id: 'summary', label: 'Summary' },
  { id: 'settings', label: 'Settings' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

function fromHash(): SectionId {
  const h = window.location.hash.replace('#/', '').replace('#', '').split('?')[0];
  return (SECTIONS.find((s) => s.id === h)?.id ?? 'dashboard') as SectionId;
}

/** Navigate to a section, optionally with parameters (e.g. { metric: 'bloodPressure' }). */
export function navigate(id: SectionId, params?: Record<string, string>) {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  window.location.hash = `/${id}${q}`;
}

/** Read a parameter from the current hash, e.g. #/live?metric=spo2. */
export function hashParam(name: string): string | undefined {
  const q = window.location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get(name) ?? undefined : undefined;
}

export function useSection(): SectionId {
  const [s, setS] = useState<SectionId>(fromHash);
  useEffect(() => {
    const on = () => {
      setS(fromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return s;
}
