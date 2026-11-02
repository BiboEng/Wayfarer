import type { NarrationPlayer, PlayableNarration, PlayerState } from '@/audio/types';

/**
 * A NarrationPlayer that does nothing but keep state, with controls to play out its life cycle
 * by hand. `interruptions` lists every narration that was cut off by another play() or a stop().
 */
export function createFakePlayer() {
  let state: PlayerState = { status: 'idle', narrationId: null, output: null };
  const listeners = new Set<() => void>();
  const played: PlayableNarration[] = [];
  const interruptions: string[] = [];

  const set = (next: PlayerState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const active = () => state.status === 'loading' || state.status === 'playing' || state.status === 'paused';

  const player: NarrationPlayer = {
    play(narration) {
      if (active() && state.narrationId) interruptions.push(state.narrationId);
      played.push(narration);
      set({ status: 'loading', narrationId: narration.id, output: narration.audio ? 'audio' : 'device-voice' });
    },
    pause() {
      if (state.status === 'playing') set({ ...state, status: 'paused' });
    },
    resume() {
      if (state.status === 'paused') set({ ...state, status: 'playing' });
    },
    stop() {
      if (state.status === 'idle') return;
      if (active() && state.narrationId) interruptions.push(state.narrationId);
      set({ status: 'idle', narrationId: null, output: null });
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    player,
    played,
    interruptions,
    listenerCount: () => listeners.size,
    /** The sound started. */
    started: () => set({ ...state, status: 'playing' }),
    /** The story played to the end. */
    finish: () => set({ ...state, status: 'ended' }),
    /** Playback failed for good. */
    fail: () => set({ ...state, status: 'failed' }),
    /** The system paused the sound (audio focus lost). */
    systemPause: () => set({ ...state, status: 'paused' }),
    /** Someone else (e.g. Explore) starts a narration. */
    playOther: (id: string) => player.play({ id, title: id, text: id, audio: null }),
  };
}
