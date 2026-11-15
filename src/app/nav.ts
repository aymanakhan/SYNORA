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
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return (SECTIONS.find((s) => s.id === h)?.id ?? 'dashboard') as SectionId;
}

export function navigate(id: SectionId) {
  window.location.hash = `/${id}`;
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
