/**
 * Real GPS for the Live Tour. Tries the background location task first (keeps going with the
 * screen off); if the phone refuses it, falls back to the foreground watch (pauses off screen).
 * Reports which one runs, once per start. Pure: both sources and the app-state wait are injected.
 *
 * Android only lets the background task start (or change options) while the app is on screen.
 * A refusal right after a permission dialog can be that race, so each refusal is retried once,
 * the next time the app is on screen.
 */
import { backgroundTrackingOptions } from './tracking-options';
import type {
  BackgroundLocationSource,
  FixListener,
  LocationErrorListener,
  LocationSource,
  TrackingOptions,
} from './types';

export interface GpsSourceDeps {
  background: BackgroundLocationSource;
  createWatch(): LocationSource;
  /** Resolves when the app is on screen: now, or the next time it comes back. Never rejects. */
  whenForeground(): Promise<void>;
  /** true = the background task runs; false = the foreground watch. Called once per start. */
  onBackgroundKnown?(runsInBackground: boolean): void;
}

type Mode = 'off' | 'starting' | 'background' | 'watch';

export function createGpsLocationSource(deps: GpsSourceDeps): LocationSource {
  let mode: Mode = 'off';
  /** Bumped on every start and stop; async results from an older run are dropped. */
  let run = 0;
  /** The options the tour wants now. */
  let wanted: TrackingOptions | null = null;
  /** The options the background task was last started or updated with. */
  let applied: TrackingOptions | null = null;
  let watch: LocationSource | null = null;
  let listeners: { onFix: FixListener; onError?: LocationErrorListener } | null = null;

  const report = (message: string) => listeners?.onError?.(message);

  /** Resolves true when the task runs with `options`. Never rejects. */
  function tryBackground(id: number, options: TrackingOptions): Promise<boolean> {
    const onFix: FixListener = (fix) => {
      if (id === run) listeners?.onFix(fix);
    };
    const onError: LocationErrorListener = (message) => {
      if (id === run) report(message);
    };
    return deps.background.start(backgroundTrackingOptions(options), onFix, onError).then(
      () => {
        if (id === run) applied = options;
        return true;
      },
      (err: unknown) => {
        if (id === run) report(`background location refused: ${String(err)}`);
        return false;
      },
    );
  }

  async function startBackground(id: number, options: TrackingOptions): Promise<void> {
    let started = await tryBackground(id, options);
    if (!started && id === run) {
      await deps.whenForeground();
      if (id === run) started = await tryBackground(id, wanted ?? options);
    }
    if (id !== run) return;
    if (!started) return fallBack();
    mode = 'background';
    deps.onBackgroundKnown?.(true);
    // The mode changed while starting.
    if (wanted && wanted !== applied) applyBackgroundOptions(id, wanted, true);
  }

  function fallBack(): void {
    if (!listeners || !wanted) return;
    mode = 'watch';
    watch = deps.createWatch();
    watch.start(wanted, listeners.onFix, listeners.onError);
    deps.onBackgroundKnown?.(false);
  }

  /** Off screen the change is refused; the old rate keeps running until the app is back. */
  function applyBackgroundOptions(id: number, options: TrackingOptions, retry: boolean): void {
    deps.background.setOptions(backgroundTrackingOptions(options)).then(
      () => {
        if (id === run) applied = options;
      },
      (err: unknown) => {
        if (id !== run) return;
        report(`could not change the background location rate: ${String(err)}`);
        if (!retry) return;
        void deps.whenForeground().then(() => {
          if (id === run && mode === 'background' && wanted === options) applyBackgroundOptions(id, options, false);
        });
      },
    );
  }

  function stop(): void {
    run += 1;
    if (mode === 'background' || mode === 'starting') deps.background.stop();
    watch?.stop();
    watch = null;
    mode = 'off';
    wanted = null;
    applied = null;
    listeners = null;
  }

  return {
    start(options, onFix, onError) {
      stop();
      const id = run;
      listeners = { onFix, onError };
      wanted = options;
      mode = 'starting';
      startBackground(id, options).catch((err: unknown) => {
        if (id === run) report(`could not start the location updates: ${String(err)}`);
      });
    },
    setOptions(options) {
      if (mode === 'off') return;
      wanted = options;
      if (mode === 'watch') watch?.setOptions(options);
      else if (mode === 'background' && options !== applied) applyBackgroundOptions(run, options, true);
      // 'starting': applied once the task runs.
    },
    stop,
  };
}
