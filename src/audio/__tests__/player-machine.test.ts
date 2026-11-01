import { INITIAL_MACHINE_STATE, isActive, playerReducer, type MachineState } from '../player-machine';
import type { PlayerOutput, PlayerStatus } from '../types';

const state = (status: PlayerStatus, output: PlayerOutput | null = 'audio', token = 5, narrationId: string | null = 'n1'): MachineState => ({
  status,
  narrationId,
  output,
  token,
});

describe('playerReducer', () => {
  describe('PLAY_REQUESTED', () => {
    it('goes to loading with a fresh token from idle', () => {
      expect(playerReducer(INITIAL_MACHINE_STATE, { type: 'PLAY_REQUESTED', narrationId: 'a', output: 'audio' })).toEqual({
        status: 'loading',
        narrationId: 'a',
        output: 'audio',
        token: 1,
      });
    });

    it.each(['idle', 'loading', 'playing', 'paused', 'ended', 'failed'] as const)('replaces a %s playback with a new token', (status) => {
      const next = playerReducer(state(status), { type: 'PLAY_REQUESTED', narrationId: 'b', output: 'device-voice' });
      expect(next).toEqual({ status: 'loading', narrationId: 'b', output: 'device-voice', token: 6 });
    });
  });

  describe('OUTPUT_STARTED', () => {
    it('loading -> playing', () => {
      expect(playerReducer(state('loading'), { type: 'OUTPUT_STARTED', token: 5 }).status).toBe('playing');
    });

    it.each(['idle', 'playing', 'paused', 'ended', 'failed'] as const)('is ignored when %s', (status) => {
      const s = state(status);
      expect(playerReducer(s, { type: 'OUTPUT_STARTED', token: 5 })).toBe(s);
    });
  });

  describe('PAUSED', () => {
    it('playing -> paused', () => {
      expect(playerReducer(state('playing'), { type: 'PAUSED', token: 5 }).status).toBe('paused');
    });

    it.each(['idle', 'loading', 'paused', 'ended', 'failed'] as const)('is ignored when %s', (status) => {
      const s = state(status);
      expect(playerReducer(s, { type: 'PAUSED', token: 5 })).toBe(s);
    });
  });

  describe('RESUMED', () => {
    it('paused -> playing', () => {
      expect(playerReducer(state('paused'), { type: 'RESUMED', token: 5 }).status).toBe('playing');
    });

    it.each(['idle', 'loading', 'playing', 'ended', 'failed'] as const)('is ignored when %s', (status) => {
      const s = state(status);
      expect(playerReducer(s, { type: 'RESUMED', token: 5 })).toBe(s);
    });
  });

  describe('FINISHED', () => {
    it.each(['loading', 'playing', 'paused'] as const)('%s -> ended', (status) => {
      expect(playerReducer(state(status), { type: 'FINISHED', token: 5 }).status).toBe('ended');
    });

    it.each(['idle', 'ended', 'failed'] as const)('is ignored when %s', (status) => {
      const s = state(status);
      expect(playerReducer(s, { type: 'FINISHED', token: 5 })).toBe(s);
    });

    it('keeps the narration id and output', () => {
      expect(playerReducer(state('playing', 'device-voice'), { type: 'FINISHED', token: 5 })).toMatchObject({
        narrationId: 'n1',
        output: 'device-voice',
      });
    });
  });

  describe('OUTPUT_ERROR', () => {
    it.each(['loading', 'playing'] as const)('audio error while %s -> device voice, loading, new token', (status) => {
      expect(playerReducer(state(status, 'audio'), { type: 'OUTPUT_ERROR', token: 5 })).toEqual({
        status: 'loading',
        narrationId: 'n1',
        output: 'device-voice',
        token: 6,
      });
    });

    it('audio error while paused -> device voice, stays paused', () => {
      expect(playerReducer(state('paused', 'audio'), { type: 'OUTPUT_ERROR', token: 5 })).toEqual({
        status: 'paused',
        narrationId: 'n1',
        output: 'device-voice',
        token: 6,
      });
    });

    it.each(['loading', 'playing', 'paused'] as const)('device voice error while %s -> failed', (status) => {
      const next = playerReducer(state(status, 'device-voice'), { type: 'OUTPUT_ERROR', token: 5 });
      expect(next.status).toBe('failed');
      expect(next.output).toBe('device-voice');
      expect(next.narrationId).toBe('n1');
    });

    it('a late audio error after the fallback started is stale (old token)', () => {
      const fallback = playerReducer(state('playing', 'audio'), { type: 'OUTPUT_ERROR', token: 5 });
      expect(playerReducer(fallback, { type: 'OUTPUT_ERROR', token: 5 })).toBe(fallback);
    });

    it.each(['idle', 'ended', 'failed'] as const)('is ignored when %s', (status) => {
      const s = state(status);
      expect(playerReducer(s, { type: 'OUTPUT_ERROR', token: 5 })).toBe(s);
    });
  });

  describe('STOP', () => {
    it.each(['loading', 'playing', 'paused', 'ended', 'failed'] as const)('%s -> idle with no narration id and a new token', (status) => {
      expect(playerReducer(state(status), { type: 'STOP' })).toEqual({ status: 'idle', narrationId: null, output: null, token: 6 });
    });

    it('is a no-op when already idle', () => {
      expect(playerReducer(INITIAL_MACHINE_STATE, { type: 'STOP' })).toBe(INITIAL_MACHINE_STATE);
    });
  });

  describe('stale tokens', () => {
    it.each(['OUTPUT_STARTED', 'PAUSED', 'RESUMED', 'FINISHED', 'OUTPUT_ERROR'] as const)('%s with an old token changes nothing', (type) => {
      for (const status of ['loading', 'playing', 'paused'] as const) {
        const s = state(status);
        expect(playerReducer(s, { type, token: 4 })).toBe(s);
        expect(playerReducer(s, { type, token: 6 })).toBe(s);
      }
    });

    it('events from before a STOP are ignored', () => {
      const stopped = playerReducer(state('playing'), { type: 'STOP' });
      expect(playerReducer(stopped, { type: 'FINISHED', token: 5 })).toBe(stopped);
      expect(playerReducer(stopped, { type: 'OUTPUT_ERROR', token: 5 })).toBe(stopped);
    });

    it('events from before a new PLAY_REQUESTED are ignored', () => {
      const replayed = playerReducer(state('playing'), { type: 'PLAY_REQUESTED', narrationId: 'n2', output: 'audio' });
      expect(playerReducer(replayed, { type: 'FINISHED', token: 5 })).toBe(replayed);
      expect(playerReducer(replayed, { type: 'OUTPUT_STARTED', token: 5 })).toBe(replayed);
    });
  });

  it('does not mutate the previous state', () => {
    const s = state('playing');
    const copy = { ...s };
    playerReducer(s, { type: 'FINISHED', token: 5 });
    expect(s).toEqual(copy);
  });
});

describe('isActive', () => {
  it.each([
    ['loading', true],
    ['playing', true],
    ['paused', true],
    ['idle', false],
    ['ended', false],
    ['failed', false],
  ] as const)('%s -> %s', (status, expected) => {
    expect(isActive(state(status))).toBe(expected);
  });
});
