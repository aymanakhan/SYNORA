import { useMemo, useState } from 'react';
import { useSynora } from '../../app/state';
import { Button, Card, StatusBadge } from '../../components/ui';
import { NEXT_STEP_TEXT, SOURCE_LABEL, formatDateTime, formatUnit, formatValue } from '../../lib/format';
import { getRuleDefinition } from '../health/assessment';
import { METRICS } from '../health/metrics';
import type { Measurement, MetricId } from '../health/types';
import { getScenario } from '../simulation/scenarios';

/** On-screen, source-aware summary a crew member could review with a flight surgeon. Nothing is sent anywhere. */
export function SummaryPage() {
  const { assessment, measurements, checkIns, mode, sim, profile, now } = useSynora();
  const [copied, setCopied] = useState(false);

  const latest = useMemo(() => {
    const map = new Map<MetricId, Measurement>();
    for (const m of measurements) if (Date.parse(m.measuredAt) <= now.getTime()) map.set(m.metric, m);
    return [...map.values()];
  }, [measurements, now]);

  if (!assessment) return null;

  const context =
    mode === 'simulated'
      ? `SIMULATED DATA (synthetic): ${getScenario(sim.scenarioId)?.name}, mission day ${sim.day}`
      : 'Manual entries';

  const text = [
    'SYNORA monitoring summary (educational prototype, not a medical record)',
    `Profile: ${profile?.displayName ?? ''}`,
    `Data: ${context}`,
    `Generated: ${now.toISOString()}`,
    '',
    `Monitoring result: ${assessment.status.toUpperCase()} (confidence ${assessment.confidence})`,
    assessment.explanation,
    ...assessment.findings.map((f) => `- [${f.status}] ${getRuleDefinition(f.ruleId)?.title ?? f.ruleId}: ${f.explanation} (demonstration rule ${f.ruleId})`),
    `Suggested next step: ${NEXT_STEP_TEXT[assessment.nextStep]}`,
    '',
    'Latest readings:',
    ...latest.map((m) => `- ${METRICS[m.metric].label}: ${formatValue(m)} ${formatUnit(m)} at ${m.measuredAt} (${SOURCE_LABEL[m.source]})`),
    '',
    `Check-ins recorded: ${checkIns.length}`,
    `Missing current data: ${assessment.missingData.map((m) => METRICS[m].label).join(', ') || 'none'}`,
    'Limitations:',
    ...assessment.limitations.map((l) => `- ${l}`),
  ].join('\n');

  return (
    <div className="space-y-4">
      <Card
        title="Mission health summary"
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied ✓' : 'Copy as text'}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-text-secondary">
          A concise, source-aware overview to support a conversation with your crew medical officer or flight surgeon. Nothing is sent automatically.
        </p>
        <p className={`mb-3 text-sm font-semibold ${mode === 'simulated' ? 'text-purple' : 'text-teal'}`}>Data: {context}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={assessment.status} size="lg" />
          <span className="text-sm">{assessment.explanation}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-muted uppercase">
              <tr>
                <th className="py-1 pr-3">Indicator</th>
                <th className="py-1 pr-3">Latest</th>
                <th className="py-1 pr-3">When</th>
                <th className="py-1">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {latest.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 pr-3">{METRICS[m.metric].label}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatValue(m)} {formatUnit(m)}</td>
                  <td className="py-1.5 pr-3 text-text-muted">{formatDateTime(m.measuredAt)}</td>
                  <td className="py-1.5 text-text-muted">{SOURCE_LABEL[m.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Plain-text version">
        <pre className="max-h-80 overflow-auto rounded bg-panel p-3 text-xs whitespace-pre-wrap text-text-secondary">{text}</pre>
      </Card>
    </div>
  );
}
