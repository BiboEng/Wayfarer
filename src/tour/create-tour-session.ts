/**
 * Wires the Live Tour: location source → motion → reducer → commands (search, story, player).
 * No React or Expo imports: every device and server dependency is injected, so this can be
 * tested with fakes. The app-wide instance lives in `tour-session.ts`.
 *
 * Hands-free: nothing here prompts or shows anything. Only `requestPermission()` (called from a
 * tap) shows the system prompt. Every failure is quiet.
 */
import type { NarrationAudio } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { TravelMode } from '@shared/narration/options';

import type { NarrationPlayer, RemoteSound } from '@/audio/types';
import { trackingOptionsFor } from '@/location/tracking-options';
import type { LocationFix, LocationPermission, LocationSource } from '@/location/types';
import type { TourSettings } from '@/settings/types';

import { createCueCache } from './cue-cache';
import { isUsableFix, profileFor } from './mode-profile';
import { currentHeading, INITIAL_MOTION, resolveMode, updateMotion, type MotionState } from './motion';
import { phaseAfterPrompt, phaseForPermission } from './permission-phase';
import { createPlayerLink } from './player-link';
import { createCommandRunner, type TourApi } from './tour-commands';
import { initialTourState, tourReducer } from './tour-machine';
import type { TourEvent, TourMachineState } from './tour-machine-types';
import { sameSnapshot, toTourSnapshot, type SessionPhase } from './tour-snapshot';
import type { TourSession, TourSnapshot, TourSource } from './types';
import { localDateKey } from './visited';
import type { VisitedStore } from './visited-storage';

export interface TourSessionDeps {
  /** A simulated source needs no permission; real GPS does. */
  isSimulated(source: TourSource): boolean;
  createLocationSource(source: TourSource): LocationSource;
  getPermission(): Promise<LocationPermission>;
  requestPermission(): Promise<LocationPermission>;
  servicesEnabled(): Promise<boolean>;
  api: TourApi;
  audioSource(audio: NarrationAudio): RemoteSound | null;
  player: NarrationPlayer;
  visitedStore: VisitedStore;
  /** Read at the moment of use, so Settings changes apply to the next story / fix. */
  getSettings(): TourSettings;
  /** Called on every Settings change; returns an unsubscribe function. Omit = no live updates. */
  subscribeSettings?: (listener: () => void) => () => void;
  now?: () => number;
  log?: (message: string, detail?: string) => void;
}

export function createTourSession(deps: TourSessionDeps): TourSession {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => undefined);
  const link = createPlayerLink(deps.player);
  // Kept across tours: the lines never change, so a voice's lines are fetched once per app run.
  const cues = createCueCache({ getCue: deps.api.getCue, audioSource: deps.audioSource });
  const runCommand = createCommandRunner({ ...deps, link, cues, log });

  let phase: SessionPhase = 'idle';
  let source: TourSource = 'gps';
  // Declared before `machine`: currentMode() reads it.
  let motion: MotionState = INITIAL_MOTION;
  let machine: TourMachineState = initialTourState(currentMode());
  /** Latest position from any fix (rough ones included), for the map dot. */
  let displayPosition: LatLng | null = null;
  let location: LocationSource | null = null;
  let trackingMode: TravelMode | null = null;
  let unsubscribeSettings: (() => void) | null = null;
  /** The system permission prompt is showing; start() must not discard its answer. */
  let asking = false;
  /** Bumped on every start/stop; async results from an older tour are ignored. */
  let generation = 0;
  const queue: TourEvent[] = [];
  let dispatching = false;
  let snapshot: TourSnapshot = buildSnapshot();
  const listeners = new Set<() => void>();

  /** Detected mode with the Settings override applied. */
  function currentMode(): TravelMode {
    return resolveMode(motion.detectedMode, deps.getSettings().travelMode);
  }

  function buildSnapshot(): TourSnapshot {
    const built = toTourSnapshot({
      phase,
      source,
      machine,
      modeFixed: deps.getSettings().travelMode !== 'auto',
      playerPaused: link.isPaused(),
      displayPosition,
    });
    // Before the first fix the reducer hasn't seen the mode yet; show the Settings one.
    return machine.position ? built : { ...built, mode: currentMode() };
  }

  function emit(): void {
    const next = buildSnapshot();
    if (sameSnapshot(next, snapshot)) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function setPhase(next: SessionPhase): void {
    phase = next;
    emit();
  }

  /** Events raised while running commands are queued, so the reducer never re-enters. */
  function dispatch(event: TourEvent): void {
    queue.push(event);
    if (dispatching) return;
    dispatching = true;
    try {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const step = tourReducer(machine, next);
        machine = step.state;
        step.commands.forEach((command) => runCommand(command, dispatchFor(generation)));
      }
    } finally {
      dispatching = false;
    }
    emit();
  }

  /** A dispatch that drops results once the tour that asked for them has stopped. */
  function dispatchFor(owner: number): (event: TourEvent) => void {
    return (event) => {
      if (owner === generation && phase === 'running') dispatch(event);
    };
  }

  /** Feeds a position to the reducer and restarts the watch if the mode changed. */
  function steer(position: LatLng, headingDeg: number | null): void {
    const mode = currentMode();
    dispatch({ type: 'FIX', position, headingDeg, mode, now: now() });
    if (mode !== trackingMode && location) {
      trackingMode = mode;
      location.setOptions(trackingOptionsFor(mode));
    }
  }

  function onFix(fix: LocationFix): void {
    // Same spot: keep the object, so the screen isn't re-rendered for nothing.
    if (displayPosition?.lat !== fix.lat || displayPosition.lng !== fix.lng) displayPosition = { lat: fix.lat, lng: fix.lng };
    // Too rough to steer by (motion, heading, re-checks, ranking): only the map dot moves.
    if (!isUsableFix(fix.accuracyM, profileFor(machine.mode))) {
      emit();
      return;
    }
    motion = updateMotion(motion, fix);
    steer(displayPosition, currentHeading(motion, fix.timestamp));
  }

  function onSettingsChange(): void {
    cues.warm(deps.getSettings().voice);
    // A new travel mode applies at once (search radius, tracking rate), without waiting for a fix.
    if (machine.position && currentMode() !== machine.mode) steer(machine.position, machine.headingDeg);
    else emit();
  }

  /** Stops tracking and the tour's own story; the caller sets the phase. */
  function teardown(): void {
    generation += 1;
    location?.stop();
    location = null;
    trackingMode = null;
    unsubscribeSettings?.();
    unsubscribeSettings = null;
    link.stop();
    link.disconnect();
    cues.cancelPending();
    queue.length = 0;
    motion = INITIAL_MOTION;
    displayPosition = null;
    machine = initialTourState(currentMode());
  }

  function begin(owner: number): void {
    phase = 'running';
    const mode = currentMode();
    machine = initialTourState(mode);
    link.connect(
      (narrationId, failed) => dispatchFor(owner)({ type: 'PLAYBACK_ENDED', narrationId, failed }),
      () => {
        if (owner === generation) emit();
      },
    );
    unsubscribeSettings =
      deps.subscribeSettings?.(() => {
        if (owner === generation) onSettingsChange();
      }) ?? null;
    cues.warm(deps.getSettings().voice);

    const today = localDateKey(now());
    deps.visitedStore.load().then(
      (day) => dispatchFor(owner)({ type: 'VISITED_LOADED', day, today }),
      () => dispatchFor(owner)({ type: 'VISITED_LOADED', day: null, today }),
    );

    trackingMode = mode;
    location = deps.createLocationSource(source);
    location.start(
      trackingOptionsFor(mode),
      (fix) => {
        if (owner === generation) onFix(fix);
      },
      (message) => log('location error', message),
    );
    emit();
  }

  /** Checked on every start, so coming back from the phone's Settings just works. */
  async function checkAndBegin(owner: number): Promise<void> {
    if (!deps.isSimulated(source)) {
      const waiting = phaseForPermission(await deps.getPermission());
      if (owner !== generation) return;
      if (waiting) return setPhase(waiting);
      const enabled = await deps.servicesEnabled();
      if (owner !== generation) return;
      if (!enabled) return setPhase('location-off');
    }
    begin(owner);
  }

  function start(next: TourSource = 'gps'): void {
    // The prompt's own answer starts the tour (the dialog's AppState bounce must not discard it).
    if (asking) return;
    if (phase === 'running' && next === source) return;
    const wasRunning = phase === 'running';
    teardown();
    source = next;
    // A waiting screen stays up until the new check answers (no flicker through idle).
    if (wasRunning) setPhase('idle');
    checkAndBegin(generation).catch((err: unknown) => log('could not start the tour', String(err)));
  }

  return {
    start,
    requestPermission() {
      if (asking) return;
      asking = true;
      if (phase === 'running') {
        teardown();
        setPhase('idle');
      } else teardown(); // cancels a pending check
      const owner = generation;
      const onAnswer = (permission: LocationPermission) => {
        asking = false;
        if (owner !== generation) return;
        const waiting = phaseAfterPrompt(permission);
        if (waiting) setPhase(waiting);
        else start(source);
      };
      deps.requestPermission().then(onAnswer, () => onAnswer('denied'));
    },
    stop() {
      teardown();
      setPhase('idle');
    },
    pause() {
      if (phase === 'running') dispatch({ type: 'PAUSE' });
    },
    resume() {
      if (phase === 'running') dispatch({ type: 'RESUME' });
    },
    skip() {
      if (phase === 'running') dispatch({ type: 'SKIP' });
    },
    replay(landmarkId) {
      if (phase === 'running') dispatch({ type: 'REPLAY', landmarkId });
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
