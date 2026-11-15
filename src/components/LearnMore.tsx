import { HAZARD_LABEL, KNOWLEDGE, SOURCES, SYMPTOM_KNOWLEDGE, type MetricKnowledge } from '../features/health/knowledge';
import { METRICS } from '../features/health/metrics';
import type { MetricId } from '../features/health/types';

/** "Why it matters in space" + how-to, with source links. */
export function LearnMore({ metric, symptoms, summary = 'Why it matters in space' }: { metric?: MetricId; symptoms?: boolean; summary?: string }) {
  const k: MetricKnowledge | undefined = symptoms ? SYMPTOM_KNOWLEDGE : metric ? KNOWLEDGE[metric] : undefined;
  if (!k) return null;
  const hazards = metric ? METRICS[metric].hazards : [];
  return (
    <details className="mt-2 text-xs text-text-secondary">
      <summary className="cursor-pointer text-cyan">{summary}</summary>
      <div className="mt-2 space-y-2 rounded border border-white/10 bg-panel p-2">
        {hazards.length > 0 && (
          <p className="flex flex-wrap gap-1">
            <span className="text-text-muted">Related hazards:</span>
            {hazards.map((h) => (
              <span key={h} className="rounded border border-purple/40 px-1 text-purple">{HAZARD_LABEL[h]}</span>
            ))}
          </p>
        )}
        <ul className="list-disc space-y-1 pl-4">
          {k.inSpace.map((s) => (
            <li key={s.text}>
              {s.text}{' '}
              <a href={SOURCES[s.sourceId].url} target="_blank" rel="noreferrer" className="text-cyan underline">
                {SOURCES[s.sourceId].publisher}
              </a>
            </li>
          ))}
        </ul>
        <p>
          <span className="font-semibold text-text-primary">How to measure (general tips, not mission procedure): </span>
          {k.howTo}
        </p>
      </div>
    </details>
  );
}
