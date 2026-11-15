import { useSynora } from '../../app/state';
import { LearnMore } from '../../components/LearnMore';
import { Card, Pill, StatusBadge } from '../../components/ui';
import { NEXT_STEP_TEXT } from '../../lib/format';
import { getRuleDefinition } from '../health/assessment';
import { METRICS } from '../health/metrics';

/** The single monitoring result shown to the user. Non-diagnostic by design. */
export function AssessmentPanel() {
  const { assessment } = useSynora();
  if (!assessment) return <Card title="Monitoring result"><p className="text-text-muted">Loading…</p></Card>;
  const a = assessment;

  return (
    <Card
      title="Monitoring result"
      actions={<span className="text-xs text-text-muted">Confidence: {a.confidence}</span>}
    >
      <div className="flex flex-wrap items-start gap-3">
        <StatusBadge status={a.status} size="lg" />
        <p className="min-w-0 flex-1 text-sm">{a.explanation}</p>
      </div>

      {a.findings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {a.findings.map((f, i) => {
            const def = getRuleDefinition(f.ruleId);
            return (
              <li key={`${f.ruleId}-${i}`} className="rounded border border-white/10 bg-panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.status} />
                  <span className="text-sm font-semibold">{def?.title ?? f.ruleId}</span>
                  <Pill tone="review">Demonstration rule</Pill>
                  <span className="text-[11px] text-text-muted">{f.ruleId}</span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{f.explanation}</p>
                <p className="mt-1 text-xs text-text-muted">Next step: {NEXT_STEP_TEXT[f.nextStep]}</p>
                <p className="mt-1 text-[11px] text-text-muted">
                  The threshold is illustrative. The spaceflight relevance below comes from NASA/CSA sources.
                </p>
                {f.ruleId === 'R-SYMPTOMS-REPORTED' ? <LearnMore symptoms /> : def?.metrics[0] && <LearnMore metric={def.metrics[0]} />}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 rounded border border-cyan/30 bg-cyan/5 p-3 text-sm">
        <span className="font-semibold text-cyan">Suggested next step: </span>
        {NEXT_STEP_TEXT[a.nextStep]}
      </div>

      <details className="mt-3 text-xs text-text-muted">
        <summary className="cursor-pointer text-text-secondary">Limitations and missing data</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {a.limitations.map((l) => <li key={l}>{l}</li>)}
          {a.missingData.length > 0 && (
            <li>No current reading for: {a.missingData.map((m) => METRICS[m].label).join(', ')}.</li>
          )}
          <li>SYNORA is an educational prototype, not a medical device. It does not diagnose or prescribe treatment.</li>
        </ul>
      </details>
    </Card>
  );
}
