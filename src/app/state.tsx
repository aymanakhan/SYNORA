import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { assess } from '../features/health/assessment';
import { METRICS, isMetricId } from '../features/health/metrics';
import { UNIT_CHOICE_METRICS, canonicalizeUnitSpelling, type DisplayUnits } from '../features/health/units';
import type {
  AssessmentResult,
  CheckIn,
  DemoProfile,
  Measurement,
  MetricId,
  PetSpecies,
  RawCheckInInput,
  RawMeasurementInput,
} from '../features/health/types';
import { MISSION_DAYS, generateDay, generateWindow, radiationHistory, simulatedNow, type ScenarioId } from '../features/simulation/scenarios';
import {
  deleteManualCheckIn,
  deleteManualMeasurement,
  ingestCheckIn,
  ingestMeasurement,
  updateCheckIn as updateCheckInRecord,
  updateMeasurement,
  type IngestCheckInResult,
  type IngestResult,
} from '../services/ingestion/ingest';
import { IndexedDbRepository } from '../services/storage/indexedDb';
import { MemoryRepository, type HealthRepository } from '../services/storage/repository';

/** Which records are in view. Manual and synthetic data are never mixed in one assessment. */
export type DataMode = 'manual' | 'simulated';

export interface SimState {
  scenarioId: ScenarioId;
  day: number;
  playing: boolean;
  /** Real milliseconds per simulated mission day while playing. */
  speedMs: number;
}

export interface LastUpdate {
  at: number;
  kind: 'measurement' | 'check-in' | 'simulated-day';
  label: string;
}

export type StartupIssue =
  | { kind: 'blocked' }
  | { kind: 'slow' }
  | { kind: 'error'; message: string };

interface SynoraContext {
  ready: boolean;
  /** Why the app hasn't finished loading, if something is wrong. */
  startupIssue?: StartupIssue;
  /** Another tab opened a newer version; this tab must reload to keep saving. */
  replacedByNewerVersion: boolean;
  continueWithoutSaving: () => void;
  resetLocalData: () => Promise<void>;
  /** Preferred display unit per metric (°F, mmol/L, µSv, min…). */
  displayUnits: DisplayUnits;
  setDisplayUnit: (metric: MetricId, unit: string) => void;
  storageWarning?: string;
  profile?: DemoProfile;
  mode: DataMode;
  setMode: (m: DataMode) => void;
  measurements: Measurement[];
  checkIns: CheckIn[];
  assessment?: AssessmentResult;
  /** Real clock in manual mode; simulated mission clock in simulated mode. */
  now: Date;
  sim: SimState;
  setScenario: (id: ScenarioId) => void;
  setDay: (day: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (ms: number) => void;
  lastUpdate?: LastUpdate;
  addManualMeasurement: (raw: Omit<RawMeasurementInput, 'source'>) => Promise<IngestResult>;
  editManualMeasurement: (id: string, raw: Omit<RawMeasurementInput, 'source'>) => Promise<IngestResult>;
  deleteMeasurement: (id: string) => Promise<boolean>;
  /** Saves a manual check-in; a second one on the same day updates that day's entry. */
  submitCheckIn: (raw: Omit<RawCheckInInput, 'synthetic' | 'scenarioId' | 'missionDay'>) => Promise<IngestCheckInResult>;
  editCheckIn: (id: string, raw: Omit<RawCheckInInput, 'synthetic' | 'scenarioId' | 'missionDay' | 'submittedAt'>) => Promise<IngestCheckInResult>;
  deleteCheckIn: (id: string) => Promise<boolean>;
  savePet: (species: PetSpecies, name: string) => Promise<void>;
  resetData: (which: 'manual' | 'simulated') => Promise<void>;
}

const Ctx = createContext<SynoraContext | null>(null);

const PROFILE_ID = 'demo-astronaut';
const PREFS_KEY = 'synora.prefs.v1';
const UNITS_KEY = 'synora.units.v1';

function loadUnits(): DisplayUnits {
  try {
    return JSON.parse(localStorage.getItem(UNITS_KEY) ?? '{}') as DisplayUnits;
  } catch {
    return {};
  }
}

interface Prefs {
  mode: DataMode;
  sim: Omit<SimState, 'playing'>;
}

const DEFAULT_PREFS: Prefs = { mode: 'simulated', sim: { scenarioId: 'stable', day: 30, speedMs: 1500 } };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      mode: p.mode === 'manual' ? 'manual' : 'simulated',
      sim: { ...DEFAULT_PREFS.sim, ...(p.sim ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: preference simply isn't remembered */
  }
}

export function SynoraProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadPrefs, []);
  const [repo, setRepo] = useState<HealthRepository>();
  const [storageWarning, setStorageWarning] = useState<string>();
  const [startupIssue, setStartupIssue] = useState<StartupIssue>();
  const [displayUnits, setDisplayUnits] = useState<DisplayUnits>(loadUnits);
  const setDisplayUnit = useCallback((metric: MetricId, unit: string) => {
    if (!UNIT_CHOICE_METRICS.includes(metric) || !METRICS[metric].acceptedUnits.includes(unit)) return;
    setDisplayUnits((u) => {
      if (u[metric] === unit) return u;
      const next = { ...u, [metric]: unit };
      try {
        localStorage.setItem(UNITS_KEY, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });
  }, []);
  const [replacedByNewerVersion, setReplaced] = useState(false);
  const [profile, setProfile] = useState<DemoProfile>();
  const [mode, setModeState] = useState<DataMode>(initial.mode);
  const [sim, setSim] = useState<SimState>({ ...initial.sim, playing: false });
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [realNow, setRealNow] = useState(() => new Date());
  const [lastUpdate, setLastUpdate] = useState<LastUpdate>();
  const [ready, setReady] = useState(false);

  // Serialize storage work so rapid slider moves can't interleave.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
  /** Day whose synthetic records are currently stored (undefined = none/unknown). */
  const loadedSim = useRef<{ scenarioId: ScenarioId; day: number }>();

  // --- open storage + profile ----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let r: HealthRepository;
      try {
        r = await IndexedDbRepository.open('synora', {
          onBlocked: () => !cancelled && setStartupIssue({ kind: 'blocked' }),
          onReplaced: () => setReplaced(true),
        });
        if (!cancelled) setStartupIssue(undefined);
      } catch {
        r = new MemoryRepository();
        setStorageWarning('Browser storage is unavailable, so data will not be kept after reload.');
      }
      try {
        const p = await ensureProfile(r);
        if (!cancelled) {
          setRepo(r);
          setProfile(p);
        }
      } catch (e) {
        if (!cancelled) setStartupIssue({ kind: 'error', message: (e as Error)?.message ?? String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => savePrefs({ mode, sim: { scenarioId: sim.scenarioId, day: sim.day, speedMs: sim.speedMs } }), [mode, sim]);

  // Real clock tick for freshness in manual mode.
  useEffect(() => {
    const t = setInterval(() => setRealNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(
    async (r: HealthRepository, m: DataMode) => {
      const synthetic = m === 'simulated';
      const [ms, cs] = await Promise.all([
        r.listMeasurements(PROFILE_ID, { synthetic }),
        r.listCheckIns(PROFILE_ID, { synthetic }),
      ]);
      setMeasurements(ms);
      setCheckIns(cs);
    },
    [],
  );

  /** Run simulated readings for a day (or a window ending on it) through the normal ingestion path. */
  const loadSimulation = useCallback(
    (r: HealthRepository, scenarioId: ScenarioId, day: number) =>
      enqueue(async () => {
        const prev = loadedSim.current;
        const appendOnly = prev && prev.scenarioId === scenarioId && day === prev.day + 1;
        const days = appendOnly ? [generateDay(scenarioId, day)] : generateWindow(scenarioId, day);
        if (!appendOnly) await r.clearRecords(PROFILE_ID, { synthetic: true });
        const now = simulatedNow(day);
        // Full dosimeter history so the cumulative mission dose is complete.
        if (!appendOnly) {
          for (const raw of radiationHistory(scenarioId, days[0].day)) await ingestMeasurement(raw, { profileId: PROFILE_ID, now }, r);
        }
        for (const d of days) {
          for (const raw of d.measurements) await ingestMeasurement(raw, { profileId: PROFILE_ID, now }, r);
          await ingestCheckIn(d.checkIn, { profileId: PROFILE_ID, now }, r);
        }
        loadedSim.current = { scenarioId, day };
        setLastUpdate({ at: Date.now(), kind: 'simulated-day', label: `Mission day ${day} readings received` });
      }),
    [enqueue],
  );

  // Initial load once storage is open.
  useEffect(() => {
    if (!repo) return;
    (async () => {
      try {
        // Always rebuild the simulated window on startup so it matches the saved scenario/day.
        await loadSimulation(repo, sim.scenarioId, sim.day);
        await refresh(repo, mode);
        setStartupIssue(undefined);
        setReady(true);
      } catch (e) {
        setStartupIssue({ kind: 'error', message: (e as Error)?.message ?? String(e) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  // If loading takes unusually long without a known cause, say so.
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setStartupIssue((i) => i ?? { kind: 'slow' }), 8000);
    return () => clearTimeout(t);
  }, [ready]);

  /** Escape hatch: run from memory for this visit (nothing is saved). */
  const continueWithoutSaving = useCallback(() => {
    const r = new MemoryRepository();
    setStorageWarning('Running without saving: changes in this visit will be lost when you reload.');
    setStartupIssue(undefined);
    loadedSim.current = undefined;
    void ensureProfile(r).then((p) => {
      setProfile(p);
      setRepo(r);
    });
  }, []);

  /** Delete this browser's SYNORA demo data and reload. */
  const resetLocalData = useCallback(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('synora');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    try {
      localStorage.removeItem(PREFS_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, []);

  const setMode = useCallback(
    (m: DataMode) => {
      setModeState(m);
      if (repo) void enqueue(() => refresh(repo, m));
    },
    [repo, enqueue, refresh],
  );

  const applySim = useCallback(
    async (scenarioId: ScenarioId, day: number) => {
      if (!repo) return;
      await loadSimulation(repo, scenarioId, day);
      if (mode === 'simulated') await enqueue(() => refresh(repo, 'simulated'));
    },
    [repo, mode, loadSimulation, enqueue, refresh],
  );

  const setScenario = useCallback(
    (id: ScenarioId) => {
      setSim((s) => ({ ...s, scenarioId: id, playing: false }));
      void applySim(id, sim.day);
    },
    [applySim, sim.day],
  );

  const setDay = useCallback(
    (day: number) => {
      const d = Math.min(MISSION_DAYS, Math.max(1, Math.round(day)));
      setSim((s) => ({ ...s, day: d }));
      void applySim(sim.scenarioId, d);
    },
    [applySim, sim.scenarioId],
  );

  const setPlaying = useCallback((playing: boolean) => setSim((s) => ({ ...s, playing })), []);
  const setSpeed = useCallback((speedMs: number) => setSim((s) => ({ ...s, speedMs })), []);

  // Simulated feed playback: one mission day per tick.
  useEffect(() => {
    if (!sim.playing) return;
    if (sim.day >= MISSION_DAYS) {
      setSim((s) => ({ ...s, playing: false }));
      return;
    }
    const t = setTimeout(() => setDay(sim.day + 1), sim.speedMs);
    return () => clearTimeout(t);
  }, [sim.playing, sim.day, sim.speedMs, setDay]);

  const now = mode === 'simulated' ? simulatedNow(sim.day) : realNow;

  const assessment = useMemo(
    () =>
      ready
        ? assess({ measurements, checkIns, now, utcOffsetMinutes: mode === 'simulated' ? 0 : undefined, displayUnits })
        : undefined,
    // `now` is derived from these; avoid re-running on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, measurements, checkIns, mode, sim.day, realNow, displayUnits],
  );

  /**
   * After any change to manual data: show manual entries (so the result
   * visibly updates instead of staying on the simulation) and refresh.
   */
  const afterManualChange = useCallback(
    async (r: HealthRepository, kind: LastUpdate['kind'], label: string) => {
      const switched = mode !== 'manual';
      if (switched) setModeState('manual');
      setLastUpdate({ at: Date.now(), kind, label: switched ? `${label}. Now showing your manual entries.` : label });
      setRealNow(new Date());
      await enqueue(() => refresh(r, 'manual'));
    },
    [mode, enqueue, refresh],
  );


  /** The unit someone enters with becomes their display unit for that measurement. */
  const rememberUnit = useCallback(
    (raw: Omit<RawMeasurementInput, 'source'>) => {
      const spelled = canonicalizeUnitSpelling(raw.unit);
      if (spelled && isMetricId(raw.metric)) setDisplayUnit(raw.metric, spelled);
    },
    [setDisplayUnit],
  );

  const addManualMeasurement = useCallback(
    async (raw: Omit<RawMeasurementInput, 'source'>) => {
      if (!repo) return { status: 'rejected', errors: [{ field: 'profileId', message: 'Storage not ready.' }] } satisfies IngestResult;
      const result = await enqueue(() => ingestMeasurement({ ...raw, source: 'manual' }, { profileId: PROFILE_ID }, repo));
      if (result.status === 'saved') {
        rememberUnit(raw);
        await afterManualChange(repo, 'measurement', 'Manual measurement saved');
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, enqueue, afterManualChange],
  );

  const editManualMeasurement = useCallback(
    async (id: string, raw: Omit<RawMeasurementInput, 'source'>) => {
      if (!repo) return { status: 'rejected', errors: [{ field: 'profileId', message: 'Storage not ready.' }] } satisfies IngestResult;
      const result = await enqueue(() => updateMeasurement(id, raw, { profileId: PROFILE_ID }, repo));
      if (result.status === 'saved') {
        rememberUnit(raw);
        await afterManualChange(repo, 'measurement', 'Measurement corrected');
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, enqueue, afterManualChange],
  );

  const deleteMeasurement = useCallback(
    async (id: string) => {
      if (!repo) return false;
      const ok = await enqueue(() => deleteManualMeasurement(id, PROFILE_ID, repo));
      if (ok) await afterManualChange(repo, 'measurement', 'Measurement deleted');
      return ok;
    },
    [repo, enqueue, afterManualChange],
  );

  const submitCheckIn = useCallback(
    async (raw: Omit<RawCheckInInput, 'synthetic' | 'scenarioId' | 'missionDay'>) => {
      if (!repo) return { status: 'rejected', errors: [{ field: 'profileId', message: 'Storage not ready.' }] } satisfies IngestCheckInResult;
      const result = await enqueue(() =>
        ingestCheckIn({ ...raw, synthetic: false }, { profileId: PROFILE_ID }, repo, {
          onePerDay: { utcOffsetMinutes: -new Date().getTimezoneOffset() },
        }),
      );
      if (result.status === 'saved') {
        await afterManualChange(repo, 'check-in', result.replaced ? "Today's check-in updated" : 'Check-in saved');
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, enqueue, afterManualChange],
  );

  const editCheckIn = useCallback(
    async (id: string, raw: Omit<RawCheckInInput, 'synthetic' | 'scenarioId' | 'missionDay' | 'submittedAt'>) => {
      if (!repo) return { status: 'rejected', errors: [{ field: 'profileId', message: 'Storage not ready.' }] } satisfies IngestCheckInResult;
      const result = await enqueue(() => updateCheckInRecord(id, { ...raw, synthetic: false }, { profileId: PROFILE_ID }, repo));
      if (result.status === 'saved') await afterManualChange(repo, 'check-in', 'Check-in corrected');
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, enqueue, afterManualChange],
  );

  const deleteCheckIn = useCallback(
    async (id: string) => {
      if (!repo) return false;
      const ok = await enqueue(() => deleteManualCheckIn(id, PROFILE_ID, repo));
      if (ok) await afterManualChange(repo, 'check-in', 'Check-in deleted');
      return ok;
    },
    [repo, enqueue, afterManualChange],
  );

  const savePet = useCallback(
    async (species: PetSpecies, name: string) => {
      if (!repo || !profile) return;
      const p = { ...profile, petSpecies: species, petName: name.trim() || defaultPetName(species) };
      await repo.saveProfile(p);
      setProfile(p);
    },
    [repo, profile],
  );

  const resetData = useCallback(
    async (which: 'manual' | 'simulated') => {
      if (!repo) return;
      await enqueue(() => repo.clearRecords(PROFILE_ID, { synthetic: which === 'simulated' }));
      if (which === 'simulated') {
        loadedSim.current = undefined;
        await loadSimulation(repo, sim.scenarioId, sim.day);
      }
      await enqueue(() => refresh(repo, mode));
    },
    [repo, enqueue, loadSimulation, refresh, sim.scenarioId, sim.day, mode],
  );

  const value: SynoraContext = {
    ready,
    startupIssue,
    replacedByNewerVersion,
    continueWithoutSaving,
    resetLocalData,
    displayUnits,
    setDisplayUnit,
    storageWarning,
    profile,
    mode,
    setMode,
    measurements,
    checkIns,
    assessment,
    now,
    sim,
    setScenario,
    setDay,
    setPlaying,
    setSpeed,
    lastUpdate,
    addManualMeasurement,
    editManualMeasurement,
    deleteMeasurement,
    submitCheckIn,
    editCheckIn,
    deleteCheckIn,
    savePet,
    resetData,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

async function ensureProfile(r: HealthRepository): Promise<DemoProfile> {
  let p = await r.getProfile(PROFILE_ID);
  if (!p) {
    p = { id: PROFILE_ID, displayName: 'Demo Astronaut (fictional)', kind: 'demo', createdAt: new Date().toISOString() };
    await r.saveProfile(p);
  }
  return p;
}

export function defaultPetName(species: PetSpecies): string {
  return { cat: 'Comet', dog: 'Rover', axolotl: 'Nova' }[species];
}

export function useSynora(): SynoraContext {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSynora must be used inside <SynoraProvider>');
  return c;
}
