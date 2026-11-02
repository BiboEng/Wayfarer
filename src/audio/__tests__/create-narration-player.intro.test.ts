import { flush, INTRO_AUDIO, MAIN_AUDIO, narration, setupPlayer } from '../__fixtures__/fake-outputs';

describe('createNarrationPlayer with an intro', () => {
  it('plays the intro audio, then the main audio, under one id', async () => {
    const { player, outputs, events } = setupPlayer();
    player.play(narration());
    expect(player.getState()).toEqual({ status: 'loading', narrationId: 'n1', output: 'audio' });
    await flush();
    expect(outputs.map((o) => o.arg)).toEqual([INTRO_AUDIO.uri]);

    outputs[0].callbacks.onStarted();
    expect(player.getState().status).toBe('playing');
    outputs[0].callbacks.onFinished();

    expect(outputs.map((o) => o.arg)).toEqual([INTRO_AUDIO.uri, MAIN_AUDIO.uri]);
    expect(player.getState().narrationId).toBe('n1');
    expect(player.getState().status).not.toBe('ended');
    // Never two sounds at once: the intro output is gone before the main one starts.
    expect(events).toEqual([`start:audio:${INTRO_AUDIO.uri}`, `start:audio:${MAIN_AUDIO.uri}`]);
  });

  it('ended fires only after the main part, with one continuous status', async () => {
    const { player, outputs, statuses } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    outputs[0].callbacks.onFinished();
    outputs[1].callbacks.onStarted();
    expect(player.getState().status).toBe('playing');
    outputs[1].callbacks.onFinished();
    expect(player.getState()).toEqual({ status: 'ended', narrationId: 'n1', output: 'audio' });
    // loading -> playing -> ended: no dip, no early ended.
    expect(statuses).toEqual(['loading', 'playing', 'ended']);
  });

  it('the intro and the main part use the right sources: intro text is not spoken when there is main audio', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onFinished();
    expect(outputs.every((o) => o.kind === 'audio')).toBe(true);
  });

  it('pause and resume during the intro control the intro output', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    player.pause();
    expect(outputs[0].pause).toHaveBeenCalledTimes(1);
    expect(player.getState().status).toBe('paused');
    player.resume();
    expect(outputs[0].resume).toHaveBeenCalledTimes(1);
    expect(player.getState().status).toBe('playing');
    expect(outputs).toHaveLength(1);
  });

  it('pause and resume after the intro control the main output', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    outputs[0].callbacks.onFinished();
    outputs[1].callbacks.onStarted();
    player.pause();
    expect(outputs[1].pause).toHaveBeenCalledTimes(1);
    expect(outputs[0].pause).not.toHaveBeenCalled();
  });

  it('the intro ending while paused does not start the main part until resume', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    player.pause();
    outputs[0].callbacks.onFinished(); // raced with the pause
    expect(outputs).toHaveLength(1);
    expect(player.getState().status).toBe('paused');
    player.resume();
    expect(outputs.map((o) => o.arg)).toEqual([INTRO_AUDIO.uri, MAIN_AUDIO.uri]);
    expect(player.getState().status).toBe('playing');
  });

  it('stop during the intro silences everything: the main part never starts', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    player.stop();
    expect(outputs[0].stopped).toBe(true);
    outputs[0].callbacks.onFinished();
    outputs[0].callbacks.onError();
    await flush();
    expect(outputs).toHaveLength(1);
    expect(player.getState()).toEqual({ status: 'idle', narrationId: null, output: null });
  });

  it('stop before the intro has started prevents any sound', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    player.stop();
    await flush();
    expect(outputs).toHaveLength(0);
  });

  it('a new narration during the intro stops the intro and plays only the new one', async () => {
    const { player, outputs } = setupPlayer();
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    player.play(narration({ id: 'n2', intro: undefined }));
    await flush();
    expect(outputs[0].stopped).toBe(true);
    outputs[0].callbacks.onFinished(); // late
    expect(outputs.map((o) => o.arg)).toEqual([INTRO_AUDIO.uri, MAIN_AUDIO.uri]);
    expect(player.getState().narrationId).toBe('n2');
  });

  describe('intro audio unavailable', () => {
    it('null intro audio with main audio skips the intro', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ intro: { text: 'Coming up on your left.', audio: null } }));
      await flush();
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([['audio', MAIN_AUDIO.uri]]);
    });

    it('failed intro audio skips the intro quietly and plays the main audio (no device-voice fallback)', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration());
      await flush();
      outputs[0].callbacks.onError();
      expect(outputs[0].stopped).toBe(true);
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([
        ['audio', INTRO_AUDIO.uri],
        ['audio', MAIN_AUDIO.uri],
      ]);
      expect(player.getState().status).not.toBe('failed');
    });
  });

  describe('main part on the device voice', () => {
    it('the device speaks the intro text first, then the story', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ audio: null }));
      expect(player.getState().output).toBe('device-voice');
      await flush();
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([['device-voice', 'Coming up on your left.']]);
      outputs[0].callbacks.onStarted();
      outputs[0].callbacks.onFinished();
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([
        ['device-voice', 'Coming up on your left.'],
        ['device-voice', 'A story about the bridge.'],
      ]);
      outputs[1].callbacks.onStarted();
      outputs[1].callbacks.onFinished();
      expect(player.getState().status).toBe('ended');
    });

    it('the device speaks the intro text even when the intro has audio of its own', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ audio: null }));
      await flush();
      expect(outputs[0].kind).toBe('device-voice');
    });

    it('a device voice that fails on the intro still tells the story', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ audio: null }));
      await flush();
      outputs[0].callbacks.onError();
      expect(outputs[1]).toMatchObject({ kind: 'device-voice', arg: 'A story about the bridge.' });
      expect(player.getState().status).not.toBe('failed');
    });

    it('an empty intro text is not spoken', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ audio: null, intro: { text: '', audio: null } }));
      await flush();
      expect(outputs.map((o) => o.arg)).toEqual(['A story about the bridge.']);
    });
  });

  describe('main audio failure after the intro', () => {
    it('falls back to the device voice for the story only (the intro is not repeated)', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration());
      await flush();
      outputs[0].callbacks.onStarted();
      outputs[0].callbacks.onFinished();
      outputs[1].callbacks.onError();
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([
        ['audio', INTRO_AUDIO.uri],
        ['audio', MAIN_AUDIO.uri],
        ['device-voice', 'A story about the bridge.'],
      ]);
      outputs[2].callbacks.onStarted();
      outputs[2].callbacks.onFinished();
      expect(player.getState()).toEqual({ status: 'ended', narrationId: 'n1', output: 'device-voice' });
    });

    it('the device voice failing too -> failed', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration());
      await flush();
      outputs[0].callbacks.onFinished();
      outputs[1].callbacks.onError();
      outputs[2].callbacks.onError();
      expect(player.getState().status).toBe('failed');
    });
  });

  describe('no intro behaves as before', () => {
    it('plays only the main audio and ends', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ intro: undefined }));
      await flush();
      expect(outputs.map((o) => o.arg)).toEqual([MAIN_AUDIO.uri]);
      outputs[0].callbacks.onStarted();
      outputs[0].callbacks.onFinished();
      expect(player.getState().status).toBe('ended');
    });

    it('the audio failure still falls back to the device voice', async () => {
      const { player, outputs } = setupPlayer();
      player.play(narration({ intro: undefined }));
      await flush();
      outputs[0].callbacks.onError();
      expect(outputs[1]).toMatchObject({ kind: 'device-voice', arg: 'A story about the bridge.' });
    });
  });
});
