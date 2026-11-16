import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CheckIn, DemoProfile, Measurement } from '../../features/health/types';
import type { HealthRepository } from './repository';

interface SynoraDB extends DBSchema {
  profiles: { key: string; value: DemoProfile };
  measurements: { key: string; value: Measurement; indexes: { byProfile: string; byProfileMetricTime: [string, string, string] } };
  checkIns: { key: string; value: CheckIn; indexes: { byProfile: string } };
}

/** Local, per-browser storage for demo profiles. Not a shared or hosted database. */
export class IndexedDbRepository implements HealthRepository {
  private constructor(private db: IDBPDatabase<SynoraDB>) {}

  /**
   * @param hooks.onBlocked  another tab still has an older version open, so
   *   the upgrade waits until that tab closes or reloads.
   * @param hooks.onReplaced  a newer version opened in another tab; this
   *   connection has been closed so it doesn't block that upgrade.
   */
  static async open(
    name = 'synora',
    hooks: { onBlocked?: () => void; onReplaced?: () => void } = {},
  ): Promise<IndexedDbRepository> {
    const db = await openDB<SynoraDB>(name, 2, {
      blocked() {
        hooks.onBlocked?.();
      },
      blocking() {
        // Never block a newer version: close and let the UI ask for a reload.
        db.close();
        hooks.onReplaced?.();
      },
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore('profiles', { keyPath: 'id' });
          db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
          db.createObjectStore('checkIns', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        }
        if (oldVersion < 2) {
          // v2: compound index so duplicate checks don't scan every reading.
          tx.objectStore('measurements').createIndex('byProfileMetricTime', ['profileId', 'metric', 'measuredAt']);
        }
      },
    });
    return new IndexedDbRepository(db);
  }

  getProfile(id: string) {
    return this.db.get('profiles', id);
  }
  listProfiles() {
    return this.db.getAll('profiles');
  }
  async saveProfile(p: DemoProfile) {
    await this.db.put('profiles', p);
  }
  async addMeasurement(m: Measurement) {
    await this.db.put('measurements', m);
  }
  getMeasurement(id: string) {
    return this.db.get('measurements', id);
  }
  async deleteMeasurement(id: string) {
    await this.db.delete('measurements', id);
  }
  findMeasurementsAt(profileId: string, metric: string, measuredAt: string) {
    return this.db.getAllFromIndex('measurements', 'byProfileMetricTime', [profileId, metric, measuredAt]);
  }
  async listMeasurements(profileId: string, opts: { synthetic?: boolean } = {}) {
    const all = await this.db.getAllFromIndex('measurements', 'byProfile', profileId);
    return all
      .filter((m) => opts.synthetic === undefined || m.isSynthetic === opts.synthetic)
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  }
  async addCheckIn(c: CheckIn) {
    await this.db.put('checkIns', c);
  }
  async bulkAdd(ms: Measurement[], cs: CheckIn[]) {
    const tx = this.db.transaction(['measurements', 'checkIns'], 'readwrite');
    const mStore = tx.objectStore('measurements');
    const cStore = tx.objectStore('checkIns');
    await Promise.all([...ms.map((m) => mStore.put(m)), ...cs.map((c) => cStore.put(c)), tx.done]);
  }
  getCheckIn(id: string) {
    return this.db.get('checkIns', id);
  }
  async deleteCheckIn(id: string) {
    await this.db.delete('checkIns', id);
  }
  async listCheckIns(profileId: string, opts: { synthetic?: boolean } = {}) {
    const all = await this.db.getAllFromIndex('checkIns', 'byProfile', profileId);
    return all
      .filter((c) => opts.synthetic === undefined || c.isSynthetic === opts.synthetic)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }
  async clearRecords(profileId: string, opts: { synthetic?: boolean } = {}) {
    const tx = this.db.transaction(['measurements', 'checkIns'], 'readwrite');
    for (const store of ['measurements', 'checkIns'] as const) {
      let cursor = await tx.objectStore(store).index('byProfile').openCursor(profileId);
      while (cursor) {
        if (opts.synthetic === undefined || cursor.value.isSynthetic === opts.synthetic) await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.done;
  }
}
