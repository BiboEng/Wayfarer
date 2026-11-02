import { INITIAL_MACHINE_STATE, playerReducer, type MachineState } from '../player-machine';

const withIntro = (): MachineState =>
  playerReducer(INITIAL_MACHINE_STATE, { type: 'PLAY_REQUESTED', narrationId: 'n1', output: 'audio', introOutput: 'audio' });

describe('playerReducer with an intro', () => {
  it('PLAY_REQUESTED starts the intro output and remembers the main output', () => {
    expect(withIntro()).toEqual({ status: 'loading', narrationId: 'n1', output: 'audio', token: 1, pendingMain: 'audio' });
  });

  it('the intro can use the device voice while the main part waits for audio', () => {
    const s = playerReducer(INITIAL_MACHINE_STATE, { type: 'PLAY_REQUESTED', narrationId: 'n1', output: 'device-voice', introOutput: 'device-voice' });
    expect(s).toMatchObject({ output: 'device-voice', pendingMain: 'device-voice' });
  });

  it('without an intro there is no pendingMain', () => {
    const s = playerReducer(INITIAL_MACHINE_STATE, { type: 'PLAY_REQUESTED', narrationId: 'n1', output: 'audio' });
    expect(s).not.toHaveProperty('pendingMain');
    const nullIntro = playerReducer(INITIAL_MACHINE_STATE, { type: 'PLAY_REQUESTED', narrationId: 'n1', output: 'audio', introOutput: null });
    expect(nullIntro).not.toHaveProperty('pendingMain');
  });

  it('the intro finishing moves to the main part: new token, same narration, the status carries on', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'OUTPUT_STARTED', token: 1 });
    expect(s.status).toBe('playing');
    s = playerReducer(s, { type: 'FINISHED', token: 1 });
    expect(s).toEqual({ status: 'playing', narrationId: 'n1', output: 'audio', token: 2 });
    expect(s).not.toHaveProperty('pendingMain');
  });

  it('the intro finishing is not "ended": ended comes only after the main part', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'FINISHED', token: 1 });
    expect(s.status).not.toBe('ended');
    s = playerReducer(s, { type: 'FINISHED', token: 2 });
    expect(s.status).toBe('ended');
  });

  it('a failed intro is skipped quietly: the main part starts, no fallback, not failed', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'OUTPUT_ERROR', token: 1 });
    expect(s).toEqual({ status: 'loading', narrationId: 'n1', output: 'audio', token: 2 });
  });

  it('a failed intro on the device voice moves on to the main part too', () => {
    let s = playerReducer(INITIAL_MACHINE_STATE, { type: 'PLAY_REQUESTED', narrationId: 'n1', output: 'device-voice', introOutput: 'device-voice' });
    s = playerReducer(s, { type: 'OUTPUT_ERROR', token: 1 });
    expect(s).toMatchObject({ status: 'loading', output: 'device-voice', token: 2 });
    expect(s).not.toHaveProperty('pendingMain');
  });

  it('events from the intro token are ignored once the main part has started', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'FINISHED', token: 1 });
    const same = playerReducer(s, { type: 'FINISHED', token: 1 });
    expect(same).toBe(s);
  });

  it('pausing during the intro pauses the whole narration', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'OUTPUT_STARTED', token: 1 });
    s = playerReducer(s, { type: 'PAUSED', token: 1 });
    expect(s.status).toBe('paused');
    s = playerReducer(s, { type: 'RESUMED', token: 1 });
    expect(s.status).toBe('playing');
  });

  it('an intro that ends while paused moves to the main part but stays paused', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'OUTPUT_STARTED', token: 1 });
    s = playerReducer(s, { type: 'PAUSED', token: 1 });
    s = playerReducer(s, { type: 'FINISHED', token: 1 });
    expect(s).toMatchObject({ status: 'paused', token: 2 });
  });

  it('stop during the intro goes idle; late intro events change nothing', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'STOP' });
    expect(s).toMatchObject({ status: 'idle', narrationId: null });
    expect(s).not.toHaveProperty('pendingMain');
    const after = playerReducer(s, { type: 'FINISHED', token: 1 });
    expect(after).toBe(s);
  });

  it('the main audio failing after the intro still falls back to the device voice', () => {
    let s = withIntro();
    s = playerReducer(s, { type: 'FINISHED', token: 1 });
    s = playerReducer(s, { type: 'OUTPUT_STARTED', token: 2 });
    s = playerReducer(s, { type: 'OUTPUT_ERROR', token: 2 });
    expect(s).toMatchObject({ status: 'loading', output: 'device-voice', token: 3 });
  });

  it('a new play replaces a narration whose intro is playing', () => {
    const s = playerReducer(withIntro(), { type: 'PLAY_REQUESTED', narrationId: 'n2', output: 'audio' });
    expect(s).toEqual({ status: 'loading', narrationId: 'n2', output: 'audio', token: 2 });
  });
});
