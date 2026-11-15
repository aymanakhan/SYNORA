import type { CheckIn, DemoProfile, Measurement } from '../../features/health/types';

/**
 * Storage abstraction. UI and ingestion depend on this interface, never on
 * IndexedDB directly, so a future authenticated backend can implement it.
 * Every query is scoped by profileId to keep profiles isolated.
 */
export interface HealthRepository {
  getProfile(id: string): Promise<DemoProfile | undefined>;
  listProfiles(): Promise<DemoProfile[]>;
  saveProfile(profile: DemoProfile): Promise<void>;

  addMeasurement(m: Measurement): Promise<void>;
  listMeasurements(profileId: string, opts?: { synthetic?: boolean }): Promise<Measurement[]>;
  addCheckIn(c: CheckIn): Promise<void>;
  listCheckIns(profileId: string, opts?: { synthetic?: boolean }): Promise<CheckIn[]>;

  /** Delete records for a profile (all, or only synthetic/real ones). */
  clearRecords(profileId: string, opts?: { synthetic?: boolean }): Promise<void>;
}

const bySynthetic = <T extends { isSynthetic: boolean }>(synthetic?: boolean) => (r: T) =>
  synthetic === undefined || r.isSynthetic === synthetic;

/** In-memory implementation for tests and as a fallback when IndexedDB is unavailable. */
export class MemoryRepository implements HealthRepository {
  private profiles = new Map<string, DemoProfile>();
  private measurements = new Map<string, Measurement>();
  private checkIns = new Map<string, CheckIn>();

  async getProfile(id: string) {
    return this.profiles.get(id);
  }
  async listProfiles() {
    return [...this.profiles.values()];
  }
  async saveProfile(p: DemoProfile) {
    this.profiles.set(p.id, structuredClone(p));
  }
  async addMeasurement(m: Measurement) {
    this.measurements.set(m.id, structuredClone(m));
  }
  async listMeasurements(profileId: string, opts: { synthetic?: boolean } = {}) {
    return [...this.measurements.values()]
      .filter((m) => m.profileId === profileId)
      .filter(bySynthetic(opts.synthetic))
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  }
  async addCheckIn(c: CheckIn) {
    this.checkIns.set(c.id, structuredClone(c));
  }
  async listCheckIns(profileId: string, opts: { synthetic?: boolean } = {}) {
    return [...this.checkIns.values()]
      .filter((c) => c.profileId === profileId)
      .filter(bySynthetic(opts.synthetic))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }
  async clearRecords(profileId: string, opts: { synthetic?: boolean } = {}) {
    for (const [id, m] of this.measurements) {
      if (m.profileId === profileId && bySynthetic(opts.synthetic)(m)) this.measurements.delete(id);
    }
    for (const [id, c] of this.checkIns) {
      if (c.profileId === profileId && bySynthetic(opts.synthetic)(c)) this.checkIns.delete(id);
    }
  }
}
