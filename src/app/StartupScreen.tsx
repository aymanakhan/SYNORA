import { Button } from '../components/ui';
import { useSynora } from './state';

/** Shown until local data is ready. Explains any delay instead of spinning forever. */
export function StartupScreen() {
  const { startupIssue, continueWithoutSaving, resetLocalData } = useSynora();

  if (!startupIssue) return <p className="text-text-muted">Loading local demo data…</p>;

  const reload = () => window.location.reload();
  const reset = async () => {
    if (window.confirm('Delete all SYNORA demo data stored in this browser (pet, manual entries, check-ins) and start fresh?')) {
      await resetLocalData();
    }
  };

  return (
    <div className="max-w-xl space-y-3 rounded-lg border border-review/50 bg-review/10 p-4 text-sm" role="alert">
      {startupIssue.kind === 'blocked' && (
        <>
          <p className="font-semibold text-review">SYNORA is open in another tab with an older version.</p>
          <p className="text-text-secondary">
            This update needs to upgrade the data saved in your browser, and the other tab is holding it open.
            <strong> Close (or reload) the other SYNORA tabs</strong> and this page will continue by itself.
          </p>
        </>
      )}
      {startupIssue.kind === 'slow' && (
        <>
          <p className="font-semibold text-review">Loading is taking longer than usual.</p>
          <p className="text-text-secondary">If SYNORA is open in another tab or window, close it and reload this page.</p>
        </>
      )}
      {startupIssue.kind === 'error' && (
        <>
          <p className="font-semibold text-review">SYNORA couldn’t load the data saved in this browser.</p>
          <p className="text-text-secondary">Details: {startupIssue.message}</p>
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={reload}>Reload</Button>
        <Button variant="secondary" onClick={continueWithoutSaving}>Continue without saving</Button>
        <Button variant="secondary" onClick={reset}>Reset local demo data</Button>
      </div>
      <p className="text-xs text-text-muted">“Continue without saving” runs this visit from memory. “Reset” deletes this browser’s SYNORA demo data only.</p>
    </div>
  );
}
