export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>; // value must be JSON-serializable
  delete(key: string): Promise<void>;
  /** Release resources (timers, handles). Optional; only persistent stores need it. */
  close?(): void;
}

/** Injectable clock (epoch ms) so tests can control expiry. */
export type Clock = () => number;
